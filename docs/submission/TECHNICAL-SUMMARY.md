# Technical Summary

W2 uses one deterministic receipt pipeline for manual task contracts and captured interactive Codex turns.

| Component | Role | Evidence boundary |
| --- | --- | --- |
| Run Engine | Validates the task, coordinates context, agent execution, diff capture, verification, and persisted run state. | It does not continue agent execution through `resume()`. |
| Context Manifest | Records files W2 considered, selected, and provided. | It does not prove exact files read by Codex. |
| Codex Adapter | Runs the installed Codex CLI in its `workspace-write` sandbox and records supported structured output. | It does not intercept every native operation or scrape the transcript. |
| Tool Runtime | Applies configured capabilities, workspace checks, approvals, timeouts, output limits, budgets, and retries to W2-owned calls. | These controls do not govern Codex-native calls. |
| SQLite Event Store | Persists runs, tasks, recognized events, tool calls, verifier results, and checkpoints. | It is local run storage, not a hosted service. |
| Diff and Verification | Captures Git-visible project changes and executes task-declared or detected non-browser checks. | A passing command proves only that command passed. |
| Evidence Engine | Derives deterministic evidence from stored verification results and attaches it only to referenced criteria. | It does not use a model to decide semantic correctness. |
| Deterministic Outcome Engine | Computes `PASS`, `FAIL`, `UNPROVEN`, `ABORTED`, or `ERROR` from run state and criterion evidence. | Agent completion text cannot set the outcome. |
| Run Receipt | Presents task, context, recognized events, diff, checks, criterion evidence, and outcome in JSON and Markdown. | It reports observed evidence and its limits. |

## Interactive Codex mode

The Windows `w2` launcher starts the normal Codex TUI with one-run native hook configuration:

- `UserPromptSubmit` records a likely engineering prompt and Git baseline, optionally supplies selected brainw2 project context, and keeps only safe reference metadata in the receipt.
- `PreToolUse` and `PostToolUse` capture safe structured activity metadata, correlate by `tool_use_id`, and feed the existing receipt pipeline.
- `Stop` combines committed changes with current staged, unstaged, and untracked Git state, filters unchanged pre-existing dirt, runs detected project checks, persists the receipt diff, updates a session index, and then attempts an idempotent Dev Log summary.
- `Interrupt` and `SessionEnd` preserve unfinished calls as interrupted and finalize pending turns as `ABORTED`.
- `PermissionRequest` observes without approving or denying; Codex's standard approval flow remains in control.

The launch does not alter Codex settings and preserves Codex's hook review and trust flow. The Git snapshot uses a temporary index and leaves the user's index, worktree, refs, and history intact. Interactive criteria are extracted only from explicit acceptance headings. A criterion maps to a discovered package check only when it directly names the check and says it must pass. Other semantic criteria remain unproven unless a suitable verifier is directly connected. W2 observes supported hook-delivered tool activity only; it does not claim to observe every OS operation, file read, internal model reasoning, or external side effect. brainw2 is optional, uses local Markdown I/O, and cannot provide acceptance evidence.
