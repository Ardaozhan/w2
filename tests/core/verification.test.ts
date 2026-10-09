import { describe, expect, it, vi } from "vitest";
import type { ToolRuntime } from "../../src/core/runtime.js";
import { runVerifications } from "../../src/core/verification.js";
import type { TaskDefinition } from "../../src/core/types.js";

describe("verification wall-clock budget", () => {
  it("shares one total timeout across sequential verifier commands", async () => {
    let now = 1000;
    const dateNow = vi.spyOn(Date, "now").mockImplementation(() => now);
    const timeouts: number[] = [];
    const runtime = {
      shell: async (_command: string, _args: string[], timeoutMs?: number) => {
        timeouts.push(timeoutMs ?? -1);
        if (timeouts.length === 1) {
          now += 7000;
          return { stdout: "", stderr: "", exitCode: 0 };
        }
        now += timeoutMs ?? 0;
        return { stdout: "", stderr: "timed out", exitCode: 124 };
      },
    } as unknown as ToolRuntime;
    const task: TaskDefinition = {
      task_id: "verification-budget",
      title: "Verification budget",
      goal: "run checks",
      constraints: [],
      allowed_paths: ["."],
      acceptance_criteria: [{ id: "AC-01", statement: "checks finish", required: true, verification_refs: ["V1", "V2", "V3"] }],
      verification_commands: [
        { id: "V1", name: "first", command: "first", category: "test" },
        { id: "V2", name: "second", command: "second", category: "lint" },
        { id: "V3", name: "third", command: "third", category: "build" },
      ],
      timeout_ms: 8000,
      verification_timeout_ms: 10_000,
    };

    try {
      const results = await runVerifications(task, runtime);
      expect(timeouts).toEqual([8000, 3000]);
      expect(results.map((result) => result.status)).toEqual(["PASSED", "ERROR", "ERROR"]);
      expect(results[2]?.stderr).toContain("Total verification time budget exhausted");
    } finally {
      dateNow.mockRestore();
    }
  });

  it("preserves precomputed results for checks after budget exhaustion", async () => {
    let now = 1000;
    const dateNow = vi.spyOn(Date, "now").mockImplementation(() => now);
    const runtime = {
      shell: async () => {
        now += 1000;
        return { stdout: "", stderr: "timed out", exitCode: 124 };
      },
    } as unknown as ToolRuntime;
    const task: TaskDefinition = {
      task_id: "precomputed-verification-budget",
      title: "Precomputed verification budget",
      goal: "run checks",
      constraints: [],
      allowed_paths: ["."],
      acceptance_criteria: [],
      verification_commands: [
        { id: "V1", name: "first", command: "first", category: "test" },
        { id: "V2", name: "precomputed", command: "precomputed", category: "lint" },
      ],
      verification_timeout_ms: 1000,
    };
    const precomputed = {
      verifier_id: "V2",
      name: "precomputed",
      command: "precomputed",
      category: "lint" as const,
      exit_code: 0,
      stdout: "already checked",
      stderr: "",
      duration_ms: 0,
      status: "PASSED" as const,
    };

    try {
      const results = await runVerifications(task, runtime, [precomputed]);
      expect(results.map((result) => result.status)).toEqual(["ERROR", "PASSED"]);
      expect(results[1]).toEqual(precomputed);
    } finally {
      dateNow.mockRestore();
    }
  });
});
