# Checkpoint, Resume, and Abort

Each run stores a SQLite checkpoint containing state, ordered event sequence,
context manifest, completed tool-call count, workspace, verification progress,
pending approvals, and update time. `RunEngine.resume(runId)` appends a
`run_resumed` event from that checkpoint; completed actions are represented by
the persisted count and are not replayed by the resume operation.

`RunEngine.abort(runId)` cancels the active adapter where possible, transitions
the run to `ABORTED`, appends terminal abort events, and keeps all collected
evidence available for the Run Receipt.
