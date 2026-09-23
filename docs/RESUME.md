# Checkpoint Recovery Inspection

Each run stores a SQLite checkpoint containing state, ordered event sequence,
context manifest, completed tool-call count, workspace, verification progress,
pending approvals, and update time.

`RunEngine.resume(runId)` currently validates that a checkpoint exists, appends a
`run_resumed` inspection event, and returns the persisted run. It does not restart
the Codex process, continue verification, or perform execution recovery. The API
is checkpoint recovery inspection only; it must not be described as execution
resume.

`RunEngine.abort(runId)` cancels the active adapter where possible, transitions
the run to `ABORTED`, appends terminal abort events, and keeps collected evidence
available for the Run Receipt.
