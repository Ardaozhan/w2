import { execFile, spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { promises as fs } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import type { EventType, ToolCallRecord } from "./types.js";
import { assertCapability, assertWorkspacePath, commandRisk, redactSecrets, SafetyError, type ApprovalRecord, type Capability, type RuntimeBudget } from "./safety.js";

const execFileAsync = promisify(execFile);
export const DEFAULT_SHELL_TIMEOUT_MS = 5 * 60 * 1000;
const PROCESS_TREE_KILL_TIMEOUT_MS = 5_000;
const WINDOWS_JOB_SETUP_FAILED_EXIT_CODE = 97;

export interface ToolRuntimeOptions {
  env?: NodeJS.ProcessEnv;
  capabilities?: Capability[];
  budget?: RuntimeBudget;
  approval?: (request: Omit<ApprovalRecord, "approval_id" | "run_id" | "requested_at" | "resolved_at">) => Promise<boolean> | boolean;
  onSafetyEvent?: (type: EventType, payload: unknown) => void;
  runId?: string;
}

export class ToolRuntime {
  readonly calls: ToolCallRecord[] = [];
  readonly startedAt = Date.now();
  readonly capabilities: ReadonlySet<Capability>;
  readonly budget: RuntimeBudget;
  private readonly options: ToolRuntimeOptions;
  private steps = 0;

  constructor(readonly workspace: string, options: ToolRuntimeOptions = {}) {
    this.workspace = path.resolve(workspace);
    this.capabilities = new Set(options.capabilities ?? ["fs.read", "fs.write", "shell.execute", "git.read"]);
    this.budget = options.budget ?? {};
    this.options = options;
  }

  private emit(type: EventType, payload: unknown): void { this.options.onSafetyEvent?.(type, redactSecrets(payload)); }

  private checkBudget(extraOutput = 0): void {
    this.steps += 1;
    const exhausted = (this.budget.max_steps !== undefined && this.steps > this.budget.max_steps)
      || (this.budget.max_tool_calls !== undefined && this.calls.length >= this.budget.max_tool_calls)
      || (this.budget.max_runtime_ms !== undefined && Date.now() - this.startedAt > this.budget.max_runtime_ms)
      || (this.budget.max_output_bytes !== undefined && extraOutput > this.budget.max_output_bytes);
    if (exhausted) {
      this.emit("budget_exhausted", { steps: this.steps, tool_calls: this.calls.length, budget: this.budget });
      throw new SafetyError("BUDGET_EXHAUSTED", "Runtime budget exhausted");
    }
  }

  private require(capability: Capability): void {
    try { assertCapability(this.capabilities, capability); }
    catch (error) { this.emit("safety_denied", { capability, reason: error instanceof Error ? error.message : String(error) }); throw error; }
  }

  private async requireApproval(command: string, args: string[]): Promise<void> {
    const risk = commandRisk(command, args);
    if (risk.risk === "LOW") return;
    const request = { action: risk.action, risk: risk.risk, reason: risk.reason, status: "PENDING" as const };
    this.emit("approval_requested", request);
    const approved = this.options.approval ? await this.options.approval(request) : false;
    this.emit("approval_resolved", { ...request, status: approved ? "APPROVED" : "DENIED" });
    if (!approved) { this.emit("safety_denied", { action: risk.action, reason: "approval denied" }); throw new SafetyError("APPROVAL_DENIED", `Approval denied: ${risk.action}`); }
  }

  private safePath(relativePath: string): string { return assertWorkspacePath(this.workspace, relativePath); }

  private shellTimeoutMs(requestedTimeoutMs?: number): number {
    const requested = Math.max(1, Math.floor(requestedTimeoutMs ?? DEFAULT_SHELL_TIMEOUT_MS));
    if (this.budget.max_runtime_ms === undefined) return requested;
    const remaining = this.budget.max_runtime_ms - (Date.now() - this.startedAt);
    if (remaining <= 0) throw new SafetyError("BUDGET_EXHAUSTED", "Runtime wall-clock budget exhausted");
    return Math.min(requested, Math.max(1, Math.floor(remaining)));
  }

  private async record<T>(toolName: string, input: unknown, operation: () => Promise<T>): Promise<T> {
    this.checkBudget();
    const startedAt = new Date().toISOString();
    const safeInput = redactSecrets(input);
    try {
      const result = await operation();
      const safeResult = redactSecrets(result) as T;
      this.calls.push({ tool_name: toolName, input: safeInput, started_at: startedAt, finished_at: new Date().toISOString(), result: safeResult });
      return safeResult;
    } catch (error) {
      const message = redactSecrets(error instanceof Error ? error.message : String(error)) as string;
      this.calls.push({ tool_name: toolName, input: safeInput, started_at: startedAt, finished_at: new Date().toISOString(), error: message });
      throw error;
    }
  }

  readFile(relativePath: string): Promise<string> {
    this.require("fs.read");
    return this.record("filesystem.read", { path: relativePath }, () => fs.readFile(this.safePath(relativePath), "utf8"));
  }

  async writeFile(relativePath: string, contents: string): Promise<void> {
    this.require("fs.write");
    await this.record("filesystem.write", { path: relativePath, bytes: Buffer.byteLength(contents) }, async () => {
      const target = this.safePath(relativePath);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, contents, "utf8");
    });
  }

  async deleteFile(relativePath: string): Promise<void> {
    this.require("fs.delete");
    await this.record("filesystem.delete", { path: relativePath }, async () => {
      const target = this.safePath(relativePath);
      const approved = this.options.approval ? await this.options.approval({ action: "filesystem.delete", risk: "HIGH", reason: "destructive delete", status: "PENDING" }) : false;
      if (!approved) throw new SafetyError("APPROVAL_DENIED", "Approval denied: filesystem.delete");
      await fs.rm(target, { force: true });
    });
  }

  async shell(command: string, args: string[] = [], timeoutMs?: number, allowedExitCodes: number[] = [0]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    this.require("shell.execute");
    await this.requireApproval(command, args);
    const limit = this.budget.max_output_bytes ?? 1024 * 1024;
    return this.record("shell", { command, args }, async () => {
      const effectiveTimeoutMs = this.shellTimeoutMs(timeoutMs);
      const environment = filteredEnvironment(this.options.env);
      const windowsJob = process.platform === "win32"
        ? windowsJobInvocation(command, args, this.workspace, environment, effectiveTimeoutMs)
        : undefined;
      let result = await executeChildProcess(
        windowsJob?.command ?? command,
        windowsJob?.args ?? args,
        this.workspace,
        environment,
        limit,
        effectiveTimeoutMs + (windowsJob ? PROCESS_TREE_KILL_TIMEOUT_MS : 0),
        process.platform !== "win32",
      );
      if (windowsJob && result.exitCode === WINDOWS_JOB_SETUP_FAILED_EXIT_CODE && result.stderr.includes("W2_JOB_SETUP_FAILED")) {
        this.emit("safety_denied", { reason: "Windows Job Object unavailable; using taskkill process-tree fallback", command });
        result = await executeChildProcess(command, args, this.workspace, environment, limit, effectiveTimeoutMs, false);
      }
      if (windowsJob && result.stderr.includes("W2_JOB_TIMED_OUT")) {
        result = { ...result, stderr: result.stderr.replace(/^W2_JOB_TIMED_OUT\r?\n?/m, ""), exitCode: 124, timedOut: true };
      }
      if (result.timedOut) this.emit("safety_denied", { reason: "shell timeout", command });
      if (result.outputLimited) this.emit("safety_denied", { reason: "shell output limit", command });
      if (result.exitCode === 0) this.checkBudget(Buffer.byteLength(result.stdout) + Buffer.byteLength(result.stderr));
      return { stdout: result.stdout, stderr: result.stderr, exitCode: result.exitCode };
    }).then((result) => {
      if (!allowedExitCodes.includes(result.exitCode)) {
        const latest = this.calls[this.calls.length - 1];
        if (latest) latest.error = result.stderr || `Command exited with code ${result.exitCode}`;
      }
      return result;
    });
  }

  async gitStatus(paths?: string[]): Promise<string> {
    this.require("git.read");
    const result = await this.shell("git", [...(paths ? ["--literal-pathspecs"] : []), "status", "--porcelain=v1", ...(paths ? ["--", ...paths] : [])]);
    if (result.exitCode !== 0) throw new Error(`git status failed: ${result.stderr}`);
    return result.stdout;
  }

  async gitDiff(paths?: string[]): Promise<{ diff: string; numstat: string }> {
    this.require("git.read");
    const scopedArgs = paths ? ["--", ...paths] : ["--"];
    let diffText: string;
    let numstatText: string;
    const head = await this.shell("git", ["rev-parse", "--verify", "HEAD"]);
    if (head.exitCode === 0) {
      const [diff, numstat] = await Promise.all([
        this.shell("git", ["--literal-pathspecs", "diff", "HEAD", ...scopedArgs]),
        this.shell("git", ["--literal-pathspecs", "diff", "HEAD", "--numstat", ...scopedArgs]),
      ]);
      if (diff.exitCode !== 0 || numstat.exitCode !== 0) throw new Error(`git diff failed: ${diff.stderr || numstat.stderr}`);
      diffText = diff.stdout;
      numstatText = numstat.stdout;
    } else {
      const [stagedDiff, unstagedDiff, stagedNumstat, unstagedNumstat] = await Promise.all([
        this.shell("git", ["--literal-pathspecs", "diff", "--cached", ...scopedArgs]),
        this.shell("git", ["--literal-pathspecs", "diff", ...scopedArgs]),
        this.shell("git", ["--literal-pathspecs", "diff", "--cached", "--numstat", ...scopedArgs]),
        this.shell("git", ["--literal-pathspecs", "diff", "--numstat", ...scopedArgs]),
      ]);
      const failed = [stagedDiff, unstagedDiff, stagedNumstat, unstagedNumstat].find((result) => result.exitCode !== 0);
      if (failed) throw new Error(`git diff failed: ${failed.stderr}`);
      diffText = [stagedDiff.stdout, unstagedDiff.stdout].filter(Boolean).join("\n");
      numstatText = [stagedNumstat.stdout, unstagedNumstat.stdout].filter(Boolean).join("\n");
    }

    const untracked = await this.shell("git", [...(paths ? ["--literal-pathspecs"] : []), "ls-files", "--others", "--exclude-standard", "-z", ...(paths ? ["--", ...paths] : [])]);
    if (untracked.exitCode !== 0) throw new Error(`git untracked-file lookup failed: ${untracked.stderr}`);
    const untrackedPaths = untracked.stdout.split("\0").filter(Boolean);
    const untrackedDiffs: string[] = [];
    const untrackedNumstat: string[] = [];
    for (const untrackedPath of untrackedPaths) {
      const [fileDiff, fileNumstat] = await Promise.all([
        this.shell("git", ["--literal-pathspecs", "diff", "--no-index", "--no-ext-diff", "--binary", "--", "/dev/null", untrackedPath], undefined, [0, 1]),
        this.shell("git", ["--literal-pathspecs", "diff", "--no-index", "--numstat", "--", "/dev/null", untrackedPath], undefined, [0, 1]),
      ]);
      if (fileDiff.exitCode !== 0 && fileDiff.exitCode !== 1) throw new Error(`git untracked diff failed for ${untrackedPath}: ${fileDiff.stderr}`);
      if (fileNumstat.exitCode !== 0 && fileNumstat.exitCode !== 1) throw new Error(`git untracked numstat failed for ${untrackedPath}: ${fileNumstat.stderr}`);
      untrackedDiffs.push(fileDiff.stdout);
      untrackedNumstat.push(fileNumstat.stdout);
    }
    return {
      diff: [diffText, ...untrackedDiffs].filter(Boolean).join("\n"),
      numstat: [numstatText, ...untrackedNumstat].filter(Boolean).join("\n"),
    };
  }
}

