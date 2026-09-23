import { describe, expect, it } from "vitest";
import { buildCodexArgs, CodexAgentAdapter } from "../../src/core/agent.js";
import type { TaskDefinition } from "../../src/core/types.js";

describe("Codex adapter", () => {
  it("normalizes Codex command lifecycle events at one boundary", () => {
    const adapter = new CodexAgentAdapter();
    expect(adapter.receiveAction({ type: "item.started", item: { type: "command_execution", command: "npm test" } })).toEqual({
      tool_name: "command_execution", input: "npm test",
    });
    expect(adapter.receiveOutput({ type: "item.completed", item: { type: "agent_message" } }).kind).toBe("item.completed");
    expect(adapter.receiveOutput({ type: "item.completed", item: { type: "agent_message", text: "Done" } }).text).toBe("Done");
  });

  it("always sends the complete task goal and verification contract", () => {
    const adapter = new CodexAgentAdapter();
    const task: TaskDefinition = { task_id: "contract", title: "Fix arithmetic", goal: "Return the product", constraints: ["only change src/math.ts"], allowed_paths: ["src/math.ts"], acceptance_criteria: [{ id: "AC-01", statement: "multiply values", required: true, verification_refs: ["V1"] }], verification_commands: [{ id: "V1", name: "tests", command: "npm test", category: "test" }] };
    const prompt = adapter.sendTask(task, "{}");
    expect(prompt).toContain("Goal: Return the product");
    expect(prompt).toContain("only change src/math.ts");
    expect(prompt).toContain("AC-01 (required): multiply values");
    expect(prompt).toContain("V1 / tests: npm test");
    expect(prompt).not.toContain("undefined");
  });

  it("selects the supported workspace-write sandbox before exec", () => {
    expect(buildCodexArgs({ noDaemon: true, extraArgs: ["--ephemeral", "--ignore-rules"] }, "C:/fixture", "gpt-6-luna", "work")).toEqual([
      "--no-daemon", "--sandbox", "workspace-write", "exec", "--json", "--ephemeral", "--ignore-rules", "-C", "C:/fixture", "-m", "gpt-6-luna", "work",
    ]);
  });
});
