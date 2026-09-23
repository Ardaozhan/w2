import { createHash } from "node:crypto";
import { z } from "zod";
import type { RunStore } from "./store.js";
import { parseTask } from "./task.js";
import { RUN_OUTCOMES, type RunOutcome } from "./outcomes.js";
import {
  ACCEPTANCE_STATUSES,
  EVIDENCE_TYPES,
  type AcceptanceCriterionResult,
  type AcceptanceStatus,
  type ContextManifest,
  type DiffCapture,
  type EvidenceRecord,
  type EvidenceType,
  type RunReceipt,
  type RunRecord,
  type TaskDefinition,
  type VerificationResult,
} from "./types.js";

const evidenceSchema = z.object({
  evidence_id: z.string().min(1),
  run_id: z.string().min(1),
  type: z.enum(EVIDENCE_TYPES),
  source: z.string().min(1),
  summary: z.string().min(1),
  raw_reference: z.string().min(1),
  confidence_class: z.enum(["DETERMINISTIC", "INTERPRETED"]),
  created_at: z.string().datetime(),
  data: z.unknown().optional(),
});

const mappingSchema = z.object({
  criterion_id: z.string().min(1),
  description: z.string().min(1),
  required: z.boolean(),
  status: z.enum(ACCEPTANCE_STATUSES),
  evidence_ids: z.array(z.string().min(1)),
  reason: z.string().min(1),
});

const receiptSchema = z.object({
  receipt_version: z.literal("1.0"), run_id: z.string().min(1), task: z.unknown(), agent: z.unknown(),
  context: z.unknown(), actions: z.unknown(), changes: z.unknown(), verification: z.unknown(),
  evidence: z.array(evidenceSchema), acceptance: z.array(mappingSchema), outcome: z.enum(RUN_OUTCOMES), generated_at: z.string().datetime(),
});

export type EvidenceMapping = z.infer<typeof mappingSchema>;

export function computeCriterionEvidenceCoverage(acceptance: AcceptanceCriterionResult[], evidence: EvidenceRecord[]): number {
  const required = acceptance.filter((item) => item.required);
  if (required.length === 0) return 0;
  const valid = new Set(evidence.filter((item) => {
    if (item.confidence_class !== "DETERMINISTIC") return false;
    const verificationType = ["TEST_EVIDENCE", "LINT_EVIDENCE", "TYPECHECK_EVIDENCE", "BUILD_EVIDENCE"].includes(item.type);
    const verifierAssertion = item.type === "ASSERTION_EVIDENCE" && item.raw_reference.includes(":verification:");
    if (!verificationType && !verifierAssertion) return false;
    const status = (item.data as { status?: unknown } | undefined)?.status;
    return status === "PASSED" || status === "FAILED";
  }).map((item) => item.evidence_id));
  return required.filter((item) => item.evidence_ids.some((id) => valid.has(id))).length / required.length;
}

function idFor(runId: string, kind: string, reference: string): string {
  return `ev_${createHash("sha256").update(`${runId}|${kind}|${reference}`).digest("hex").slice(0, 20)}`;
}

function verificationEvidenceType(result: VerificationResult): EvidenceType {
  return result.category === "test" ? "TEST_EVIDENCE" : result.category === "lint" ? "LINT_EVIDENCE" : result.category === "typecheck" ? "TYPECHECK_EVIDENCE" : result.category === "build" ? "BUILD_EVIDENCE" : "ASSERTION_EVIDENCE";
}

function contextEvidence(run: RunRecord, context: ContextManifest): EvidenceRecord[] {
  const reference = `run:${run.run_id}:context`;
  return [{
    evidence_id: idFor(run.run_id, "context", reference), run_id: run.run_id, type: "CONTEXT_EVIDENCE",
    source: "sqlite:runs.context_manifest", summary: `${context.files_included.length} files supplied from ${context.files_considered.length} considered`,
    raw_reference: reference, confidence_class: "DETERMINISTIC", created_at: context.generated_at,
    data: { files_considered: context.files_considered.length, files_included: context.files_included.length, approximate_tokens: context.approximate_tokens },
  }];
}

