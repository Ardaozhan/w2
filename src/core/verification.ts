import type { ToolRuntime } from "./runtime.js";
import type { TaskDefinition, VerificationResult } from "./types.js";

function shellInvocation(command: string): { executable: string; args: string[] } {
  return process.platform === "win32"
    ? { executable: "cmd.exe", args: ["/d", "/s", "/c", command] }
    : { executable: "/bin/sh", args: ["-lc", command] };
}

export async function runVerifications(task: TaskDefinition, runtime: ToolRuntime, precomputedResults: VerificationResult[] = []): Promise<VerificationResult[]> {
  const results: VerificationResult[] = [];
  const precomputedById = new Map(precomputedResults.map((result) => [result.verifier_id, result]));
  for (const verification of task.verification_commands) {
    const precomputed = precomputedById.get(verification.id);
    if (precomputed) {
      if (precomputed.name !== verification.name || precomputed.command !== verification.command || precomputed.category !== verification.category) {
        throw new Error(`Precomputed verifier result does not match task contract: ${verification.id}`);
      }
      results.push(precomputed);
      continue;
    }
    const started = Date.now();
    const invocation = shellInvocation(verification.command);
    const result = await runtime.shell(invocation.executable, invocation.args, task.timeout_ms);
    results.push({
      verifier_id: verification.id,
      name: verification.name,
      category: verification.category,
      command: verification.command,
      exit_code: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
      duration_ms: Date.now() - started,
      status: result.exitCode === 0 ? "PASSED" : result.exitCode === 124 || result.exitCode === 125 ? "ERROR" : "FAILED",
    });
  }
  return results;
}
