# Public Claim Audit

Audit scope: README, judge demo, benchmark report and results, architecture/security/context docs, hero case study, application summaries, and the public evidence manifest. [W2 Final Report](W2-FINAL-REPORT.md) is the current status source.

| Claim | Disposition | Evidence or wording limit |
|---|---|---|
| W2 is a verification layer for coding agents | SUPPORTED | RunEngine, CLI, automatic acceptance mapping, persisted receipt, and product-path integration tests. |
| Coding agents can claim they finished; W2 shows evidence | SUPPORTED WITH LIMIT | Receipt outcomes derive from stored run status and verifier-linked deterministic evidence. |
| No evidence, no PASS | SUPPORTED | Receipt validation rejects missing required criterion evidence; tests cover PASS, FAIL, and UNPROVEN. |
| W2 automatically maps criteria to evidence in normal CLI runs | SUPPORTED | CLI/RunEngine integration tests and stored REAL_CODEX receipts use task-declared verifier references. |
| A verifier supports its declared checks in a stored run | SUPPORTED WITH LIMIT | It is evidence for that verifier and run, not a general correctness guarantee. |
| A successful test suite proves every task criterion | REMOVE | Only mapped verifier evidence supports the referenced criterion. |
| W2 proves all requirements are correct | REWRITE | Say that the receipt has deterministic evidence for the declared criterion and verifier in that run. |
| The context manifest proves every file Codex accessed | REMOVE | It records files considered, selected, and provided; exact Codex reads are unknown without supporting telemetry. |
| W2 sees every file Codex opened | REMOVE | The current adapter does not provide a complete file-read trace. |
| W2 controls or authorizes every Codex action | REMOVE | Codex's sandbox controls native Codex execution. W2 checks only its own `ToolRuntime` calls. |
| The active Codex adapter uses `workspace-write` | SUPPORTED FOR THE VERIFIED WINDOWS RUN | The adapter arguments and stored benchmark configuration specify this mode; Windows used the `unelevated` implementation. |
| W2 is safer, more reliable, faster, or more accurate than raw Codex | REMOVE | The one-attempt-per-fixture sample does not establish comparative superiority. |
| W2 replaces CI | REMOVE | W2 can record test/CI output as evidence; it does not replace CI. |
| GPT-5.6 maps evidence or selects runtime outcomes | REMOVE | GPT-5.6 is documented as a development-time reviewer; runtime mapping and outcomes are deterministic. |
| W2 is production-ready | REMOVE | The local fixture and evidence do not establish deployment or operational readiness. |
| The static judge demo runs Codex live | REMOVE | It replays stored artifacts. `demo:live` and `hero:run` start separate live runs. |

Terms reviewed include claims about safety, speed, reliability, proof, prevention, visibility, control, and production readiness. Keep evidence scoped to the named task, verifier, and recorded run.
