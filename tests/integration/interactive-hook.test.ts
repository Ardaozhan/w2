import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { getInteractiveRunStorage, handleInteractiveHook, isMeaningfulEngineeringPrompt } from "../../src/core/interactive.js";
import { renderReceiptMarkdown } from "../../src/core/evidence.js";
import { findLatestSessionSummary } from "../../src/core/session.js";
import { RunStore } from "../../src/core/store.js";
import type { RunReceipt } from "../../src/core/types.js";

const temporaryRoots: string[] = [];
const runtimeRoots: string[] = [];

function temporaryDirectory(prefix: string): string {
  const directory = mkdtempSync(path.join(os.tmpdir(), prefix));
  temporaryRoots.push(directory);
  return directory;
}

function temporaryHome(): string {
  return temporaryDirectory("w2-interactive-home-");
}

function gitProject(withTestScript = false, testBody = "import assert from 'node:assert/strict';\nimport test from 'node:test';\ntest('project check', () => assert.equal(1, 1));\n"): string {
  const workspace = temporaryDirectory("w2-interactive-project-");
  execFileSync("git", ["init", "--quiet"], { cwd: workspace, stdio: "ignore" });
  writeFileSync(path.join(workspace, "README.md"), "baseline\n", "utf8");
  mkdirSync(path.join(workspace, "src"), { recursive: true });
  writeFileSync(path.join(workspace, "src", "feature.js"), "export const feature = false;\n", "utf8");
  if (withTestScript) {
    writeFileSync(path.join(workspace, "package.json"), JSON.stringify({ name: "interactive-fixture", private: true, scripts: { test: "node --test" } }, null, 2), "utf8");
    mkdirSync(path.join(workspace, "test"), { recursive: true });
    writeFileSync(path.join(workspace, "test", "feature.test.js"), testBody, "utf8");
  }
  execFileSync("git", ["add", "."], { cwd: workspace, stdio: "ignore" });
  execFileSync("git", ["-c", "user.name=W2", "-c", "user.email=w2@example.invalid", "commit", "--quiet", "-m", "baseline"], { cwd: workspace, stdio: "ignore" });
  return workspace;
}

function commitAll(workspace: string, message: string): void {
  execFileSync("git", ["add", "--all"], { cwd: workspace, stdio: "ignore" });
  execFileSync("git", ["-c", "user.name=W2", "-c", "user.email=w2@example.invalid", "commit", "--quiet", "-m", message], { cwd: workspace, stdio: "ignore" });
}

function receiptDiff(receipt: RunReceipt): string {
  return (receipt.evidence.find((item) => item.type === "DIFF_EVIDENCE")?.data as { unified_diff?: string } | undefined)?.unified_diff ?? "";
}

async function submit(w2Home: string, workspace: string, prompt: string, sessionId: string, turnId: string) {
  return handleInteractiveHook(w2Home, {
    hook_event_name: "UserPromptSubmit",
    session_id: sessionId,
    turn_id: turnId,
    cwd: workspace,
    transcript_path: null,
    prompt,
    model: "codex-test-model",
    permission_mode: "default",
  }, { brainw2Env: { ...process.env, BRAINW2_VAULT: path.join(w2Home, "missing-test-vault") }, brainw2Home: w2Home });
}

async function stop(w2Home: string, workspace: string, sessionId: string, turnId: string, onReceipt?: (receipt: RunReceipt) => void) {
  return handleInteractiveHook(w2Home, {
    hook_event_name: "Stop",
    session_id: sessionId,
    turn_id: turnId,
    cwd: workspace,
    stop_hook_active: false,
    permission_mode: "default",
    last_assistant_message: "Implemented and checked.",
  }, { onRun: onReceipt, brainw2Env: { ...process.env, BRAINW2_VAULT: path.join(w2Home, "missing-test-vault") }, brainw2Home: w2Home });
}

