# W2

**A verification layer for coding agents.**

Coding agents can claim they finished. W2 shows the evidence.

**No evidence, no PASS.**

## Why W2

A passing test suite does not show which task requirements it covered. W2 connects a task's acceptance criteria to declared verifiers, stores the results and repository changes, and derives a reviewable outcome. The agent's completion message cannot select that outcome.

## Run Receipt

The Run Receipt is W2's main artifact. It records the task contract, context W2 considered/selected/provided, recognized agent events, repository diff, verifier results, deterministic evidence, criterion statuses, and computed outcome. Receipts are available as JSON and Markdown.

The adapter does not expose a complete file-read trace. A receipt reports exact accessed files as unknown unless separate telemetry establishes them.

## No Evidence, No PASS

Each criterion names verifier IDs in the task contract. W2 validates those references, runs the declared verification commands after agent execution, creates evidence from stored results, attaches it to the referenced criteria, and calculates the final outcome. A task with no verifier mapping cannot pass through an unrelated green test suite.

## PASS / FAIL / UNPROVEN

- **PASS:** every required criterion has deterministic passing evidence from all referenced verifiers.
- **FAIL:** a required referenced verifier failed, or the completed run failed verification.
- **UNPROVEN:** a required criterion has no verifier mapping or lacks enough evidence.
- **ABORTED:** the run was stopped.
- **ERROR:** execution or verification infrastructure failed, including a timeout.

Agent `DONE` is not evidence. A test passing does not make every criterion pass.

## How It Works

```text
Task and acceptance criteria
    -> W2 Run Engine
    -> Context Manifest
    -> Codex Adapter
    -> Codex workspace-write sandbox
    -> Repository changes
    -> Events + diff + verification
    -> Evidence Engine
    -> Deterministic criterion and outcome calculation
    -> Run Receipt
    -> CLI / local UI / static judge demo
```

## How W2 Differs from CI

CI answers whether configured checks passed. W2 connects verifier results to declared task criteria and puts that evidence alongside the run's recognized events and diff. W2 can use test or CI output as evidence; it does not replace CI.

## Architecture

W2 is a local Node.js tool. Codex native operations use the installed Codex CLI sandbox. W2's `ToolRuntime` applies capability and path checks only to calls made through W2-owned runtime APIs. W2 records recognized events, repository changes, and verification results; it is not an OS/container security boundary or a universal pre-execution tool broker.

See [Architecture](docs/ARCHITECTURE.md), [Security Model](docs/SECURITY-MODEL.md), and [Context Model](docs/CONTEXT-MANIFEST.md).

## Automatic Criterion Evidence Mapping

Use stable criterion IDs and reference verifier IDs declared in the same task file. Unknown or duplicate references are rejected. A normal `w2 run` command creates verifier evidence, criterion results, and a Run Receipt without benchmark-only mapping. Integration tests cover PASS, FAIL, UNPROVEN, multiple verifiers, invalid references, completion claims, and infrastructure failures.

Example task contract:

```json
{
  "task_id": "fix-search",
  "title": "Fix search behavior",
  "goal": "Return matching results for the documented query cases.",
  "constraints": [],
  "allowed_paths": ["src/search.ts"],
  "acceptance_criteria": [
    {
      "id": "AC-01",
      "statement": "All declared search behavior tests pass.",
      "required": true,
      "verification_refs": ["V1"]
    }
  ],
  "verification_commands": [
    {
      "id": "V1",
      "name": "search tests",
      "command": "npm test -- --run search",
      "category": "test"
    }
  ],
  "workspace": "."
}
```

`allowed_paths` is part of the task contract and prompt. The Codex workspace sandbox controls its writable workspace; W2 does not enforce per-file authorization for Codex-native operations.

## Quick Start

Requirements: Git, Node.js 22.13 or newer, and npm. A Codex CLI installation is required for live agent runs; authenticate it using your normal Codex setup.

```bash
npm ci
npm test
npm run typecheck
npm run build
```

Save the example contract as `task.json`, then run:

```bash
npm run w2 -- run task.json
```

