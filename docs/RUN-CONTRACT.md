# Run Contract

`RunEngine` persists one run in SQLite. A run has `run_id`, `task_id`, state, timestamps, model, workspace, context manifest, tool events, diff, verification results, and error.

States are `CREATED -> PREPARING -> RUNNING -> VERIFYING -> COMPLETED|FAILED`; `ABORTED` and `ERROR` are terminal failure states. `RunStore.transition` rejects every transition not in this graph. A verification failure is `FAILED`, never `COMPLETED`.

The `runs` row is the operational summary; normalized `tasks`, `events`, `tool_calls`, and `verification_results` rows remain queryable after the process exits.
