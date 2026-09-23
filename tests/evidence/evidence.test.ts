import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildRunReceipt, computeCriterionEvidenceCoverage, computeOutcome, deriveEvidence, mapAcceptanceCriteria, renderReceiptMarkdown, validateReceipt } from "../../src/core/evidence.js";
import { RunStore } from "../../src/core/store.js";
import { isFalseDone } from "../../src/core/outcomes.js";
import type { ContextManifest, DiffCapture, TaskDefinition, VerificationResult } from "../../src/core/types.js";

function fixture(unmappedSecond = false) {
  const databasePath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "w2-evidence-")), "runs.sqlite");
  const store = new RunStore(databasePath);
  const task: TaskDefinition = {
    task_id: "rate-limit-demo", title: "Implement login rate limiting", goal: "Limit login attempts", constraints: [], allowed_paths: ["."],
    acceptance_criteria: [
      { id: "AC-01", statement: "Maximum five attempts per minute", required: true, verification_refs: ["V1"] },
      { id: "AC-02", statement: "HTTP 429 is returned after the limit", required: true, verification_refs: unmappedSecond ? [] : ["V1"] },
    ],
    verification_commands: [{ id: "V1", name: "tests", category: "test", command: "npm test" }], workspace: process.cwd(), model: "fixture-model",
  };
  const runId = "run-evidence-1";
  store.saveTask(task);
  store.createRun({ run_id: runId, task_id: task.task_id, started_at: "2026-09-22T10:00:00.000Z", model: "fixture-model", workspace: process.cwd() });
  store.appendEvent(runId, "run_created", {});
  store.transition(runId, "PREPARING");
  const context: ContextManifest = { workspace: process.cwd(), generated_at: "2026-09-22T10:00:01.000Z", task_id: task.task_id, files_considered: [], files_included: [], excluded_candidates: [], total_bytes: 0, approximate_tokens: 0 };
  const diff: DiffCapture = { status_before: "", status_after: "M src/auth.ts", changed_files: ["src/auth.ts"], additions: 2, deletions: 1, unified_diff: "diff" };
  const verification: VerificationResult = { verifier_id: "V1", name: "tests", category: "test", command: "npm test", exit_code: 0, stdout: "passed", stderr: "", duration_ms: 3, status: "PASSED" };
  store.updateSnapshots(runId, { contextManifest: context, diff, verificationResults: [verification] });
  store.appendVerification(runId, verification);
  store.transition(runId, "RUNNING");
  store.transition(runId, "VERIFYING");
  store.transition(runId, "COMPLETED", { finishedAt: "2026-09-22T10:00:02.000Z" });
  const run = store.getRun(runId)!;
  return { store, task, run, databasePath };
}

