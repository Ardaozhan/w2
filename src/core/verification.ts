import type { ToolRuntime } from "./runtime.js";
import { DEFAULT_SHELL_TIMEOUT_MS } from "./runtime.js";
import { SafetyError } from "./safety.js";
import type { TaskDefinition, VerificationResult } from "./types.js";

const DEFAULT_VERIFICATION_TIMEOUT_MS = DEFAULT_SHELL_TIMEOUT_MS * 2;

function shellInvocation(command: string): { executable: string; args: string[] } {
  return process.platform === "win32"
    ? { executable: "cmd.exe", args: ["/d", "/s", "/c", command] }
    : { executable: "/bin/sh", args: ["-lc", command] };
}

export async function runVerifications(task: TaskDefinition, runtime: ToolRuntime, precomputedResults: VerificationResult[] = []): Promise<VerificationResult[]> {
  const results: VerificationResult[] = [];
  const precomputedById = new Map(precomputedResults.map((result) => [result.verifier_id, result]));
  const verificationStartedAt = Date.now();
  const verificationBudgetMs = task.verification_timeout_ms ?? DEFAULT_VERIFICATION_TIMEOUT_MS;
  const commandTimeoutMs = task.timeout_ms ?? DEFAULT_SHELL_TIMEOUT_MS;
  const appendPrecomputedOrBudgetError = (verification: TaskDefinition["verification_commands"][number], reason: string) => {
    const precomputed = precomputedById.get(verification.id);
    if (precomputed) {
      if (precomputed.name !== verification.name || precomputed.command !== verification.command || precomputed.category !== verification.category) {
        throw new Error(`Precomputed verifier result does not match task contract: ${verification.id}`);
      }
      results.push(precomputed);
      return;
    }
    results.push({
      verifier_id: verification.id,
      name: verification.name,
      category: verification.category,
      command: verification.command,
      exit_code: null,
      stdout: "",
      stderr: reason,
      duration_ms: 0,
      status: "ERROR",
    });
  };
  const appendBudgetErrors = (fromIndex: number, reason: string) => {
    for (const verification of task.verification_commands.slice(fromIndex)) {
      appendPrecomputedOrBudgetError(verification, reason);
    }
  };
  for (const [index, verification] of task.verification_commands.entries()) {
    const precomputed = precomputedById.get(verification.id);
    if (precomputed) {
      if (precomputed.name !== verification.name || precomputed.command !== verification.command || precomputed.category !== verification.category) {
        throw new Error(`Precomputed verifier result does not match task contract: ${verification.id}`);
      }
      results.push(precomputed);
      continue;
    }
    const remainingBudgetMs = verificationBudgetMs - (Date.now() - verificationStartedAt);
    if (remainingBudgetMs <= 0) {
      appendBudgetErrors(index, "Total verification time budget exhausted before this check started.");
      break;
    }
    const effectiveTimeoutMs = Math.min(commandTimeoutMs, remainingBudgetMs);
    const started = Date.now();
    const invocation = shellInvocation(verification.command);
    let result: Awaited<ReturnType<ToolRuntime["shell"]>>;
    try {
      result = await runtime.shell(invocation.executable, invocation.args, effectiveTimeoutMs);
    } catch (error) {
      if (!(error instanceof SafetyError) || error.code !== "BUDGET_EXHAUSTED") throw error;
      results.push({
        verifier_id: verification.id,
        name: verification.name,
        category: verification.category,
        command: verification.command,
        exit_code: null,
        stdout: "",
        stderr: "W2 runtime wall-clock budget exhausted before this check completed.",
        duration_ms: Date.now() - started,
        status: "ERROR",
      });
      appendBudgetErrors(index + 1, "W2 runtime wall-clock budget exhausted before this check started.");
      break;
    }
    const durationMs = Date.now() - started;
    results.push({
      verifier_id: verification.id,
      name: verification.name,
      category: verification.category,
      command: verification.command,
      exit_code: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
      duration_ms: durationMs,
      status: result.exitCode === 0 ? "PASSED" : result.exitCode === 124 || result.exitCode === 125 ? "ERROR" : "FAILED",
    });
    const reachedTotalBudget = Date.now() - verificationStartedAt >= verificationBudgetMs;
    if (reachedTotalBudget && result.exitCode === 124 && effectiveTimeoutMs <= remainingBudgetMs) {
      appendBudgetErrors(index + 1, "Total verification time budget exhausted before this check started.");
      break;
    }
  }
  return results;
}