export function deriveEvidence(run: RunRecord, events: number, toolCalls: number): EvidenceRecord[] {
  const items: EvidenceRecord[] = [];
  if (run.context_manifest) items.push(...contextEvidence(run, run.context_manifest));
  for (const [index, call] of run.tool_events.entries()) {
    const reference = `run:${run.run_id}:tool:${index}`;
    items.push({ evidence_id: idFor(run.run_id, "tool", reference), run_id: run.run_id, type: "TOOL_EVIDENCE", source: "sqlite:tool_calls", summary: `${call.tool_name} executed`, raw_reference: reference, confidence_class: "DETERMINISTIC", created_at: call.finished_at, data: { tool_name: call.tool_name, input: call.input, result: call.result, error: call.error } });
  }
  if (run.diff) {
    const reference = `run:${run.run_id}:diff`;
    items.push({ evidence_id: idFor(run.run_id, "diff", reference), run_id: run.run_id, type: "DIFF_EVIDENCE", source: "sqlite:runs.diff", summary: `${run.diff.changed_files.length} files changed (+${run.diff.additions}/-${run.diff.deletions})`, raw_reference: reference, confidence_class: "DETERMINISTIC", created_at: run.finished_at ?? run.started_at, data: run.diff });
  }
  for (const [index, result] of run.verification_results.entries()) {
    const type = verificationEvidenceType(result);
    const reference = `run:${run.run_id}:verification:${index}`;
    items.push({ evidence_id: idFor(run.run_id, `verification:${index}`, reference), run_id: run.run_id, type, source: "sqlite:verification_results", summary: `${result.name}: ${result.status}`, raw_reference: reference, confidence_class: "DETERMINISTIC", created_at: run.finished_at ?? run.started_at, data: result });
  }
  const eventReference = `run:${run.run_id}:events`;
  items.push({ evidence_id: idFor(run.run_id, "events", eventReference), run_id: run.run_id, type: "ASSERTION_EVIDENCE", source: "sqlite:events", summary: `${events} ordered events and ${toolCalls} persisted tool calls`, raw_reference: eventReference, confidence_class: "DETERMINISTIC", created_at: run.finished_at ?? run.started_at, data: { events, tool_calls: toolCalls } });
  return items;
}

export function parseEvidence(value: unknown): EvidenceRecord {
  return evidenceSchema.parse(value);
}

export function parseEvidenceMappings(value: unknown): EvidenceMapping[] {
  return z.array(mappingSchema).parse(value);
}

function criterionDefinitions(task: TaskDefinition): Array<{ id: string; description: string; required: boolean; verificationRefs: string[] }> {
  return task.acceptance_criteria.map((criterion) => ({ id: criterion.id, description: criterion.statement, required: criterion.required, verificationRefs: criterion.verification_refs }));
}

function isVerifierEvidence(item: EvidenceRecord, verifierId: string): boolean {
  if (item.confidence_class !== "DETERMINISTIC") return false;
  if (!(item.type === "TEST_EVIDENCE" || item.type === "LINT_EVIDENCE" || item.type === "TYPECHECK_EVIDENCE" || item.type === "BUILD_EVIDENCE" || item.type === "ASSERTION_EVIDENCE")) return false;
  if (!item.raw_reference.includes(":verification:")) return false;
  const data = item.data as { verifier_id?: unknown; status?: unknown } | undefined;
  return data?.verifier_id === verifierId && (data.status === "PASSED" || data.status === "FAILED");
}

