# W2 Architecture

## Boundary

W2 is a local task-evidence and control layer around one Codex CLI execution. It does not replace Codex and is not a universal pre-execution tool broker.

## Data flow

```text
Task contract
    -> Context Manifest (candidate/selected/provided where recorded)
    -> Codex Adapter
    -> Codex CLI workspace-write sandbox
    -> Repository
         | recognized structured events and resulting Git diff
         v
    W2 Run Engine -> declared verification -> evidence/acceptance mapping
         -> deterministic Outcome Engine -> JSON/Markdown Run Receipt
```

The Codex process uses native Codex file/shell tools within Codex's workspace-write sandbox. W2 records recognized structured output and repository changes; those native operations do not pass through W2's `ToolRuntime`.

## Components

| Component | Responsibility | Evidence limit |
| --- | --- | --- |
| Context Manifest | Stores repository context considered and selected for the prompt, where available | Selection is not an access restriction; exact file reads are not proven |
| Codex Adapter | Starts Codex with `workspace-write` and records recognized JSONL events | Not a complete record of every Codex-side operation |
| ToolRuntime | Applies capabilities, workspace checks, approvals, timeout/output limits, budgets, and retries to W2-owned calls | Does not mediate Codex native calls |
| Change observer | Captures repository diff and changed paths | Git working-tree state can include unrelated concurrent writes unless workspace is isolated |
| Verification runner | Executes configured verification commands and stores results | Verifier success alone does not automatically prove every criterion |
| Evidence/Outcome Engine | Checks references and derives PASS/FAIL/UNPROVEN/ERROR/ABORTED deterministically | Does not use a model to decide outcome |
| Run Receipt | Presents task, selected context, recognized events, diff, verification, evidence, and outcome | A record of observed artifacts, not a general security guarantee |

## Persistence and recovery

Run state, events, tool calls, and checkpoints persist in SQLite. `RunEngine.resume()` loads checkpoint state for inspection and appends recovery events; it does not continue agent execution. Completed destructive actions are not replayed because execution is not resumed.

## Model boundary

Codex is the real coding agent in live runs. GPT-5.6 is used for development-time review only when an authorized review session is recorded; it is not called by runtime receipts. Verification, evidence reference validation, and outcome calculation are deterministic.

## Security boundary

W2 enforces local controls for W2-owned ToolRuntime calls. Codex enforces its workspace-write sandbox for native Codex tools. W2 observes outputs and resulting changes but does not intercept every native tool call. This is not an OS/container security boundary; see [SECURITY-MODEL.md](SECURITY-MODEL.md).