W2 stores its local SQLite run state under `.w2/` and writes JSON/Markdown receipts alongside the selected database. The default database is `.w2/runs.sqlite`; pass `--db <path>` after the task file to choose another location.

## Interactive Codex Mode

From the W2 repository, install or update the PowerShell launcher once with `& .\scripts\install-w2-launcher.ps1`. Then use W2 from any project directory:

```powershell
cd C:\work\my-project
w2
```

Codex remains the normal interactive TUI. W2 uses Codex's native [`UserPromptSubmit`, `Stop`, `Interrupt`, and `SessionEnd` hooks](https://learn.chatgpt.com/docs/hooks) to capture and verify engineering turns; no `task.json` is needed for this mode. Codex requires you to review and trust the W2 hook definition with `/hooks` before it runs. W2 does not bypass that review. The hook preserves the working directory and uses a [one-run CLI configuration override](https://learn.chatgpt.com/docs/developer-settings); it does not edit Codex settings or project files.

W2 compares Git-visible project files at prompt submission and turn stop, then passes the captured task through the existing RunEngine and receipt pipeline. It runs available `test`, `typecheck`, `lint`, and `build` scripts from the project's `package.json`, excluding scripts that appear to invoke browser or visual automation. These checks prove only that the detected commands passed; without direct verifier mappings for the prompt's semantic requirements, the task outcome remains `UNPROVEN`. A changed file or Codex completion message alone cannot prove requested behavior. The hook runs at assistant-turn boundaries, so a multi-turn request can produce one receipt per engineering turn. W2 does not run browser QA.