export function mapAcceptanceCriteria(task: TaskDefinition, evidence: EvidenceRecord[]): AcceptanceCriterionResult[] {
  const definitions = criterionDefinitions(task);
  return definitions.map((definition) => {
    const mapped = definition.verificationRefs.flatMap((verifierId) => evidence.filter((item) => isVerifierEvidence(item, verifierId)));
    const failed = mapped.some((item) => (item.data as { status?: string }).status === "FAILED");
    const allPassed = definition.verificationRefs.length > 0 && definition.verificationRefs.every((verifierId) => evidence.some((item) => isVerifierEvidence(item, verifierId) && (item.data as { status?: string }).status === "PASSED"));
    const status: AcceptanceStatus = failed ? "FAIL" : allPassed ? "PASS" : "UNPROVEN";
    const evidenceIds = status === "UNPROVEN" ? [] : [...new Set(mapped.map((item) => item.evidence_id))];
    const reason = failed
      ? "A referenced deterministic verifier failed."
      : allPassed
        ? "Every referenced verifier passed with deterministic evidence."
        : definition.verificationRefs.length === 0
          ? "No verifier is mapped to this criterion."
          : "One or more referenced verifiers lack successful deterministic evidence.";
    return { criterion_id: definition.id, description: definition.description, required: definition.required, status, evidence_ids: evidenceIds, reason };
  });
}

export function computeOutcome(input: { runStatus: RunRecord["status"]; acceptance: AcceptanceCriterionResult[] }): RunOutcome {
  if (input.runStatus === "ERROR") return "ERROR";
  if (input.runStatus === "ABORTED") return "ABORTED";
  if (input.acceptance.some((criterion) => criterion.required && criterion.status === "FAIL")) return "FAIL";
  if (input.acceptance.some((criterion) => criterion.required && criterion.status === "UNPROVEN")) return "UNPROVEN";
  if (input.runStatus === "FAILED") return "FAIL";
  return input.acceptance.length > 0 ? "PASS" : "UNPROVEN";
}

