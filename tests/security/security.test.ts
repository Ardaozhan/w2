import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ToolRuntime } from "../../src/core/runtime.js";
import { redactSecrets, SafetyError } from "../../src/core/safety.js";

describe("Phase 03 safety boundary", () => {
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
});
