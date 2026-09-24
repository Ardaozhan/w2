import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { getInteractiveRunStorage, handleInteractiveHook, isMeaningfulEngineeringPrompt } from "../../src/core/interactive.js";
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
  });
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
  }, { onRun: onReceipt });
}

afterEach(() => {
  for (const directory of temporaryRoots.splice(0)) rmSync(directory, { recursive: true, force: true });
  for (const directory of runtimeRoots.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe("interactive Codex hook integration", () => {
  it("recognizes actionable engineering prompts and skips casual requests", () => {
    expect(isMeaningfulEngineeringPrompt("Please fix the search bug." )).toBe(true);
    expect(isMeaningfulEngineeringPrompt("Can you add a settings endpoint?" )).toBe(true);
    expect(isMeaningfulEngineeringPrompt("Şu giriş hatasını düzelt." )).toBe(true);
    expect(isMeaningfulEngineeringPrompt("What does this helper do?" )).toBe(false);
    expect(isMeaningfulEngineeringPrompt("Can you explain how to implement caching?" )).toBe(false);
    expect(isMeaningfulEngineeringPrompt("Let's discuss the architecture." )).toBe(false);
    expect(isMeaningfulEngineeringPrompt("Read the README and tell me what it says." )).toBe(false);
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
    writeFileSync(packagePath, JSON.stringify({ name: "browser-fixture", scripts: { test: "playwright test" } }), "utf8");
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