export function validateReceipt(receipt: RunReceipt): RunReceipt {
  receiptSchema.parse(receipt);
  const task = parseTask(receipt.task);
  if (receipt.evidence.some((item) => item.run_id !== receipt.run_id)) throw new Error("Receipt contains evidence for another run");
  const ids = new Set(receipt.evidence.map((item) => item.evidence_id));
  if (ids.size !== receipt.evidence.length) throw new Error("Receipt contains duplicate evidence IDs");
  const evidenceById = new Map(receipt.evidence.map((item) => [item.evidence_id, item]));
  const assertReferences = (references: string[], allowed: EvidenceType[], label: string) => {
    for (const id of references) {
      const item = evidenceById.get(id);
      if (!item || !allowed.includes(item.type)) throw new Error(`Receipt has invalid ${label} evidence reference: ${id}`);
    }
  };
  assertReferences(receipt.context.evidence_ids, ["CONTEXT_EVIDENCE"], "context");
  assertReferences(receipt.actions.evidence_ids, ["TOOL_EVIDENCE", "ASSERTION_EVIDENCE"], "action");
  assertReferences(receipt.changes.evidence_ids, ["DIFF_EVIDENCE"], "diff");
  assertReferences(receipt.verification.evidence_ids, ["TEST_EVIDENCE", "LINT_EVIDENCE", "TYPECHECK_EVIDENCE", "BUILD_EVIDENCE", "ASSERTION_EVIDENCE"], "verification");
  for (const id of receipt.changes.evidence_ids) {
    const diff = evidenceById.get(id)?.data as DiffCapture | undefined;
    if (!diff || JSON.stringify(diff.changed_files) !== JSON.stringify(receipt.changes.changed_files) || diff.additions !== receipt.changes.additions || diff.deletions !== receipt.changes.deletions) throw new Error("Receipt diff does not match its evidence");
  }
  for (const id of receipt.verification.evidence_ids) {
    const item = evidenceById.get(id)!;
    if (!item.raw_reference.includes(":verification:") || !receipt.verification.results.some((result) => JSON.stringify(result) === JSON.stringify(item.data))) throw new Error(`Receipt has invalid verification evidence reference: ${id}`);
  }
  const verifierCommands = new Map(task.verification_commands.map((command) => [command.id, command]));
  const seenVerifierResults = new Set<string>();
  const canonicalVerifierEvidenceIds: string[] = [];
  for (const [index, result] of receipt.verification.results.entries()) {
    if (seenVerifierResults.has(result.verifier_id)) throw new Error(`Receipt contains duplicate verifier results: ${result.verifier_id}`);
    seenVerifierResults.add(result.verifier_id);
    const command = verifierCommands.get(result.verifier_id);
    if (!command || command.name !== result.name || command.command !== result.command || command.category !== result.category) throw new Error(`Receipt verifier result does not match its task contract: ${result.verifier_id}`);
    const reference = `run:${receipt.run_id}:verification:${index}`;
    const evidenceId = idFor(receipt.run_id, `verification:${index}`, reference);
    const item = evidenceById.get(evidenceId);
    if (!item || item.raw_reference !== reference || item.source !== "sqlite:verification_results" || item.confidence_class !== "DETERMINISTIC" || item.type !== verificationEvidenceType(result) || JSON.stringify(item.data) !== JSON.stringify(result)) throw new Error(`Receipt verifier result lacks canonical deterministic evidence: ${result.verifier_id}`);
    canonicalVerifierEvidenceIds.push(evidenceId);
  }
  const listedVerifierEvidenceIds = [...receipt.verification.evidence_ids].sort();
  if (JSON.stringify(listedVerifierEvidenceIds) !== JSON.stringify([...canonicalVerifierEvidenceIds].sort())) throw new Error("Receipt verification references do not match canonical verifier results");
  const verifierEvidenceIds = new Set(canonicalVerifierEvidenceIds);
  for (const criterion of receipt.acceptance) {
    for (const evidenceId of criterion.evidence_ids) {
      if (!ids.has(evidenceId)) throw new Error(`Receipt references unknown evidence: ${evidenceId}`);
      if (!verifierEvidenceIds.has(evidenceId)) throw new Error(`Criterion ${criterion.criterion_id} references evidence outside canonical verifier results: ${evidenceId}`);
    }
    if (["PASS", "FAIL"].includes(criterion.status) && criterion.evidence_ids.length === 0) throw new Error(`Criterion ${criterion.criterion_id} has ${criterion.status} without evidence`);
  }
  const expectedAcceptance = mapAcceptanceCriteria(task, receipt.evidence.filter((item) => verifierEvidenceIds.has(item.evidence_id)));
  if (JSON.stringify(expectedAcceptance) !== JSON.stringify(receipt.acceptance)) throw new Error("Receipt acceptance mapping does not match deterministic verifier evidence");
  const expected = computeOutcome({ runStatus: receipt.agent.status, acceptance: receipt.acceptance });
  if (expected !== receipt.outcome) throw new Error(`Receipt outcome mismatch: expected ${expected}, got ${receipt.outcome}`);
  return receipt;
}

export interface ReceiptOptions {
  generatedAt?: string;
}

