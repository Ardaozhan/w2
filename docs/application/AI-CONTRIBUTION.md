# AI Contribution

## Codex

Codex CLI is the real coding-agent participant in stored benchmark and demo executions, and Codex also assisted implementation and local verification. Codex/V42 sessions were used for task acceptance and the audit lifecycle where recorded. W2 stores recognized events and resulting diffs; it does not intercept every native Codex tool call.

## GPT-5.6

GPT-5.6 was used for an independent development-time review of final submission claims, benchmark methodology, and Run Receipt semantics. It was not used as a runtime evidence mapper and does not determine outcomes. Exact model/session provenance and review findings are recorded in [GPT56-CONTRIBUTION.md](../GPT56-CONTRIBUTION.md) and [GPT56-FINAL-REVIEW.md](../GPT56-FINAL-REVIEW.md).

## Human decisions

Human architecture decisions covered the Run Receipt abstraction, deterministic outcome engine, PASS/FAIL/UNPROVEN semantics, benchmark fairness, safety boundaries, project scope, claim review, and final acceptance. Failed, timed-out, and unproven benchmark runs are retained.
