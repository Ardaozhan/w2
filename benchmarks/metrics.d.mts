export interface BenchmarkFalseDoneRun {
  condition: "raw_codex" | "w2_codex";
  claim_done: boolean;
  infrastructure_failure?: boolean;
  status: "TASK_PASS" | "TASK_FAIL" | "TASK_UNPROVEN" | "INFRASTRUCTURE_FAILURE";
  external_verification?: { status?: string };
}
export function isFalseDoneBenchmarkRun(run: BenchmarkFalseDoneRun, acceptance?: Array<{ required: boolean; status: string }>): boolean;
