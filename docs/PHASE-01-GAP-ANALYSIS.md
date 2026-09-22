# W2 Phase 01 Gap Analysis

This analysis reflects the repository state after Phase 00 regression verification and before Phase 01 implementation.

| Requirement | Current State | Missing Work | Verification Method | Status |
| --- | --- | --- | --- | --- |
| Run Contract and explicit states | Only Phase 00 outcome vocabulary exists | Add validated run model, SQLite persistence, and transition guard | State/schema tests and persisted run inspection | NOT IMPLEMENTED |
| Task Contract | No task loader or schema | Add Zod task schema and fail-early loader | Malformed-task tests | NOT IMPLEMENTED |
| Context Manifest | No context builder | Record considered/included/excluded files, reasons, source and size | Context manifest integration test | NOT IMPLEMENTED |
| Codex Agent Adapter | No adapter boundary | Add one Codex CLI adapter with lifecycle/cancellation surface | Adapter unit/integration test | NOT IMPLEMENTED |
| Tool Runtime | No runtime boundary | Add filesystem, shell, git status and git diff operations with call records | Tool runtime tests | NOT IMPLEMENTED |
| Ordered Event Trace | No event store | Add SQLite events with per-run sequence numbers | Event ordering and persistence tests | NOT IMPLEMENTED |
| SQLite operational state | No database dependency or schema | Add reproducible migration and tables for runs/tasks/events/tool calls/verifications | Schema and process-restart tests | NOT IMPLEMENTED |
| Diff Capture | No change observer | Add before/after status, changed files, numstat and unified diff by run | Diff integration test | NOT IMPLEMENTED |
| Verification Runner | No command runner | Execute task-defined test/lint/typecheck/build/custom commands and persist outputs | Verification success/failure tests | NOT IMPLEMENTED |
| Canonical fixture | `fixtures/` is empty | Add resettable TypeScript bug fixture with deterministic failing/passing test | Fixture reset and run tests | NOT IMPLEMENTED |
| Developer entry point | No CLI | Add `w2 run <task.json>` flow through engine | CLI integration test and manual run | NOT IMPLEMENTED |
| Failure handling | No run execution or error persistence | Persist invalid task, agent, tool, verification, timeout and unexpected errors as non-success | Failure-path tests | NOT IMPLEMENTED |
| Required Phase 01 documents | Only Phase 00 documents exist | Add run, context, adapter and event model docs | File inspection | NOT IMPLEMENTED |
| Five-run regression | No engine or fixture exists | Execute five infrastructure-clean canonical runs and retain evidence | Five-run summary and SQLite inspection | NOT IMPLEMENTED |
