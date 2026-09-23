# W2

**Verification layer for coding agents.**

Coding agents can claim they finished. W2 turns each run into a Run Receipt.

**No evidence, no PASS.**

## The Problem

A green test suite answers whether configured checks passed. It does not automatically show which task requirements those checks support, what context W2 supplied, what changed, or where evidence is missing. W2 keeps those facts in one inspectable record.

## Run Receipt

A Run Receipt records the task contract, W2-selected and provided context, recognized agent events, repository diff, verifier results, deterministic evidence, per-criterion status, and a computed outcome. It is available as JSON and Markdown. Codex's exact file-read access is reported as unknown unless actual telemetry establishes it.

## No Evidence, No PASS

Each acceptance criterion names zero or more verifier IDs. W2 checks the task contract, runs its declared verification commands, creates evidence from stored results, attaches that evidence to the referenced criteria, and derives each criterion and final outcome. The model cannot set the outcome.

## PASS / FAIL / UNPROVEN

- **PASS** means every required criterion has successful deterministic evidence from all its referenced verifiers.
- **FAIL** means a required referenced verifier failed or the completed run failed verification.
- **UNPROVEN** means a required criterion has no mapping or lacks sufficient evidence.
- **ERROR** means execution or verification infrastructure failed. **ABORTED** means the run was stopped.

An agent saying `DONE` does not change the outcome. A test suite passing does not prove criteria that it does not verify.

## How W2 Differs from CI

**CI:** Did predefined checks pass?

**W2:** Which task requirements are supported by the evidence recorded during this run?

W2 combines the task, acceptance criteria, agent execution, diff, verification, evidence, and outcome in a receipt. It can use CI or test output as evidence; it does not replace CI.

## Architecture

```text
Task contract -> Context manifest -> Codex CLI (workspace-write) -> Diff capture
       |                                               |                 |
       +-- criterion/verifier IDs <--- verification results              |
                                         |                               |
                              deterministic evidence <-------------------+
                                         |
                              acceptance mapping -> Run Receipt
```

W2's `ToolRuntime` enforces capabilities and path checks for W2-owned calls. Codex native tools use Codex's supported workspace-write sandbox. W2 captures recognized events and resulting repository diffs; it is not an operating-system boundary or a universal tool-call broker. See [Architecture](docs/ARCHITECTURE.md), [Security Model](docs/SECURITY-MODEL.md), and [Context Model](docs/CONTEXT-MANIFEST.md).

## Automatic Criterion Evidence Mapping

Task contracts use stable criterion IDs and explicit verifier references. The schema rejects duplicate IDs, malformed criteria, empty references, and references to missing verifiers. A normal RunEngine/CLI run creates evidence and a Run Receipt without benchmark-only mappings. Integration tests cover automatic PASS, FAIL, UNPROVEN, multiple verifiers, forged receipts, and persisted CLI output.

## Instant Judge Demo

Open [`judge-demo/index.html`](judge-demo/index.html) directly. It is a static, no-build replay of stored run data; it needs no backend or API key. The current demo shows the stored REAL_CODEX hero receipt and a separate semantic UNPROVEN receipt, with every case labeled `VERIFIED STORED RUN` and replay labeled `REPLAY OF VERIFIED REAL RUN`.

## Real Hero Run

The TypeScript/Node login fixture exercises per-client failed-login limits, the sixth HTTP request returning 429, the existing authentication regression, and verifier-test presence. The real Codex task, context, events, diff, verification, acceptance evidence, and receipt are stored under [`evidence/hero-run/`](evidence/hero-run/). Its outcome is the value in that stored receipt; no result is chosen in advance.

## Semantic UNPROVEN Example

The second stored REAL_CODEX example verifies a multiplication fix but leaves its separate documentation criterion without a verifier. W2 reports that criterion as `UNPROVEN`; the case is not a timeout or infrastructure failure. See [`evidence/demo/cases.json`](evidence/demo/cases.json) and the referenced receipt.

## Benchmark

