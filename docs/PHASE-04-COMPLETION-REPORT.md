# Phase 04 Completion Report — Benchmark & Proof

## Status

COMPLETE. Official V42 task `task-4e8e461e0da08d59c1db0a6c` reached a PASS final-combined verification gate.

## Objective

Measure what W2 contributes using a reproducible Raw Codex versus W2 + Codex comparison without manufacturing a win.

## Implemented

- Eight fixture contracts across eight task categories.
- Deterministic fixture reset/validation and independent external verifier.
- Direct Raw Codex and W2 RunEngine + Codex conditions with equal task contracts and timeout.
- Raw run preservation, W2 JSON/Markdown receipts, result JSON/CSV, and report generation.
- Explicit infrastructure-failure classification for Codex timeouts.

## Changed Files

`benchmarks/README.md`, `benchmarks/prepare.mjs`, `benchmarks/validate.mjs`, `benchmarks/run.mjs`, `benchmarks/verify-results.mjs`, `benchmarks/adversarial-scenarios.mjs`, `benchmarks/fixtures/`, `benchmarks/runs/`, `benchmarks/results/`, `evidence/benchmark/README.md`, and `docs/BENCHMARK-REPORT.md`.

## Architecture

Fixture contracts are deterministic and independent of the aggregator. Each run is reset into a separate workspace, externally verified, and stored before aggregation. W2 runs additionally persist a SQLite-backed Run Receipt. The report reads only `benchmarks/results/results.json`.

## Tests Executed

- `npm run benchmark:validate` — PASS (8 fixtures, 8 categories).
- `npm run benchmark` — PASS as an execution pipeline; 16 run records stored.
- `npm run benchmark:verify` — PASS.
- `npm run typecheck` — PASS.
- `npm run build` — PASS.
- Phase 00–03 regression suite remained green before the gate.
- Official V42 independent verifier — PASS (`vfy-4e13ac9e033a46c1aedda2007ad5dc34`).
- Official V42 adversarial QA — PASS with targeted security/concurrency/idempotency/time checks.

## Acceptance Criteria Audit

| Criterion | Status | Evidence | Verification |
|---|---|---|---|
| Suite | PASS | 8 contracts, 8 categories, validators | `npm run benchmark:validate` |
| Fairness | PASS | same contract, verifier, workspace shape, timeout and local Codex config | `benchmarks/README.md`, stored run metadata |
| Metrics | PASS | false-DONE, evidence, runtime/tool/step and infrastructure fields | `benchmarks/results/results.json` |
| Results | PASS | 16 stored raw/W2 records, failed runs retained | `benchmarks/runs/`, `results.json`, `results.csv` |
| Reporting | PASS | methodology, case study, limitations, claim audit | `docs/BENCHMARK-REPORT.md` |
| Reproducibility | PASS | prepare, validate, run, verify commands | `benchmarks/README.md` |

## Exit Evidence

The 16-run dataset is stored in `benchmarks/results/results.json`; per-condition artifacts are under `benchmarks/runs/raw/` and `benchmarks/runs/w2/`. The report records 0/8 externally passing runs in both conditions because the configured 20-second local Codex timeout was reached; these are preserved as infrastructure failures or unproven outcomes, not relabeled as success.

## Regression

Prior phase tests, typecheck, build, and Phase 02 fixture validation remained PASS.

## Known Limitations

This is one run per condition per fixture and therefore descriptive. Token counts are not claimed because the local stream did not expose a reliable value. The current sample demonstrates reproducible failure/observability behavior, not a positive performance or accuracy claim.

## Scope Check

No Phase 05 UI or Phase 06 packaging was included in the benchmark gate.

## Final Gate

PASS. Phase 04 is complete; Phase 05 may start under a new explicit V42 task.
