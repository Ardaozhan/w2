import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { AgentAdapter, AgentStartInput } from "../../src/core/agent.js";
import { runTaskAndPersistReceipt } from "../../src/core/cli-run.js";
import { resolveProjectMapping } from "../../src/core/brainw2.js";
import type { AgentOutput, AgentRunResult, TaskDefinition } from "../../src/core/types.js";
import { validateReceipt } from "../../src/core/evidence.js";

class ReceiptAdapter implements AgentAdapter {
  readonly provider = "codex" as const;
  sendTask(task: TaskDefinition): string { return task.goal; }
  receiveAction(): undefined { return undefined; }
  receiveOutput(raw: unknown): AgentOutput { return { kind: "test", raw }; }
  cancel(): void {}
  async startRun(input: AgentStartInput): Promise<AgentRunResult> {
    writeFileSync(path.join(input.workspace, "generated.txt"), "recorded", "utf8");
    return { exit_code: 0, outputs: [{ kind: "message", text: "finished", raw: { type: "agent_message", text: "finished" } }], tool_calls: [] };
  }
}

describe("CLI run receipt persistence", () => {
  it("runs the production receipt path and persists automatically evaluated JSON and Markdown", async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "w2-cli-run-"));
    const workspace = path.join(root, "workspace");
    const vaultPath = path.join(root, "brainw2");
    mkdirSync(workspace, { recursive: true });
    mkdirSync(path.join(vaultPath, "01 Projects"), { recursive: true });
    execFileSync("git", ["init"], { cwd: workspace, stdio: "ignore" });
    writeFileSync(path.join(workspace, "baseline.txt"), "baseline", "utf8");
    execFileSync("git", ["add", "."], { cwd: workspace, stdio: "ignore" });
    execFileSync("git", ["-c", "user.name=W2", "-c", "user.email=w2@example.invalid", "commit", "-m", "baseline"], { cwd: workspace, stdio: "ignore" });
    const task: TaskDefinition = {
      task_id: "cli-receipt", title: "Persist receipt", goal: "write generated.txt", constraints: [], allowed_paths: ["generated.txt"],
      acceptance_criteria: [{ id: "AC-01", statement: "The product verifier passes", required: true, verification_refs: ["V1"] }],
      verification_commands: [{ id: "V1", name: "product-check", command: process.platform === "win32" ? "if exist generated.txt (exit /b 0) else (exit /b 1)" : "test -f generated.txt", category: "custom" }],
      workspace,
    };
    const databasePath = path.join(workspace, "run.sqlite");
    const receiptDirectory = path.join(workspace, "receipts");
    try {
      const result = await runTaskAndPersistReceipt({
        task,
        databasePath,
        receiptDirectory,
        adapter: new ReceiptAdapter(),
        brainw2: { env: { BRAINW2_VAULT: vaultPath, HOME: root, USERPROFILE: root }, home: root },
      });
      expect(result.receipt.outcome).toBe("PASS");
      expect(result.receipt.acceptance[0]?.status).toBe("PASS");
      expect(existsSync(result.jsonPath)).toBe(true);
      expect(existsSync(result.markdownPath)).toBe(true);
      const now = new Date();
      const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      expect(result.brainw2Writeback).toMatchObject({
        status: "written",
        target: "01 Projects/workspace/Dev Log.md",
        routes: [
          { category: "05 Daily", target: `05 Daily/${date}.md`, status: "written" },
          { category: "01 Projects", target: "01 Projects/workspace/Activity Log.md", status: "written" },
        ],
      });
      const mapping = await resolveProjectMapping(workspace, { env: { BRAINW2_VAULT: vaultPath, HOME: root, USERPROFILE: root }, home: root, create: false });
      expect(readFileSync(mapping!.dev_log_path, "utf8")).toContain(`- Receipt: ${result.receipt.run_id}`);
      expect(readFileSync(path.join(vaultPath, "05 Daily", `${date}.md`), "utf8")).toContain("write generated.txt");
      const stored = JSON.parse(readFileSync(result.jsonPath, "utf8"));
      expect(validateReceipt(stored).outcome).toBe("PASS");
      expect(readFileSync(result.markdownPath, "utf8")).toContain("# PASS");
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
});
