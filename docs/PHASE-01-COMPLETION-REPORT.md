# W2 Phase 01 Completion Report

## Status

COMPLETE

## Objective

Build the smallest reliable Core Run Engine that executes one structured coding-agent task and durably records context, agent output, tools, ordered trace, diff, verification, and final state.

## Implemented

- Zod-validated task contract with fail-early malformed input handling.
- Explicit run state machine persisted in SQLite.
- Inspectable context manifest with considered/included/excluded files, selection reasons, source paths, bytes, and approximate tokens.
- One Codex CLI adapter boundary with lifecycle, JSONL output capture, tool normalization, cancellation, and timeout handling.
- Central filesystem/shell/git runtime with tool call records and errors.
- Ordered SQLite event trace with per-run sequence numbers.
- Reproducible SQLite migration for runs, tasks, events, tool calls, and verification results.
- Git status/diff capture with changed files, additions, deletions, and unified diff.
- Task-defined verification runner for test/lint/typecheck/build/custom categories.
- `w2 run <task.json> [--db <path>]` developer entry point.
- Deterministic nested TypeScript canonical fixture and resettable Git baseline.

## Architecture Changes

The engine flow is `TASK -> CONTEXT -> CODEX ADAPTER -> TOOL/EVENT TRACE -> DIFF -> VERIFICATION -> FINAL RUN STATE`. SQLite is the operational source of truth; JSON is used only as structured column payloads and event payloads, never as the sole state store. Node 22.5+ built-in `node:sqlite` is used to avoid native ABI dependencies.

## Changed Files

Core implementation is under `src/core/` with `src/cli.ts`. Required contracts are documented in `docs/RUN-CONTRACT.md`, `docs/CONTEXT-MANIFEST.md`, `docs/AGENT-ADAPTER.md`, and `docs/EVENT-MODEL.md`. Tests are under `tests/core/` and `tests/integration/`; the fixture is under `fixtures/canonical/`.

## Tests Executed

| Command | Result |
| --- | --- |
| `npm ci` | PASS, exit 0 |
| `npm test` | PASS, 6 files / 9 tests |
| `npm run typecheck` | PASS, exit 0 |
| `npm run build` | PASS, exit 0 |
| canonical baseline `npm test` | PASS after agent change; baseline fails deterministically before change |

## Canonical Fixture

`fixtures/canonical/project` is a nested Git repository with a failing percentage-discount test at baseline. The Codex run changes only `src/discount.ts`; the task verification command is `npm test`. Reset is `git -C fixtures/canonical/project restore src/discount.ts` (the nested baseline remains tracked).

## Five-Run Regression

All five consecutive runs completed with infrastructure exit 0 and persisted complete evidence in `fixtures/.w2/canonical.sqlite`:

| Run ID | State | Events | Tool records | Verification | Changed files |
| --- | --- | ---: | ---: | ---: | --- |
| `2362b766-2567-4ecf-a525-d8a4bb33c22a` | COMPLETED | 76 | 17 | 1 passed | `src/discount.ts` |
| `faa042e0-e2b2-4401-b6a2-09a4f64c1d0c` | COMPLETED | 68 | 15 | 1 passed | `src/discount.ts` |
| `590467c9-2bd7-476b-a35a-a565b8bb0fdf` | COMPLETED | 68 | 15 | 1 passed | `src/discount.ts` |
| `dce45bd0-81b4-42c8-a5c3-9cfaf3560425` | COMPLETED | 68 | 15 | 1 passed | `src/discount.ts` |
| `717e8d75-0209-4a7b-b614-eff235046408` | COMPLETED | 68 | 15 | 1 passed | `src/discount.ts` |

## Acceptance Criteria Audit

- **Structured task executes end-to-end** — PASS. `node dist/src/cli.js run fixtures/canonical/task.json --db fixtures/.w2/final.sqlite`; final run `ea0d0b0b-ad36-4666-acb0-4c636cfa7778` is `COMPLETED`.
- **Persistent run ID and SQLite state** — PASS. `runs` row and normalized rows are present in `fixtures/.w2/final.sqlite`.
- **Explicit state transitions** — PASS. `tests/core/store.test.ts` rejects invalid transitions; `docs/RUN-CONTRACT.md` defines the graph.
- **Context manifest and inspectable sources/size** — PASS. Final run stores 4 included files and 170 approximate tokens in `runs.context_manifest`.
- **Codex adapter boundary and agent failure capture** — PASS. `src/core/agent.ts`, `tests/core/agent.test.ts`, and the unsupported-model run `b06869a6-7336-4f33-bcfb-e55c674dc6f1` show a persisted failed agent run.
- **Filesystem, shell, and Git tools traced** — PASS. Final run has 14 tool records; `tests/core/runtime.test.ts` covers filesystem and shell error recording.
- **Ordered trace survives completion and includes errors** — PASS. Final run has 74 sequence-ordered events; failure runs include `run_failed`.
- **SQLite schema is reproducible** — PASS. `RunStore.migrate()` creates `schema_migrations` and all required tables; reopen persistence is tested.
- **Before/after status and unified diff** — PASS. Final run stores clean `status_before`, modified `status_after`, `src/discount.ts`, 1 addition, 1 deletion, and unified diff.
- **Verification outputs and exit codes persisted** — PASS. Final run stores `npm test`, exit code 0, stdout/stderr, duration, and `PASSED`; integration tests prove exit 4 becomes `FAILED`.
- **Canonical fixture and five clean runs** — PASS. Fixture is resettable and the five-run table above contains complete evidence for every run.

## Exit Evidence

Complete final run: `ea0d0b0b-ad36-4666-acb0-4c636cfa7778` in `fixtures/.w2/final.sqlite`.

- Context manifest: 4 included files, 170 approximate tokens.
- Ordered trace: 74 events, sequence-ordered in `events`.
- Tool records: 14 in `tool_calls`.
- Git diff: `src/discount.ts`, 1 addition / 1 deletion, unified diff persisted.
- Verification: canonical `npm test`, exit 0, `PASSED`.
- Persistent state: `runs`, `tasks`, `events`, `tool_calls`, and `verification_results` rows.
- Five-run regression: five `COMPLETED` records listed above.

## Phase 00 Regression

PASS — `npm ci`, `npm test`, `npm run typecheck`, and `npm run build` all exit 0 after Phase 01 implementation. Required Phase 00 documents remain present and Phase 02-06 remain locked.

## Known Limitations

- Node.js 22.5+ is required for the built-in `node:sqlite` API.
- Phase 01 has no approval broker; the non-interactive Codex adapter uses Codex's explicit bypass flag inside the task workspace. Approval/sandbox policy is deferred to Phase 03.
- Codex JSONL events are observed and normalized at the adapter boundary; a future safety phase can provide deeper interception.
- `npm ci` reports five existing development-tool audit findings; no production dependency was added for SQLite.

## Scope Check

No Phase 02+ implementation introduced: YES

## Final Gate

PHASE 01 COMPLETE: YES
NEXT PHASE UNLOCKED: NO — Phase 02 remains locked until a separate authorized phase session.
