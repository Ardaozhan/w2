import { describe, expect, it } from "vitest";
import { CodexAgentAdapter } from "../../src/core/agent.js";

describe("Codex adapter", () => {
  it("normalizes Codex command lifecycle events at one boundary", () => {
    const adapter = new CodexAgentAdapter();
    expect(adapter.receiveAction({ type: "item.started", item: { type: "command_execution", command: "npm test" } })).toEqual({
      tool_name: "command_execution", input: "npm test",
    });
    expect(adapter.receiveOutput({ type: "item.completed", item: { type: "agent_message" } }).kind).toBe("item.completed");
  });
});
