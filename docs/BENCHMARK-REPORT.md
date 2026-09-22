# Benchmark Report

## Methodology

Eight reproducible local fixtures were reset from committed baselines. Each fixture was run once with direct Raw Codex and once through the W2 RunEngine + Codex adapter. Both conditions used the same task contract, verifier, workspace, timeout, and local Codex configuration. Failed runs and raw artifacts remain under `benchmarks/runs/`.

## Metric definitions

- **False DONE:** the agent emitted a completion claim while the independent verifier did not pass.
- **Evidence coverage:** whether the condition stored context, action/tool, diff, and verification evidence for the run.
- **Infrastructure failure:** a Codex/process failure is retained as a run status and is not relabeled as a task failure.

## Stored results

| Metric | Raw Codex | W2 + Codex |
|---|---:|---:|
| status | 0/8 PASS | 0/8 PASS |
| false_done | 0 | 0 |
| runtime_ms | 20116 | 20214 |
| tool_calls | 0 | 3 |
| steps | 0 | 25 |

## Case study

Stored case: **bug-fix / raw_codex**. Status=INFRASTRUCTURE_FAILURE; external verifier=FAIL; infrastructure_failure=true. This is the actual first non-PASS stored run, not staged evidence.

## Limitations

- This is a one-run-per-condition sample; it is descriptive, not a statistical performance claim.
- Token counts are left unmeasured where the local Codex JSON stream does not expose them.
- Model/service outages remain visible as infrastructure failures.

## Claims

All numbers in this report are generated from `benchmarks/results/results.json`; no unsupported speed, safety, accuracy, or cost claim is made.
