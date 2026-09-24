# Run Contract

`RunEngine` persists one run in SQLite. A run has `run_id`, `task_id`, state, timestamps, model, workspace, context manifest, tool events, diff, verification results, and error.

States are `CREATED -> PREPARING -> RUNNING -> VERIFYING -> COMPLETED|FAILED`; `ABORTED` and `ERROR` are terminal failure states. `RunStore.transition` rejects every transition not in this graph. A verification failure is `FAILED`, never `COMPLETED`.

The `runs` row is the operational summary; normalized `tasks`, `events`, `tool_calls`, and `verification_results` rows remain queryable after the process exits.

Interactive TUI runs construct the same task contract in memory from a likely engineering prompt. A Codex `UserPromptSubmit` hook stores the prompt and Git-visible baseline; the matching `Stop` hook supplies only paths whose Git state changed during that turn. W2's built-in `V-W2-TURN-DIFF` verifier proves whether such paths exist. Available non-browser `test`, `typecheck`, `lint`, and `build` package scripts are run and recorded as project-check evidence. They do not by themselves prove the prompt's semantic requirements: until a direct deterministic verifier is mapped to those requirements, the semantic criterion remains `UNPROVEN`. A failed project verifier remains `FAIL`, and hook or verification infrastructure failures remain `ERROR`. No transcript text, completion claim, or unverified model judgment can produce `PASS`.

These receipts cover one assistant turn, not the full lifetime of a multi-turn request. The canonical runtime root is W2's installation directory at `.w2/interactive/`; project pending state, the shared SQLite run store, and JSON/Markdown receipts stay under `.w2/interactive/<project-hash>/`, while safe hook metadata is appended to `.w2/interactive/hook-diagnostics.jsonl`. The runtime never resolves from the target project's cwd and does not create a project-local `.w2/`. The explicit `w2 run <task.json>` contract remains unchanged.
