# W2 Competition Matrix

This matrix reports implemented capabilities and linked evidence, not feature aspirations. The current authority for final pass/fail state is `FINAL-SUBMISSION-READINESS.md`.

| Criterion | Implemented capability | Real evidence | Artifact path | Remaining limitation |
|---|---|---|---|---|
| Technical implementation | Persisted runs, recognized events, diff, verifier, deterministic receipt | Real Raw and W2 Codex benchmark artifacts; test suite | `benchmarks/runs/`, `src/core/`, `tests/` | Codex events do not expose every native action |
| Product clarity | Receipt, context, trace, diff, verification, acceptance evidence, benchmark views | Playwright captures from the static stored-data demo | `judge-demo/`, `evidence/screenshots/` | Local replay, not hosted/live execution |
| Evidence integrity | Typed references and verification-backed deterministic outcomes | Receipt integrity tests and real receipts | `tests/evidence/`, `benchmarks/runs/w2/` | No runtime GPT-5.6 evidence mapping |
| Benchmark rigor | Eight paired fixtures, canonical normalized task, baseline, verifier, and timeout | Sixteen REAL_CODEX run records plus result validator | `benchmarks/results/`, `docs/BENCHMARK-REPORT.md` | One run per task/condition; descriptive only |
| Safety transparency | W2-owned ToolRuntime checks separated from Codex sandbox and observation | Active adapter configuration, safety tests, documentation | `src/core/agent.ts`, `docs/SECURITY-MODEL.md` | Not an OS/container boundary or universal native-tool broker |
| Reproducibility | Clean archive install, tests, typecheck, build, validators, and demo checks | Fresh-clone result in final readiness report | `scripts/fresh-clone-check.mjs`, `docs/FINAL-SUBMISSION-READINESS.md` | Verified on Windows 11 only |
| AI contribution | Real Codex runs/development plus independently recorded GPT-5.6 final review | Stored run metadata and review provenance | `docs/GPT56-CONTRIBUTION.md`, `docs/GPT56-FINAL-REVIEW.md` | GPT-5.6 was not used at runtime |

No criterion is marked proven without current linked evidence. Earlier phase-level summaries do not supersede these limits.
