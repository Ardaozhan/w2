# W2 — verifiable evidence for coding-agent runs

W2 is an engineering harness for coding agents that turns every run into verifiable evidence. The core artifact is the **Run Receipt**: a human- and machine-readable record of what the agent saw, what it did, and whether it worked.

## Fast path

```powershell
npm ci
npm run demo
```

Open the printed local URL. The demo is read-only and uses a real captured W2 receipt whose `UNPROVEN` outcome is intentionally visible. For a non-network check use `npm run demo:smoke`.

## Verify the repository

```powershell
npm test
npm run typecheck
npm run build
npm run verify:phase02
npm run benchmark:validate
npm run benchmark:verify
```

The canonical engine entry point is `npm run w2 -- run fixtures/canonical/task.json`. Operational state is persisted in SQLite. Receipts can be exported with `w2 receipt <run-id> --db <path> --out <dir>`.

## Product flow

```text
TASK → CONTEXT → CODEX → TOOLS → DIFF → VERIFICATION → EVIDENCE → RUN RECEIPT
```

The local demo exposes Runs, Context, Trace, Diff, Verification, Acceptance Evidence, and Benchmark views. `UNPROVEN` is never presented as `PASS`.

## Evidence and benchmark

Phase 02 fixtures (`PASS`, `FAIL`, `UNPROVEN`) live under `fixtures/rate-limit-demo/`. Phase 04 stores eight fixture contracts and 16 raw/W2 condition records under `benchmarks/`. The current one-run-per-condition sample records Codex timeouts as infrastructure failures; it makes no unsupported speed, safety, or accuracy claim. See [docs/BENCHMARK-REPORT.md](docs/BENCHMARK-REPORT.md).

## Architecture and limits

See [docs/ARCHITECTURE-DIAGRAM.md](docs/ARCHITECTURE-DIAGRAM.md), [docs/SECURITY-MODEL.md](docs/SECURITY-MODEL.md), and [docs/application/LIMITATIONS.md](docs/application/LIMITATIONS.md). W2 implements a local workspace-scoped control layer; it is not an OS/container sandbox or hosted multi-user service.

## Documentation

- [Product UX](docs/PRODUCT-UX.md) · [Demo flow](docs/DEMO-FLOW.md)
- [Project summary](docs/application/PROJECT-SUMMARY.md) · [Technical summary](docs/application/TECHNICAL-SUMMARY.md)
- [Impact](docs/application/IMPACT.md) · [AI contribution](docs/application/AI-CONTRIBUTION.md) · [Limitations](docs/application/LIMITATIONS.md)
- [Competition proof map](docs/COMPETITION-PROOF-MAP.md) · [Claim audit](docs/CLAIM-AUDIT.md) · [Judge simulation](docs/JUDGE-SIMULATION.md)

## Source of truth

Phase contracts are in [W2-Competition-Phases/](W2-Competition-Phases/), with current state in [docs/PHASE-STATUS.md](docs/PHASE-STATUS.md).