function truncate(value: string, maxBytes: number): string { return Buffer.byteLength(value) <= maxBytes ? value : `${Buffer.from(value).subarray(0, maxBytes).toString("utf8")}\n[OUTPUT_REDACTED_LIMIT]`; }

function filteredEnvironment(source: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const allowed = new Set(["path", "systemroot", "windir", "comspec", "pathext", "temp", "tmp", "home", "userprofile", "homedrive", "homepath", "appdata", "localappdata", "codex_home", "npm_config_userconfig", "npm_config_cache", "git_config_global", "git_config_nosystem", "username", "userdomain", "node_options"]);
  return Object.fromEntries(Object.entries(source).filter(([key]) => allowed.has(key.toLowerCase())));
}

function windowsJobInvocation(command: string, args: string[], cwd: string, environment: NodeJS.ProcessEnv, timeoutMs: number): { command: string; args: string[] } {
  const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
  const runnerPath = [
    path.resolve(moduleDirectory, "../../scripts/w2-job-runner.ps1"),
    path.resolve(moduleDirectory, "../../../scripts/w2-job-runner.ps1"),
  ].find(existsSync);
  const bootstrapPath = [
    path.resolve(moduleDirectory, "../../scripts/w2-job-bootstrap.mjs"),
    path.resolve(moduleDirectory, "../../../scripts/w2-job-bootstrap.mjs"),
  ].find(existsSync);
  if (!runnerPath || !bootstrapPath) throw new Error("W2 Windows Job Object runner files are missing from the installation.");
  const payload = Buffer.from(JSON.stringify({
    file: command,
    args,
    cwd,
    nodeExecutable: process.execPath,
    bootstrapPath,
    deadlineEpochMs: Date.now() + timeoutMs,
    environment: Object.entries(environment).map(([key, value]) => `${key}=${value ?? ""}`),
  }), "utf8").toString("base64");
  return {
    command: "powershell.exe",
    args: ["-NoLogo", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", runnerPath, payload],
  };
}

interface ChildExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  timedOut: boolean;
  outputLimited: boolean;
}

