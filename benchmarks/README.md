# W2 Benchmark Harness

The harness compares direct Raw Codex with W2 RunEngine + Codex on the same eight committed fixture contracts.

```powershell
npm run benchmark:validate   # rebuild deterministic fixture baselines and validate contracts
npm run benchmark            # run both conditions and preserve raw artifacts
npm run benchmark:verify     # validate stored result shape and report artifacts
```

Each fixture contains a canonical nested task (`title`, `goal`, `constraints`, `acceptance_criteria`, `verification_commands`), baseline hash, allowed paths, external verifier, and reset command. Raw Codex and W2 receive the same normalized task semantics, allowed paths, verifier, workspace shape, workspace-write sandbox, and timeout. W2 adds observation and receipt artifacts.

Runs are stored under `benchmarks/runs/raw` and `benchmarks/runs/w2`; W2 SQLite databases are stored outside task workspaces in ignored `benchmarks/runtime-db/`. Aggregate data is generated only after raw-run validation under `benchmarks/results`. Every timeout and process error is retained as `INFRASTRUCTURE_FAILURE` and excluded from task outcome classifications. The sample is descriptive, one run per condition per fixture.
