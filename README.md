# W2

W2 creates an inspectable Run Receipt for a coding-agent task: the task contract, context W2 selected, observable actions, repository diff, verifier output, and evidence-linked outcome are stored together.

## Why W2

An agent's completion message does not establish that a task passed. W2 stores the run artifacts and runs declared verification commands so a reviewer can inspect the result and see when required evidence is missing.

## Run Receipt

The receipt is a JSON/Markdown record containing the task, W2-selected context, observed Codex events, changed files, verification results, acceptance evidence, and outcome (`PASS`, `FAIL`, `UNPROVEN`, `ERROR`, or `ABORTED`). W2 does not capture every file Codex reads; exact repository access is not claimed.

## What W2 Proves

For a recorded run, W2 can show the task it received, context manifest it passed, structured events it observed, diff it captured, verification commands it ran, and evidence references used by the receipt. A `PASS` is limited to the configured required criteria and attached evidence. This is local run evidence, not a general guarantee about agent behavior or repository security.

## Architecture

```text
Task -> W2 context manifest -> Codex CLI in workspace-write sandbox
                              -> structured events observed by W2
Repository <----------------- Codex native tools
W2 Run Engine -> diff + declared verification -> evidence -> Run Receipt
```

W2's own `ToolRuntime` controls calls made through W2 APIs. Codex native filesystem and shell actions execute under the Codex sandbox and are observed from its event stream; W2 is not a universal pre-execution tool broker or an OS/container boundary. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [docs/SECURITY-MODEL.md](docs/SECURITY-MODEL.md).

## Quick Start

Requirements: Node.js 22.5 or newer, npm, Git, and Codex CLI authenticated for live agent runs. The read-only stored-data demo does not require Codex credentials.

```bash
npm ci
npm run demo
```

Open the local URL printed in the terminal. The demo displays stored run artifacts and does not start an agent. For its local UI smoke check run `npm run demo:smoke`.

To start a real W2 run, provide a valid task JSON to `npm run w2 -- run <task.json>`. For an isolated real benchmark run use `npm run benchmark`; it invokes Codex for each condition and fixture and may take several minutes.

## Demo

`npm run demo` shows the current captured W2 Run Receipt plus the latest validated benchmark results. Every run card is labeled with its execution mode. A stored run is a replay of that recorded execution, not a live run.

## Judge Path

1. Run `npm ci`.
2. Run `npm run demo` and inspect Task, Context, Trace, Diff, Verification, Acceptance Evidence, and Benchmark.
3. Reproduce local checks with `npm test`, `npm run typecheck`, `npm run build`, and `npm run demo:smoke`.
4. To regenerate the benchmark, authenticate Codex first and run `npm run benchmark`.

The demo requires no hosted service. `npm run demo` replays stored real run receipts without invoking an agent. It exposes the verified PASS and task-evidence UNPROVEN cases. To execute Codex live and persist a fresh semantic-UNPROVEN demo receipt, run `npm run demo:live` (requires the Codex CLI to be installed and authenticated).

## Benchmark

The benchmark has eight local fixtures, each with a baseline, normalized task contract, external verifier, and reset command. Raw Codex and W2 + Codex receive the same task semantics and use the same timeout and `workspace-write` sandbox. Every run is retained, including errors and timeouts. Results are descriptive; a speed or reliability advantage is not claimed. See [docs/BENCHMARK-REPORT.md](docs/BENCHMARK-REPORT.md) and [benchmarks/README.md](benchmarks/README.md).

## Built with Codex and GPT-5.6

### Codex

Codex CLI and Codex/V42 sessions were used during implementation and local verification. Human decisions set W2's scope, evidence model, acceptance rules, security boundary, and benchmark methodology. See [docs/application/AI-CONTRIBUTION.md](docs/application/AI-CONTRIBUTION.md).

### GPT-5.6

No live GPT-5.6 Evidence Mapper call is implemented or represented in stored run evidence. Repository provenance does not establish whether or where GPT-5.6 contributed during development, so no specific implementation contribution is attributed to it. Runtime receipt outcomes and evidence validation are deterministic. A real Codex session/feedback identifier has not been collected: **Codex feedback/session ID: [ADD REAL SESSION ID BEFORE SUBMISSION]**. Human submission action: replace this placeholder with the actual identifier if the competition requires it.

## Security Model

W2 provides a local control and evidence layer. Its own `ToolRuntime` enforces its declared capabilities, canonical path checks, approval callbacks, output and runtime budgets for W2-owned calls. Codex native tools run under Codex's supported `workspace-write` sandbox. W2 observes structured Codex events and resulting changes, but does not intercept and authorize every native Codex call. This is not an OS/container security boundary and does not protect against a compromised host or all Codex-side behavior. See [docs/SECURITY-MODEL.md](docs/SECURITY-MODEL.md).

## Supported Platforms

Verified: Windows 11. Other platforms have not been independently verified.

## Limitations

- Exact Codex file-read access is not captured; the context view shows files selected by W2 for the prompt.
- The benchmark has one run per fixture and condition and is not statistically conclusive.
- GPT-5.6 is not called at runtime.
- `RunEngine.resume()` is checkpoint recovery inspection only; it does not continue agent execution.
- The demo is local and uses stored evidence; no hosted deployment is provided.

## Repository Structure

- `src/core/` — run engine, Codex adapter, ToolRuntime, evidence and receipt.
- `tests/` — unit, integration, durability and security checks.
- `benchmarks/fixtures/` — benchmark baselines, contracts and verifiers.
- `benchmarks/runs/` — retained raw Codex and W2 run artifacts.
- `benchmarks/results/` — generated benchmark data.
- `docs/` — architecture, security, methodology and submission evidence.

## Reproducing the Evidence

```bash
npm ci
npm test
npm run typecheck
npm run build
npm run verify:phase02
npm run benchmark:validate
npm run benchmark:verify
npm run demo:smoke
```

For clean-copy verification run `node scripts/fresh-clone-check.mjs`. A full current benchmark additionally requires an authenticated Codex CLI and runs with the documented timeout.
