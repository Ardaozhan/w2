import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { RunStore } from "../../src/core/store.js";

function setup() {
  const directory = mkdtempSync(path.join(os.tmpdir(), "w2-store-"));
  const store = new RunStore(path.join(directory, "run.sqlite"));
  store.createRun({ run_id: "run-1", task_id: "task-1", started_at: "2026-01-01T00:00:00.000Z", model: "codex", workspace: directory });
  return { directory, store };
}

describe("SQLite run store", () => {
  it("rejects invalid state transitions and orders events by sequence", () => {
    const { directory, store } = setup();
    expect(() => store.transition("run-1", "COMPLETED")).toThrow(/Invalid run transition/);
    store.transition("run-1", "PREPARING");
    store.appendEvent("run-1", "context_built", { n: 1 });
    store.appendEvent("run-1", "agent_started", {});
    expect(store.getEvents("run-1").map((event) => event.sequence)).toEqual([1, 2]);
    store.close();
    const reopened = new RunStore(path.join(directory, "run.sqlite"));
    expect(reopened.getEvents("run-1")).toHaveLength(2);
    reopened.close();
    rmSync(directory, { recursive: true, force: true });
  });

  it("persists tool errors", () => {
    const { directory, store } = setup();
    store.appendToolCall("run-1", { tool_name: "shell", input: { command: "bad" }, started_at: "a", finished_at: "b", error: "boom" });
    expect(store.getToolCalls("run-1")[0]?.error).toBe("boom");
    store.close();
    rmSync(directory, { recursive: true, force: true });
  });
});
