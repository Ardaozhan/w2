# W2

## Know what your coding agent actually did.

A verification layer that turns coding-agent runs into evidence-backed receipts.

**No evidence, no PASS.**

## The problem

Coding agents can report that work is complete without showing which context W2 supplied, what changed, which checks ran, or whether the task's requirements were actually proven. A green test suite alone does not show which requirements it covered.

## The solution

W2 captures a task, its declared context, recognized agent events, repository changes, verification results, and acceptance evidence in a Run Receipt:

```text
TASK → CONTEXT → MODEL / AGENT → TOOLS → DIFF
     → VERIFICATION → ACCEPTANCE EVIDENCE → RECEIPT
```

W2 derives the outcome from deterministic evidence. An agent's completion message cannot select it.

## Outcomes

| Outcome | Meaning |
| --- | --- |
| `PASS` | Every required criterion has passing evidence from its referenced verifier. |
| `FAIL` | A required verifier failed, or verification failed. |
| `UNPROVEN` | Required evidence is missing or does not cover a criterion. |
| `ABORTED` | The run was interrupted. |
| `ERROR` | Execution or verification infrastructure failed. |

## Interactive Codex mode

Install or update the Windows PowerShell launcher once from the W2 checkout:

```powershell
& .\scripts\install-w2-launcher.ps1
```

Then start W2 from a Git project:

```powershell
cd C:\work\my-project
w2
```

W2 opens the normal Codex TUI. Native `UserPromptSubmit`, `Stop`, `Interrupt`, and `SessionEnd` hooks capture engineering turns, run detected project checks, and persist receipts under W2's local `.w2\interactive\` directory. No `task.json` is required. Review and trust the W2 hook in Codex with `/hooks` before use. Running `codex` directly remains normal Codex.

An explicitly headed acceptance list is recorded criterion by criterion. W2 maps a criterion to a discovered project check only when that criterion directly names the command and says it must pass. A generic passing test suite does not prove semantic requirements. W2 does not read the Codex transcript or watch terminal output, and each receipt covers one assistant turn.

## Example receipts

Sanitized excerpt from a real Windows interactive Codex receipt:

```text
W2 RECEIPT
UNPROVEN
Criteria: 2/3 proven
Test: PASS
Diff: 2 files
```

The receipt stays `UNPROVEN` because the task-specific requirement lacks direct deterministic evidence. W2 also stores a real Codex task-file `PASS` example: four required criteria linked to four passing verifiers and a two-file diff. See the [hero case](docs/HERO-CASE-STUDY.md), [stored receipts](evidence/hero-run/), and [public evidence manifest](evidence/PUBLIC-EVIDENCE-MANIFEST.md).

## Architecture

```text
Task + acceptance criteria
        ↓
Run Engine → Context Manifest → Codex Adapter / workspace-write sandbox
        ↓
Recognized events + Git diff + verification results
        ↓
SQLite Event Store → Evidence Engine → deterministic Outcome Engine
        ↓
JSON / Markdown Run Receipt → CLI, local demo, offline judge demo
```

W2's `ToolRuntime` checks calls made through W2-owned runtime APIs. Codex's sandbox governs Codex-native operations. W2 is not an OS/container security boundary or a universal tool broker. See [Architecture](docs/ARCHITECTURE.md) and [Security Model](docs/SECURITY-MODEL.md).

## W2 and CI

| CI | W2 |
| --- | --- |
| Runs configured checks. | Connects a task's declared criteria to verifier results from that run. |
| Reports whether those checks passed. | Stores the task, W2 context, recognized events, diff, evidence, and outcome together. |

W2 can run project checks and complement CI; it does not replace CI.

## Installation

Verified environment: Windows 11, Node.js 22.13 or newer, npm, and Git. The hosted repository URL is not configured in this checkout; use the repository URL provided by the project owner.

```powershell
git clone <W2 repository URL> w2
cd w2
npm ci
npm run build
```

Live agent runs also need the Codex CLI installed and authenticated through the user's normal Codex setup. Other operating systems have not been independently verified.

## Usage

Interactive Windows use:

```powershell
cd C:\work\my-project
w2
```

Manual task-file compatibility:

```powershell
w2 run task.json
w2 receipt <run-id>
```

Without the launcher, use `npm run w2 -- run task.json` from the W2 checkout. Manual task contracts map each acceptance criterion to verifier IDs; see the [Run Contract](docs/RUN-CONTRACT.md).

## Verification philosophy

Git state, command exit status, stored verifier results, evidence references, and receipt calculations are deterministic facts. Completion messages and semantic interpretations are not proof. If W2 cannot connect a required criterion to suitable deterministic evidence, it remains `UNPROVEN`.

In interactive mode, explicitly headed criteria are extracted as individual receipt entries. Only a criterion that directly asserts a discovered command passes can use that command's result. For task-specific behavior, use a manual task contract with a suitable verifier mapping; otherwise W2 keeps the criterion unproven.

## Current status

- Version: `0.1.0`.
- Native Codex hooks: `UserPromptSubmit`, `Stop`, `Interrupt`, and `SessionEnd`.
- Live Codex TUI flow and receipt persistence have been exercised on Windows; the latest stored interactive receipt is `UNPROVEN` with 2/3 criteria proven, passing project tests, and two changed files.
- Final-tree `npm test`: PASS (17 test files, 71 tests, plus the hook boundary); typecheck, build, standalone, fresh-copy, receipt, benchmark, hero, judge-demo, and privacy checks also passed. `npm audit --audit-level=high` reported zero vulnerabilities.
- The real TUI result predates the acceptance-list change; the final-tree native hook boundary passed, but a second model-driven TUI run was not recorded.
- The repository contains a real Codex task-file `PASS` receipt, a semantic `UNPROVEN` receipt, and an eight-fixture-per-condition descriptive benchmark.
- Exact verification results for this release are recorded in [W2 Final Report](docs/W2-FINAL-REPORT.md).
- No Git remote is configured and no matching `w2` repository was found under the authenticated GitHub account. Hosted push, release, and repository visibility are pending a confirmed target.

## Limitations

- Only Windows 11 with Node.js 22.13+ has been independently verified.
- Interactive criteria parsing requires an explicit acceptance heading and captures at most 50 items; overflow is explicitly left unproven. Semantic criteria remain `UNPROVEN` unless linked to suitable deterministic evidence.
- Interactive receipts are per assistant turn; the engineering-prompt filter is heuristic.
- The adapter does not capture every Codex-native operation or exact file reads.
- W2 is not a security boundary, hosted multi-user service, or correctness guarantee.
- The benchmark has one attempt per fixture and condition; it supports descriptive claims only.
- Node's built-in SQLite API remains experimental in Node 22.
- The judge demo replays stored evidence; it does not launch Codex. Repository visibility and actual competition submission remain human decisions.

## Development and validation

```powershell
npm ci
npm test
npm run typecheck
npm run build
npm run standalone:check
npm run fresh:check
npm run audit:public
```

See [the submission pack](docs/submission/) for judge quickstart, project summaries, FAQ, release notes, and the planned 60–90 second demo script. Existing UI captures are organized under [`evidence/screenshots/`](evidence/screenshots/); no new screenshots or video were produced for this preparation.

## License

W2 is available under the [MIT License](LICENSE). The npm package remains marked private and has not been published.

## Competition positioning

W2 is a focused verification layer for coding-agent runs. It aims to make the gap between an agent's claim and recorded evidence visible. It does not claim measured correctness improvements, faster coding, or universal platform support.
