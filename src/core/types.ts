export const RUN_STATES = [
  "CREATED",
  "PREPARING",
  "RUNNING",
  "VERIFYING",
  "COMPLETED",
  "FAILED",
  "ABORTED",
  "ERROR",
] as const;

export type RunState = (typeof RUN_STATES)[number];

export type AgentExecutionMode = "REAL_CODEX" | "CODEX_TUI_HOOK" | "FAKE_ADAPTER";

export const EVENT_TYPES = [
  "run_created",
  "context_built",
  "agent_started",
  "agent_output",
  "tool_requested",
  "tool_started",
  "tool_finished",
  "file_changed",
  "verification_started",
  "verification_finished",
  "run_finished",
  "run_failed",
  "run_aborted",
  "safety_denied",
  "approval_requested",
  "approval_resolved",
  "budget_exhausted",
  "run_checkpointed",
  "run_resumed",
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

export type VerificationCategory = "test" | "lint" | "typecheck" | "build" | "custom";

export interface VerificationCommand {
  id: string;
  name: string;
  command: string;
  category: VerificationCategory;
}

export interface AcceptanceCriterion {
  id: string;
  statement: string;
  required: boolean;
  verification_refs: string[];
}

export interface TaskDefinition {
  task_id: string;
  title: string;
  goal: string;
  constraints: string[];
  allowed_paths: string[];
  acceptance_criteria: AcceptanceCriterion[];
  verification_commands: VerificationCommand[];
  workspace?: string;
  model?: string;
  timeout_ms?: number;
  capabilities?: import("./safety.js").Capability[];
  runtime_budget?: import("./safety.js").RuntimeBudget;
}

export interface ContextEntry {
  path: string;
  source_path: string;
  included: boolean;
  selection_reason: string;
  sections: string[];
  bytes: number;
  approximate_tokens: number;
}

export interface ContextManifest {
  workspace: string;
  generated_at: string;
  task_id: string;
  files_considered: ContextEntry[];
  files_included: ContextEntry[];
  excluded_candidates: ContextEntry[];
  accessed_files?: string[];
  access_observation?: "COMPLETE" | "PARTIAL" | "UNAVAILABLE";
  total_bytes: number;
  approximate_tokens: number;
  reference_context?: {
    logical_source: string;
    content_sha256: string;
    byte_count: number;
    mapping_id: string;
  };
}

export interface DiffCapture {
  status_before: string;
  status_after: string;
  changed_files: string[];
  additions: number;
  deletions: number;
  unified_diff: string;
}

export interface VerificationResult {
  verifier_id: string;
  name: string;
  category: VerificationCategory;
  command: string;
  exit_code: number | null;
  stdout: string;
  stderr: string;
  duration_ms: number;
  status: "PASSED" | "FAILED" | "ERROR";
}

export interface ToolCallRecord {
  tool_name: string;
  tool_use_id?: string;
  status?: "RETURNED" | "FAILED" | "INCOMPLETE" | "INTERRUPTED";
  input: unknown;
  started_at: string;
  finished_at: string;
  result?: unknown;
  error?: string;
}

export interface AgentOutput {
  kind: string;
  text?: string;
  raw: unknown;
}

export interface AgentRunResult {
  exit_code: number;
  outputs: AgentOutput[];
  tool_calls: ToolCallRecord[];
  error?: string;
  infrastructure_failure?: boolean;
}

export interface RunRecord {
  run_id: string;
  task_id: string;
  status: RunState;
  started_at: string;
  finished_at: string | null;
  model: string;
  workspace: string;
  context_manifest: ContextManifest | null;
  tool_events: ToolCallRecord[];
  diff: DiffCapture | null;
  verification_results: VerificationResult[];
  error: string | null;
}

export interface RunEvent {
  event_id: string;
  run_id: string;
  sequence: number;
  timestamp: string;
  type: EventType;
  payload: unknown;
}

export const EVIDENCE_TYPES = [
  "CONTEXT_EVIDENCE",
  "TOOL_EVIDENCE",
  "DIFF_EVIDENCE",
  "TEST_EVIDENCE",
  "LINT_EVIDENCE",
  "TYPECHECK_EVIDENCE",
  "BUILD_EVIDENCE",
  "ASSERTION_EVIDENCE",
  "MODEL_INTERPRETATION",
] as const;

export type EvidenceType = (typeof EVIDENCE_TYPES)[number];
export type EvidenceClass = "DETERMINISTIC" | "INTERPRETED";

export interface EvidenceRecord {
  evidence_id: string;
  run_id: string;
  type: EvidenceType;
  source: string;
  summary: string;
  raw_reference: string;
  confidence_class: EvidenceClass;
  created_at: string;
  data?: unknown;
}

export const ACCEPTANCE_STATUSES = ["PASS", "FAIL", "UNPROVEN"] as const;
export type AcceptanceStatus = (typeof ACCEPTANCE_STATUSES)[number];

export interface AcceptanceCriterionResult {
  criterion_id: string;
  description: string;
  required: boolean;
  status: AcceptanceStatus;
  evidence_ids: string[];
  reason: string;
}

export interface RunReceipt {
  receipt_version: "1.0";
  run_id: string;
  task: TaskDefinition;
  agent: { model: string; status: RunState; error: string | null; execution_mode: AgentExecutionMode };
  context: { files_considered: number; files_supplied: number; approximate_tokens: number; selected_paths: string[]; accessed_files: string[] | null; access_observation: "COMPLETE" | "PARTIAL" | "UNAVAILABLE"; evidence_ids: string[]; reference_context?: ContextManifest["reference_context"] };
  actions: { events: number; tool_calls: number; evidence_ids: string[] };
  changes: { changed_files: string[]; additions: number; deletions: number; evidence_ids: string[] };
  verification: { results: VerificationResult[]; evidence_ids: string[] };
  evidence: EvidenceRecord[];
  acceptance: AcceptanceCriterionResult[];
  outcome: import("./outcomes.js").RunOutcome;
  generated_at: string;
}

export interface RunCheckpoint {
  run_id: string;
  state: RunState;
  sequence: number;
  context_manifest: ContextManifest | null;
  completed_tool_calls: number;
  workspace: string;
  verification_progress: number;
  pending_approvals: number;
  updated_at: string;
}