The canonical benchmark contains eight Raw Codex runs and eight W2 + Codex runs. It uses the same normalized task, criterion-to-verifier contract, model/config, baseline, timeout, and external verifier in both conditions. Every canonical run, including task failures and infrastructure failures, remains in the result set.

See [Benchmark Report](docs/BENCHMARK-REPORT.md) for the measured outcomes, evidence coverage, runtime, scope violations, verification coverage, and event-count limits.

## Methodology

Raw and W2 runs use a fresh isolated `CODEX_HOME` and profile per condition, an explicit model/config, disabled memory and skill-instruction injection, ignored inherited project rules, and Codex's `workspace-write` sandbox with its supported Windows `unelevated` implementation. Only one isolated fixture path is writable and it resets to baseline before each paired run. A `codex debug prompt-input` preflight checks the actual model-visible prompt for user-profile and host-repository context. This adapter does not expose a complete operating-system file-read trace; that limit is explicit in the benchmark report.

One run per fixture and condition is descriptive. The benchmark does not establish a correctness advantage unless the measured results support one.

## Built with Codex and GPT-5.6

Codex CLI was used as the real agent for stored runs and as development assistance. The recorded GPT-5.6 contribution is an independent development-time review; GPT-5.6 does not map evidence or select runtime outcomes. See [GPT-5.6 contribution evidence](docs/GPT56-CONTRIBUTION.md) and [review record](docs/GPT56-FINAL-REVIEW.md).

Human engineering decisions set the receipt contract, evidence rules, deterministic outcomes, benchmark controls, and release scope.

## Security Model

W2 is a local evidence layer, not an OS/container security boundary, network firewall, or secrets vault. W2-owned runtime calls use W2 capability/path checks. Codex native execution uses the installed Codex CLI's supported sandbox. W2 does not intercept every native filesystem or shell action. See [Security Model](docs/SECURITY-MODEL.md).

## Context Model

The receipt distinguishes files W2 considered, selected, and provided from files whose access was actually observed. Context selection is not an access restriction. Exact Codex reads remain unknown unless supported by telemetry.

## Supported Platforms

Windows 11 is verified. Other platforms have not been independently verified.

## Installation

Requirements: Node.js 22.12+, npm, and Git.

```bash
npm ci
npm test
npm run typecheck
npm run build
```

## Reproducing the Evidence

```bash
npm ci
npm test
npm run typecheck
npm run build
npm run verify:phase02
npm run benchmark:validate
npm run benchmark:verify
npm run benchmark:hermeticity
npm run hero:validate
npm run audit:public
npm run judge-demo:verify
npm run demo:smoke
npm run phase06:audit
```

To run the product path and persist a receipt, use `npm run w2 -- run task.json`. The command stores JSON and Markdown receipts next to the selected database. `npm run benchmark` regenerates the paired benchmark and requires an authenticated Codex CLI. `npm run hero:run` creates a new REAL_CODEX hero run. The no-build demo is local and stored-data based.

## Privacy / Public Evidence

The public evidence manifest names the artifacts intended for judge review. Local machine paths are replaced with placeholders, and the pre-hermetic benchmark archive is gitignored and excluded. See [`evidence/PUBLIC-EVIDENCE-MANIFEST.md`](evidence/PUBLIC-EVIDENCE-MANIFEST.md) and [`docs/PUBLIC-ARTIFACT-AUDIT.md`](docs/PUBLIC-ARTIFACT-AUDIT.md).

## Limitations

- Exact Codex file-read access is not captured by this adapter.
- W2 does not intercept every Codex-native call and is not an OS/container boundary.
- Codex runs can fail, time out, or leave criteria unproven; those outcomes remain visible.
- The benchmark has one attempt per fixture and condition and is not statistically conclusive.
- GPT-5.6 is not called at runtime.
- `RunEngine.resume()` inspects checkpoint state; it does not continue agent execution.
- The demo is local and stored-data based. No hosted service is provided.
- Repository visibility is unchanged. A public release requires a license choice and public-evidence review.
