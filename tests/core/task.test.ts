import { describe, expect, it } from "vitest";
import { parseTask } from "../../src/core/task.js";

describe("task contract", () => {
  it("rejects malformed tasks instead of defaulting fields", () => {
    expect(() => parseTask({ task_id: "only-id" })).toThrow();
  });

  it("rejects unknown task fields", () => {
    expect(() => parseTask({
      task_id: "id", title: "title", goal: "goal", constraints: [], allowed_paths: [], acceptance_criteria: ["criterion"],
      verification_commands: [{ name: "test", command: "npm test", category: "test" }], unexpected: true,
    })).toThrow();
  });
});
