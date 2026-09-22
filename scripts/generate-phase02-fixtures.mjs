import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { RunStore } from "../dist/src/core/store.js";
import { buildRunReceipt, deriveEvidence, renderReceiptMarkdown } from "../dist/src/core/evidence.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "fixtures", "rate-limit-demo");
fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });
const dbPath = path.join(output, "runs.sqlite");
const store = new RunStore(dbPath);
const task = { task_id: "rate-limit-demo", title: "Implement login rate limiting", goal: "Limit login attempts to five per minute and return HTTP 429 after the limit.", constraints: ["Existing auth tests remain green"], allowed_paths: ["src/auth.ts", "tests/auth.test.ts"], acceptance_criteria: ["Maximum five attempts per minute", "HTTP 429 is returned after the limit"], verification_commands: [], workspace: root, model: "fixture-model" };

for (const variant of ["pass", "fail", "unproven"]) {
  const runId = `rate-limit-${variant}`;
  store.saveTask(task);
  store.createRun({ run_id: runId, task_id: task.task_id, started_at: "2026-09-22T10:00:00.000Z", model: task.model, workspace: root });
  store.appendEvent(runId, "run_created", { fixture: variant });
  store.transition(runId, "PREPARING");
  store.updateSnapshots(runId, {
    contextManifest: { workspace: root, generated_at: "2026-09-22T10:00:01.000Z", task_id: task.task_id, files_considered: [], files_included: [], excluded_candidates: [], total_bytes: 0, approximate_tokens: 0 },
    diff: { status_before: "", status_after: "M src/auth.ts", changed_files: ["src/auth.ts"], additions: 3, deletions: 0, unified_diff: "fixture diff" },
    verificationResults: [{ name: "auth tests", category: "test", command: "npm test", exit_code: 0, stdout: "fixture tests passed", stderr: "", duration_ms: 4, status: "PASSED" }],
  });
  store.appendVerification(runId, { name: "auth tests", category: "test", command: "npm test", exit_code: 0, stdout: "fixture tests passed", stderr: "", duration_ms: 4, status: "PASSED" });
  store.transition(runId, "RUNNING");
  store.transition(runId, "VERIFYING");
  store.transition(runId, "COMPLETED", { finishedAt: "2026-09-22T10:00:02.000Z" });
  const run = store.getRun(runId);
  const evidence = deriveEvidence(run, store.getEvents(runId).length, store.getToolCalls(runId).length);
  const testEvidence = evidence.find((item) => item.type === "TEST_EVIDENCE");
  const acceptance = variant === "unproven" ? undefined : [
    { criterion_id: "AC-01", description: task.acceptance_criteria[0], required: true, status: variant === "fail" ? "FAIL" : "PASS", evidence_ids: [testEvidence.evidence_id], reason: variant === "fail" ? "External assertion contradicts the limit." : "Recorded auth tests cover the limit." },
    { criterion_id: "AC-02", description: task.acceptance_criteria[1], required: true, status: "PASS", evidence_ids: [testEvidence.evidence_id], reason: "Recorded auth tests cover the response." },
  ];
  const receipt = buildRunReceipt(store, runId, { evidence, acceptance, generatedAt: "2026-09-22T10:00:03.000Z" });
  const dir = path.join(output, variant);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "raw-evidence.json"), `${JSON.stringify({ evidence, acceptance: receipt.acceptance }, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, "run-receipt.json"), `${JSON.stringify(receipt, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, "run-receipt.md"), renderReceiptMarkdown(receipt));
}
store.close();
console.log(`Generated PASS, FAIL, and UNPROVEN receipts under ${output}`);
