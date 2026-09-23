import type { DatabaseSync as DatabaseSyncType } from "node:sqlite";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type {
  ContextManifest,
  DiffCapture,
  EventType,
  RunEvent,
  RunRecord,
  RunState,
  TaskDefinition,
  ToolCallRecord,
  VerificationResult,
  AcceptanceCriterionResult,
  EvidenceRecord,
  RunCheckpoint,
} from "./types.js";
import type { ApprovalRecord } from "./safety.js";
import { RUN_STATES } from "./types.js";

const allowedTransitions: Record<RunState, readonly RunState[]> = {
  CREATED: ["PREPARING", "ABORTED", "ERROR"],
  PREPARING: ["RUNNING", "FAILED", "ABORTED", "ERROR"],
  RUNNING: ["VERIFYING", "FAILED", "ABORTED", "ERROR"],
  VERIFYING: ["COMPLETED", "FAILED", "ERROR"],
  COMPLETED: [],
  FAILED: [],
  ABORTED: [],
  ERROR: [],
};

function json(value: unknown): string {
  return JSON.stringify(value ?? null);
}

function parseJson<T>(value: string | null): T | null {
  return value === null ? null : (JSON.parse(value) as T);
}

export class RunStore {
  readonly db: DatabaseSyncType;

  constructor(databasePath: string) {
    const absolutePath = path.resolve(databasePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    const sqlite = process.getBuiltinModule("node:sqlite") as typeof import("node:sqlite");
    this.db = new sqlite.DatabaseSync(absolutePath);
    this.db.exec("PRAGMA journal_mode = WAL;");
    this.migrate();
  }

  close(): void {
    this.db.close();
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL
      );
    `);
    const applied = this.db.prepare("SELECT version FROM schema_migrations ORDER BY version").all() as Array<{ version: number }>;
    if (!applied.some((row) => row.version === 1)) {
      this.db.exec(`
        CREATE TABLE runs (
          run_id TEXT PRIMARY KEY,
          task_id TEXT NOT NULL,
          status TEXT NOT NULL,
          started_at TEXT NOT NULL,
          finished_at TEXT,
          model TEXT NOT NULL,
          workspace TEXT NOT NULL,
          context_manifest TEXT,
          tool_events TEXT NOT NULL DEFAULT '[]',
          diff TEXT,
          verification_results TEXT NOT NULL DEFAULT '[]',
          error TEXT
        );
        CREATE TABLE tasks (
          task_id TEXT PRIMARY KEY,
          payload TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
        CREATE TABLE events (
          event_id TEXT PRIMARY KEY,
          run_id TEXT NOT NULL REFERENCES runs(run_id),
          sequence INTEGER NOT NULL,
          timestamp TEXT NOT NULL,
          type TEXT NOT NULL,
          payload TEXT NOT NULL,
          UNIQUE(run_id, sequence)
        );
        CREATE TABLE tool_calls (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          run_id TEXT NOT NULL REFERENCES runs(run_id),
          tool_name TEXT NOT NULL,
          input TEXT NOT NULL,
          started_at TEXT NOT NULL,
          finished_at TEXT NOT NULL,
          result TEXT,
          error TEXT
        );
        CREATE TABLE verification_results (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          run_id TEXT NOT NULL REFERENCES runs(run_id),
          name TEXT NOT NULL,
          category TEXT NOT NULL,
          command TEXT NOT NULL,
          exit_code INTEGER,
          stdout TEXT NOT NULL,
          stderr TEXT NOT NULL,
          duration_ms INTEGER NOT NULL,
          status TEXT NOT NULL
        );
        CREATE INDEX events_run_sequence ON events(run_id, sequence);
        CREATE INDEX tool_calls_run ON tool_calls(run_id);
        CREATE INDEX verification_results_run ON verification_results(run_id);
      `);
      this.db.prepare("INSERT INTO schema_migrations(version, applied_at) VALUES (?, ?)").run(1, new Date().toISOString());
    }
    if (!applied.some((row) => row.version === 2)) {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS evidence (
          evidence_id TEXT PRIMARY KEY,
          run_id TEXT NOT NULL REFERENCES runs(run_id),
          type TEXT NOT NULL,
          source TEXT NOT NULL,
          summary TEXT NOT NULL,
          raw_reference TEXT NOT NULL,
          confidence_class TEXT NOT NULL,
          created_at TEXT NOT NULL,
          data TEXT
        );
        CREATE TABLE IF NOT EXISTS acceptance_mappings (
          run_id TEXT NOT NULL REFERENCES runs(run_id),
          criterion_id TEXT NOT NULL,
          description TEXT NOT NULL,
          required INTEGER NOT NULL,
          status TEXT NOT NULL,
          evidence_ids TEXT NOT NULL,
          reason TEXT NOT NULL,
          PRIMARY KEY(run_id, criterion_id)
        );
        CREATE INDEX IF NOT EXISTS evidence_run ON evidence(run_id);
      `);
      this.db.prepare("INSERT INTO schema_migrations(version, applied_at) VALUES (?, ?)").run(2, new Date().toISOString());
    }
    if (!applied.some((row) => row.version === 3)) {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS approvals (
          approval_id TEXT PRIMARY KEY,
          run_id TEXT NOT NULL REFERENCES runs(run_id),
          action TEXT NOT NULL,
          risk TEXT NOT NULL,
          reason TEXT NOT NULL,
          status TEXT NOT NULL,
          requested_at TEXT NOT NULL,
          resolved_at TEXT
        );
        CREATE TABLE IF NOT EXISTS checkpoints (
          run_id TEXT PRIMARY KEY REFERENCES runs(run_id),
          state TEXT NOT NULL,
          sequence INTEGER NOT NULL,
          context_manifest TEXT,
          completed_tool_calls INTEGER NOT NULL,
          workspace TEXT NOT NULL,
          verification_progress INTEGER NOT NULL,
          pending_approvals INTEGER NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS approvals_run ON approvals(run_id);
      `);
      this.db.prepare("INSERT INTO schema_migrations(version, applied_at) VALUES (?, ?)").run(3, new Date().toISOString());
    }
    if (!applied.some((row) => row.version === 4)) {
      this.db.exec("ALTER TABLE verification_results ADD COLUMN verifier_id TEXT NOT NULL DEFAULT '';");
      this.db.exec("UPDATE verification_results SET verifier_id = name WHERE verifier_id = '';");
      this.db.prepare("INSERT INTO schema_migrations(version, applied_at) VALUES (?, ?)").run(4, new Date().toISOString());
    }
  }

  saveTask(task: TaskDefinition): void {
    this.db.prepare(`
      INSERT INTO tasks(task_id, payload, created_at) VALUES (?, ?, ?)
      ON CONFLICT(task_id) DO UPDATE SET payload = excluded.payload
    `).run(task.task_id, json(task), new Date().toISOString());
  }

  getTask(taskId: string): TaskDefinition | undefined {
    const row = this.db.prepare("SELECT payload FROM tasks WHERE task_id = ?").get(taskId) as { payload: string } | undefined;
    return row ? (JSON.parse(row.payload) as TaskDefinition) : undefined;
  }

  createRun(input: Pick<RunRecord, "run_id" | "task_id" | "started_at" | "model" | "workspace">): void {
    this.db.prepare(`
      INSERT INTO runs(run_id, task_id, status, started_at, model, workspace)
      VALUES (?, ?, 'CREATED', ?, ?, ?)
    `).run(input.run_id, input.task_id, input.started_at, input.model, input.workspace);
  }

  transition(runId: string, next: RunState, details?: { finishedAt?: string; error?: string }): void {
    const current = this.db.prepare("SELECT status FROM runs WHERE run_id = ?").get(runId) as { status: RunState } | undefined;
    if (!current) throw new Error(`Run does not exist: ${runId}`);
    if (!RUN_STATES.includes(next)) throw new Error(`Unknown run state: ${next}`);
    if (!allowedTransitions[current.status].includes(next)) {
      throw new Error(`Invalid run transition ${current.status} -> ${next}`);
    }
    this.db.prepare(`
      UPDATE runs SET status = ?, finished_at = COALESCE(?, finished_at), error = COALESCE(?, error)
      WHERE run_id = ?
    `).run(next, details?.finishedAt ?? null, details?.error ?? null, runId);
  }

  updateSnapshots(runId: string, snapshots: {
    contextManifest?: ContextManifest;
    toolEvents?: ToolCallRecord[];
    diff?: DiffCapture;
    verificationResults?: VerificationResult[];
  }): void {
    this.db.prepare(`
      UPDATE runs SET
        context_manifest = COALESCE(?, context_manifest),
        tool_events = COALESCE(?, tool_events),
        diff = COALESCE(?, diff),
        verification_results = COALESCE(?, verification_results)
      WHERE run_id = ?
    `).run(
      snapshots.contextManifest ? json(snapshots.contextManifest) : null,
      snapshots.toolEvents ? json(snapshots.toolEvents) : null,
      snapshots.diff ? json(snapshots.diff) : null,
      snapshots.verificationResults ? json(snapshots.verificationResults) : null,
      runId,
    );
  }

  appendEvent(runId: string, type: EventType, payload: unknown, timestamp = new Date().toISOString()): RunEvent {
    const sequenceRow = this.db.prepare("SELECT COALESCE(MAX(sequence), 0) + 1 AS next FROM events WHERE run_id = ?").get(runId) as { next: number };
    const event: RunEvent = { event_id: randomUUID(), run_id: runId, sequence: sequenceRow.next, timestamp, type, payload };
    this.db.prepare(`
      INSERT INTO events(event_id, run_id, sequence, timestamp, type, payload)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(event.event_id, event.run_id, event.sequence, event.timestamp, event.type, json(event.payload));
    return event;
  }

  appendToolCall(runId: string, call: ToolCallRecord): void {
    this.db.prepare(`
      INSERT INTO tool_calls(run_id, tool_name, input, started_at, finished_at, result, error)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(runId, call.tool_name, json(call.input), call.started_at, call.finished_at, call.result === undefined ? null : json(call.result), call.error ?? null);
  }

  appendVerification(runId: string, result: VerificationResult): void {
    this.db.prepare(`
      INSERT INTO verification_results(run_id, verifier_id, name, category, command, exit_code, stdout, stderr, duration_ms, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(runId, result.verifier_id, result.name, result.category, result.command, result.exit_code, result.stdout, result.stderr, result.duration_ms, result.status);
  }

  getRun(runId: string): RunRecord | undefined {
    const row = this.db.prepare("SELECT * FROM runs WHERE run_id = ?").get(runId) as Record<string, unknown> | undefined;
    if (!row) return undefined;
    return {
      run_id: String(row.run_id), task_id: String(row.task_id), status: row.status as RunState,
      started_at: String(row.started_at), finished_at: row.finished_at ? String(row.finished_at) : null,
      model: String(row.model), workspace: String(row.workspace),
      context_manifest: parseJson<ContextManifest>(row.context_manifest as string | null),
      tool_events: parseJson<ToolCallRecord[]>(row.tool_events as string) ?? [],
      diff: parseJson<DiffCapture>(row.diff as string | null),
      verification_results: parseJson<VerificationResult[]>(row.verification_results as string) ?? [],
      error: row.error ? String(row.error) : null,
    };
  }

  getEvents(runId: string): RunEvent[] {
    const rows = this.db.prepare("SELECT * FROM events WHERE run_id = ? ORDER BY sequence ASC").all(runId) as Array<Record<string, unknown>>;
    return rows.map((row) => ({
      event_id: String(row.event_id), run_id: String(row.run_id), sequence: Number(row.sequence),
      timestamp: String(row.timestamp), type: row.type as EventType, payload: JSON.parse(String(row.payload)),
    }));
  }

  getToolCalls(runId: string): ToolCallRecord[] {
    const rows = this.db.prepare("SELECT * FROM tool_calls WHERE run_id = ? ORDER BY id ASC").all(runId) as Array<Record<string, unknown>>;
    return rows.map((row) => ({
      tool_name: String(row.tool_name), input: JSON.parse(String(row.input)), started_at: String(row.started_at),
      finished_at: String(row.finished_at), result: row.result ? JSON.parse(String(row.result)) : undefined, error: row.error ? String(row.error) : undefined,
    }));
  }

  getVerificationResults(runId: string): VerificationResult[] {
    return this.db.prepare("SELECT verifier_id, name, category, command, exit_code, stdout, stderr, duration_ms, status FROM verification_results WHERE run_id = ? ORDER BY id ASC").all(runId) as unknown as VerificationResult[];
  }

  saveEvidence(evidence: EvidenceRecord[]): void {
    const statement = this.db.prepare(`
      INSERT INTO evidence(evidence_id, run_id, type, source, summary, raw_reference, confidence_class, created_at, data)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(evidence_id) DO UPDATE SET
        run_id=excluded.run_id, type=excluded.type, source=excluded.source,
        summary=excluded.summary, raw_reference=excluded.raw_reference,
        confidence_class=excluded.confidence_class, created_at=excluded.created_at,
        data=excluded.data
    `);
    for (const item of evidence) statement.run(item.evidence_id, item.run_id, item.type, item.source, item.summary, item.raw_reference, item.confidence_class, item.created_at, item.data === undefined ? null : json(item.data));
  }

  getEvidence(runId: string): EvidenceRecord[] {
    const rows = this.db.prepare("SELECT * FROM evidence WHERE run_id = ? ORDER BY created_at ASC, evidence_id ASC").all(runId) as Array<Record<string, unknown>>;
    return rows.map((row) => ({
      evidence_id: String(row.evidence_id), run_id: String(row.run_id), type: row.type as EvidenceRecord["type"],
      source: String(row.source), summary: String(row.summary), raw_reference: String(row.raw_reference),
      confidence_class: row.confidence_class as EvidenceRecord["confidence_class"], created_at: String(row.created_at),
      data: row.data === null ? undefined : JSON.parse(String(row.data)),
    }));
  }

  saveAcceptance(runId: string, criteria: AcceptanceCriterionResult[]): void {
    const statement = this.db.prepare(`
      INSERT INTO acceptance_mappings(run_id, criterion_id, description, required, status, evidence_ids, reason)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(run_id, criterion_id) DO UPDATE SET
        description=excluded.description, required=excluded.required, status=excluded.status,
        evidence_ids=excluded.evidence_ids, reason=excluded.reason
    `);
    for (const criterion of criteria) statement.run(runId, criterion.criterion_id, criterion.description, criterion.required ? 1 : 0, criterion.status, json(criterion.evidence_ids), criterion.reason);
  }

  getAcceptance(runId: string): AcceptanceCriterionResult[] {
    const rows = this.db.prepare("SELECT * FROM acceptance_mappings WHERE run_id = ? ORDER BY criterion_id ASC").all(runId) as Array<Record<string, unknown>>;
    return rows.map((row) => ({
      criterion_id: String(row.criterion_id), description: String(row.description), required: Number(row.required) === 1,
      status: row.status as AcceptanceCriterionResult["status"], evidence_ids: JSON.parse(String(row.evidence_ids)) as string[], reason: String(row.reason),
    }));
  }

  saveApproval(record: ApprovalRecord): void {
    this.db.prepare(`
      INSERT INTO approvals(approval_id, run_id, action, risk, reason, status, requested_at, resolved_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(approval_id) DO UPDATE SET status=excluded.status, resolved_at=excluded.resolved_at
    `).run(record.approval_id, record.run_id, record.action, record.risk, record.reason, record.status, record.requested_at, record.resolved_at);
  }

  getApprovals(runId: string): ApprovalRecord[] {
    return this.db.prepare("SELECT * FROM approvals WHERE run_id = ? ORDER BY requested_at ASC").all(runId) as unknown as ApprovalRecord[];
  }

  saveCheckpoint(checkpoint: RunCheckpoint): void {
    this.db.prepare(`
      INSERT INTO checkpoints(run_id, state, sequence, context_manifest, completed_tool_calls, workspace, verification_progress, pending_approvals, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(run_id) DO UPDATE SET state=excluded.state, sequence=excluded.sequence,
        context_manifest=excluded.context_manifest, completed_tool_calls=excluded.completed_tool_calls,
        workspace=excluded.workspace, verification_progress=excluded.verification_progress,
        pending_approvals=excluded.pending_approvals, updated_at=excluded.updated_at
    `).run(checkpoint.run_id, checkpoint.state, checkpoint.sequence, checkpoint.context_manifest ? json(checkpoint.context_manifest) : null, checkpoint.completed_tool_calls, checkpoint.workspace, checkpoint.verification_progress, checkpoint.pending_approvals, checkpoint.updated_at);
  }

  getCheckpoint(runId: string): RunCheckpoint | undefined {
    const row = this.db.prepare("SELECT * FROM checkpoints WHERE run_id = ?").get(runId) as Record<string, unknown> | undefined;
    if (!row) return undefined;
    return { run_id: String(row.run_id), state: row.state as RunCheckpoint["state"], sequence: Number(row.sequence), context_manifest: parseJson<ContextManifest>(row.context_manifest as string | null), completed_tool_calls: Number(row.completed_tool_calls), workspace: String(row.workspace), verification_progress: Number(row.verification_progress), pending_approvals: Number(row.pending_approvals), updated_at: String(row.updated_at) };
  }
}
