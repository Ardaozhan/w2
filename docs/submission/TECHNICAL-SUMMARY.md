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

- `UserPromptSubmit` records a likely engineering prompt, baseline `HEAD`, index tree, working-tree tree, and dirty-path fingerprints.
- `Stop` combines committed changes with current staged, unstaged, and untracked Git state, filters unchanged pre-existing dirt, runs detected project checks, and persists the receipt diff even after a clean commit.
- `Interrupt` marks the matching pending turn aborted.
- `SessionEnd` cleans up pending state for that session.

The launch does not alter Codex settings or project files and preserves Codex's hook review and trust flow. The Git snapshot uses a temporary index and leaves the user's index, worktree, refs, and history intact. Interactive criteria are extracted only from explicit acceptance headings. A criterion maps to a discovered package check only when it directly states that check passes. Other semantic criteria remain unproven unless a suitable verifier is directly connected.
