# Technical Summary

The Run Engine creates a run contract, builds a Context Manifest, invokes the Codex adapter, records ordered events in SQLite, captures Git diff, runs independent verification, and projects the result into JSON/Markdown Run Receipts. The Tool Runtime adds capability checks, workspace canonicalization, approvals, time/output limits, redaction, budgets, retries, checkpoints, resume, and abort events. The Evidence Engine validates deterministic/interpreted records and maps criteria to stored evidence before the deterministic Outcome Engine computes `PASS`, `FAIL`, `UNPROVEN`, `ABORTED`, or `ERROR`.

Benchmark fixtures and external verifiers are stored under `benchmarks/`. There is no live GPT-5.6 Evidence Mapper in the runtime. Acceptance mapping is supplied to deterministic receipt validation; the outcome engine does not call a model.

The Codex adapter runs the CLI with `workspace-write`. W2 observes recognized structured events and resulting repository diffs; it does not intercept every native Codex tool call. The context manifest records files selected for the prompt, not the full set of files the agent could access.
