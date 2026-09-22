# W2 Benchmark Harness

The harness compares direct Raw Codex with W2 RunEngine + Codex on the same eight committed fixture contracts.

```powershell
npm run benchmark:validate   # rebuild deterministic fixture baselines and validate contracts
npm run benchmark            # run both conditions and preserve raw artifacts
npm run benchmark:verify     # validate stored result shape and report artifacts
```

Each fixture contains its baseline commit, task wording, constraints, allowed paths, acceptance criteria, verifier, and reset command. Runs are stored under `benchmarks/runs/raw` and `benchmarks/runs/w2`; aggregate data is generated under `benchmarks/results`. A Codex timeout is recorded as `INFRASTRUCTURE_FAILURE`, never as a task pass.
