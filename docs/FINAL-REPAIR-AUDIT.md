# W2 Final Repair Audit

**FINAL COMPETITION GATE = NOT YET PROVEN**

Independent audit started 2026-09-23. Prior phase reports were treated as claims to re-check, not as current proof. The supported V42 dispatcher accepted repair task `task-9791ce8c715367e9db11adc7`; readiness artifact: `.v42-runtime/competition-repair/tasks/task-9791ce8c715367e9db11adc7/execution-readiness.json` (`V42_EXECUTION_READY=true`, project `w2`, security preflight `PASS`). A first shared-runtime checkpoint attempt failed on unrelated legacy `codex-v42` task records; retrying through a workspace-local V42 runtime succeeded without bypassing validation.

| ID | Audit blocker | Initial evidence | Status |
|---|---|---|---|
| A | Benchmark task schema mismatch | Runner reads `task.goal`; fixture stores `task` as a string. | REPAIRED: nested canonical task and fail-fast schema validator |
| B | Raw/W2 task semantics fairness | Raw prompt omits constraints and acceptance criteria. | REPAIRED: identical normalized semantics hash, baseline commit, verifier, sandbox, timeout |
| C | Timeout classifications differ | W2 and Raw branch logic differ for timeout and task outcome. | REPAIRED: nonzero Codex process exit -> INFRASTRUCTURE_FAILURE |
| D | Real Codex success proof | Stored benchmark reports show timeout-heavy runs; must produce new, verifiable successes. | REPAIRED: live REAL_CODEX benchmark has successful Raw and W2 runs; live W2 task-evidence UNPROVEN case persisted |
| E | Benchmark results are stale | Existing results predate the repair and cannot be reused. | REPAIRED: complete 16-run dataset regenerated and validator PASS |
| F | Criterion coverage metric is presence-only | CSV maps any verification object to coverage 1. | REPAIRED: required attached deterministic evidence / required criteria |
| G | Codex sandbox bypass is active | Adapter and benchmark runner pass the dangerous bypass flag. | REPAIRED: active command uses supported workspace-write |
| H | Safety boundary overclaim risk | Codex native tools bypass W2 ToolRuntime. | REPAIRED: README/security/architecture now describe observation layer and native Codex sandbox boundary |
| I | ToolRuntime scope is unclear | W2-owned tools and Codex sandbox controls are conflated. | REPAIRED: enforced/inherited/observed boundaries documented |
| J | Context visibility overclaim | W2-selected files are reported as all agent-visible files. | REPAIRED: selected context separated from unknown exact access |
| K | Context states are not separated | Manifest has considered/included/excluded only. | REPAIRED: selected/provided plus accessed unknown represented in receipt |
| L | GPT-5.6 mapper runtime claim | No live mapper call is present in evidence pipeline. | REPAIRED: runtime claim removed; deterministic mapping stated |
| M | Resume semantics mismatch | `resume()` only records an event and returns. | REPAIRED: capability downgraded to checkpoint recovery inspection |
| N | W2 DB pollutes task diff | Benchmark stores SQLite DB inside target workspace. | REPAIRED: DB outside fixture workspace and runtime-path diff filter/test |
| O | README misses required competition sections | Existing README needs compliance and claim review. | REPAIRED: required sections present |
| P | Demo and screenshot freshness | Existing screenshot is Phase 05; current judge path must be revalidated. | REPAIRED: real PASS/UNPROVEN replay and desktop/mobile screenshots refreshed; Playwright console clear |
| Q | Benchmark validator lacks provenance checks | Validator checks fixtures but not actual run/receipt/metric integrity. | REPAIRED: fixture hashes, paired baselines, receipts, coverage and classifications validated |
| R | Receipt integrity and evidence execution mode | Added typed evidence-reference validation, verification-backed PASS, and REAL_CODEX/FAKE_ADAPTER labels. | REPAIRED: receipt/unit/demo validation PASS |
| S | Security, clone, browser, secrets and Git state | Re-run from current checkout after repairs. | REPAIRED: current committed clean archive passed fresh-clone test; browser console clear; secret and dangerous-flag scan reviewed; no nested submodules remain |

No result in this table is considered closed until repository artifacts and fresh command output support it. See `FINAL-REPAIR-REPORT.md` for final evidence and gate decision.
