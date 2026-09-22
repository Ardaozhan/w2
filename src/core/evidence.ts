import { createHash } from "node:crypto";
import { z } from "zod";
import type { RunStore } from "./store.js";
import { RUN_OUTCOMES, type RunOutcome } from "./outcomes.js";
import {
  ACCEPTANCE_STATUSES,
  EVIDENCE_TYPES,
  type AcceptanceCriterionResult,
  type AcceptanceStatus,
  type ContextManifest,
  type EvidenceRecord,
  type EvidenceType,
  type RunReceipt,
  type RunRecord,
  type TaskDefinition,
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

function idFor(runId: string, kind: string, reference: string): string {
  return `ev_${createHash("sha256").update(`${runId}|${kind}|${reference}`).digest("hex").slice(0, 20)}`;
}

function criterionId(index: number): string {
  return `AC-${String(index + 1).padStart(2, "0")}`;
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
    const type: EvidenceType = result.category === "test" ? "TEST_EVIDENCE" : result.category === "lint" ? "LINT_EVIDENCE" : result.category === "typecheck" ? "TYPECHECK_EVIDENCE" : result.category === "build" ? "BUILD_EVIDENCE" : "ASSERTION_EVIDENCE";
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

function criterionDefinitions(task: TaskDefinition): Array<{ id: string; description: string; required: boolean }> {
  return task.acceptance_criteria.map((description, index) => ({ id: criterionId(index), description, required: true }));
}

export function mapAcceptanceCriteria(task: TaskDefinition, evidence: EvidenceRecord[], supplied: EvidenceMapping[] = []): AcceptanceCriterionResult[] {
  const knownEvidence = new Set(evidence.map((item) => item.evidence_id));
  const byId = new Map(supplied.map((item) => [item.criterion_id, item]));
  const definitions = criterionDefinitions(task);
  for (const item of supplied) {
    if (!definitions.some((criterion) => criterion.id === item.criterion_id)) throw new Error(`Unknown acceptance criterion: ${item.criterion_id}`);
    for (const evidenceId of item.evidence_ids) if (!knownEvidence.has(evidenceId)) throw new Error(`Unknown evidence ID: ${evidenceId}`);
  }
  return definitions.map((definition) => {
    const item = byId.get(definition.id);
    if (!item || item.evidence_ids.length === 0) return { criterion_id: definition.id, description: definition.description, required: definition.required, status: "UNPROVEN", evidence_ids: [], reason: item?.reason ?? "No evidence was mapped to this required criterion." };
    return { criterion_id: definition.id, description: definition.description, required: definition.required, status: item.status, evidence_ids: item.evidence_ids, reason: item.reason };
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
  if (receipt.evidence.some((item) => item.run_id !== receipt.run_id)) throw new Error("Receipt contains evidence for another run");
  const ids = new Set(receipt.evidence.map((item) => item.evidence_id));
  for (const criterion of receipt.acceptance) {
    for (const evidenceId of criterion.evidence_ids) if (!ids.has(evidenceId)) throw new Error(`Receipt references unknown evidence: ${evidenceId}`);
    if (["PASS", "FAIL"].includes(criterion.status) && criterion.evidence_ids.length === 0) throw new Error(`Criterion ${criterion.criterion_id} has ${criterion.status} without evidence`);
  }
  const expected = computeOutcome({ runStatus: receipt.agent.status, acceptance: receipt.acceptance });
  if (expected !== receipt.outcome) throw new Error(`Receipt outcome mismatch: expected ${expected}, got ${receipt.outcome}`);
  return receipt;
}

export interface ReceiptOptions {
  evidence?: EvidenceRecord[];
  acceptance?: EvidenceMapping[];
  generatedAt?: string;
}

export function buildRunReceipt(store: RunStore, runId: string, options: ReceiptOptions = {}): RunReceipt {
  const run = store.getRun(runId);
  if (!run) throw new Error(`Run does not exist: ${runId}`);
  const task = store.getTask(run.task_id);
  if (!task) throw new Error(`Task does not exist: ${run.task_id}`);
  const derived = options.evidence?.map(parseEvidence) ?? deriveEvidence(run, store.getEvents(runId).length, store.getToolCalls(runId).length);
  store.saveEvidence(derived);
  const supplied = options.acceptance ? parseEvidenceMappings(options.acceptance) : [];
  const existing = store.getAcceptance(runId);
  const acceptance = existing.length > 0 && !options.acceptance ? existing : mapAcceptanceCriteria(task, derived, supplied);
  store.saveAcceptance(runId, acceptance);
  const context = run.context_manifest;
  const contextIds = derived.filter((item) => item.type === "CONTEXT_EVIDENCE").map((item) => item.evidence_id);
  const actionIds = derived.filter((item) => item.type === "TOOL_EVIDENCE" || item.type === "ASSERTION_EVIDENCE").map((item) => item.evidence_id);
  const changeIds = derived.filter((item) => item.type === "DIFF_EVIDENCE").map((item) => item.evidence_id);
  const verificationIds = derived.filter((item) => item.type.endsWith("_EVIDENCE") && ["TEST_EVIDENCE", "LINT_EVIDENCE", "TYPECHECK_EVIDENCE", "BUILD_EVIDENCE"].includes(item.type)).map((item) => item.evidence_id);
  return validateReceipt({
    receipt_version: "1.0", run_id: runId, task,
    agent: { model: run.model, status: run.status, error: run.error },
    context: { files_considered: context?.files_considered.length ?? 0, files_supplied: context?.files_included.length ?? 0, approximate_tokens: context?.approximate_tokens ?? 0, evidence_ids: contextIds },
    actions: { events: store.getEvents(runId).length, tool_calls: store.getToolCalls(runId).length, evidence_ids: actionIds },
    changes: { changed_files: run.diff?.changed_files ?? [], additions: run.diff?.additions ?? 0, deletions: run.diff?.deletions ?? 0, evidence_ids: changeIds },
    verification: { results: run.verification_results, evidence_ids: verificationIds }, evidence: derived, acceptance,
    outcome: computeOutcome({ runStatus: run.status, acceptance }), generated_at: options.generatedAt ?? new Date().toISOString(),
  });
}

export function renderReceiptMarkdown(receipt: RunReceipt): string {
  validateReceipt(receipt);
  const lines = ["# W2 RUN RECEIPT", "", `- Receipt version: ${receipt.receipt_version}`, `- Run: \`${receipt.run_id}\``, `- Generated: ${receipt.generated_at}`, "", "## Task", `**${receipt.task.title}**`, "", receipt.task.goal, "", "## What the agent saw", `- ${receipt.context.files_supplied}/${receipt.context.files_considered} files supplied`, `- ${receipt.context.approximate_tokens} approximate tokens`, "", "## What the agent did", `- ${receipt.actions.tool_calls} tool calls`, `- ${receipt.actions.events} ordered events`, `- ${receipt.changes.changed_files.length} changed files`, "", "## Verification"];
  lines.push(...(receipt.verification.results.length ? receipt.verification.results.map((result) => `- ${result.status === "PASSED" ? "PASS" : "FAIL"} ${result.name} (exit ${result.exit_code ?? "n/a"})`) : ["- UNPROVEN: no verification configured"]));
  lines.push("", "## Acceptance Evidence", ...receipt.acceptance.map((criterion) => `- **${criterion.status}** ${criterion.criterion_id}: ${criterion.description} — ${criterion.reason}`), "", "## Outcome", `# ${receipt.outcome}`, "", `**Why:** ${receipt.acceptance.find((criterion) => criterion.required && criterion.status !== "PASS")?.reason ?? "All required criteria have valid evidence."}`, "");
  return lines.join("\n");
}

export { evidenceSchema, mappingSchema, receiptSchema };
