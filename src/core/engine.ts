import { randomUUID } from "node:crypto";
import path from "node:path";
import { buildContextManifest } from "./context.js";
import { CodexAgentAdapter, type AgentAdapter } from "./agent.js";
import { captureDiff } from "./diff.js";
import { ToolRuntime } from "./runtime.js";
import { RunStore } from "./store.js";
import type { ContextManifest, RunRecord, TaskDefinition, VerificationResult } from "./types.js";
import type { ToolRuntimeOptions } from "./runtime.js";
import { runVerifications } from "./verification.js";
import { parseTask } from "./task.js";

export interface RunEngineOptions {
  databasePath: string;
  adapter?: AgentAdapter;
  now?: () => Date;
  runtime?: Omit<ToolRuntimeOptions, "onSafetyEvent" | "runId">;
}

export class RunEngine {
  readonly store: RunStore;
  private readonly adapter: AgentAdapter;
  private readonly now: () => Date;
  private activeRunId?: string;

  constructor(private readonly options: RunEngineOptions) {
    this.store = new RunStore(options.databasePath);
    this.adapter = options.adapter ?? new CodexAgentAdapter();
    this.now = options.now ?? (() => new Date());
  }

  close(): void {
    this.store.close();
  }

  async run(task: TaskDefinition): Promise<RunRecord> {
    task = parseTask(task);
    const workspace = path.resolve(task.workspace ?? process.cwd());
    const runId = randomUUID();
    const startedAt = this.now().toISOString();
    const model = task.model ?? this.adapter.provider;
    const executionMode = this.adapter instanceof CodexAgentAdapter ? "REAL_CODEX" : "FAKE_ADAPTER";
    const runtime = new ToolRuntime(workspace, {
      ...this.options.runtime,
      capabilities: task.capabilities ?? this.options.runtime?.capabilities,
      budget: task.runtime_budget ?? this.options.runtime?.budget,
      runId,
      onSafetyEvent: (type, payload) => this.store.appendEvent(runId, type, payload),
    });
    this.activeRunId = runId;
    let persistedRuntimeCalls = 0;
    this.store.saveTask(task);
    this.store.createRun({ run_id: runId, task_id: task.task_id, started_at: startedAt, model, workspace });
    this.store.appendEvent(runId, "run_created", { task_id: task.task_id });
    this.saveCheckpoint(runId, runtime, null, 0);
    try {
      this.store.transition(runId, "PREPARING");
      const statusBefore = await runtime.gitStatus();
      persistedRuntimeCalls = this.persistToolCalls(runId, runtime, persistedRuntimeCalls);
      const context = buildContextManifest(task, workspace);
      this.store.updateSnapshots(runId, { contextManifest: context });
      this.store.appendEvent(runId, "context_built", { files_included: context.files_included.length, approximate_tokens: context.approximate_tokens });
      this.saveCheckpoint(runId, runtime, context, 0);
      this.store.transition(runId, "RUNNING");
      this.store.appendEvent(runId, "agent_started", { provider: this.adapter.provider, model, execution_mode: executionMode });
      const agentResult = await this.adapter.startRun({ task, workspace, context: JSON.stringify(context, null, 2), timeoutMs: task.timeout_ms ?? 5 * 60 * 1000 });
      for (const output of agentResult.outputs) this.store.appendEvent(runId, "agent_output", output);
      persistedRuntimeCalls = this.persistToolCalls(runId, runtime, persistedRuntimeCalls);
      for (const call of agentResult.tool_calls) this.persistAgentToolCall(runId, call);
      this.store.updateSnapshots(runId, { toolEvents: [...runtime.calls, ...agentResult.tool_calls] });
      this.saveCheckpoint(runId, runtime, context, 0);
      if (agentResult.exit_code !== 0) {
        const message = `Agent failure: ${agentResult.error ?? "unknown error"}`;
        if (agentResult.infrastructure_failure) {
          const diff = await this.captureAndPersistDiff(runId, runtime, statusBefore);
          this.store.updateSnapshots(runId, { toolEvents: agentResult.tool_calls, diff });
          this.store.transition(runId, "ERROR", { finishedAt: this.now().toISOString(), error: message });
          this.store.appendEvent(runId, "run_failed", { error: message, infrastructure: true });
          this.store.appendEvent(runId, "run_finished", { status: "ERROR" });
        } else await this.finishFailure(runId, message, runtime, statusBefore);
        return this.store.getRun(runId)!;
      }
      this.store.transition(runId, "VERIFYING");
      this.store.appendEvent(runId, "verification_started", { count: task.verification_commands.length });
      const verificationResults = await runVerifications(task, runtime);
      persistedRuntimeCalls = this.persistToolCalls(runId, runtime, persistedRuntimeCalls);
      for (const result of verificationResults) {
        this.store.appendVerification(runId, result);
        this.store.appendEvent(runId, "verification_finished", result);
      }
      this.saveCheckpoint(runId, runtime, context, verificationResults.length);
      const diff = await this.captureAndPersistDiff(runId, runtime, statusBefore);
      persistedRuntimeCalls = this.persistToolCalls(runId, runtime, persistedRuntimeCalls);
      this.store.updateSnapshots(runId, { toolEvents: runtime.calls, verificationResults, diff });
      if (verificationResults.some((result) => result.status === "ERROR")) {
        this.store.transition(runId, "ERROR", { finishedAt: this.now().toISOString(), error: "Verification infrastructure failed" });
        this.store.appendEvent(runId, "run_failed", { error: "Verification infrastructure failed", infrastructure: true });
        this.store.appendEvent(runId, "run_finished", { status: "ERROR" });
      } else if (verificationResults.some((result) => result.status !== "PASSED")) {
        await this.finishFailure(runId, "Verification failed", runtime, statusBefore, verificationResults, diff);
      } else {
        this.store.transition(runId, "COMPLETED", { finishedAt: this.now().toISOString() });
        this.store.appendEvent(runId, "run_finished", { status: "COMPLETED" });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      persistedRuntimeCalls = this.persistToolCalls(runId, runtime, persistedRuntimeCalls);
      this.store.updateSnapshots(runId, { toolEvents: runtime.calls });
      const current = this.store.getRun(runId);
      if (current && !["COMPLETED", "FAILED", "ABORTED", "ERROR"].includes(current.status)) {
        this.store.transition(runId, "ERROR", { finishedAt: this.now().toISOString(), error: message });
      }
      this.store.appendEvent(runId, "run_failed", { error: message, infrastructure: true });
      this.store.appendEvent(runId, "run_finished", { status: "ERROR" });
    }
    this.activeRunId = undefined;
    return this.store.getRun(runId)!;
  }

  abort(runId: string): RunRecord {
    const current = this.store.getRun(runId);
    if (!current) throw new Error(`Run does not exist: ${runId}`);
    if (!["COMPLETED", "FAILED", "ABORTED", "ERROR"].includes(current.status)) {
      if (this.activeRunId === runId) this.adapter.cancel();
      this.store.transition(runId, "ABORTED", { finishedAt: this.now().toISOString(), error: "Aborted by user" });
      this.store.appendEvent(runId, "run_aborted", { reason: "user_requested" });
      this.store.appendEvent(runId, "run_finished", { status: "ABORTED" });
    }
    return this.store.getRun(runId)!;
  }

  resume(runId: string): RunRecord {
    const checkpoint = this.store.getCheckpoint(runId);
    if (!checkpoint) throw new Error(`No checkpoint exists for run: ${runId}`);
    this.store.appendEvent(runId, "run_resumed", { sequence: checkpoint.sequence, completed_tool_calls: checkpoint.completed_tool_calls, verification_progress: checkpoint.verification_progress });
    return this.store.getRun(runId)!;
  }

  private saveCheckpoint(runId: string, runtime: ToolRuntime, context: ContextManifest | null, verificationProgress: number): void {
    const run = this.store.getRun(runId);
    if (!run) return;
    this.store.saveCheckpoint({ run_id: runId, state: run.status, sequence: this.store.getEvents(runId).length, context_manifest: context, completed_tool_calls: runtime.calls.length, workspace: run.workspace, verification_progress: verificationProgress, pending_approvals: 0, updated_at: this.now().toISOString() });
    this.store.appendEvent(runId, "run_checkpointed", { sequence: this.store.getEvents(runId).length, completed_tool_calls: runtime.calls.length, verification_progress: verificationProgress });
  }

  private persistToolCalls(runId: string, runtime: ToolRuntime, fromIndex: number): number {
    for (const call of runtime.calls.slice(fromIndex)) {
      this.store.appendToolCall(runId, call);
      this.store.appendEvent(runId, "tool_requested", { tool_name: call.tool_name, input: call.input });
      this.store.appendEvent(runId, "tool_started", { tool_name: call.tool_name });
      this.store.appendEvent(runId, "tool_finished", { tool_name: call.tool_name, error: call.error, result: call.result });
    }
    return runtime.calls.length;
  }

  private persistAgentToolCall(runId: string, call: import("./types.js").ToolCallRecord): void {
    this.store.appendToolCall(runId, call);
    this.store.appendEvent(runId, "tool_requested", { tool_name: call.tool_name, input: call.input });
    this.store.appendEvent(runId, "tool_started", { tool_name: call.tool_name });
    this.store.appendEvent(runId, "tool_finished", { tool_name: call.tool_name, error: call.error, result: call.result });
  }

  private async captureAndPersistDiff(runId: string, runtime: ToolRuntime, statusBefore: string) {
    const statusAfter = await runtime.gitStatus();
    const gitDiff = await runtime.gitDiff();
    const withoutW2Runtime = (status: string) => status.split(/\r?\n/).filter((line) => !/(?:^|\/)w2-run\.sqlite(?:-(?:wal|shm))?$/i.test(line.slice(3).trim())).join("\n");
    const diff = captureDiff(withoutW2Runtime(statusBefore), withoutW2Runtime(statusAfter), gitDiff.diff, gitDiff.numstat);
    for (const file of diff.changed_files) this.store.appendEvent(runId, "file_changed", { path: file });
    return diff;
  }

  private async finishFailure(runId: string, message: string, runtime: ToolRuntime, statusBefore: string, verificationResults: VerificationResult[] = [], diff?: ReturnType<typeof captureDiff>): Promise<void> {
    let captured = diff;
    try { captured ??= await this.captureAndPersistDiff(runId, runtime, statusBefore); } catch { /* preserve the original failure */ }
    this.store.updateSnapshots(runId, { toolEvents: runtime.calls, verificationResults, diff: captured });
    const current = this.store.getRun(runId);
    if (current && !["FAILED", "ERROR", "ABORTED", "COMPLETED"].includes(current.status)) this.store.transition(runId, "FAILED", { finishedAt: this.now().toISOString(), error: message });
    this.store.appendEvent(runId, "run_failed", { error: message });
    this.store.appendEvent(runId, "run_finished", { status: "FAILED" });
  }
}
