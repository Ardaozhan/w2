# Event Model

Events are SQLite rows with `event_id`, `run_id`, monotonically increasing per-run `sequence`, timestamp, event type, and JSON payload. Sequence ordering is authoritative; timestamps are descriptive only.

Supported types include `run_created`, `context_built`, `agent_started`, `agent_output`, `tool_requested`, `tool_started`, `tool_finished`, `file_changed`, `verification_started`, `verification_finished`, `run_finished`, `run_failed`, and `run_aborted`.

The event table is indexed by `(run_id, sequence)`, so the complete trace remains inspectable after process completion.
