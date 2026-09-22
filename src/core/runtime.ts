import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import type { ToolCallRecord } from "./types.js";

const execFileAsync = promisify(execFile);

export class ToolRuntime {
  readonly calls: ToolCallRecord[] = [];

  constructor(readonly workspace: string) {
    this.workspace = path.resolve(workspace);
  }

  private safePath(relativePath: string): string {
    const resolved = path.resolve(this.workspace, relativePath);
    const relative = path.relative(this.workspace, resolved);
    if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error(`Path escapes workspace: ${relativePath}`);
    return resolved;
  }

  private async record<T>(toolName: string, input: unknown, operation: () => Promise<T>): Promise<T> {
    const startedAt = new Date().toISOString();
    try {
      const result = await operation();
      const call: ToolCallRecord = { tool_name: toolName, input, started_at: startedAt, finished_at: new Date().toISOString(), result };
      this.calls.push(call);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.calls.push({ tool_name: toolName, input, started_at: startedAt, finished_at: new Date().toISOString(), error: message });
      throw error;
    }
  }

  readFile(relativePath: string): Promise<string> {
    return this.record("filesystem.read", { path: relativePath }, () => fs.readFile(this.safePath(relativePath), "utf8"));
  }

  async writeFile(relativePath: string, contents: string): Promise<void> {
    await this.record("filesystem.write", { path: relativePath, bytes: Buffer.byteLength(contents) }, async () => {
      const target = this.safePath(relativePath);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, contents, "utf8");
    });
  }

  shell(command: string, args: string[] = [], timeoutMs?: number): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    return this.record("shell", { command, args }, async () => {
      try {
        const result = await execFileAsync(command, args, { cwd: this.workspace, timeout: timeoutMs, windowsHide: true, maxBuffer: 10 * 1024 * 1024 });
        return { stdout: result.stdout, stderr: result.stderr, exitCode: 0 };
      } catch (error) {
        const failure = error as { stdout?: string; stderr?: string; code?: number | string; killed?: boolean };
        return { stdout: failure.stdout ?? "", stderr: failure.stderr ?? String(error), exitCode: typeof failure.code === "number" ? failure.code : 1 };
      }
    }).then((result) => {
      if (result.exitCode !== 0) {
        const latest = this.calls[this.calls.length - 1];
        if (latest) latest.error = result.stderr || `Command exited with code ${result.exitCode}`;
      }
      return result;
    });
  }

  async gitStatus(): Promise<string> {
    const result = await this.shell("git", ["status", "--porcelain=v1"]);
    if (result.exitCode !== 0) throw new Error(`git status failed: ${result.stderr}`);
    return result.stdout;
  }

  async gitDiff(): Promise<{ diff: string; numstat: string }> {
    const [diff, numstat] = await Promise.all([
      this.shell("git", ["diff", "HEAD", "--"]),
      this.shell("git", ["diff", "HEAD", "--numstat"]),
    ]);
    if (diff.exitCode !== 0 || numstat.exitCode !== 0) throw new Error(`git diff failed: ${diff.stderr || numstat.stderr}`);
    return { diff: diff.stdout, numstat: numstat.stdout };
  }
}
