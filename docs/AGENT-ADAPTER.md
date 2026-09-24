# Agent Adapter

`CodexAgentAdapter` is W2's production agent adapter. It invokes the installed `codex exec --json` CLI with the supported `workspace-write` sandbox and the task workspace as its working directory. The engine depends on the `AgentAdapter` boundary: `startRun`, `sendTask`, `receiveAction`, `receiveOutput`, and `cancel`.

JSONL output recognized by the adapter is retained as ordered `agent_output` events. Recognized command/tool items become tool-call records. The adapter does not observe every native operation or file read. Non-zero exit, process errors, or timeout become infrastructure errors; an agent's final text cannot set the receipt outcome.
