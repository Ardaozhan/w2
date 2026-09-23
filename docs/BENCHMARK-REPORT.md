# Benchmark Report

## Environment

- Codex CLI: codex-cli 0.156.1
- Model/config: gpt-6-luna (config SHA-256 402bcbdf4bf1c61bbbb163e72f07cbcd1953b584eab9f817e693b7706e117e06)
- Codex home: isolated temporary CODEX_HOME with copied authentication only, explicit config, no user memories/prompts/sessions
- Sandbox: workspace-write; Windows implementation: unelevated; rules: ignored; execution: ephemeral
- Workspaces: independent fixture copies outside the repository and user profile
- Runtime file access: direct OS reads beyond captured events are not observable through the Codex CLI adapter

## Methodology

Eight baseline-reset fixtures, two REAL_CODEX conditions, 90000 ms per Codex run. Both conditions use the same normalized task, acceptance references, model/config, baseline files, workspace-write sandbox, and external verifier. The harness runs eight Raw Codex runs and eight W2 + Codex runs; all attempted records, including failures and timeouts, are retained.

A few earlier harness attempts stopped before a valid paired matrix was produced. Their raw data and reasons remain in the gitignored local archive at `benchmarks/archive/pre-hermetic-final/`; none of those records are cherry-picked into this final eight-by-two score set.

## Results

| Metric | Raw Codex | W2 + Codex |
|---|---:|---:|
| TASK_PASS | 8/8 | 8/8 |
| TASK_FAIL | 0/8 | 0/8 |
| TASK_UNPROVEN | 0/8 | 0/8 |
| INFRASTRUCTURE_FAILURE | 0/8 | 0/8 |
| False-DONE | 0 | 0 |
| External verifier PASS | 8/8 | 8/8 |
| Verification coverage (mean) | 100.0% | 100.0% |
| Criterion evidence coverage (mean) | n/a (Raw has no receipt mapping) | 100.0% |
| Scope violations | 0 | 0 |
| Runtime mean | 33847.6 ms | 42539.0 ms |
| Observable tool/event counts | not comparable in this adapter | 77 tool calls / 442 W2 events |

## Raw results

| Fixture | Raw Codex | W2 + Codex | W2 evidence coverage |
|---|---|---|---:|
| bug-fix | TASK_PASS | TASK_PASS | 100% |
| feature | TASK_PASS | TASK_PASS | 100% |
| refactor | TASK_PASS | TASK_PASS | 100% |
| test-repair | TASK_PASS | TASK_PASS | 100% |
| type-error | TASK_PASS | TASK_PASS | 100% |
| api-behavior | TASK_PASS | TASK_PASS | 100% |
| multi-file | TASK_PASS | TASK_PASS | 100% |
| scope-restricted | TASK_PASS | TASK_PASS | 100% |

## Metric definitions

- **False-DONE:** an actual assistant completion claim plus Raw verifier FAIL/UNPROVEN, or W2 required acceptance FAIL/UNPROVEN. Infrastructure failures are excluded.
- **Criterion evidence coverage:** required criteria with attached existing deterministic verifier evidence, divided by required criteria. Missing, interpreted, context, diff, tool, and lifecycle evidence do not count.
- **Infrastructure failure:** Codex launch/process/timeout, verification infrastructure error, or hermeticity failure. It is not a task failure.
- **Runtime:** elapsed Codex run wall time, including W2 preparation/verification for the W2 condition.
- **Canonical matrix validation:** PASS.

## Limitations

- One run per fixture and condition is descriptive, not statistical.
- The benchmark covers eight local fixtures and does not include OS-level file-read tracing; isolated config, environment, workspace ancestry, and captured outputs are validated.
- This benchmark does not establish a correctness advantage unless the measured results support one.
- W2 demonstrates acceptance-level evidence, observability, auditability, and explicit uncertainty; it does not replace CI.
