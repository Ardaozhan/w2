import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildRunReceipt, computeCriterionEvidenceCoverage, computeOutcome, deriveEvidence, mapAcceptanceCriteria, renderReceiptMarkdown, validateReceipt } from "../../src/core/evidence.js";
import { RunStore } from "../../src/core/store.js";
import { isFalseDone } from "../../src/core/outcomes.js";
import type { AcceptanceCriterionResult, ContextManifest, DiffCapture, TaskDefinition, VerificationResult } from "../../src/core/types.js";

function fixture() {
  const databasePath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "w2-evidence-")), "runs.sqlite");
  const store = new RunStore(databasePath);
  const task: TaskDefinition = {
    task_id: "rate-limit-demo", title: "Implement login rate limiting", goal: "Limit login attempts", constraints: [], allowed_paths: ["."], acceptance_criteria: ["Maximum five attempts per minute", "HTTP 429 is returned after the limit"], verification_commands: [], workspace: process.cwd(), model: "fixture-model",
  };
  const runId = "run-evidence-1";
  store.saveTask(task);
  store.createRun({ run_id: runId, task_id: task.task_id, started_at: "2026-09-22T10:00:00.000Z", model: "fixture-model", workspace: process.cwd() });
  store.appendEvent(runId, "run_created", {});
  store.transition(runId, "PREPARING");
  const context: ContextManifest = { workspace: process.cwd(), generated_at: "2026-09-22T10:00:01.000Z", task_id: task.task_id, files_considered: [], files_included: [], excluded_candidates: [], total_bytes: 0, approximate_tokens: 0 };
  const diff: DiffCapture = { status_before: "", status_after: "M src/auth.ts", changed_files: ["src/auth.ts"], additions: 2, deletions: 1, unified_diff: "diff" };
  const verification: VerificationResult = { name: "tests", category: "test", command: "npm test", exit_code: 0, stdout: "passed", stderr: "", duration_ms: 3, status: "PASSED" };
  store.updateSnapshots(runId, { contextManifest: context, diff, verificationResults: [verification] });
  store.appendVerification(runId, verification);
  store.transition(runId, "RUNNING");
  store.transition(runId, "VERIFYING");
  store.transition(runId, "COMPLETED", { finishedAt: "2026-09-22T10:00:02.000Z" });
  const run = store.getRun(runId)!;
  return { store, task, run, databasePath };
}

