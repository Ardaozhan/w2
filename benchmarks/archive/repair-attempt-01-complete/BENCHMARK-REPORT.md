# Benchmark Report

## Methodology

Eight baseline-reset fixtures, two real Codex conditions, identical normalized task semantics and verifier, workspace-write sandbox, and a shared 90000 ms agent timeout. Every run, including errors and timeouts, is retained.

## Metric definitions

- **Criterion evidence coverage:** required criteria with valid attached deterministic evidence divided by required criteria; zero required criteria is reported as 0. Interpreted-only evidence does not count.
- **False DONE:** agent completion claim plus external verifier FAIL or UNPROVEN. Infrastructure failure is excluded.
- **Infrastructure failure:** Codex process error or timeout; it is not counted as a task failure.
- **Denominator:** all eight attempted runs per condition; infrastructure failures are separately shown and excluded from task-outcome rates.

## Outcomes

| Outcome | Raw Codex | W2 + Codex |
|---|---:|---:|
| TASK_PASS | 8/8 | 8/8 |
| TASK_FAIL | 0/8 | 0/8 |
| TASK_UNPROVEN | 0/8 | 0/8 |
| INFRASTRUCTURE_FAILURE | 0/8 | 0/8 |

## Limitations

- One real run per task and condition is descriptive, not statistical.
- This benchmark tests eight local fixtures only.
- No speed, reliability, or safety advantage is inferred from this sample.
