import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const temporaryRoot = mkdtempSync(path.join(os.tmpdir(), "w2 hook boundary "));
const workspace = path.join(temporaryRoot, "external project with spaces");
const w2Home = repositoryRoot;
let runtimeDirectory;

function ensureInside(target, parent) {
  const absoluteTarget = path.resolve(target);
  const absoluteParent = path.resolve(parent);
  const relative = path.relative(absoluteParent, absoluteTarget);
  assert.ok(relative && relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative), `${absoluteTarget} must be inside ${absoluteParent}`);
  return absoluteTarget;
}

function removeInside(target, parent) {
  rmSync(ensureInside(target, parent), { recursive: true, force: true });
}

function hash(value) {
  return createHash("sha256").update(value).digest("hex").slice(0, 32);
}

function configString(config, name) {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = config.match(new RegExp(`${escapedName} = ("(?:\\\\.|[^"\\\\])*")`));
  assert.ok(match, `Generated hook configuration has no ${name} string`);
  return JSON.parse(match[1]);
}

function commandFor(plan, event) {
  const config = plan.args.find((argument) => argument.startsWith(`hooks.${event}=`));
  assert.ok(config, `Launch plan has no ${event} hook configuration`);
  return process.platform === "win32" ? configString(config, "command_windows") : configString(config, "command");
}

