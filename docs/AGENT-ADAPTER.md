# Agent Adapter

Phase 01 has one provider: `CodexAgentAdapter`. It is the only production adapter and invokes the installed `codex exec --json` CLI in the task workspace. Because Phase 01 has no approval broker yet, the non-interactive adapter uses Codex's explicit bypass flag; Phase 03 is responsible for execution safety and approvals. The engine depends only on the `AgentAdapter` boundary: `startRun`, `sendTask`, `receiveAction`, `receiveOutput`, and `cancel`.

JSONL output is retained as ordered `agent_output` events. Observable command/tool items become tool-call records. Non-zero exit, process errors, or timeout are persisted as run failure; an agent’s final text cannot complete a run without verification.
