# Technical Summary

The Run Engine creates a run contract, builds a Context Manifest, invokes the Codex adapter, records ordered events in SQLite, captures Git diff, runs independent verification, and projects the result into JSON/Markdown Run Receipts. The Tool Runtime adds capability checks, workspace canonicalization, approvals, time/output limits, redaction, budgets, retries, checkpoints, resume, and abort events. The Evidence Engine validates deterministic/interpreted records and maps criteria to stored evidence before the deterministic Outcome Engine computes `PASS`, `FAIL`, `UNPROVEN`, `ABORTED`, or `ERROR`.

Benchmark fixtures and external verifiers are stored under `benchmarks/`. The GPT-5.6 interpretation boundary is deliberately downstream of deterministic facts; this local submission does not pretend that an unavailable live model call is evidence.
