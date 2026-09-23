import { spawn, type ChildProcess } from "node:child_process";
import type { AgentOutput, AgentRunResult, TaskDefinition, ToolCallRecord } from "./types.js";

export interface AgentStartInput {
  task: TaskDefinition;
  workspace: string;
  context: string;
  timeoutMs: number;
}

export interface AgentAdapter {
  readonly provider: "codex";
  startRun(input: AgentStartInput): Promise<AgentRunResult>;
  sendTask(task: TaskDefinition, context: string): string;
  receiveAction(raw: unknown): { tool_name: string; input: unknown } | undefined;
  receiveOutput(raw: unknown): AgentOutput;
  cancel(): void;
}

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | undefined {
  return value && typeof value === "object" ? value as JsonRecord : undefined;
}

function getString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export class CodexAgentAdapter implements AgentAdapter {
  readonly provider = "codex" as const;
  private process?: ChildProcess;

  sendTask(task: TaskDefinition, context: string): string {
    return [
      `Task: ${task.title}`,
      `Goal: ${task.goal}`,
      `Constraints: ${task.constraints.join("; ") || "none"}`,
      `Allowed paths: ${task.allowed_paths.join(", ") || "all"}`,
      `Acceptance criteria: ${task.acceptance_criteria.join("; ")}`,
      `Verification requirements: ${task.verification_commands.map((command) => `${command.name}: ${command.command}`).join("; ")}`,
      "Work only in the supplied workspace. Make the smallest change that satisfies the task, run the declared verification command yourself, and summarize the actual changes.",
      `Context manifest (the files W2 selected):\n${context}`,
    ].join("\n\n");
  }

  receiveAction(raw: unknown): { tool_name: string; input: unknown } | undefined {
    const record = asRecord(raw);
    if (!record) return undefined;
    const item = asRecord(record.item) ?? record;
    const type = getString(item.type) ?? getString(record.type);
    if (!type || (!type.includes("command") && !type.includes("tool") && !type.includes("file_change"))) return undefined;
    const command = item.command ?? item.input ?? item.arguments ?? item;
    return { tool_name: type, input: command };
  }

  receiveOutput(raw: unknown): AgentOutput {
    const record = asRecord(raw);
    const item = record ? asRecord(record.item) : undefined;
    const text = record ? (getString(record.text) ?? getString(record.message) ?? getString(record.output) ?? getString(item?.text)) : undefined;
    return { kind: record ? (getString(record.type) ?? "codex_event") : "stdout", text, raw };
  }

  cancel(): void {
    this.process?.kill();
  }

  async startRun(input: AgentStartInput): Promise<AgentRunResult> {
    const prompt = this.sendTask(input.task, input.context);
    // Codex runs with its supported workspace-local sandbox. W2 records the
    // structured events but does not broker every native Codex tool call.
    const args = ["exec", "--json", "--sandbox", "workspace-write", "-C", input.workspace];
    if (input.task.model) args.push("-m", input.task.model);
    args.push(prompt);
    const child = spawn("codex", args, { cwd: input.workspace, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    this.process = child;
    const outputs: AgentOutput[] = [];
    const toolCalls: ToolCallRecord[] = [];
    let stderr = "";
    let buffer = "";
    let timedOut = false;
    const started = new Map<string, string>();
    const handleLine = (line: string): void => {
      if (!line.trim()) return;
      let raw: unknown;
      try { raw = JSON.parse(line); } catch { raw = line; }
      outputs.push(this.receiveOutput(raw));
      const action = this.receiveAction(raw);
      if (!action) return;
      const now = new Date().toISOString();
      const key = JSON.stringify(action.input);
      const record = asRecord(raw);
      const lifecycle = getString(record?.type) ?? "";
      if (lifecycle === "item.started") {
        started.set(key, now);
      } else if (lifecycle === "item.completed" || lifecycle === "") {
        toolCalls.push({ tool_name: action.tool_name, input: action.input, started_at: started.get(key) ?? now, finished_at: now, result: raw });
      }
    };
    child.stdout.on("data", (chunk: Buffer) => {
      buffer += chunk.toString();
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? "";
      lines.forEach(handleLine);
    });
    child.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });
    const timeout = setTimeout(() => { timedOut = true; child.kill(); }, input.timeoutMs);
    const exitCode = await new Promise<number>((resolve) => {
      child.on("error", (error) => { stderr += error.message; resolve(1); });
      child.on("close", (code) => resolve(code ?? 1));
    });
    clearTimeout(timeout);
    if (buffer.trim()) handleLine(buffer);
    this.process = undefined;
    const structuredError = outputs.find((output) => {
      const record = asRecord(output.raw);
      return getString(record?.type) === "error";
    });
    const structuredMessage = structuredError ? getString(asRecord(structuredError.raw)?.message) : undefined;
    return {
      exit_code: exitCode,
      outputs,
      tool_calls: toolCalls,
      error: exitCode === 0 ? undefined : (timedOut ? `Codex process timed out after ${input.timeoutMs}ms` : (structuredMessage ?? (stderr || `Codex exited with code ${exitCode}`))),
      infrastructure_failure: exitCode !== 0,
    };
  }
}
