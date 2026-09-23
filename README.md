# W2

W2 creates a local Run Receipt that puts a coding-agent task, W2-selected context, observed events, repository diff, verification, and acceptance evidence in one inspectable record.

## Why W2

An agent saying "done" is not the same as a verified task outcome. W2 keeps task evidence and verifier results close to the changes so a reviewer can inspect what was recorded and where evidence is missing.

## Run Receipt

A receipt is a JSON/Markdown record with the task contract, context W2 selected and provided, recognized events, changed files, verifier output, evidence links, and a deterministic outcome (`PASS`, `FAIL`, `UNPROVEN`, `ERROR`, or `ABORTED`). Exact Codex file-read access is not claimed. A PASS applies only to configured required criteria and their attached evidence.

## How It Works

```text
Task -> W2 context selection -> Codex CLI (workspace-write sandbox) -> repository
                                  |                                |
                                  +-- recognized events -----------+
W2 captures diff + runs declared verification -> evidence -> Run Receipt
```

W2's `ToolRuntime` controls only W2-owned tool calls. Codex's native tools run under the Codex sandbox and W2 observes recognized structured events and resulting changes; W2 is not a universal pre-execution broker or OS/container boundary. Details: [Architecture](docs/ARCHITECTURE.md) and [Security Model](docs/SECURITY-MODEL.md).

## Instant Judge Demo

Open [`judge-demo/index.html`](judge-demo/index.html) directly. It is a static, no-build, no-app-backend, no-key, offline-capable replay of stored run evidence. Both cases are labeled `REAL_CODEX` and `REPLAY OF VERIFIED REAL RUN`; no live execution is implied. If your browser blocks local files, run `npm run judge-demo:serve` and open the printed loopback URL; this uses Node's built-in static file server and installs no dependency.

The demo includes a verified stored PASS and a semantic UNPROVEN receipt caused by a required criterion with no attached evidence, not an infrastructure timeout, plus the current 16-run benchmark summary.

## Full Demo

Requirements: Node.js 22.12+, npm, and Git. From the repository root:

```bash
npm ci
npm run demo
```

This opens the local evidence UI; it does not start Codex. See the local URL printed in the terminal.

## Live Codex Demo

```bash
npm run demo:live
```

Requires an installed and authenticated Codex CLI. This starts a real Codex run and stores its artifacts; it is distinct from the static replay and full stored-data demo.

## Benchmark

Eight local fixtures are run under Raw Codex and W2 + Codex with the same normalized task, baseline, verifier, workspace-write sandbox, and timeout. All outcomes, including timeouts and errors, are retained. The sample is descriptive, not statistically conclusive; W2 is not claimed to be faster, more reliable, or safer. See [methodology](benchmarks/README.md) and [current report](docs/BENCHMARK-REPORT.md).

## Built with Codex and GPT-5.6

Codex CLI was used as the real coding agent in stored benchmark/demo runs and as development assistance in this repository. Codex/V42 sessions were used for task acceptance and audit lifecycle where evidence exists. Human engineering decisions set the Run Receipt abstraction, deterministic outcome rules, evidence requirements, benchmark fairness, safety boundaries, and release scope.

GPT-5.6 was used for an independent final review of the submission text, benchmark methodology, Run Receipt semantics, and public claims; this was development-time review only. It is not a runtime evidence mapper. See [GPT-5.6 contribution evidence](docs/GPT56-CONTRIBUTION.md) and the [review record](docs/GPT56-FINAL-REVIEW.md). Receipt validation and outcome calculation remain deterministic.

## Evidence Model

Evidence IDs must refer to stored records. A model completion message cannot create a PASS. Required criteria without valid attached evidence remain `UNPROVEN`; contradictory deterministic evidence can produce `FAIL`. Verifier success alone does not automatically prove every acceptance criterion.

## Security Model

W2 provides a local control and evidence layer, not an OS/container security boundary. W2 enforces its checks for W2-owned `ToolRuntime` calls. Codex enforces its supported `workspace-write` sandbox for Codex-native actions. W2 observes recognized events and resulting diffs; it does not intercept every native filesystem/shell operation or prove all file reads. See [Security Model](docs/SECURITY-MODEL.md).

## Supported Platforms

Verified platform: Windows 11. Other platforms have not been independently verified.

## Installation

Use Node.js 22.12+ and npm:

```bash
npm ci
npm test
npm run typecheck
npm run build
```

The full application and live Codex paths require a local Node.js environment. The instant judge demo does not.

## Reproducing the Evidence

```bash
npm ci
npm test
npm run typecheck
npm run build
npm run verify:phase02
npm run benchmark:validate
npm run benchmark:verify
npm run judge-demo:verify
npm run demo:smoke
```

To regenerate all 16 benchmark runs, authenticate Codex and run `npm run benchmark`. To recreate the no-build demo's static data from stored receipts and current results, run `npm run judge-demo:refresh` after the benchmark completes. Clean-copy proof is recorded by `node scripts/fresh-clone-check.mjs`.

## Limitations

- Exact Codex file-read access is not captured; the context section shows what W2 selected/provided and only labels observed access when supported by events.
- The benchmark is one run per fixture and condition; it is not statistically conclusive.
- W2 does not intercept all Codex-native calls and is not an OS/container boundary.
- GPT-5.6 is not called at runtime.
- `RunEngine.resume()` inspects persisted checkpoint state; it does not continue agent execution.
- The demo is local and stored-data based. No hosted service is provided.
- No Git remote is configured in this checkout, so hosted repository visibility is not verified; public release requires a publication/license decision.

## Repository Structure

- `src/` - Run Engine, Codex adapter, context, verification, evidence, receipts, and UI.
- `tests/` - unit, integration, durability, and security regressions.
- `benchmarks/fixtures/` - baseline-reset contracts and external verifiers.
- `benchmarks/runs/` - current stored Raw Codex and W2 run artifacts.
- `benchmarks/results/` - current generated benchmark results.
- `judge-demo/` - no-build local evidence viewer.
- `docs/` - architecture, security, methodology, and submission records.
