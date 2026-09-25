# Competition Submission Form Pack

Ready-to-paste factual answers. Replace only the explicit placeholders after a target competition and hosted repository have been confirmed.

## Project name

W2

## One-line description

Evidence-backed verification and run receipts for coding agents.

## Short description

Coding agents can say they finished; W2 produces evidence-backed run receipts showing what changed, which checks ran, and whether the task's requirements were actually proven. Missing evidence stays `UNPROVEN`—no evidence, no PASS.

## Long description

Use [`LONG-DESCRIPTION.md`](LONG-DESCRIPTION.md).

## Problem

Coding agents can report completion without showing which requirements were verified. A diff shows changes, and a test command shows that it passed, but neither fact alone proves every task-specific requirement.

## Solution

W2 captures the task, W2-supplied context, supported native Codex tool activity, Git diff, verifier results, and criterion-level evidence in one Run Receipt. Its deterministic outcome is `PASS`, `FAIL`, `UNPROVEN`, `ABORTED`, or `ERROR`. Missing criterion evidence remains `UNPROVEN`.

## Technical implementation

W2 validates a task contract, builds a Context Manifest, invokes the Codex adapter, persists recognized events and verifier results in SQLite, captures Git-visible changes, maps deterministic evidence to referenced criteria, and computes a Run Receipt outcome. Windows interactive mode uses native Codex `UserPromptSubmit`, `PreToolUse`, `PostToolUse`, passive `PermissionRequest`, `Stop`, `Interrupt`, and `SessionEnd` hooks and reuses the same verification and receipt pipeline. Optional brainw2 support reads selected project Markdown context and appends a short receipt summary after persistence.

## How Codex / GPT-5.6 is used

Codex CLI is the real coding agent in stored benchmark and demo runs. The interactive Windows launcher starts the regular Codex TUI with per-invocation native hooks. GPT-5.6 provided a documented read-only development review of benchmark methodology, receipt semantics, and public claims; it is not called at runtime and does not choose evidence or outcomes.

## What is technically novel

W2 connects each declared acceptance criterion to specific deterministic verifier results and computes the outcome from those records. Unsupported criteria stay `UNPROVEN` even when an agent says the task is complete or an unrelated test suite passes. The claim is about W2's implementation and evidence boundary, not market-first novelty.

## Potential impact

Developers need evidence that increasingly autonomous coding agents completed the requested work. W2 separates an agent's completion claim from the deterministic evidence recorded for the run. No market-size or measured correctness claim is made.

## Design / UX

The Run Receipt is the primary review surface. It groups the task, W2-supplied context, recognized activity, Git diff, verifier output, criterion evidence, and computed outcome. The offline judge demo replays stored REAL_CODEX PASS and UNPROVEN examples.

## What was built during the event

`[Add the event-specific work and dates after the target competition is identified. The repository does not establish which event or work period applies.]`

## Current limitations

Windows 11 with Node.js 22.13+ is the only independently verified environment. Interactive receipts are per assistant turn; prompt capture is a conservative deterministic filter; W2 observes only supported native hook activity and does not claim all OS operations, file reads, internal reasoning, or external side effects; semantic criteria need suitable deterministic evidence; W2 is not a security boundary or correctness guarantee; and the benchmark is descriptive with one attempt per fixture and condition.

## Future work

Possible directions include structured test-case evidence and additional coding-agent adapters. Any extension should preserve deterministic criterion links and mark unsupported evidence `UNPROVEN`. These are proposals, not current capabilities.

## Repository URL

https://github.com/Ardaozhan/w2

## Demo URL

https://github.com/Ardaozhan/w2/releases/tag/v0.1.0 (stable release; no demo video is published). The local static judge demo is at `judge-demo/index.html`.

## Team / creator

Arda Özhan (existing Git author name; confirm the team field required by the selected competition).

## Contact

`[Add a competition-appropriate public contact address if required.]`
