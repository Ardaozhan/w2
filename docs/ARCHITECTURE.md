# W2 Architecture

## Product boundary

W2 is a local verification layer for coding-agent runs. It connects a task contract, Codex execution evidence, repository changes, declared verification, and a deterministic Run Receipt. It does not replace Codex, CI, or the operating system's security boundary.

## Run flow

```text
User task and acceptance criteria
    -> W2 Run Engine
    -> Context Manifest
    -> Codex Adapter
    -> Codex CLI workspace-write sandbox
    -> Repository
    -> recognized events + Git diff + verifier results
    -> Evidence Engine
    -> criterion statuses
    -> deterministic Outcome Engine
    -> JSON / Markdown Run Receipt
    -> CLI / local UI / static judge demo
```

Interactive use enters through a small W2 Node process adapter that starts the ordinary Codex TUI with per-invocation native hooks: `UserPromptSubmit` captures a likely engineering prompt and the Git-visible baseline; `Stop` captures the turn diff, builds an internal task contract, and calls the same RunEngine path above. An explicitly headed acceptance list is represented item by item. A criterion maps to a discovered project verifier only when it directly asserts that exact command passes; generic test results do not prove semantic criteria. The adapter inherits the terminal and forwards Codex arguments. W2 does not read the transcript or watch terminal output. Because Codex's Stop event is turn-scoped, receipts are turn-scoped too.

## Components

| Component | Responsibility | Evidence limit |
| --- | --- | --- |
| Task contract | Declares task scope, required criteria, verifier references, and commands | A declared allowed path is contract context; W2 does not enforce per-file authorization for Codex-native calls |
| Context Manifest | Records files considered, selected, and provided to the adapter | Selection is not an access restriction; exact Codex reads are unknown without supporting telemetry |
| Codex Adapter | Starts Codex with `workspace-write` and records recognized structured events | Does not record every Codex-side operation or every file read |
| `ToolRuntime` | Applies capabilities, workspace checks, approvals, timeout/output limits, budgets, and retries to W2-owned calls | Does not mediate Codex native calls |
| Change observer | Captures repository diff and changed paths | Concurrent repository writes can appear in the same diff; isolated workspaces provide cleaner attribution |
| Verification runner | Executes task-declared verification commands and stores results | A passing verifier proves only its declared check in that run |
| Evidence Engine | Creates verifier evidence, validates references, and maps evidence to each criterion | Does not use a model to determine criterion status |
| Outcome Engine | Computes `PASS`, `FAIL`, `UNPROVEN`, `ABORTED`, or `ERROR` | Agent completion text cannot select the result |
| Run Receipt | Presents the task, context, recognized events, diff, verification, criterion evidence, and outcome | Records observed artifacts; it is not a general security guarantee |

## Automatic criterion evidence mapping

Each criterion carries verifier IDs in the task contract. Task validation rejects duplicate IDs and references to unknown verifiers. After execution, W2 creates deterministic evidence from the stored verifier results and maps only evidence from the referenced verifiers. Every referenced verifier must pass for the criterion to pass. A failed referenced verifier makes the criterion fail; absent mappings or evidence leave it unproven. Receipt validation recomputes this mapping from canonical verifier records before accepting the stored outcome.

## Persistence and recovery

Run state, events, tool calls, and checkpoints persist in SQLite. `RunEngine.resume()` loads checkpoint state for inspection and appends recovery events; it does not continue agent execution. Completed actions are not replayed.

## Model boundary

Codex is the real coding agent in live runs. GPT-5.6 was used for documented development-time review only; it is not called by runtime receipts. Verification, criterion mapping, and outcome calculation are deterministic.

## Security boundary

Codex's sandbox controls native Codex execution. W2 capability and path checks apply only to W2-owned `ToolRuntime` calls. W2 records recognized output, resulting changes, and verifier results; it does not broker every native call and is not an OS/container security boundary. See [Security Model](SECURITY-MODEL.md).

The launcher supplies hook configuration only for that Codex invocation. On Windows it supplies a `command_windows` override that safely starts the built W2 CLI through PowerShell's encoded-command interface. Codex's native hook review and trust flow remains enabled; users review the W2 command through `/hooks`. Interactive state and receipts are stored under W2's ignored `.w2/interactive/` directory, keyed by the normalized target project path and Codex `session_id` plus `turn_id`. The hook diagnostics log is at the runtime root. The hook does not create project files or add dependencies.