async function executeChildProcess(command: string, args: string[], cwd: string, environment: NodeJS.ProcessEnv, maxBuffer: number, timeoutMs: number, detached: boolean): Promise<ChildExecutionResult> {
  const child = spawn(command, args, { cwd, env: environment, windowsHide: true, detached, stdio: ["ignore", "pipe", "pipe"] });
  const stdout: Buffer[] = [];
  const stderr: Buffer[] = [];
  let stdoutBytes = 0;
  let stderrBytes = 0;
  let timedOut = false;
  let outputLimited = false;
  let spawnError: Error | undefined;
  let termination: Promise<void> | undefined;
  const terminate = () => {
    termination ??= terminateProcessTree(child);
    return termination;
  };
  const capture = (chunks: Buffer[], stream: "stdout" | "stderr", chunk: Buffer) => {
    const currentBytes = stream === "stdout" ? stdoutBytes : stderrBytes;
    const remainingBytes = Math.max(0, maxBuffer - currentBytes);
    if (remainingBytes > 0) chunks.push(chunk.subarray(0, remainingBytes));
    const nextBytes = currentBytes + chunk.byteLength;
    if (stream === "stdout") stdoutBytes = nextBytes;
    else stderrBytes = nextBytes;
    if (nextBytes > maxBuffer && !outputLimited) {
      outputLimited = true;
      void terminate();
    }
  };
  child.stdout?.on("data", (chunk: Buffer | string) => capture(stdout, "stdout", Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
  child.stderr?.on("data", (chunk: Buffer | string) => capture(stderr, "stderr", Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
  child.once("error", (error) => { spawnError = error; });
  const timeout = setTimeout(() => {
    timedOut = true;
    void terminate();
  }, timeoutMs);
  return new Promise((resolve) => {
    child.once("close", async (code) => {
      clearTimeout(timeout);
      if (termination) await termination.catch(() => undefined);
      const stdoutText = truncate(Buffer.concat(stdout).toString("utf8"), maxBuffer);
      let stderrText = truncate(Buffer.concat(stderr).toString("utf8"), maxBuffer);
      if (spawnError) stderrText ||= spawnError.message;
      if (timedOut) stderrText ||= `Command timed out after ${timeoutMs} ms`;
      if (outputLimited) stderrText ||= `Command output exceeded ${maxBuffer} byte limit`;
      resolve({
        stdout: stdoutText,
        stderr: stderrText,
        exitCode: timedOut ? 124 : outputLimited ? 125 : code ?? 1,
        timedOut,
        outputLimited,
      });
    });
  });
}

async function terminateProcessTree(child: ChildProcess): Promise<void> {
  if (!child.pid) return;
  if (process.platform === "win32") {
    try {
      await execFileAsync("taskkill.exe", ["/pid", String(child.pid), "/t", "/f"], {
        windowsHide: true,
        timeout: PROCESS_TREE_KILL_TIMEOUT_MS,
        maxBuffer: 64 * 1024,
        env: filteredEnvironment(),
      });
      return;
    } catch {
      child.kill("SIGKILL");
      return;
    }
  }
  try {
    process.kill(-child.pid, "SIGKILL");
  } catch {
    child.kill("SIGKILL");
  }
}