export function buildRunReceipt(store: RunStore, runId: string, options: ReceiptOptions = {}): RunReceipt {
  const run = store.getRun(runId);
  if (!run) throw new Error(`Run does not exist: ${runId}`);
  const storedTask = store.getTask(run.task_id);
  if (!storedTask) throw new Error(`Task does not exist: ${run.task_id}`);
  const task = parseTask(storedTask);
  const events = store.getEvents(runId);
  const derived = deriveEvidence(run, events.length, store.getToolCalls(runId).length);
  const safetyEvents = events.filter((event) => ["safety_denied", "approval_requested", "approval_resolved", "budget_exhausted", "run_checkpointed", "run_resumed", "run_aborted"].includes(event.type));
  if (safetyEvents.length > 0 && !derived.some((item) => item.raw_reference === `run:${runId}:safety`)) {
    derived.push({ evidence_id: idFor(runId, "safety", `run:${runId}:safety`), run_id: runId, type: "ASSERTION_EVIDENCE", source: "sqlite:events", summary: `${safetyEvents.length} safety and durability events`, raw_reference: `run:${runId}:safety`, confidence_class: "DETERMINISTIC", created_at: safetyEvents[safetyEvents.length - 1].timestamp, data: safetyEvents });
  }
  store.saveEvidence(derived);
  const acceptance = mapAcceptanceCriteria(task, derived);
  store.saveAcceptance(runId, acceptance);
  const context = run.context_manifest;
  const contextIds = derived.filter((item) => item.type === "CONTEXT_EVIDENCE").map((item) => item.evidence_id);
  const actionIds = derived.filter((item) => item.type === "TOOL_EVIDENCE" || item.type === "ASSERTION_EVIDENCE").map((item) => item.evidence_id);
  const changeIds = derived.filter((item) => item.type === "DIFF_EVIDENCE").map((item) => item.evidence_id);
  const verificationIds = derived.filter((item) => ["TEST_EVIDENCE", "LINT_EVIDENCE", "TYPECHECK_EVIDENCE", "BUILD_EVIDENCE"].includes(item.type) || (item.type === "ASSERTION_EVIDENCE" && item.raw_reference.includes(":verification:"))).map((item) => item.evidence_id);
  return validateReceipt({
    receipt_version: "1.0", run_id: runId, task,
    agent: { model: run.model, status: run.status, error: run.error, execution_mode: events.some((event) => (event.payload as { execution_mode?: string })?.execution_mode === "REAL_CODEX") ? "REAL_CODEX" : "FAKE_ADAPTER" },
    context: { files_considered: context?.files_considered.length ?? 0, files_supplied: context?.files_included.length ?? 0, approximate_tokens: context?.approximate_tokens ?? 0, selected_paths: context?.files_included.map((item) => item.path) ?? [], accessed_files: context?.access_observation === "COMPLETE" ? context.accessed_files ?? [] : null, access_observation: context?.access_observation ?? "UNAVAILABLE", evidence_ids: contextIds },
    actions: { events: events.length, tool_calls: store.getToolCalls(runId).length, evidence_ids: actionIds },
    changes: { changed_files: run.diff?.changed_files ?? [], additions: run.diff?.additions ?? 0, deletions: run.diff?.deletions ?? 0, evidence_ids: changeIds },
    verification: { results: run.verification_results, evidence_ids: verificationIds }, evidence: derived, acceptance,
    outcome: computeOutcome({ runStatus: run.status, acceptance }), generated_at: options.generatedAt ?? new Date().toISOString(),
  });
}

export function renderReceiptMarkdown(receipt: RunReceipt): string {
  validateReceipt(receipt);
  const lines = ["# W2 RUN RECEIPT", "", `- Receipt version: ${receipt.receipt_version}`, `- Run: \`${receipt.run_id}\``, `- Execution mode: ${receipt.agent.execution_mode}`, `- Generated: ${receipt.generated_at}`, "", "## Task", `**${receipt.task.title}**`, "", receipt.task.goal, "", "## Context W2 provided", `- ${receipt.context.files_supplied}/${receipt.context.files_considered} files selected for the prompt`, `- ${receipt.context.approximate_tokens} approximate tokens`, "- Exact repository files accessed by Codex: not captured by this adapter", "", "## What the agent did", `- ${receipt.actions.tool_calls} observable tool calls`, `- ${receipt.actions.events} ordered events`, `- ${receipt.changes.changed_files.length} changed files`, "", "## Verification"];
  lines.push(...(receipt.verification.results.length ? receipt.verification.results.map((result) => `- ${result.status === "PASSED" ? "PASS" : "FAIL"} ${result.name} (exit ${result.exit_code ?? "n/a"})`) : ["- UNPROVEN: no verification configured"]));
  lines.push("", "## Acceptance Evidence", ...receipt.acceptance.map((criterion) => "- **" + criterion.status + "** " + criterion.criterion_id + ": " + criterion.description + " - " + criterion.reason), "", "## Outcome", "# " + receipt.outcome, "", "**Why:** " + (receipt.acceptance.find((criterion) => criterion.required && criterion.status !== "PASS")?.reason ?? "All required criteria have valid evidence."), "");
  return lines.join("\n");
}

export { evidenceSchema, mappingSchema, receiptSchema };
