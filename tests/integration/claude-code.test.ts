import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { handleClaudeCodeHook } from "../../src/core/claude-code.js";
import { buildClaudeLaunchPlan } from "../../src/core/claude-launch.js";
import type { RunReceipt } from "../../src/core/types.js";

const temporaryRoots: string[] = [];

function temporaryDirectory(prefix: string): string {
  const directory = mkdtempSync(path.join(os.tmpdir(), prefix));
  temporaryRoots.push(directory);
  return directory;
}

function gitProject(): string {
  const workspace = temporaryDirectory("w2-claude-project-");
  execFileSync("git", ["init", "--quiet"], { cwd: workspace, stdio: "ignore" });
  mkdirSync(path.join(workspace, "src"), { recursive: true });
  writeFileSync(path.join(workspace, "src", "feature.js"), "export const feature = false;\n", "utf8");
  execFileSync("git", ["add", "."], { cwd: workspace, stdio: "ignore" });
  execFileSync("git", ["-c", "user.name=W2", "-c", "user.email=w2@example.invalid", "commit", "--quiet", "-m", "baseline"], { cwd: workspace, stdio: "ignore" });
  return workspace;
}

function hookOptions(w2Home: string, onRun?: (receipt: RunReceipt) => void) {
  return {
    onRun,
    brainw2Env: { ...process.env, BRAINW2_VAULT: path.join(w2Home, "missing-test-vault") },
    brainw2Home: w2Home,
  };
}

afterEach(() => {
  for (const directory of temporaryRoots.splice(0)) rmSync(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
});

describe("Claude Code integration", () => {
  it("adds the session plugin and preserves Claude arguments", () => {
    const home = path.join(os.tmpdir(), "W2 Claude Home");
    expect(buildClaudeLaunchPlan(home, "claude", ["--model", "sonnet"])).toEqual({
      executable: "claude",
      args: ["--plugin-dir", path.resolve(home), "--model", "sonnet"],
    });
  });

  it("records a main-session turn with correlated tool activity as a Claude Code receipt", async () => {
    const w2Home = temporaryDirectory("w2-claude-home-");
    const workspace = gitProject();
    const sessionId = "claude-integration-session";
    const options = hookOptions(w2Home);

    const promptResult = await handleClaudeCodeHook(w2Home, {
      hook_event_name: "UserPromptSubmit", session_id: sessionId, cwd: workspace,
      prompt: "Implement the feature flag in src/feature.js.", permission_mode: "default", model: "claude-test-model",
    }, options);
    expect(promptResult?.systemMessage).toBeUndefined();

    await handleClaudeCodeHook(w2Home, {
      hook_event_name: "PreToolUse", session_id: sessionId, cwd: workspace,
      tool_name: "Write", tool_use_id: "tool-1", tool_input: { file_path: "src/feature.js" },
    }, options);
    writeFileSync(path.join(workspace, "src", "feature.js"), "export const feature = true;\n", "utf8");
    await handleClaudeCodeHook(w2Home, {
      hook_event_name: "PostToolUse", session_id: sessionId, cwd: workspace,
      tool_name: "Write", tool_use_id: "tool-1", tool_response: { success: true },
    }, options);

    let receipt: RunReceipt | undefined;
    const stopResult = await handleClaudeCodeHook(w2Home, {
      hook_event_name: "Stop", session_id: sessionId, cwd: workspace,
      stop_hook_active: false, last_assistant_message: "Implemented the feature.",
    }, hookOptions(w2Home, (value) => { receipt = value; }));

    expect(stopResult?.systemMessage).toContain("W2 RECEIPT");
    expect(receipt?.agent.execution_mode).toBe("CLAUDE_CODE_HOOK");
    expect(receipt?.agent.model).toBe("claude-test-model");
    expect(receipt?.actions.tool_calls).toBe(1);
    expect(receipt?.changes.changed_files).toContain("src/feature.js");
    expect(readFileSync(path.join(workspace, "src", "feature.js"), "utf8")).toContain("true");
  });

  it("ignores subagent hooks and leaves permission requests passive", async () => {
    const w2Home = temporaryDirectory("w2-claude-home-");
    const workspace = gitProject();
    const options = hookOptions(w2Home);
    expect(await handleClaudeCodeHook(w2Home, {
      hook_event_name: "UserPromptSubmit", session_id: "subagent-session", cwd: workspace,
      prompt: "Implement the feature.", agent_id: "agent-child",
    }, options)).toBeUndefined();
    expect(await handleClaudeCodeHook(w2Home, {
      hook_event_name: "PermissionRequest", session_id: "subagent-session", cwd: workspace,
      agent_id: "agent-child", tool_name: "Bash", tool_input: { command: "npm test" },
    }, options)).toBeUndefined();
  });
});
