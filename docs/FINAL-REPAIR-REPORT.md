# W2 Final Repair Report

> Historical report from the previous repair task. Its benchmark values and readiness status describe that checkpoint only. Current status and evidence are in [FINAL-COMPLETION-REPORT.md](FINAL-COMPLETION-REPORT.md) and [BENCHMARK-REPORT.md](BENCHMARK-REPORT.md).

This report supersedes conflicting claims in earlier phase completion reports. Only current artifacts and commands are treated as proof.

## Overall Status

FINAL COMPETITION GATE = YES for the documented local Windows 11 scope. All technical gates passed; external competition submission and real session-ID entry remain human actions.

## Audit Findings

All findings and initial evidence are tracked in [FINAL-REPAIR-AUDIT.md](FINAL-REPAIR-AUDIT.md). The supported V42 dispatcher accepted repair task `task-9791ce8c715367e9db11adc7`; its local readiness artifact records `V42_EXECUTION_READY=true` and security preflight PASS. A failed initial shared-runtime checkpoint was resolved through an isolated supported V42 runtime, without bypassing the gate.

## Repairs Completed

- Canonical nested benchmark task contract, fail-fast fixture validation, semantic parity, common baseline commit, sandbox, verifier, and timeout.
- Unified infrastructure-timeout classification; corrected criterion evidence coverage and false-DONE definitions.
- Removed the active dangerous Codex bypass; documented Codex sandbox, W2-owned controls, and observation limits.
- Corrected context, GPT-5.6, resume/recovery, and runtime-artifact claims.
- Strengthened receipt evidence-reference and verifier consistency checks; labeled execution mode.
- Rewrote README judge path, refreshed real demo artifacts/screenshots, and documented platform/license decisions.

## Benchmark Contract Repair

All eight fixtures use `{task:{title,goal,constraints,acceptance_criteria,verification_commands}}`. Raw and W2 derive their prompts from the same normalized contract and share a deterministic fixture baseline commit, verifier, `workspace-write` sandbox, and 90,000 ms timeout. Malformed contracts fail validation.

## Benchmark Re-run

Fresh results: [results.json](../benchmarks/results/results.json), [results.csv](../benchmarks/results/results.csv), [BENCHMARK-REPORT.md](BENCHMARK-REPORT.md). `npm run benchmark` stored 16 real Codex condition records; `npm run benchmark:verify` PASS. Outcomes: Raw 8/8 TASK_PASS, W2 8/8 TASK_PASS, 0 task failures, 0 unproven benchmark outcomes, 0 infrastructure failures. One run per fixture/condition is descriptive only; no comparative product advantage is inferred. Earlier attempts are retained under `benchmarks/archive/` and are not current results.

## Real Codex Execution Evidence

- Raw Codex: [bug-fix run record](../benchmarks/runs/raw/bug-fix/run-record.json), status TASK_PASS, external verifier PASS.
- W2 + Codex: [bug-fix receipt](../benchmarks/runs/w2/bug-fix/run-receipt.json), status PASS, execution mode REAL_CODEX, verifier-backed acceptance evidence.
- Real semantic UNPROVEN: [live demo receipt](../evidence/demo/unproven/20260923101252840/run-receipt.json); Codex completed and the multiplication verifier passed, while the separate README contract criterion lacked verification evidence.

## Timeout Semantics

Codex process error/timeout is an infrastructure failure; W2 persists it as ERROR. Benchmark class is `INFRASTRUCTURE_FAILURE`, never task FAIL or false-DONE evidence. UNPROVEN is reserved for completed execution with insufficient criterion evidence.

## Evidence Coverage Metric

Required criteria with attached valid deterministic evidence divided by required criteria. Zero required criteria yields 0; interpreted-only or invalid-ID evidence does not count. Unit tests cover the behavior.

## Context Truth Model

Receipt reports selected/provided context separately from repository access. Exact Codex file reads are not captured and remain unknown; the UI no longer says “what the agent saw.”

## Codex Sandbox / Safety Model

