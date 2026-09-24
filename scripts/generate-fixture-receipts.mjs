import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { RunStore } from "../dist/src/core/store.js";
import { buildRunReceipt, renderReceiptMarkdown } from "../dist/src/core/evidence.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "fixtures", "rate-limit-demo");
fs.mkdirSync(output, { recursive: true });
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "w2-fixture-receipts-"));
const dbPath = path.join(temporary, "runs.sqlite");
const store = new RunStore(dbPath);
const commands = [
  { id: "per-client-rate-limit", name: "per-client-rate-limit", command: "node verify-rate-limit.mjs", category: "test" },
  { id: "sixth-attempt-http-429", name: "sixth-attempt-http-429", command: "node verify-http-429.mjs", category: "test" },
];
const baseTask = { task_id: "rate-limit-demo", title: "Implement login rate limiting", goal: "Limit login attempts to five per minute and return HTTP 429 after the limit.", constraints: ["Existing auth tests remain green"], allowed_paths: ["src/auth.ts", "tests/auth.test.ts"], verification_commands: commands, workspace: "<WORKSPACE>", model: "fixture-model" };
const results = {
  pass: [
    { verifier_id: commands[0].id, name: commands[0].name, category: "test", command: commands[0].command, exit_code: 0, stdout: "fixture verifier: PASS", stderr: "", duration_ms: 4, status: "PASSED" },
    { verifier_id: commands[1].id, name: commands[1].name, category: "test", command: commands[1].command, exit_code: 0, stdout: "fixture verifier: PASS", stderr: "", duration_ms: 4, status: "PASSED" },
  ],
  fail: [
    { verifier_id: commands[0].id, name: commands[0].name, category: "test", command: commands[0].command, exit_code: 1, stdout: "fixture verifier: FAIL", stderr: "", duration_ms: 4, status: "FAILED" },
    { verifier_id: commands[1].id, name: commands[1].name, category: "test", command: commands[1].command, exit_code: 0, stdout: "fixture verifier: PASS", stderr: "", duration_ms: 4, status: "PASSED" },
  ],
  unproven: [
    { verifier_id: commands[0].id, name: commands[0].name, category: "test", command: commands[0].command, exit_code: 0, stdout: "fixture verifier: PASS", stderr: "", duration_ms: 4, status: "PASSED" },
    { verifier_id: commands[1].id, name: commands[1].name, category: "test", command: commands[1].command, exit_code: 0, stdout: "fixture verifier: PASS", stderr: "", duration_ms: 4, status: "PASSED" },
  ],
};

try {
  for (const variant of ["pass", "fail", "unproven"]) {
    const runId = `rate-limit-${variant}`;
    const task = {
      ...baseTask,
      acceptance_criteria: [
        { id: "AC-01", statement: "At most five failed attempts per client are accepted in one minute.", required: true, verification_refs: [commands[0].id] },
        { id: "AC-02", statement: "The sixth failed HTTP login attempt returns 429.", required: true, verification_refs: variant === "unproven" ? [] : [commands[1].id] },
      ],
    };
    const dir = path.join(output, variant);
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
    store.saveTask(task);
    store.createRun({ run_id: runId, task_id: task.task_id, started_at: "2026-09-22T10:00:00.000Z", model: task.model, workspace: root });
    store.appendEvent(runId, "run_created", { fixture: variant, synthetic_fixture: true });
    store.transition(runId, "PREPARING");
    store.updateSnapshots(runId, {
      contextManifest: { workspace: "<WORKSPACE>", generated_at: "2026-09-22T10:00:01.000Z", task_id: task.task_id, files_considered: [], files_included: [], excluded_candidates: [], total_bytes: 0, approximate_tokens: 0 },
      diff: { status_before: "", status_after: "M src/auth.ts", changed_files: ["src/auth.ts"], additions: 3, deletions: 0, unified_diff: "synthetic fixture diff" },
      verificationResults: results[variant],
    });
    for (const result of results[variant]) store.appendVerification(runId, result);
    store.transition(runId, "RUNNING");
    store.transition(runId, "VERIFYING");
    store.transition(runId, "COMPLETED", { finishedAt: "2026-09-22T10:00:02.000Z" });
    const receipt = buildRunReceipt(store, runId, { generatedAt: "2026-09-22T10:00:03.000Z" });
    fs.writeFileSync(path.join(dir, "raw-evidence.json"), `${JSON.stringify({ evidence: receipt.evidence, acceptance: receipt.acceptance }, null, 2)}\n`);
    fs.writeFileSync(path.join(dir, "run-receipt.json"), `${JSON.stringify(receipt, null, 2)}\n`);
    fs.writeFileSync(path.join(dir, "run-receipt.md"), renderReceiptMarkdown(receipt));
  }
} finally {
  store.close();
  fs.rmSync(temporary, { recursive: true, force: true });
}
console.log(`Generated clearly labeled synthetic Run Receipt fixtures under ${output}`);
