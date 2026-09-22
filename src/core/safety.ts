import fs from "node:fs";
import path from "node:path";

export const CAPABILITIES = ["fs.read", "fs.write", "fs.delete", "shell.execute", "git.read", "git.write", "network.read", "network.write", "secret.read", "external.write"] as const;
export type Capability = (typeof CAPABILITIES)[number];

export interface ApprovalRecord {
  approval_id: string;
  run_id: string;
  action: string;
  risk: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  reason: string;
  status: "PENDING" | "APPROVED" | "DENIED";
  requested_at: string;
  resolved_at: string | null;
}

export interface RuntimeBudget {
  max_steps?: number;
  max_tool_calls?: number;
  max_runtime_ms?: number;
  max_output_bytes?: number;
  max_context_size?: number;
}

export interface RetryAttempt {
  attempt: number;
  cause: string;
  decision: "RETRY" | "STOP";
  result: string;
  at: string;
}

export class SafetyError extends Error {
  constructor(public readonly code: string, message: string) { super(message); this.name = "SafetyError"; }
}

export function redactSecrets(value: unknown): unknown {
  if (typeof value === "string") return value
    .replace(/(sk-[A-Za-z0-9_-]{12,})/g, "[REDACTED_API_KEY]")
    .replace(/(gh[pousr]_[A-Za-z0-9_]{12,})/g, "[REDACTED_TOKEN]")
    .replace(/(Bearer\s+)[A-Za-z0-9._~+/=-]{8,}/gi, "$1[REDACTED]")
    .replace(/([A-Za-z][A-Za-z0-9+.-]*:\/\/)([^\s:@/]+):([^\s@/]+)@/g, "$1[REDACTED]@")
    .replace(/(password|secret|token|api[_-]?key)\s*[=:]\s*[^\s,;]+/gi, "$1=[REDACTED]");
  if (Array.isArray(value)) return value.map(redactSecrets);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, /password|secret|token|api[_-]?key|authorization/i.test(key) ? "[REDACTED]" : redactSecrets(item)]));
  return value;
}

export function assertCapability(capabilities: ReadonlySet<Capability>, capability: Capability): void {
  if (!capabilities.has(capability)) throw new SafetyError("CAPABILITY_DENIED", `Capability denied: ${capability}`);
}

export function canonicalWorkspacePath(workspace: string): string {
  return fs.realpathSync.native(workspace);
}

export function assertWorkspacePath(workspace: string, candidate: string): string {
  const root = canonicalWorkspacePath(workspace);
  const resolved = path.resolve(root, candidate);
  const relative = path.relative(root, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) throw new SafetyError("WORKSPACE_ESCAPE", `Path escapes workspace: ${candidate}`);
  let canonical = resolved;
  try {
    canonical = fs.realpathSync.native(resolved);
  } catch {
    const parent = fs.realpathSync.native(path.dirname(resolved));
    canonical = path.join(parent, path.basename(resolved));
  }
  const canonicalRelative = path.relative(root, canonical);
  if (canonicalRelative.startsWith("..") || path.isAbsolute(canonicalRelative)) throw new SafetyError("SYMLINK_ESCAPE", `Symlink escapes workspace: ${candidate}`);
  return canonical;
}

export function commandRisk(command: string, args: string[]): { risk: ApprovalRecord["risk"]; action: string; reason: string } {
  const text = `${command} ${args.join(" ")}`.toLowerCase();
  if (/git\s+push|curl\s+.*-x|invoke-webrequest|invoke-restmethod|npm\s+publish/.test(text)) return { risk: "CRITICAL", action: "external-write", reason: "external or network write" };
  if (/git\s+commit|rm\s|remove-item|del\s|format|drop\s/.test(text)) return { risk: "HIGH", action: "destructive-shell", reason: "destructive or history-changing shell action" };
  return { risk: "LOW", action: "shell", reason: "bounded local shell execution" };
}

export class RetryPolicy {
  readonly attempts: RetryAttempt[] = [];
  constructor(readonly maxRetries = 2) {}
  decide(cause: string, result: string): RetryAttempt {
    const attempt = this.attempts.length + 1;
    const decision = attempt <= this.maxRetries ? "RETRY" : "STOP";
    const record: RetryAttempt = { attempt, cause, decision, result, at: new Date().toISOString() };
    this.attempts.push(record);
    return record;
  }
}