describe("evidence and run receipts", () => {
  it("maps only known evidence and computes a deterministic PASS", () => {
    const { store, task, run } = fixture();
    const evidence = deriveEvidence(run, store.getEvents(run.run_id).length, store.getToolCalls(run.run_id).length);
    const mapping = mapAcceptanceCriteria(task, evidence, [
      { criterion_id: "AC-01", description: task.acceptance_criteria[0], required: true, status: "PASS", evidence_ids: [evidence.find((item) => item.type === "TEST_EVIDENCE")!.evidence_id], reason: "The recorded test exited zero." },
      { criterion_id: "AC-02", description: task.acceptance_criteria[1], required: true, status: "PASS", evidence_ids: [evidence.find((item) => item.type === "TEST_EVIDENCE")!.evidence_id], reason: "The recorded test exited zero." },
    ]);
    expect(computeOutcome({ runStatus: run.status, acceptance: mapping })).toBe("PASS");
    const receipt = buildRunReceipt(store, run.run_id, { evidence, acceptance: mapping });
    expect(receipt.outcome).toBe("PASS");
    expect(receipt.verification.evidence_ids).toContain(evidence.find((item) => item.type === "TEST_EVIDENCE")!.evidence_id);
    expect(() => validateReceipt(receipt)).not.toThrow();
    expect(renderReceiptMarkdown(receipt)).toContain("# PASS");
    const falsePass = { ...receipt, acceptance: receipt.acceptance.map((item) => item.criterion_id === "AC-01" ? { ...item, evidence_ids: [evidence[0].evidence_id] } : item) };
    expect(() => validateReceipt(falsePass)).toThrow("successful deterministic verification evidence");
    store.close();
  });

  it("keeps missing evidence UNPROVEN and exposes deterministic FAIL", () => {
    const { store, task, run } = fixture();
    const evidence = deriveEvidence(run, 1, 0);
    const unproven = mapAcceptanceCriteria(task, evidence);
    expect(unproven.every((criterion) => criterion.status === "UNPROVEN")).toBe(true);
    expect(computeOutcome({ runStatus: run.status, acceptance: unproven })).toBe("UNPROVEN");
    const failed: AcceptanceCriterionResult[] = unproven.map((criterion, index) => index === 0 ? { ...criterion, status: "FAIL", evidence_ids: [evidence[0].evidence_id], reason: "Deterministic assertion contradicts the criterion." } : criterion);
    expect(computeOutcome({ runStatus: run.status, acceptance: failed })).toBe("FAIL");
    expect(() => mapAcceptanceCriteria(task, evidence, [{ criterion_id: "AC-01", description: "x", required: true, status: "PASS", evidence_ids: ["ev_missing"], reason: "bad" }])).toThrow("Unknown evidence ID");
    store.close();
  });

  it("computes criterion coverage only from attached deterministic evidence", () => {
    const { store, task, run } = fixture();
    const evidence = deriveEvidence(run, 1, 0);
    const mappings = mapAcceptanceCriteria(task, evidence, [
      { criterion_id: "AC-01", description: "first", required: true, status: "PASS", evidence_ids: [evidence[0].evidence_id], reason: "attached" },
      { criterion_id: "AC-02", description: "second", required: true, status: "UNPROVEN", evidence_ids: [], reason: "none" },
    ]);
    expect(computeCriterionEvidenceCoverage(mappings, evidence)).toBe(0.5);
    const interpreted = { ...evidence[0], confidence_class: "INTERPRETED" as const };
    expect(computeCriterionEvidenceCoverage([{ ...mappings[0], evidence_ids: [interpreted.evidence_id] }], [interpreted])).toBe(0);
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

  it("rejects receipt tampering and protects ERROR/ABORTED outcomes", () => {
    const { store, run } = fixture();
    const evidence = deriveEvidence(run, 1, 0);
    const receipt = buildRunReceipt(store, run.run_id, { evidence });
    const tampered = { ...receipt, outcome: "PASS" as const };
    expect(() => validateReceipt(tampered)).toThrow("Receipt outcome mismatch");
    expect(computeOutcome({ runStatus: "ERROR", acceptance: [] })).toBe("ERROR");
    expect(computeOutcome({ runStatus: "ABORTED", acceptance: [] })).toBe("ABORTED");
    store.close();
  });

  it("persists evidence and acceptance mappings in the SQLite projection", () => {
    const { store, run, databasePath } = fixture();
    const receipt = buildRunReceipt(store, run.run_id);
    expect(receipt.evidence.length).toBeGreaterThan(0);
    expect(store.getEvidence(run.run_id).map((item) => item.evidence_id).sort()).toEqual(receipt.evidence.map((item) => item.evidence_id).sort());
    expect(store.getAcceptance(run.run_id)).toEqual(receipt.acceptance);
    store.close();
    const reopened = new RunStore(databasePath);
    expect(reopened.getEvidence(run.run_id).length).toBe(receipt.evidence.length);
    expect(reopened.getAcceptance(run.run_id)).toEqual(receipt.acceptance);
    reopened.close();
  });

  it("ADV-TIME-BOUNDARY keeps receipt timestamps valid and ordered", () => {
    const { store, run } = fixture();
    const receipt = buildRunReceipt(store, run.run_id, { generatedAt: "2026-09-22T10:00:03.000Z" });
    expect(Date.parse(receipt.generated_at)).toBeGreaterThanOrEqual(Date.parse(run.started_at));
    expect(receipt.evidence.every((item) => Date.parse(item.created_at) >= Date.parse(run.started_at))).toBe(true);
    store.close();
  });
});
