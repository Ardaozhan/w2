import type { ToolRuntime } from "./runtime.js";
import type { TaskDefinition, VerificationResult } from "./types.js";

function shellInvocation(command: string): { executable: string; args: string[] } {
  return process.platform === "win32"
    ? { executable: "cmd.exe", args: ["/d", "/s", "/c", command] }
    : { executable: "/bin/sh", args: ["-lc", command] };
}

export async function runVerifications(task: TaskDefinition, runtime: ToolRuntime): Promise<VerificationResult[]> {
  const results: VerificationResult[] = [];
  for (const verification of task.verification_commands) {
    const started = Date.now();
    const invocation = shellInvocation(verification.command);
    const result = await runtime.shell(invocation.executable, invocation.args, task.timeout_ms);
    results.push({
      name: verification.name,
      category: verification.category,
      command: verification.command,
      exit_code: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
      duration_ms: Date.now() - started,
      status: result.exitCode === 0 ? "PASSED" : "FAILED",
    });
  }
  return results;
}