afterEach(() => {
  for (const directory of temporaryRoots.splice(0)) rmSync(directory, { recursive: true, force: true });
  for (const directory of runtimeRoots.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe("interactive Codex hook integration", () => {
  it("uses a conservative English and Turkish engineering prompt fixture corpus", () => {
    const positives = [
      "Implement an option to disable retries.", "Please fix the search bug.", "Refactor the cache adapter.",
      "Add a settings endpoint.", "Update the npm scripts.", "Write tests for the empty response.",
      "Could you write a regression test for this bug?", "Testleri yaz.", "Kodu güncelle.",
      "Change the config default.", "Remove the deprecated feature.", "Migrate the storage schema.",
      "Apply a security fix for the token handling.", "Şu giriş hatasını düzelt.", "Yeni endpoint ekle.",
      "Lütfen bu ayarı güncelle.", "Testler için yeni durumları yaz.", "Bu modülü yeniden yaz.",
      "Güvenlik açığını düzelt.",
    ];
    const negatives = [
      "Explain this helper.", "What does this function do?", "Review this conceptually.",
      "How does caching work?", "Summarize the README.", "Plan how to implement caching.",
      "Let's discuss the architecture.", "Read the README and tell me what it says.",
      "Write a summary of this concept.", "Write a poem about compilers.",
      "Build a plan for the migration.", "Create an implementation plan.",
      "Nasıl çalışıyor?", "Bu kodu nasıl düzeltirim?", "/review this change",
    ];
    for (const prompt of positives) expect(isMeaningfulEngineeringPrompt(prompt), prompt).toBe(true);
    for (const prompt of negatives) expect(isMeaningfulEngineeringPrompt(prompt), prompt).toBe(false);
  });

  it("supports W2_CAPTURE always and off overrides without capturing slash commands", () => {
    expect(isMeaningfulEngineeringPrompt("Explain this helper.", { W2_CAPTURE: "always" })).toBe(true);
    expect(isMeaningfulEngineeringPrompt("Please fix this bug.", { W2_CAPTURE: "off" })).toBe(false);
    expect(isMeaningfulEngineeringPrompt("/review this change", { W2_CAPTURE: "always" })).toBe(false);
  });

  it("maps explicitly named conventional project verifiers without semantic guessing", async () => {
    const w2Home = temporaryHome();
    const workspace = gitProject(true);
    const packagePath = path.join(workspace, "package.json");
    const command = "node -e \"process.exit(0)\"";
    writeFileSync(packagePath, JSON.stringify({ name: "all-verifier-fixture", scripts: { test: command, typecheck: command, lint: command, build: command } }, null, 2), "utf8");
    execFileSync("git", ["add", "package.json"], { cwd: workspace, stdio: "ignore" });
    execFileSync("git", ["-c", "user.name=W2", "-c", "user.email=w2@example.invalid", "commit", "--quiet", "-m", "verifier setup"], { cwd: workspace, stdio: "ignore" });
    runtimeRoots.push(getInteractiveRunStorage(w2Home, workspace).runtimeDirectory);
    let receipt: RunReceipt | undefined;
    await submit(w2Home, workspace, [
      "Implement the requested feature.", "Acceptance criteria:",
      "- npm test passes.", "- npm run typecheck passes.", "- npm run lint passes.", "- npm run build passes.",
      "- total = 0 throws RangeError.",
    ].join("\n"), "explicit-verifiers-session", "explicit-verifiers-turn");
    writeFileSync(path.join(workspace, "src", "feature.js"), "export const feature = true;\n", "utf8");
    await stop(w2Home, workspace, "explicit-verifiers-session", "explicit-verifiers-turn", (value) => { receipt = value; });
    const explicit = receipt?.task.acceptance_criteria.slice(2);
    expect(explicit?.map((item) => item.verification_refs)).toEqual([
      ["V-PROJECT-TEST"], ["V-PROJECT-TYPECHECK"], ["V-PROJECT-LINT"], ["V-PROJECT-BUILD"], [],
    ]);
    expect(receipt?.acceptance.slice(2).map((item) => item.status)).toEqual(["PASS", "PASS", "PASS", "PASS", "UNPROVEN"]);
    expect(receipt?.outcome).toBe("UNPROVEN");
  });

  it("does not create a run for a casual prompt", async () => {
    const w2Home = temporaryHome();
    const workspace = gitProject();
    const storage = getInteractiveRunStorage(w2Home, workspace);
    expect(await submit(w2Home, workspace, "What does the search helper do?", "casual-session", "casual-turn")).toBeUndefined();
    expect(await stop(w2Home, workspace, "casual-session", "casual-turn")).toBeUndefined();
    expect(() => readFileSync(storage.databasePath)).toThrow();
  });

  it("uses the existing engines while keeping unlinked task semantics UNPROVEN", async () => {
    const w2Home = temporaryHome();
    const workspace = gitProject(true);
    const storage = getInteractiveRunStorage(w2Home, workspace);
    runtimeRoots.push(storage.runtimeDirectory);
    let receipt: RunReceipt | undefined;

    await submit(w2Home, workspace, "Please fix the feature flag behavior.", "pass-session", "pass-turn");
    writeFileSync(path.join(workspace, "src", "feature.js"), "export const feature = true;\n", "utf8");
    writeFileSync(path.join(workspace, "new file.txt"), "Created during this turn.\n", "utf8");
    const result = await stop(w2Home, workspace, "pass-session", "pass-turn", (captured) => { receipt = captured; });

    expect(result?.systemMessage, JSON.stringify(receipt?.verification.results, null, 2)).toContain("W2 RECEIPT\nUNPROVEN");
    expect(receipt?.outcome).toBe("UNPROVEN");
    expect(receipt?.agent.execution_mode).toBe("CODEX_TUI_HOOK");
    expect(receipt?.task.workspace).toBe(workspace);
    expect(receipt?.verification.results.map((item) => item.name)).toEqual(["W2 turn diff", "Project tests"]);
    expect(receipt?.acceptance.map((criterion) => criterion.status)).toEqual(["PASS", "PASS", "UNPROVEN"]);
    expect(receipt?.changes.changed_files).toContain("src/feature.js");
    expect(receipt?.changes.changed_files).toContain("new file.txt");
    const diffEvidence = receipt?.evidence.find((item) => item.type === "DIFF_EVIDENCE")?.data as { unified_diff?: string } | undefined;
    expect(diffEvidence?.unified_diff).toContain("Created during this turn.");
    expect(receipt?.changes.additions).toBeGreaterThan(0);
    expect(storage.databasePath.startsWith(workspace)).toBe(false);
    expect(result?.systemMessage).toContain(storage.receiptDirectory);
    const targetGitState = execFileSync("git", ["status", "--porcelain=v1"], { cwd: workspace, encoding: "utf8" });
    expect(targetGitState).not.toContain(".w2");
  });

  it("captures committed Git changes in the turn diff after the working tree becomes clean", async () => {
    const w2Home = temporaryHome();
    const workspace = gitProject(true);
    runtimeRoots.push(getInteractiveRunStorage(w2Home, workspace).runtimeDirectory);
    let receipt: RunReceipt | undefined;

    await submit(w2Home, workspace, "Please implement the feature flag.", "commit-session", "commit-turn");
    expect(execFileSync("git", ["status", "--porcelain=v1"], { cwd: workspace, encoding: "utf8" })).toBe("");
    writeFileSync(path.join(workspace, "src", "feature.js"), "export const feature = true;\n", "utf8");
    writeFileSync(path.join(workspace, "committed file.txt"), "This committed change belongs to the turn.\n", "utf8");
    commitAll(workspace, "complete feature flag");
    expect(execFileSync("git", ["status", "--porcelain=v1"], { cwd: workspace, encoding: "utf8" })).toBe("");

    const result = await stop(w2Home, workspace, "commit-session", "commit-turn", (captured) => { receipt = captured; });
    expect(result?.systemMessage).toContain("W2 RECEIPT\nUNPROVEN");
    expect(receipt?.verification.results.find((item) => item.verifier_id === "V-W2-TURN-DIFF")?.status).toBe("PASSED");
    expect(receipt?.changes.changed_files).toEqual(["committed file.txt", "src/feature.js"]);
    expect(receiptDiff(receipt!)).toContain("This committed change belongs to the turn.");
    expect(receiptDiff(receipt!)).toContain("export const feature = true;");
    expect(receipt?.changes.additions).toBeGreaterThan(0);
  });

  it("combines committed changes and additional uncommitted work in one turn receipt", async () => {
    const w2Home = temporaryHome();
    const workspace = gitProject();
    runtimeRoots.push(getInteractiveRunStorage(w2Home, workspace).runtimeDirectory);
    let receipt: RunReceipt | undefined;

    await submit(w2Home, workspace, "Please implement the combined change.", "mixed-session", "mixed-turn");
    writeFileSync(path.join(workspace, "src", "feature.js"), "export const feature = true;\n", "utf8");
    writeFileSync(path.join(workspace, "committed.txt"), "Committed part.\n", "utf8");
    commitAll(workspace, "commit part of turn");
    writeFileSync(path.join(workspace, "README.md"), "baseline plus uncommitted turn work\n", "utf8");
    writeFileSync(path.join(workspace, "extra.txt"), "Uncommitted part.\n", "utf8");

    await stop(w2Home, workspace, "mixed-session", "mixed-turn", (captured) => { receipt = captured; });
    expect(receipt?.changes.changed_files).toEqual(["README.md", "committed.txt", "extra.txt", "src/feature.js"]);
    expect(receiptDiff(receipt!)).toContain("Committed part.");
    expect(receiptDiff(receipt!)).toContain("Uncommitted part.");
    expect(receiptDiff(receipt!)).toContain("baseline plus uncommitted turn work");
  });

  it("includes staged-only Git changes in the uncommitted turn diff", async () => {
    const w2Home = temporaryHome();
    const workspace = gitProject();
    runtimeRoots.push(getInteractiveRunStorage(w2Home, workspace).runtimeDirectory);
    let receipt: RunReceipt | undefined;

    await submit(w2Home, workspace, "Please implement the feature and stage it.", "staged-session", "staged-turn");
    writeFileSync(path.join(workspace, "src", "feature.js"), "export const feature = true;\n", "utf8");
    execFileSync("git", ["add", "src/feature.js"], { cwd: workspace, stdio: "ignore" });
    writeFileSync(path.join(workspace, "src", "feature.js"), "export const feature = false;\n", "utf8");

    const result = await stop(w2Home, workspace, "staged-session", "staged-turn", (captured) => { receipt = captured; });
    expect(result?.systemMessage, result?.systemMessage).toContain("W2 RECEIPT\nUNPROVEN");
    expect(receipt?.changes.changed_files).toEqual(["src/feature.js"]);
    expect(receiptDiff(receipt!)).toContain("export const feature = true;");
  });

  it("records explicit acceptance items separately and maps only directly named passing commands", async () => {
    const w2Home = temporaryHome();
    const workspace = gitProject(true);
    runtimeRoots.push(getInteractiveRunStorage(w2Home, workspace).runtimeDirectory);
    let receipt: RunReceipt | undefined;

    await submit(w2Home, workspace, [
      "Please update the arithmetic behavior.",
      "Acceptance criteria:",
      "- A total of 0 throws RangeError.",
      "- Negative values behave mathematically.",
      "- The return type is number.",
      "- npm test passes.",
    ].join("\n"), "criteria-session", "criteria-turn");
    writeFileSync(path.join(workspace, "src", "feature.js"), "export const feature = true;\n", "utf8");
    await stop(w2Home, workspace, "criteria-session", "criteria-turn", (captured) => { receipt = captured; });

    expect(receipt?.task.acceptance_criteria.map((criterion) => criterion.statement)).toEqual([
      "At least one project file changed during this Codex turn.",
      "All discovered project checks pass: test.",
      "A total of 0 throws RangeError.",
      "Negative values behave mathematically.",
      "The return type is number.",
      "npm test passes.",
    ]);
    expect(receipt?.task.acceptance_criteria.map((criterion) => criterion.verification_refs)).toEqual([
      ["V-W2-TURN-DIFF"],
      ["V-PROJECT-TEST"],
      [],
      [],
      [],
      ["V-PROJECT-TEST"],
    ]);
    expect(receipt?.acceptance.map((criterion) => criterion.status)).toEqual(["PASS", "PASS", "UNPROVEN", "UNPROVEN", "UNPROVEN", "PASS"]);
    expect(receipt?.outcome).toBe("UNPROVEN");
    const markdown = renderReceiptMarkdown(receipt!);
    expect(markdown).toContain("AC-04: Negative values behave mathematically.");
    expect(markdown).toContain("Evidence: Project tests: PASSED (`npm run test`)");
  });

  it("keeps criteria beyond the bounded parser limit explicitly UNPROVEN", async () => {
    const w2Home = temporaryHome();
    const workspace = gitProject();
    runtimeRoots.push(getInteractiveRunStorage(w2Home, workspace).runtimeDirectory);
    let receipt: RunReceipt | undefined;
    const criteria = Array.from({ length: 51 }, (_, index) => `- Criterion ${index + 1} is satisfied.`);

    await submit(w2Home, workspace, ["Please implement the requested behavior.", "Acceptance criteria:", ...criteria].join("\n"), "overflow-session", "overflow-turn");
    writeFileSync(path.join(workspace, "src", "feature.js"), "export const feature = true;\n", "utf8");
    await stop(w2Home, workspace, "overflow-session", "overflow-turn", (captured) => { receipt = captured; });

    expect(receipt?.task.acceptance_criteria).toHaveLength(53);
    expect(receipt?.task.acceptance_criteria.at(-1)?.statement).toContain("50-criterion limit");
    expect(receipt?.task.acceptance_criteria.at(-1)?.verification_refs).toEqual([]);
    expect(receipt?.acceptance.at(-1)?.status).toBe("UNPROVEN");
    expect(receipt?.outcome).toBe("UNPROVEN");
  });

  it("keeps missing project verification evidence UNPROVEN", async () => {
    const w2Home = temporaryHome();
    const workspace = gitProject();
    runtimeRoots.push(getInteractiveRunStorage(w2Home, workspace).runtimeDirectory);
    let receipt: RunReceipt | undefined;
    await submit(w2Home, workspace, "Add a stable settings field.", "unproven-session", "unproven-turn");
    writeFileSync(path.join(workspace, "src", "feature.js"), "export const feature = true;\n", "utf8");
    const result = await stop(w2Home, workspace, "unproven-session", "unproven-turn", (captured) => { receipt = captured; });
    expect(result?.systemMessage).toContain("W2 RECEIPT\nUNPROVEN");
    expect(receipt?.acceptance.map((criterion) => criterion.status)).toEqual(["PASS", "UNPROVEN", "UNPROVEN"]);
    expect(receipt?.outcome).toBe("UNPROVEN");
  });

  it("reports a verifier failure as FAIL", async () => {
    const failingTest = "import assert from 'node:assert/strict';\nimport test from 'node:test';\ntest('project check', () => assert.fail('expected failure'));\n";
    const w2Home = temporaryHome();
    const workspace = gitProject(true, failingTest);
    runtimeRoots.push(getInteractiveRunStorage(w2Home, workspace).runtimeDirectory);
    let receipt: RunReceipt | undefined;
    await submit(w2Home, workspace, "Implement the new feature flag.", "fail-session", "fail-turn");
    writeFileSync(path.join(workspace, "src", "feature.js"), "export const feature = true;\n", "utf8");
    const result = await stop(w2Home, workspace, "fail-session", "fail-turn", (captured) => { receipt = captured; });
    expect(result?.systemMessage).toContain("W2 RECEIPT\nFAIL");
    expect(receipt?.verification.results.find((item) => item.category === "test")?.status).toBe("FAILED");
    expect(receipt?.outcome).toBe("FAIL");
  });

  it("skips project scripts that invoke browser automation", async () => {
    const w2Home = temporaryHome();
    const workspace = gitProject(true);
    const packagePath = path.join(workspace, "package.json");
    writeFileSync(packagePath, JSON.stringify({ name: "browser-fixture", scripts: { test: "npm run test:e2e", "test:e2e": "playwright test" } }), "utf8");
    execFileSync("git", ["add", "package.json"], { cwd: workspace, stdio: "ignore" });
    execFileSync("git", ["-c", "user.name=W2", "-c", "user.email=w2@example.invalid", "commit", "--quiet", "-m", "browser test setup"], { cwd: workspace, stdio: "ignore" });
    runtimeRoots.push(getInteractiveRunStorage(w2Home, workspace).runtimeDirectory);
    let receipt: RunReceipt | undefined;
    await submit(w2Home, workspace, "Implement the keyboard shortcut.", "browser-session", "browser-turn");
    writeFileSync(path.join(workspace, "src", "feature.js"), "export const shortcut = true;\n", "utf8");
    const result = await stop(w2Home, workspace, "browser-session", "browser-turn", (captured) => { receipt = captured; });
    expect(result?.systemMessage).toContain("W2 RECEIPT\nUNPROVEN");
    expect(receipt?.verification.results.map((item) => item.verifier_id)).toEqual(["V-W2-TURN-DIFF"]);
    expect(receipt?.outcome).toBe("UNPROVEN");
  });

  it("does not turn an unchanged implementation request into PASS", async () => {
    const w2Home = temporaryHome();
    const workspace = gitProject();
    runtimeRoots.push(getInteractiveRunStorage(w2Home, workspace).runtimeDirectory);
    let receipt: RunReceipt | undefined;
    await submit(w2Home, workspace, "Implement a configuration toggle.", "empty-session", "empty-turn");
    const result = await stop(w2Home, workspace, "empty-session", "empty-turn", (captured) => { receipt = captured; });
    expect(result?.systemMessage).toContain("W2 RECEIPT\nFAIL");
    expect(receipt?.acceptance[0]?.status).toBe("FAIL");
    expect(receipt?.outcome).toBe("FAIL");
    expect(receipt?.changes.changed_files).toEqual([]);
    expect(receiptDiff(receipt!)).toBe("");
  });

  it("excludes unrelated dirty files that predate the turn, including one committed during it", async () => {
    const w2Home = temporaryHome();
    const workspace = gitProject();
    runtimeRoots.push(getInteractiveRunStorage(w2Home, workspace).runtimeDirectory);
    writeFileSync(path.join(workspace, "README.md"), "pre-existing dirty content\n", "utf8");
    writeFileSync(path.join(workspace, "pre-existing-untracked.txt"), "also predates the prompt\n", "utf8");
    writeFileSync(path.join(workspace, "pre-existing-staged.txt"), "staged before the prompt\n", "utf8");
    execFileSync("git", ["add", "pre-existing-staged.txt"], { cwd: workspace, stdio: "ignore" });
    let receipt: RunReceipt | undefined;

    const statusBeforePrompt = execFileSync("git", ["status", "--porcelain=v1"], { cwd: workspace, encoding: "utf8" });
    await submit(w2Home, workspace, "Please implement the current turn change.", "dirty-session", "dirty-turn");
    expect(execFileSync("git", ["status", "--porcelain=v1"], { cwd: workspace, encoding: "utf8" })).toBe(statusBeforePrompt);
    execFileSync("git", ["add", "README.md"], { cwd: workspace, stdio: "ignore" });
    execFileSync("git", ["-c", "user.name=W2", "-c", "user.email=w2@example.invalid", "commit", "--only", "--quiet", "-m", "commit pre-existing edit", "--", "README.md"], { cwd: workspace, stdio: "ignore" });
    writeFileSync(path.join(workspace, "src", "feature.js"), "export const feature = true;\n", "utf8");
    writeFileSync(path.join(workspace, "turn.txt"), "Only this new file belongs to the turn.\n", "utf8");

    await stop(w2Home, workspace, "dirty-session", "dirty-turn", (captured) => { receipt = captured; });
    expect(receipt?.changes.changed_files).toEqual(["src/feature.js", "turn.txt"]);
    expect(receiptDiff(receipt!)).toContain("Only this new file belongs to the turn.");
    expect(receiptDiff(receipt!)).not.toContain("pre-existing dirty content");
    expect(receiptDiff(receipt!)).not.toContain("also predates the prompt");
    expect(receiptDiff(receipt!)).not.toContain("staged before the prompt");
  });

  it("uses a fresh baseline for each turn in the same repository", async () => {
    const w2Home = temporaryHome();
    const workspace = gitProject();
    runtimeRoots.push(getInteractiveRunStorage(w2Home, workspace).runtimeDirectory);
    let firstReceipt: RunReceipt | undefined;
    let secondReceipt: RunReceipt | undefined;

    await submit(w2Home, workspace, "Please implement the first turn.", "multi-session", "first-turn");
    writeFileSync(path.join(workspace, "src", "feature.js"), "export const feature = true;\n", "utf8");
    commitAll(workspace, "first turn");
    await stop(w2Home, workspace, "multi-session", "first-turn", (captured) => { firstReceipt = captured; });
    expect(firstReceipt?.changes.changed_files).toEqual(["src/feature.js"]);

    await submit(w2Home, workspace, "Please implement the second turn.", "multi-session", "second-turn");
    writeFileSync(path.join(workspace, "README.md"), "second turn only\n", "utf8");
    await stop(w2Home, workspace, "multi-session", "second-turn", (captured) => { secondReceipt = captured; });
    expect(secondReceipt?.changes.changed_files).toEqual(["README.md"]);
    expect(receiptDiff(secondReceipt!)).toContain("second turn only");
    expect(receiptDiff(secondReceipt!)).not.toContain("export const feature = true;");
    const summary = await findLatestSessionSummary(w2Home, "multi-session");
    expect(summary?.turn_count).toBe(2);
    expect(summary?.receipt_ids).toEqual([firstReceipt?.run_id, secondReceipt?.run_id]);
    expect(summary?.outcome_sequence).toEqual(["UNPROVEN", "UNPROVEN"]);
    expect(summary?.latest_receipt).toBe(secondReceipt?.run_id);
  });

  it("stores and correlates safe native tool metadata through receipt events without proving behavior", async () => {
    const w2Home = temporaryHome();
    const workspace = gitProject();
    const runtime = getInteractiveRunStorage(w2Home, workspace).runtimeDirectory;
    runtimeRoots.push(runtime);
    const sessionId = "tool-session";
    const turnId = "tool-turn";
    const sampleToken = ["private", "token", "value"].join("-");
    const authHeader = ["Authorization", "Bearer", sampleToken].join(" ");
    const privatePrompt = ["private", "prompt", "text"].join(" ");
    await submit(w2Home, workspace, "Add the requested implementation.", sessionId, turnId);
    const base = { session_id: sessionId, turn_id: turnId, cwd: workspace, permission_mode: "default" as const, tool_name: "Bash", tool_use_id: "call_safe_123" };
    await handleInteractiveHook(w2Home, { ...base, hook_event_name: "PreToolUse", tool_input: { command: `curl -H '${authHeader}' https://example.invalid`, description: privatePrompt } }, { brainw2Env: { BRAINW2_VAULT: path.join(w2Home, "missing") }, brainw2Home: w2Home });
    const sessionHash = createHash("sha256").update(sessionId).digest("hex").slice(0, 32);
    const turnHash = createHash("sha256").update(turnId).digest("hex").slice(0, 32);
    const pendingPath = path.join(runtime, "pending", sessionHash, `${turnHash}.json`);
    const preState = readFileSync(pendingPath, "utf8");
    expect(preState).toContain("call_safe_123");
    expect(preState).toContain("input_sha256");
    expect(preState).not.toContain(sampleToken);
    expect(preState).not.toContain(privatePrompt);
    const contaminatedPending = JSON.parse(preState);
    contaminatedPending.tool_calls[0].input.raw_command = sampleToken;
    contaminatedPending.tool_calls[0].result.response_body = privatePrompt;
    writeFileSync(pendingPath, JSON.stringify(contaminatedPending), "utf8");

    await handleInteractiveHook(w2Home, { ...base, hook_event_name: "PostToolUse", tool_input: { command: `curl -H '${authHeader}' https://example.invalid` }, tool_response: { exit_code: 0, output: `PRIVATE_RESPONSE_BODY ${sampleToken}` } }, { brainw2Env: { BRAINW2_VAULT: path.join(w2Home, "missing") }, brainw2Home: w2Home });
    const postState = readFileSync(pendingPath, "utf8");
    expect(postState).toContain('"status": "RETURNED"');
    expect(postState).toContain("response_sha256");
    expect(postState).not.toContain("PRIVATE_RESPONSE_BODY");
    expect(postState).not.toContain(sampleToken);
    expect(postState).not.toContain(privatePrompt);

    writeFileSync(path.join(workspace, "src", "feature.js"), "export const feature = true;\n", "utf8");
    let receipt: RunReceipt | undefined;
    await stop(w2Home, workspace, sessionId, turnId, (value) => { receipt = value; });
    expect(receipt?.outcome).toBe("UNPROVEN");
    expect(receipt?.actions.tool_calls).toBe(1);
    expect(receipt?.acceptance.some((criterion) => criterion.status === "PASS")).toBe(true);
    expect(receipt?.acceptance.at(-1)?.status).toBe("UNPROVEN");
    const toolEvidence = receipt?.evidence.find((item) => item.type === "TOOL_EVIDENCE");
    expect(toolEvidence?.data).toMatchObject({ tool_use_id: "call_safe_123", status: "RETURNED" });
    const receiptJson = JSON.stringify(receipt);
    expect(receiptJson).not.toContain(sampleToken);
    expect(receiptJson).not.toContain("PRIVATE_RESPONSE_BODY");
    expect(receiptJson).not.toContain(privatePrompt);
    const store = new RunStore(getInteractiveRunStorage(w2Home, workspace).databasePath);
    try {
      const calls = store.getToolCalls(receipt!.run_id);
      expect(calls).toHaveLength(1);
      expect(calls[0]?.tool_use_id).toBe("call_safe_123");
      expect(calls[0]?.status).toBe("RETURNED");
      expect(calls[0]?.input).toMatchObject({ field_names: ["command", "description"] });
      expect(calls[0]?.result).toMatchObject({ phase: "post", response_bytes: expect.any(Number) });
      const events = store.getEvents(receipt!.run_id).filter((event) => event.type === "tool_requested" || event.type === "tool_finished");
      expect(events.every((event) => JSON.stringify(event.payload).includes("call_safe_123"))).toBe(true);
    } finally { store.close(); }
  });

  it("keeps a pre-tool record interrupted when PostToolUse never arrives", async () => {
    const w2Home = temporaryHome();
    const workspace = gitProject();
    runtimeRoots.push(getInteractiveRunStorage(w2Home, workspace).runtimeDirectory);
    await submit(w2Home, workspace, "Implement the requested change.", "interrupt-tool-session", "interrupt-tool-turn");
    await handleInteractiveHook(w2Home, {
      hook_event_name: "PreToolUse", session_id: "interrupt-tool-session", turn_id: "interrupt-tool-turn", cwd: workspace,
      permission_mode: "default", tool_name: "apply_patch", tool_use_id: "call_incomplete", tool_input: { file_path: path.join(workspace, "src", "feature.js"), patch: "secret prompt body" },
    }, { brainw2Env: { BRAINW2_VAULT: path.join(w2Home, "missing") }, brainw2Home: w2Home });
    let receipt: RunReceipt | undefined;
    const result = await handleInteractiveHook(w2Home, {
      hook_event_name: "Interrupt", session_id: "interrupt-tool-session", turn_id: "interrupt-tool-turn", cwd: workspace,
      permission_mode: "default", transcript_path: null,
    }, { brainw2Env: { BRAINW2_VAULT: path.join(w2Home, "missing") }, brainw2Home: w2Home, onRun: (value) => { receipt = value; } });
    expect(result?.systemMessage).toContain("W2 RECEIPT\nABORTED");
    expect(receipt?.outcome).toBe("ABORTED");
    expect(receipt?.evidence.find((item) => item.type === "TOOL_EVIDENCE")?.data).toMatchObject({ tool_use_id: "call_incomplete", status: "INTERRUPTED" });
    expect(JSON.stringify(receipt)).not.toContain("secret prompt body");
  });

  it("finalizes pending tool activity as interrupted at SessionEnd and preserves receipts", async () => {
    const w2Home = temporaryHome();
    const workspace = gitProject();
    const runtime = getInteractiveRunStorage(w2Home, workspace).runtimeDirectory;
    runtimeRoots.push(runtime);
    await submit(w2Home, workspace, "Implement the requested feature.", "end-tool-session", "end-tool-turn");
    await handleInteractiveHook(w2Home, { hook_event_name: "PreToolUse", session_id: "end-tool-session", turn_id: "end-tool-turn", cwd: workspace, permission_mode: "default", tool_name: "Bash", tool_use_id: "call_end", tool_input: { command: "npm test" } }, { brainw2Env: { BRAINW2_VAULT: path.join(w2Home, "missing") }, brainw2Home: w2Home });
    let receipt: RunReceipt | undefined;
    const result = await handleInteractiveHook(w2Home, { hook_event_name: "SessionEnd", session_id: "end-tool-session", cwd: workspace, reason: "other", transcript_path: null }, { brainw2Env: { BRAINW2_VAULT: path.join(w2Home, "missing") }, brainw2Home: w2Home, onRun: (value) => { receipt = value; } });
    expect(result).toBeUndefined();
    expect(receipt?.outcome).toBe("ABORTED");
    expect(receipt?.evidence.find((item) => item.type === "TOOL_EVIDENCE")?.data).toMatchObject({ tool_use_id: "call_end", status: "INTERRUPTED" });
    expect(readFileSync(path.join(runtime, "receipts", `${receipt!.run_id}.json`), "utf8")).toContain('"outcome": "ABORTED"');
    const pendingDirectory = path.join(runtime, "pending", createHash("sha256").update("end-tool-session").digest("hex").slice(0, 32));
    expect(existsSync(pendingDirectory)).toBe(false);
  });

  it("keeps Git capture failures as infrastructure ERROR", async () => {
    const w2Home = temporaryHome();
    const workspace = temporaryDirectory("w2-no-git-project-");
    runtimeRoots.push(getInteractiveRunStorage(w2Home, workspace).runtimeDirectory);
    writeFileSync(path.join(workspace, "file.txt"), "no Git here\n", "utf8");
    let receipt: RunReceipt | undefined;
    await submit(w2Home, workspace, "Fix the generated configuration.", "error-session", "error-turn");
    const result = await stop(w2Home, workspace, "error-session", "error-turn", (captured) => { receipt = captured; });
    expect(result?.systemMessage).toContain("W2 RECEIPT\nERROR");
    expect(receipt?.outcome).toBe("ERROR");
  });

  it("returns ERROR if history rewriting removes the captured Git baseline object", async () => {
    const w2Home = temporaryHome();
    const workspace = gitProject();
    runtimeRoots.push(getInteractiveRunStorage(w2Home, workspace).runtimeDirectory);
    writeFileSync(path.join(workspace, "README.md"), "pre-existing dirt at turn start\n", "utf8");
    await submit(w2Home, workspace, "Implement the requested repository change.", "rewrite-session", "rewrite-turn");
    const sessionHash = createHash("sha256").update("rewrite-session").digest("hex").slice(0, 32);
    const turnHash = createHash("sha256").update("rewrite-turn").digest("hex").slice(0, 32);
    const pendingPath = path.join(getInteractiveRunStorage(w2Home, workspace).runtimeDirectory, "pending", sessionHash, `${turnHash}.json`);
    const baseline = JSON.parse(readFileSync(pendingPath, "utf8")).git_baseline as { head: string; working_tree: string };
    writeFileSync(path.join(workspace, "README.md"), "rewritten history content\n", "utf8");
    execFileSync("git", ["add", "README.md"], { cwd: workspace, stdio: "ignore" });
    execFileSync("git", ["-c", "user.name=W2", "-c", "user.email=w2@example.invalid", "commit", "--amend", "--quiet", "--no-edit"], { cwd: workspace, stdio: "ignore" });
    execFileSync("git", ["reflog", "expire", "--expire=now", "--all"], { cwd: workspace, stdio: "ignore" });
    execFileSync("git", ["gc", "--prune=now", "--aggressive"], { cwd: workspace, stdio: "ignore" });
    expect(() => execFileSync("git", ["cat-file", "-e", `${baseline.head}^{commit}`], { cwd: workspace, stdio: "ignore" })).toThrow();
    expect(() => execFileSync("git", ["cat-file", "-e", `${baseline.working_tree}^{tree}`], { cwd: workspace, stdio: "ignore" })).toThrow();
    let receipt: RunReceipt | undefined;
    const result = await stop(w2Home, workspace, "rewrite-session", "rewrite-turn", (value) => { receipt = value; });
    expect(result?.systemMessage).toContain("W2 RECEIPT\nERROR");
    expect(receipt?.outcome).toBe("ERROR");
    expect(receipt?.verification.results.some((item) => item.status === "ERROR" && item.verifier_id === "V-W2-TURN-DIFF")).toBe(true);
  });

  it("captures work in a Git project before its first commit", async () => {
    const w2Home = temporaryHome();
    const workspace = temporaryDirectory("w2-unborn-project-");
    mkdirSync(path.join(workspace, "src"), { recursive: true });
    writeFileSync(path.join(workspace, "package.json"), JSON.stringify({ name: "unborn-project", scripts: { test: "node --test" } }), "utf8");
    writeFileSync(path.join(workspace, "src", "feature.js"), "export const feature = false;\n", "utf8");
    execFileSync("git", ["init", "--quiet"], { cwd: workspace, stdio: "ignore" });
    execFileSync("git", ["add", "."], { cwd: workspace, stdio: "ignore" });
    const storage = getInteractiveRunStorage(w2Home, workspace);
    runtimeRoots.push(storage.runtimeDirectory);
    let receipt: RunReceipt | undefined;
    await submit(w2Home, workspace, "Implement a feature toggle.", "unborn-session", "unborn-turn");
    writeFileSync(path.join(workspace, "src", "feature.js"), "export const feature = true;\n", "utf8");
    const result = await stop(w2Home, workspace, "unborn-session", "unborn-turn", (captured) => { receipt = captured; });
    expect(result?.systemMessage).toContain("W2 RECEIPT\nUNPROVEN");
    expect(receipt?.outcome).toBe("UNPROVEN");
    expect(receipt?.changes.changed_files).toContain("src/feature.js");
  });
});