Active adapter uses installed Codex CLI `--sandbox workspace-write`. Codex native tools run under the Codex workspace sandbox and are observed by W2; W2 ToolRuntime controls only W2-owned calls. W2 is not an OS/container boundary or universal tool broker. See [SECURITY-MODEL.md](SECURITY-MODEL.md).

## GPT-5.6 Reality

No live GPT-5.6 Evidence Mapper is implemented or claimed. Mapping and final outcomes are deterministic. Repository provenance does not establish whether or where GPT-5.6 contributed during development, so no specific implementation contribution is attributed to it.

## Resume / Recovery Reality

`RunEngine.resume()` is checkpoint recovery inspection only; it does not restart or continue execution. Tests verify completed work is not replayed.

## Runtime Artifact Diff Cleanup

W2 SQLite databases are stored outside task workspaces (ignored `benchmarks/runtime-db/`); W2-named SQLite sidecars are excluded from captured task diff. The integration regression test passes.

## README Compliance

Required judge-facing sections and `npm ci` / `npm run demo` path are present. Demo is explicitly a stored replay; `npm run demo:live` performs a real Codex run. Platform statement is limited to Windows 11 verified; others are unverified. No license was added because `package.json` marks this repository private; decision is documented.

## Demo Repair

`evidence/demo/cases.json` points to a REAL_CODEX PASS benchmark receipt and a real task-evidence UNPROVEN receipt. `npm run demo:smoke` verifies both. The UNPROVEN outcome is due to missing criterion verification, not timeout.

## Screenshot Refresh

Fresh Playwright captures are in [evidence/screenshots](../evidence/screenshots/): hero PASS, context, trace, diff, verification, acceptance evidence, benchmark, task-evidence UNPROVEN, and mobile view. Browser console reported 0 errors and 0 warnings; the 390px viewport rendered without horizontal overflow observed in the screenshot.

## Test Results

- `npm ci`: PASS; 0 vulnerabilities reported.
- `npm test`: PASS, 10 files / 30 tests.
- `npm run typecheck`: PASS.
- `npm run build`: PASS.
- `npm run verify:phase02`: PASS (PASS, FAIL, UNPROVEN fixture integrity).
- `npm run benchmark:verify`: PASS (16 REAL_CODEX runs).
- `npm run demo:smoke`: PASS (REAL_CODEX PASS and task-evidence UNPROVEN).
- `npm run phase06:audit`: PASS.
- Security regressions cover path traversal, symlink escape, approval denial, timeout/output limit, secret redaction, bounded retries, abort, checkpoint inspection, and W2 DB diff cleanup.
- No lint script is configured.

## Fresh Clone Results

`node scripts/fresh-clone-check.mjs` PASS against the final evidence/code state at commit `87e0717`. It used a clean `git archive` copy, fresh `npm ci` (41 packages), then passed 10 files / 30 tests, typecheck, build, Phase 02 integrity, benchmark result validation (16 runs), and real PASS/UNPROVEN demo smoke.

## Claim Audit

Updated [CLAIM-AUDIT.md](CLAIM-AUDIT.md); `npm run phase06:audit` PASS. Dangerous bypass flag search: no active or retained repository matches. Secret-pattern review found only test placeholders, redaction key names, and historical V42 task identifiers; no credential detected.

## Known Limitations

One run per fixture/condition; eight local fixtures only; exact Codex file access unavailable; no live GPT-5.6 mapper; checkpoint recovery does not resume; only Windows 11 verified.

## Human Submission Actions

- Replace `[ADD REAL SESSION ID BEFORE SUBMISSION]` only with the actual required Codex session/feedback ID.
- Confirm publication/license intent; current package is private and no license was added.
- Complete external competition upload and any human-recorded video requirement.

## Git State

Clean worktree at final report commit. No gitlinks/submodules remain. Failed benchmark attempts and the pre-repair set are preserved as ordinary files under `benchmarks/archive/`; preceding repair commits are `4f2a218` (`fix: store demo and benchmark workspaces as artifacts`) and `17f66a4` (`competition: repair evidence and harden W2`).

## Final Gate

W2 COMPETITION READY: YES (local Windows 11 verification scope only).
