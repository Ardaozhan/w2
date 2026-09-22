# W2 — Phase 04: Benchmark & Proof

## Status
**Gate:** BLOCKING  
**Prerequisite:** Phases 00–03 must be COMPLETE.

---

## 1. Objective

Prove what W2 actually contributes.

Primary comparison:

```text
RAW CODEX
vs
W2 + CODEX
```

The benchmark exists to test claims, not manufacture a win.

---

## 2. Benchmark Questions

Measure:

1. Does W2 reduce false-DONE outcomes?
2. Does W2 improve evidence coverage?
3. Does W2 expose missing verification?
4. Does W2 make code changes easier to audit?
5. What runtime/tool/token overhead does W2 add?
6. Which task types benefit most?
7. Where does W2 fail to help?

---

## 3. Benchmark Suite

Target: **10–15 tasks** if practical.

Minimum acceptable: **8 meaningful tasks**.

Suggested categories:

- small bug fix
- feature implementation
- refactor
- test repair
- type error
- API behavior change
- multi-file change
- scope-restricted task
- context-selection challenge
- false-DONE trap
- missing-verification task
- ambiguous acceptance criterion

---

## 4. Fixture Contract

Each fixture must contain:

```text
fixture_id
baseline_commit
task
constraints
allowed_paths
acceptance_criteria
verification_commands
external_verifier
reset_command
```

---

## 5. Fair Comparison Rules

Keep equal where practical:

- same repository state
- same model
- same model configuration
- same task wording
- same machine
- same timeout
- same acceptance criteria
- same external verifier

Document any unavoidable differences.

---

## 6. Core Metrics

### Correctness

```text
task_pass_rate
false_done_rate
required_criteria_pass_rate
scope_violation_rate
```

### Evidence

```text
context_visibility
tool_visibility
diff_visibility
verification_visibility
criterion_evidence_coverage
```

### Efficiency

```text
runtime
model_calls
tool_calls
steps
input_tokens
output_tokens
retries
```

### Human Effort

```text
manual_interventions
manual_verification_steps
manual_recovery_steps
```

---

## 7. Metric Definitions

Write definitions before final benchmark runs.

Example:

### False DONE

A run in which the agent communicates task completion, while at least one required acceptance criterion fails or remains unproven under external verification.

### Evidence Coverage

Percentage of required audit questions for which the system stores direct inspectable evidence.

---

## 8. External Verification

W2 must not grade itself exclusively.

Use independent verification such as:

- deterministic tests
- expected response assertions
- file assertions
- typecheck
- static analysis
- scripted API probes
- manually prewritten rubric when automation is impossible

---

## 9. Run Procedure

For each task:

```text
reset baseline
run Raw Codex
collect artifacts
run external verifier
reset baseline
run W2 + Codex
collect receipt
run same external verifier
store result
```

Repeat selected tasks if variance is high.

---

## 10. Raw Result Preservation

Store failed and successful runs.

Recommended:

```text
/benchmarks/fixtures/
/benchmarks/runs/raw/
/benchmarks/runs/w2/
/benchmarks/results/results.json
/benchmarks/results/results.csv
```

No cherry-picking.

---

## 11. Benchmark Report

Create:

```text
/docs/BENCHMARK-REPORT.md
```

Must include:

- methodology
- environment
- model
- sample size
- task categories
- metric definitions
- raw-result links
- aggregate results
- failure cases
- limitations
- interpretation

Clearly distinguish:

```text
measured result
interpretation
hypothesis
```

---

## 12. Comparative Summary

Generate a judge-readable table.

Example:

| Metric | Raw Codex | W2 + Codex |
|---|---:|---:|
| Tasks externally verified | ... | ... |
| False DONE | ... | ... |
| Runs with stored context evidence | ... | ... |
| Runs with stored diff evidence | ... | ... |
| Criteria with explicit evidence | ... | ... |
| Median runtime | ... | ... |
| Median tool calls | ... | ... |

All numbers must derive from stored data.

---

## 13. Case Study

Select one strongest real example.

Ideal structure:

```text
Agent says DONE
↓
W2 verification finds missing requirement
↓
Receipt marks FAIL / UNPROVEN
↓
Developer can inspect evidence immediately
```

If no such real case occurs, use the most informative genuine failure instead.

Never stage fake evidence.

---

## 14. Ablation

If time allows, compare:

```text
W2 without Evidence Mapper
W2 without verification
Full W2
```

Only run ablations that produce useful insight.

---

## 15. Public Claim Rules

Never claim:

- faster
- safer
- more reliable
- fewer failures
- better accuracy
- lower cost

unless the benchmark actually supports the claim.

Prefer precise wording:

> “In our 12-task benchmark, ...”

---

## 16. Acceptance Criteria

### Suite
- [ ] At least 8 meaningful fixtures exist.
- [ ] Multiple task categories exist.
- [ ] Every fixture resets reproducibly.
- [ ] Every fixture has external verification.

### Fairness
- [ ] Raw and W2 conditions are documented.
- [ ] Same task and acceptance criteria are used.
- [ ] Differences are disclosed.

### Metrics
- [ ] False DONE is defined.
- [ ] Evidence coverage is defined.
- [ ] Efficiency metrics are captured where reliable.

### Results
- [ ] Raw Codex runs are stored.
- [ ] W2 runs are stored.
- [ ] Failed runs are retained.
- [ ] External verification outputs are stored.

### Reporting
- [ ] Results table is generated from raw data.
- [ ] Limitations are documented.
- [ ] At least one real case study exists.
- [ ] No unsupported public claim remains.

### Reproducibility
- [ ] Another developer can rerun the benchmark.
- [ ] Result generation is scripted.
- [ ] Infrastructure failure is distinguishable from task failure.

---

## 17. Required Artifacts

```text
/benchmarks/README.md
/benchmarks/fixtures/
/benchmarks/run.*
/benchmarks/results/results.json
/benchmarks/results/results.csv
/docs/BENCHMARK-REPORT.md
/evidence/benchmark/
```

---

## 18. Exit Evidence

Phase 04 closes only when:

1. methodology is frozen
2. benchmark is executed
3. raw results are preserved
4. comparative summary is generated
5. limitations are written
6. public claims trace to evidence

---

## 19. Phase Lock

**STOP after Phase 04.**

If benchmark results expose a core weakness, return to the relevant earlier phase, fix it, and rerun the affected benchmark before continuing.
