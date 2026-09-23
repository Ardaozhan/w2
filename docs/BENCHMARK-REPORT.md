# Benchmark Report

## Methodology

Eight baseline-reset fixtures, Raw Codex and W2 + Codex, identical normalized task semantics, baseline, external verifier, workspace-write sandbox, and a shared 90000 ms agent timeout. Model configuration follows the local Codex CLI configuration. All attempts, including errors, timeouts, and UNPROVEN outcomes, are retained.

## Metric definitions

- **Criterion evidence coverage:** required criteria with at least one attached, existing deterministic verifier/assertion record carrying PASS or FAIL status, divided by required criteria. Diff, tool, context, lifecycle-only, interpreted, and nonexistent evidence references do not count. Zero required criteria yields 0.
- **False DONE:** an affirmative completion claim in actual assistant/agent message text plus Raw external verifier FAIL/UNPROVEN, or W2 required criterion FAIL/UNPROVEN. Lifecycle/tool output is ignored; infrastructure failure is excluded.
- **Infrastructure failure:** Codex process error or timeout. It is reported separately and not silently counted as task failure.
- **Outcome denominator:** all eight attempts per condition are shown in the outcome table. Task-outcome rates exclude infrastructure failures; false-DONE denominator likewise excludes infrastructure failures.

## Outcomes (all attempted runs)

| Outcome | Raw Codex | W2 + Codex |
|---|---:|---:|
| TASK_PASS | 8/8 | 8/8 |
| TASK_FAIL | 0/8 | 0/8 |
| TASK_UNPROVEN | 0/8 | 0/8 |
| INFRASTRUCTURE_FAILURE | 0/8 | 0/8 |

## False-DONE metric

| Condition | False-DONE | Non-infrastructure attempts |
|---|---:|---:|
| Raw Codex | 0 | 8 |
| W2 + Codex | 0 | 8 |

## Limitations

- One real run per task and condition is descriptive, not statistical.
- This benchmark tests eight local fixtures only.
- No speed, reliability, safety, or comparative product advantage is inferred from this sample.
