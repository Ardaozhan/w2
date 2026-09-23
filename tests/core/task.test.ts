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

  const base = {
    task_id: "mapping", title: "mapping", goal: "verify mapping", constraints: [], allowed_paths: [],
    acceptance_criteria: [{ id: "AC-01", statement: "the check passes", required: true, verification_refs: ["V1"] }],
    verification_commands: [{ id: "V1", name: "test", command: "npm test", category: "test" }],
  };

  it("normalizes legacy criteria but leaves them unreferenced", () => {
    const task = parseTask({ ...base, acceptance_criteria: ["legacy criterion"], verification_commands: [{ name: "test", command: "npm test", category: "test" }] });
    expect(task.acceptance_criteria[0]).toEqual({ id: "AC-01", statement: "legacy criterion", required: true, verification_refs: [] });
    expect(task.verification_commands[0]?.id).toBe("test");
  });

  it("rejects references to missing verifier IDs", () => {
    expect(() => parseTask({ ...base, acceptance_criteria: [{ ...base.acceptance_criteria[0], verification_refs: ["V99"] }] })).toThrow(/Unknown verifier ID/);
  });

  it("rejects duplicate verifier and criterion IDs", () => {
    expect(() => parseTask({ ...base, verification_commands: [...base.verification_commands, { id: "V1", name: "other", command: "npm test", category: "test" }] })).toThrow(/Duplicate verifier ID/);
    expect(() => parseTask({ ...base, acceptance_criteria: [base.acceptance_criteria[0], { ...base.acceptance_criteria[0], statement: "duplicate" }] })).toThrow(/Duplicate criterion ID/);
  });

  it("rejects empty references and malformed criterion structures", () => {
    expect(() => parseTask({ ...base, acceptance_criteria: [{ ...base.acceptance_criteria[0], verification_refs: [""] }] })).toThrow();
    expect(() => parseTask({ ...base, acceptance_criteria: [{ id: "AC-01", required: true, verification_refs: ["V1"] }] })).toThrow();
  });
});