function executeHook(command, payload) {
  const windows = process.platform === "win32";
  const result = spawnSync(
    windows ? (process.env.ComSpec || "cmd.exe") : "/bin/sh",
    windows ? ["/d", "/s", "/c", command] : ["-lc", command],
    {
      cwd: workspace,
      env: process.env,
      encoding: "utf8",
      input: JSON.stringify(payload),
      windowsHide: true,
      maxBuffer: 8 * 1024 * 1024,
    },
  );
  assert.equal(result.error?.message, undefined, `${payload.hook_event_name} command spawn failed`);
  assert.equal(result.status, 0, `${payload.hook_event_name} command failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
  return { stdout: result.stdout, stderr: result.stderr };
}

function makePromptEvent(sessionId, turnId) {
  return {
    session_id: sessionId,
    turn_id: turnId,
    cwd: workspace,
    hook_event_name: "UserPromptSubmit",
    model: "test",
    permission_mode: "default",
    transcript_path: null,
    prompt: "Implement clamp(value, min, max) in src/math.js. Clamp below min, clamp above max, preserve in-range values, throw RangeError when min > max. Add node:test coverage for each requirement. npm test must pass.",
  };
}

function expectedPendingPath(runtimeRoot, sessionId, turnId) {
  return path.join(runtimeRoot, "pending", hash(sessionId), `${hash(turnId)}.json`);
}

async function main() {
  const { buildCodexLaunchPlan } = await import(pathToFileURL(path.join(repositoryRoot, "dist", "src", "core", "codex-launch.js")));
  const { getInteractiveRunStorage, getInteractiveRuntimeRoot } = await import(pathToFileURL(path.join(repositoryRoot, "dist", "src", "core", "interactive.js")));
  const plan = buildCodexLaunchPlan(w2Home, process.execPath);
  const cliPath = path.join(w2Home, "dist", "src", "cli.js");
  assert.ok(existsSync(cliPath), `Built hook CLI does not exist: ${cliPath}`);
  assert.ok(existsSync(process.execPath), `Node executable does not exist: ${process.execPath}`);

  mkdirSync(path.join(workspace, "src"), { recursive: true });
  mkdirSync(path.join(workspace, "test"), { recursive: true });
  writeFileSync(path.join(workspace, "package.json"), `\uFEFF${JSON.stringify({ name: "w2-clamp-e2e", private: true, type: "module", scripts: { test: "node --test" } }, null, 2)}`, "utf8");
  writeFileSync(path.join(workspace, "src", "math.js"), "export function clamp(value, min, max) { return value; }\n", "utf8");
  writeFileSync(path.join(workspace, "test", "math.test.js"), "// Baseline placeholder; this is replaced after UserPromptSubmit.\n", "utf8");
  execFileSync("git", ["init", "--quiet"], { cwd: workspace, stdio: "ignore", windowsHide: true });
  execFileSync("git", ["add", "."], { cwd: workspace, stdio: "ignore", windowsHide: true });
  execFileSync("git", ["-c", "user.name=W2 Hook Test", "-c", "user.email=w2-hook-test@example.invalid", "commit", "--quiet", "-m", "baseline"], { cwd: workspace, stdio: "ignore", windowsHide: true });

  const storage = getInteractiveRunStorage(w2Home, workspace);
  runtimeDirectory = storage.runtimeDirectory;
  const runtimeRoot = getInteractiveRuntimeRoot(w2Home);
  const testRunId = randomUUID();
  const sessionId = `w2-real-hook-boundary-${testRunId}-session`;
  const turnId = `w2-real-hook-boundary-${testRunId}-turn`;
  const prompt = makePromptEvent(sessionId, turnId);
  const promptResult = executeHook(commandFor(plan, "UserPromptSubmit"), prompt);
  assert.equal(promptResult.stdout, "", "UserPromptSubmit must not emit diagnostics on stdout");
  const pendingPath = expectedPendingPath(runtimeDirectory, sessionId, turnId);
  assert.ok(existsSync(pendingPath), "UserPromptSubmit did not persist a pending turn");
  const pending = JSON.parse(readFileSync(pendingPath, "utf8"));
  assert.equal(pending.session_id, sessionId);
  assert.equal(pending.turn_id, turnId);
  assert.equal(pending.workspace, workspace);

  writeFileSync(path.join(workspace, "src", "math.js"), [
    "export function clamp(value, min, max) {",
    "  if (min > max) throw new RangeError('min must be less than or equal to max');",
    "  return Math.min(max, Math.max(min, value));",
    "}",
    "",
  ].join("\n"), "utf8");
  writeFileSync(path.join(workspace, "test", "math.test.js"), [
    "import assert from 'node:assert/strict';",
    "import test from 'node:test';",
    "import { clamp } from '../src/math.js';",
    "test('clamps values below the minimum', () => assert.equal(clamp(-2, 0, 10), 0));",
    "test('clamps values above the maximum', () => assert.equal(clamp(12, 0, 10), 10));",
    "test('preserves values inside the range', () => assert.equal(clamp(4, 0, 10), 4));",
    "test('throws when the minimum exceeds the maximum', () => assert.throws(() => clamp(4, 10, 0), RangeError));",
    "",
  ].join("\n"), "utf8");

  const stopPayload = {
    ...prompt,
    hook_event_name: "Stop",
    stop_hook_active: false,
    last_assistant_message: "Implemented clamp and added four node:test cases; npm test passed.",
  };
  const stopResult = executeHook(commandFor(plan, "Stop"), stopPayload);
  const stopOutput = JSON.parse(stopResult.stdout);
  assert.equal(typeof stopOutput.systemMessage, "string", "Stop did not return a JSON systemMessage");
  assert.match(stopOutput.systemMessage, /^W2 RECEIPT\nUNPROVEN\b/);
  assert.match(stopOutput.systemMessage, /Test: PASS/);
  assert.equal(existsSync(pendingPath), false, "Stop did not close the matching pending turn");

  const receiptFiles = readdirSync(storage.receiptDirectory).filter((name) => name.endsWith(".json"));
  assert.equal(receiptFiles.length, 1, "Stop did not persist exactly one JSON receipt");
  const receipt = JSON.parse(readFileSync(path.join(storage.receiptDirectory, receiptFiles[0]), "utf8"));
  assert.equal(receipt.outcome, "UNPROVEN", "Passing generic npm tests must not be treated as semantic proof");
  assert.equal(receipt.task.goal, prompt.prompt);
  assert.equal(receipt.task.workspace, workspace);
  assert.equal(receipt.agent.execution_mode, "CODEX_TUI_HOOK");
  assert.deepEqual(receipt.acceptance.map((criterion) => criterion.status), ["PASS", "PASS", "UNPROVEN"]);
  assert.deepEqual(receipt.verification.results.map((result) => [result.verifier_id, result.status]), [
    ["V-W2-TURN-DIFF", "PASSED"],
    ["V-PROJECT-TEST", "PASSED"],
  ]);
  assert.ok(receipt.changes.changed_files.includes("src/math.js"));
  assert.ok(receipt.changes.changed_files.includes("test/math.test.js"));
  assert.equal(existsSync(path.join(workspace, ".w2")), false, "W2 runtime files polluted the external project");
  assert.ok(storage.databasePath.startsWith(runtimeRoot));

  const interruptSession = `w2-real-interrupt-${testRunId}-session`;
  const interruptedTurn = `w2-real-interrupt-${testRunId}-turn-a`;
  const survivingTurn = `w2-real-interrupt-${testRunId}-turn-b`;
  const interruptedPath = expectedPendingPath(runtimeDirectory, interruptSession, interruptedTurn);
  const survivingPath = expectedPendingPath(runtimeDirectory, interruptSession, survivingTurn);
  executeHook(commandFor(plan, "UserPromptSubmit"), makePromptEvent(interruptSession, interruptedTurn));
  executeHook(commandFor(plan, "UserPromptSubmit"), makePromptEvent(interruptSession, survivingTurn));
  assert.ok(existsSync(interruptedPath) && existsSync(survivingPath), "Distinct turns in a session overwrote each other's state");
  const interruptResult = executeHook(commandFor(plan, "Interrupt"), {
    session_id: interruptSession,
    turn_id: interruptedTurn,
    cwd: workspace,
    hook_event_name: "Interrupt",
    permission_mode: "default",
    transcript_path: null,
  });
  assert.equal(interruptResult.stdout, "", "Interrupt must not emit plain text");
  assert.equal(existsSync(interruptedPath), false, "Interrupt did not close its corresponding pending turn");
  assert.ok(existsSync(survivingPath), "Interrupt removed another turn from the same session");

  executeHook(commandFor(plan, "SessionEnd"), {
    session_id: sessionId,
    cwd: workspace,
    hook_event_name: "SessionEnd",
    reason: "other",
    transcript_path: null,
  });
  assert.equal(readdirSync(storage.receiptDirectory).filter((name) => name.endsWith(".json")).length, 1, "SessionEnd damaged a persisted receipt");
  const cleanup = executeHook(commandFor(plan, "SessionEnd"), {
    session_id: interruptSession,
    cwd: workspace,
    hook_event_name: "SessionEnd",
    reason: "other",
    transcript_path: null,
  });
  assert.equal(cleanup.stdout, "", "SessionEnd must not emit unsupported output");
  assert.equal(existsSync(survivingPath), false, "SessionEnd left pending session state behind");

  const diagnosticPath = path.join(runtimeRoot, "hook-diagnostics.jsonl");
  const diagnostics = readFileSync(diagnosticPath, "utf8").trim().split(/\r?\n/).map((line) => JSON.parse(line));
  const relevant = diagnostics.filter((record) => record.session_id === sessionId || record.session_id === interruptSession);
  for (const record of relevant) {
    assert.ok(["UserPromptSubmit", "Stop", "Interrupt", "SessionEnd"].includes(record.event));
    assert.ok(["started", "completed"].includes(record.handler));
    assert.equal(Object.hasOwn(record, "prompt"), false);
    assert.equal(Object.hasOwn(record, "last_assistant_message"), false);
  }
  const completedStop = relevant.find((record) => record.event === "Stop" && record.handler === "completed");
  assert.equal(completedStop?.outcome, "UNPROVEN");
  assert.equal(completedStop?.receipt_id, receipt.run_id);
  const completedInterrupt = relevant.find((record) => record.event === "Interrupt" && record.handler === "completed");
  assert.equal(completedInterrupt?.outcome, "ABORTED");
  const completedSessionEnd = relevant.find((record) => record.event === "SessionEnd" && record.session_id === interruptSession && record.handler === "completed");
  assert.equal(completedSessionEnd?.outcome, "CLEANED");

  process.stdout.write(JSON.stringify({
    status: "PASS",
    commands: ["UserPromptSubmit", "Stop", "Interrupt", "SessionEnd"],
    project: "external Git project with spaces",
    receipt: { id: receipt.run_id, outcome: receipt.outcome, npm_test: "PASSED" },
    diagnostics: diagnosticPath,
  }, null, 2) + "\n");
}

try {
  await main();
} finally {
  const interactiveRoot = path.join(w2Home, ".w2", "interactive");
  if (runtimeDirectory && existsSync(runtimeDirectory)) removeInside(runtimeDirectory, interactiveRoot);
  if (existsSync(temporaryRoot)) removeInside(temporaryRoot, os.tmpdir());
}
