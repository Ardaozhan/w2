# W2 Competition Matrix

| Criterion | Implemented capability | Real evidence | Artifact | Remaining limitation |
|---|---|---|---|---|
| Technical implementation | Persisted run, observed events, diff, verifier, receipt validation | Tests and current real Codex run records | `src/core/`, `benchmarks/runs/`, `docs/FINAL-REPAIR-REPORT.md` | Codex events do not expose every action |
| Product clarity | Receipt views for task, selected context, trace, diff, verification and criteria | Current demo smoke and browser capture | `src/demo-server.ts`, `evidence/screenshots/` | Local stored-data demo |
| Evidence integrity | Deterministic outcome plus referenced acceptance evidence | Receipt integrity tests and real run receipt | `tests/evidence/`, `benchmarks/runs/w2/` | Semantic mapping is supplied, not produced by GPT-5.6 |
| Benchmark rigor | Eight paired fixtures, shared normalized contract/verifier/timeout | Validated rerun artifacts and generated report | `benchmarks/results/`, `docs/BENCHMARK-REPORT.md` | One run per task and condition; descriptive only |
| Safety transparency | W2-owned ToolRuntime controls and Codex workspace-write boundary described separately | CLI help, source invocation and security regression tests | `docs/SECURITY-MODEL.md`, `src/core/agent.ts` | Not an OS/container boundary or complete native tool broker |
| Reproducibility | Clean-copy install, tests, typecheck, build, validators and demo smoke | Fresh clone log in final report | `scripts/fresh-clone-check.mjs`, `docs/FINAL-REPAIR-REPORT.md` | Verified on Windows 11 only |

No criterion is marked proven without current evidence. This matrix supersedes earlier phase-level completion summaries where they describe broader capabilities.
