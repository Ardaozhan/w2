import { existsSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ToolRuntime } from "../../src/core/runtime.js";
import { redactSecrets, SafetyError } from "../../src/core/safety.js";

describe("W2-owned runtime security boundary", () => {
  it("denies missing capabilities, traversal, and symlink escape", async () => {
    const workspace = mkdtempSync(path.join(os.tmpdir(), "w2-security-"));
    const outside = mkdtempSync(path.join(os.tmpdir(), "w2-outside-"));
    writeFileSync(path.join(outside, "secret.txt"), "outside", "utf8");
    const runtime = new ToolRuntime(workspace, { capabilities: ["fs.read"] });
    await expect(runtime.writeFile("blocked.txt", "x")).rejects.toMatchObject({ code: "CAPABILITY_DENIED" });
    await expect(runtime.readFile("../outside.txt")).rejects.toMatchObject({ code: "WORKSPACE_ESCAPE" });
    try {
      symlinkSync(outside, path.join(workspace, "escape"), "junction");
      await expect(runtime.readFile("escape/secret.txt")).rejects.toMatchObject({ code: "SYMLINK_ESCAPE" });
    } catch (error) {
      if (error instanceof SafetyError) throw error;
    }
    rmSync(workspace, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  });

  it("requires approval for destructive shell actions and redacts secrets", async () => {
    const workspace = mkdtempSync(path.join(os.tmpdir(), "w2-approval-"));
    const events: string[] = [];
    const runtime = new ToolRuntime(workspace, { onSafetyEvent: (type) => events.push(type) });
    await expect(runtime.shell("git", ["commit", "-m", "nope"])).rejects.toMatchObject({ code: "APPROVAL_DENIED" });
    expect(events).toEqual(expect.arrayContaining(["approval_requested", "approval_resolved", "safety_denied"]));
    const redacted = String(redactSecrets("token=sk-test-secret-value"));
    expect(redacted).not.toContain("sk-test-secret-value");
    expect(redacted).toContain("REDACTED");
    rmSync(workspace, { recursive: true, force: true });
  });

  it("enforces timeout and output budgets without leaking child environment", async () => {
    const workspace = mkdtempSync(path.join(os.tmpdir(), "w2-shell-"));
    const runtime = new ToolRuntime(workspace, { budget: { max_output_bytes: 64 } });
    const output = await runtime.shell(process.execPath, ["-e", "process.stdout.write('x'.repeat(1000))"]);
    expect(output.exitCode).toBe(125);
    const timeout = await runtime.shell(process.execPath, ["-e", "setTimeout(() => {}, 1000)"], 20);
    expect(timeout.exitCode).toBe(124);
    rmSync(workspace, { recursive: true, force: true });
  });

  it("terminates descendants when a shell command times out", async () => {
    const workspace = mkdtempSync(path.join(os.tmpdir(), "w2-process-tree-timeout-"));
    const marker = path.join(workspace, "descendant-survived.txt");
    const runtime = new ToolRuntime(workspace);
    const descendant = `setTimeout(() => require("node:fs").writeFileSync(${JSON.stringify(marker)}, "alive"), 700)`;
    const parent = `require("node:child_process").spawn(process.execPath, ["-e", ${JSON.stringify(descendant)}], { stdio: "ignore" }); setInterval(() => {}, 1000)`;

    try {
      const result = await runtime.shell(process.execPath, ["-e", parent], 100);
      expect(result.exitCode).toBe(124);
      await new Promise((resolve) => setTimeout(resolve, 850));
      expect(existsSync(marker)).toBe(false);
    } finally {
      rmSync(workspace, { recursive: true, force: true });
    }
  });

  it.skipIf(process.platform !== "win32")("contains detached Windows descendants after the command exits", async () => {
    const workspace = mkdtempSync(path.join(os.tmpdir(), "w2-job-object-process-tree-"));
    const marker = path.join(workspace, "job-descendant-survived.txt");
    const events: string[] = [];
    const runtime = new ToolRuntime(workspace, { onSafetyEvent: (_type, payload) => events.push(JSON.stringify(payload)) });
    const descendant = `setTimeout(() => require("node:fs").writeFileSync(${JSON.stringify(marker)}, "alive"), 900)`;
    const parent = `const child = require("node:child_process").spawn(process.execPath, ["-e", ${JSON.stringify(descendant)}], { detached: true, stdio: "ignore" }); child.unref();`;

    try {
      const result = await runtime.shell(process.execPath, ["-e", parent], 3000);
      expect(result.exitCode).toBe(0);
      expect(events.some((event) => event.includes("Windows Job Object unavailable"))).toBe(false);
      await new Promise((resolve) => setTimeout(resolve, 1100));
      expect(existsSync(marker)).toBe(false);
    } finally {
      rmSync(workspace, { recursive: true, force: true });
    }
  });

  it("clamps child process timeouts to the remaining total runtime budget", async () => {
    const workspace = mkdtempSync(path.join(os.tmpdir(), "w2-total-runtime-budget-"));
    const runtime = new ToolRuntime(workspace, { budget: { max_runtime_ms: 1200 } });
    Object.defineProperty(runtime, "startedAt", { value: Date.now() - 1000 });
    const remainingTimeoutMs = (runtime as unknown as { shellTimeoutMs(requested?: number): number }).shellTimeoutMs();
    expect(remainingTimeoutMs).toBeGreaterThan(0);
    expect(remainingTimeoutMs).toBeLessThanOrEqual(200);
    try {
      const result = await runtime.shell(process.execPath, ["-e", "setTimeout(() => {}, 750)"]);
      expect(result.exitCode).toBe(124);
    } finally {
      rmSync(workspace, { recursive: true, force: true });
    }
  });
});