describe("evidence and run receipts", () => {
  it("automatically maps verifier evidence and computes deterministic PASS", () => {
    const { store, task, run } = fixture();
    const evidence = deriveEvidence(run, store.getEvents(run.run_id).length, store.getToolCalls(run.run_id).length);
    const mapping = mapAcceptanceCriteria(task, evidence);
    expect(mapping.map((item) => item.status)).toEqual(["PASS", "PASS"]);
    expect(computeOutcome({ runStatus: run.status, acceptance: mapping })).toBe("PASS");
    const receipt = buildRunReceipt(store, run.run_id);
    expect(receipt.outcome).toBe("PASS");
    expect(receipt.acceptance).toEqual(mapping);
    expect(receipt.verification.evidence_ids).toContain(evidence.find((item) => item.type === "TEST_EVIDENCE")!.evidence_id);
    expect(() => validateReceipt(receipt)).not.toThrow();
    expect(renderReceiptMarkdown(receipt)).toContain("# PASS");
    const falsePass = { ...receipt, acceptance: receipt.acceptance.map((item) => item.criterion_id === "AC-01" ? { ...item, evidence_ids: [evidence.find((candidate) => candidate.type === "DIFF_EVIDENCE")!.evidence_id] } : item) };
    expect(() => validateReceipt(falsePass)).toThrow(/evidence outside canonical verifier results/);
    store.close();
  });

  it("keeps an unmapped criterion UNPROVEN and reports a failed referenced verifier as FAIL", () => {
    const { store, task, run } = fixture(true);
    const evidence = deriveEvidence(run, 1, 0);
    const unproven = mapAcceptanceCriteria(task, evidence);
    expect(unproven.map((criterion) => criterion.status)).toEqual(["PASS", "UNPROVEN"]);
    expect(computeOutcome({ runStatus: run.status, acceptance: unproven })).toBe("UNPROVEN");
    const failedEvidence = evidence.map((item) => item.type === "TEST_EVIDENCE" ? { ...item, data: { ...(item.data as Record<string, unknown>), status: "FAILED" } } : item);
    const failed = mapAcceptanceCriteria(task, failedEvidence);
    expect(failed[0]?.status).toBe("FAIL");
    expect(computeOutcome({ runStatus: run.status, acceptance: failed })).toBe("FAIL");
    store.close();
  });

  it("computes criterion coverage only from attached deterministic verifier evidence", () => {
    const { store, task, run } = fixture(true);
    const evidence = deriveEvidence(run, 1, 0);
    const mappings = mapAcceptanceCriteria(task, evidence);
    expect(computeCriterionEvidenceCoverage(mappings, evidence)).toBe(0.5);
    const verifierEvidence = evidence.find((item) => item.type === "TEST_EVIDENCE")!;
    const interpreted = { ...verifierEvidence, confidence_class: "INTERPRETED" as const };
    expect(computeCriterionEvidenceCoverage([{ ...mappings[0]!, evidence_ids: [interpreted.evidence_id] }], [interpreted])).toBe(0);
    expect(computeCriterionEvidenceCoverage([{ ...mappings[0]!, evidence_ids: ["ev_nonexistent"] }], evidence)).toBe(0);
    const unrelatedDeterministic = evidence.find((item) => item.type === "DIFF_EVIDENCE")!;
    expect(computeCriterionEvidenceCoverage([{ ...mappings[0]!, evidence_ids: [unrelatedDeterministic.evidence_id] }], evidence)).toBe(0);
    const failedVerifier = { ...verifierEvidence, data: { ...(verifierEvidence.data as Record<string, unknown>), status: "FAILED" } };
    expect(computeCriterionEvidenceCoverage([{ ...mappings[0]!, status: "FAIL", evidence_ids: [failedVerifier.evidence_id] }], [failedVerifier])).toBe(1);
    expect(computeCriterionEvidenceCoverage([], evidence)).toBe(0);
    store.close();
  });

  it("counts false DONE only after completion with external FAIL or UNPROVEN", () => {
    expect(isFalseDone({ agentDeclaredCompletion: true, verifierOutcome: "FAIL" })).toBe(true);
    expect(isFalseDone({ agentDeclaredCompletion: true, verifierOutcome: "UNPROVEN" })).toBe(true);
    expect(isFalseDone({ agentDeclaredCompletion: false, verifierOutcome: "FAIL" })).toBe(false);
    expect(isFalseDone({ agentDeclaredCompletion: true, verifierOutcome: "FAIL", infrastructureFailure: true })).toBe(false);
    expect(isFalseDone({ agentDeclaredCompletion: true, verifierOutcome: "PASS" })).toBe(false);
  });

  it("rejects forged evidence, verifier mappings, outcomes, and diff claims", () => {
    const { store, task, run } = fixture(true);
    const receipt = buildRunReceipt(store, run.run_id);
    expect(receipt.outcome).toBe("UNPROVEN");
    expect(() => validateReceipt({ ...receipt, outcome: "PASS" })).toThrow("Receipt outcome mismatch");
    expect(() => validateReceipt({ ...receipt, acceptance: receipt.acceptance.map((item) => item.criterion_id === "AC-01" ? { ...item, evidence_ids: ["ev_missing"] } : item) })).toThrow("Receipt references unknown evidence");
    expect(() => validateReceipt({ ...receipt, task: { ...task, acceptance_criteria: [{ ...task.acceptance_criteria[0]!, verification_refs: ["V99"] }, task.acceptance_criteria[1]] } })).toThrow(/Unknown verifier ID/);
    expect(() => validateReceipt({ ...receipt, acceptance: receipt.acceptance.map((item) => item.criterion_id === "AC-02" ? { ...item, status: "PASS" as const, evidence_ids: [receipt.verification.evidence_ids[0]!] } : item) })).toThrow(/acceptance mapping/);
    const changedDiff = { ...receipt, changes: { ...receipt.changes, changed_files: ["src/forged.ts"] } };
    expect(() => validateReceipt(changedDiff)).toThrow("Receipt diff does not match its evidence");
    const noVerification = { ...receipt, evidence: receipt.evidence.map((item) => item.type === "TEST_EVIDENCE" ? { ...item, confidence_class: "INTERPRETED" as const } : item) };
    expect(() => validateReceipt(noVerification)).toThrow(/canonical deterministic evidence/);
    expect(computeOutcome({ runStatus: "ERROR", acceptance: [] })).toBe("ERROR");
    expect(computeOutcome({ runStatus: "ABORTED", acceptance: [] })).toBe("ABORTED");
    store.close();
  });

  it("rejects fabricated verifier evidence that is not bound to a canonical verifier result", () => {
    const { store, run } = fixture();
    const receipt = buildRunReceipt(store, run.run_id);
    const verified = receipt.evidence.find((item) => item.raw_reference.endsWith(":verification:0"))!;
    const forged = { ...verified, evidence_id: "ev_fabricated_verifier", raw_reference: `run:${run.run_id}:verification:99` };
    const tampered = {
      ...receipt,
      evidence: [...receipt.evidence, forged],
      acceptance: receipt.acceptance.map((criterion) => ({ ...criterion, evidence_ids: [...criterion.evidence_ids, forged.evidence_id] })),
    };
    expect(() => validateReceipt(tampered)).toThrow(/outside canonical verifier results/);
    store.close();
  });

  it("persists generated evidence and acceptance mappings in the SQLite projection", () => {
    const { store, run, databasePath } = fixture();
    const receipt = buildRunReceipt(store, run.run_id);
    expect(receipt.evidence.length).toBeGreaterThan(0);
    expect(store.getEvidence(run.run_id).map((item) => item.evidence_id).sort()).toEqual(receipt.evidence.map((item) => item.evidence_id).sort());
    expect(store.getAcceptance(run.run_id)).toEqual(receipt.acceptance);
    expect(store.getVerificationResults(run.run_id)[0]?.verifier_id).toBe("V1");
    store.close();
    const reopened = new RunStore(databasePath);
    expect(reopened.getEvidence(run.run_id).length).toBe(receipt.evidence.length);
    expect(reopened.getAcceptance(run.run_id)).toEqual(receipt.acceptance);
    reopened.close();
  });

  it("keeps receipt timestamps valid and ordered", () => {
    const { store, run } = fixture();
    const receipt = buildRunReceipt(store, run.run_id, { generatedAt: "2026-09-22T10:00:03.000Z" });
    expect(Date.parse(receipt.generated_at)).toBeGreaterThanOrEqual(Date.parse(run.started_at));
    expect(receipt.evidence.every((item) => Date.parse(item.created_at) >= Date.parse(run.started_at))).toBe(true);
    store.close();
  });
});
