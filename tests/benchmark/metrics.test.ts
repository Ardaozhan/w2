import { describe, expect, it } from "vitest";
import { isFalseDoneBenchmarkRun } from "../../benchmarks/metrics.mjs";

describe("benchmark false-DONE classification", () => {
  it("uses the external verifier outcome for Raw Codex", () => {
    expect(isFalseDoneBenchmarkRun({ condition: "raw_codex", claim_done: true, status: "TASK_FAIL", external_verification: { status: "FAIL" } })).toBe(true);
    expect(isFalseDoneBenchmarkRun({ condition: "raw_codex", claim_done: true, status: "TASK_PASS", external_verification: { status: "PASS" } })).toBe(false);
  });

  it("uses required criterion outcomes for W2 even when a generic verifier passed", () => {
    const run = { condition: "w2_codex" as const, claim_done: true, status: "TASK_UNPROVEN" as const, infrastructure_failure: false, external_verification: { status: "PASS" } };
    expect(isFalseDoneBenchmarkRun(run, [{ required: true, status: "UNPROVEN" }])).toBe(true);
    expect(isFalseDoneBenchmarkRun(run, [{ required: true, status: "PASS" }])).toBe(false);
    expect(isFalseDoneBenchmarkRun({ ...run, claim_done: false }, [{ required: true, status: "UNPROVEN" }])).toBe(false);
  });

  it("does not score infrastructure failure as false-DONE", () => {
    expect(isFalseDoneBenchmarkRun({ condition: "raw_codex", claim_done: true, status: "INFRASTRUCTURE_FAILURE", infrastructure_failure: true, external_verification: { status: "UNPROVEN" } })).toBe(false);
    expect(isFalseDoneBenchmarkRun({ condition: "w2_codex", claim_done: true, status: "INFRASTRUCTURE_FAILURE", infrastructure_failure: true }, [{ required: true, status: "UNPROVEN" }])).toBe(false);
  });
});