The canonical interactive runtime root is `<W2 installation>\.w2\interactive\`, independent of the target project cwd. Pending turns, the shared SQLite run store, and JSON/Markdown receipts are stored in a project-hash subdirectory there; hook diagnostics append safe event metadata to `.w2\interactive\hook-diagnostics.jsonl`. The target project receives no W2 runtime files. The install script changes only its marked block in the PowerShell profile and supports `-Uninstall`. Explicit task-file use remains available with `w2 run task.json` and `w2 receipt <run-id>`.

## Instant Judge Demo

Open [`judge-demo/index.html`](judge-demo/index.html) directly. It is a standalone, no-build replay of stored evidence and needs no API key or network service. The primary cases are the stored REAL_CODEX hero PASS and the stored REAL_CODEX semantic UNPROVEN run. Both are labeled as replays, not live executions.

To serve it locally, run `npm run judge-demo:serve`. Validate the stored demo with `npm run judge-demo:verify`.

## Live Codex Run

`npm run demo:live` runs the semantic UNPROVEN example with the authenticated Codex CLI and writes an additional sanitized evidence package under `evidence/demo/unproven/<run-id>/`. It needs Codex authentication. `npm run hero:run` starts a fresh real run of the login rate-limit fixture. Existing verified evidence remains available in the repository without rerunning either command.

`npm run demo` starts the local W2 walkthrough. `npm run demo:smoke` performs its non-browser smoke check.

## Hero Case

The real login rate-limit fixture covers five failed attempts per client in a rolling minute, HTTP 429 on the sixth request, unchanged authentication behavior, and required tests. The stored REAL_CODEX receipt records four criteria, four passing verifiers, and a two-file diff. See [Hero Case Study](docs/HERO-CASE-STUDY.md) and [`evidence/hero-run/`](evidence/hero-run/).

## Semantic UNPROVEN Example

In the stored REAL_CODEX example, the agent fixes multiplication and a verifier passes. A separate required documentation criterion has no verifier reference, so the outcome stays `UNPROVEN`. This is a completed run with missing criterion evidence, not a timeout or infrastructure error. See [`evidence/demo/cases.json`](evidence/demo/cases.json).

## Benchmark

The stored benchmark contains **8 Raw Codex runs and 8 W2 + Codex runs**. All 16 are marked `REAL_CODEX`; the external verifier passed 8/8 in each condition. W2's mean criterion evidence coverage is 100%; Raw Codex has no receipt mapping, so that metric is not applicable there.

These results describe one attempt for each of eight fixtures per condition. They do not establish that W2 writes better code, is faster, or reduces failures. See [Benchmark Report](docs/BENCHMARK-REPORT.md) for outcomes, methodology, and limitations.

## Benchmark Methodology

Both conditions use the same normalized tasks, model/configuration, source baselines, 90-second timeout, and independent external verifier. Every run starts from a reset fixture in an isolated Codex home and workspace. The configured Codex sandbox is `workspace-write`; only the isolated fixture workspace is writable. The benchmark disables inherited project rules, user memories, and skill-instruction injection. The adapter does not provide a complete operating-system file-read trace.

## Security Model

Codex's sandbox controls native Codex execution. W2 capability and path checks apply to W2-owned `ToolRuntime` calls. W2 records recognized execution evidence and results; it does not broker every native call and is not an OS/container security boundary. See [Security Model](docs/SECURITY-MODEL.md).

## Context Model

The context record distinguishes files considered, selected, and provided. Accessed files are recorded only when observed through supported telemetry; otherwise exact agent reads are unknown. Context selection is not a filesystem restriction. See [Context Model](docs/CONTEXT-MANIFEST.md).

## Built with Codex and GPT-5.6

Codex CLI was used for real stored coding-agent runs, implementation support, and repository validation. GPT-5.6 performed a documented development-time review of benchmark methodology, Run Receipt semantics, and public claims; it does not map runtime evidence or select outcomes. See [Codex session evidence](docs/CODEX-SESSION-EVIDENCE.md), [GPT-5.6 contribution](docs/GPT56-CONTRIBUTION.md), and [review record](docs/GPT56-FINAL-REVIEW.md).

## Supported Platforms

Windows 11 with Node.js 22.13+ is verified. Other operating systems have not been independently verified. `package.json` carries the same minimum Node.js version.

## Privacy

W2 runs locally and stores run state in the selected SQLite database. The public evidence manifest lists the artifacts intended for review. Current public evidence and the tracked project are scanned for local paths and common credential patterns. No hosted service is provided.

## Limitations

- A verifier supports only its declared check in that recorded run; it is not a general correctness guarantee.
- Exact Codex file-read access is not captured by this adapter, and W2 does not intercept every Codex-native operation.
- The benchmark has one attempt per fixture and condition; it is descriptive, not statistically conclusive.
- W2 uses Node's built-in [`node:sqlite` API](https://nodejs.org/api/sqlite.html), which remains experimental in Node 22 and may change; Node can emit an ExperimentalWarning for SQLite operations.
- GPT-5.6 is not called at runtime.
- `RunEngine.resume()` inspects persisted checkpoints; it does not continue agent execution.
- The local walkthrough and judge demo do not provide a hosted multi-user service.
- Public repository visibility, license selection, video recording, and competition submission remain human decisions.

## Repository Structure

- `src/core/` — task contracts, run engine, runtime, evidence, and outcome calculation.
- `tests/` — core, integration, security, durability, benchmark, and UI smoke coverage.
- `benchmarks/` — fixtures, isolated Codex harness, current results, and validators.
- `evidence/` — stored REAL_CODEX hero and semantic UNPROVEN artifacts, screenshots, and public manifest.
- `judge-demo/` — static offline-capable judge interface.
- `docs/` — architecture, security, methodology, submission notes, and current final report.

## Reproducing the Evidence

```bash
npm ci
npm test
npm run typecheck
npm run build
npm run standalone:check
npm run fixtures:check
npm run benchmark:validate
npm run benchmark:verify
npm run benchmark:hermeticity
npm run hero:validate
npm run judge-demo:verify
npm run audit:public
npm run demo:smoke
npm run fresh:check
```

`npm run benchmark` and `npm run hero:run` start new authenticated Codex runs and replace their generated result artifacts. Run them only when intentionally collecting a new sample; the stored current results can be verified with the commands above.

## Public Evidence Manifest

See [`evidence/PUBLIC-EVIDENCE-MANIFEST.md`](evidence/PUBLIC-EVIDENCE-MANIFEST.md) for the exact review set. The current report is [W2 Final Report](docs/W2-FINAL-REPORT.md); it supersedes older checkpoint material in Git history.
