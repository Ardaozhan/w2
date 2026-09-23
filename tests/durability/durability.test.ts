import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { RunEngine } from "../../src/core/engine.js";
import { buildRunReceipt } from "../../src/core/evidence.js";
import type { AgentAdapter, AgentStartInput } from "../../src/core/agent.js";
import type { AgentOutput, AgentRunResult, TaskDefinition } from "../../src/core/types.js";

class DurableAdapter implements AgentAdapter {
  readonly provider = "codex" as const;
  startCount = 0;
  sendTask(task: TaskDefinition): string { return task.goal; }
  receiveAction(): undefined { return undefined; }
  receiveOutput(raw: unknown): AgentOutput { return { kind: "fake", raw }; }
  cancel(): void {}
  async startRun(input: AgentStartInput): Promise<AgentRunResult> { this.startCount += 1; writeFileSync(path.join(input.workspace, "durable.txt"), "done", "utf8"); return { exit_code: 0, outputs: [], tool_calls: [] }; }
}

function task(workspace: string): TaskDefinition {
  return { task_id: "durability-task", title: "durability", goal: "checkpoint", constraints: [], allowed_paths: ["."], acceptance_criteria: [{ id: "AC-01", statement: "checkpoint exists", required: true, verification_refs: ["ok"] }], verification_commands: [{ id: "ok", name: "ok", category: "custom", command: process.platform === "win32" ? "exit /b 0" : "true" }], workspace };
}

describe("Phase 03 durability", () => {
  it("inspects checkpoint recovery state without claiming resumed execution", async () => {
    const workspace = mkdtempSync(path.join(os.tmpdir(), "w2-durable-"));
    const adapter = new DurableAdapter();
    const engine = new RunEngine({ databasePath: path.join(workspace, "run.sqlite"), adapter });
    const result = await engine.run(task(workspace));
    expect(engine.store.getCheckpoint(result.run_id)?.completed_tool_calls).toBeTypeOf("number");
    const recovered = engine.resume(result.run_id);
    expect(recovered.status).toBe(result.status);
    expect(adapter.startCount).toBe(0); // inspection does not restart completed work
    expect(engine.store.getEvents(result.run_id).some((event) => event.type === "run_resumed")).toBe(true);
    const receipt = buildRunReceipt(engine.store, result.run_id);
    expect(receipt.evidence.some((item) => item.summary.includes("safety and durability"))).toBe(true);
    const abortTask = { ...task(workspace), task_id: "abort-task" };
    engine.store.saveTask(abortTask);
    engine.store.createRun({ run_id: "abort-run", task_id: abortTask.task_id, started_at: "2026-09-22T10:00:00.000Z", model: "fixture", workspace });
    const aborted = engine.abort("abort-run");
    expect(aborted.status).toBe("ABORTED");
    expect(buildRunReceipt(engine.store, "abort-run").outcome).toBe("ABORTED");
    engine.close();
    rmSync(workspace, { recursive: true, force: true });
  });
});
