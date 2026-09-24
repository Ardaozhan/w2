# W2 Evidence Model

W2 creates auditable evidence from its persisted run record. Every evidence
item has a stable `evidence_id`, the owning `run_id`, a typed source, a raw
reference back to SQLite, a timestamp, and an explicit confidence class.

## Trust boundary

`DETERMINISTIC` evidence is produced from stored context, events, tool calls,
diffs, verification exit codes, and timestamps. `INTERPRETED` evidence may be
produced by a model, but it can only reference existing deterministic evidence;
it cannot invent an ID, change a verification result, or select the final run
outcome.

## Acceptance mapping

Each task criterion is represented individually as `PASS`, `FAIL`, or
`UNPROVEN`, with the exact evidence IDs and a reason. A criterion with no valid
evidence is always `UNPROVEN`. Unknown evidence IDs are rejected before a
receipt is persisted.

## Outcome engine

The outcome is deterministic: infrastructure errors become `ERROR`, an abort
becomes `ABORTED`, a required `FAIL` becomes `FAIL`, and a required `UNPROVEN`
prevents `PASS`. Only when every required criterion has valid evidence does the
engine return `PASS`.

The model is therefore an optional explanation layer, never an authority over
the stored runtime facts.
