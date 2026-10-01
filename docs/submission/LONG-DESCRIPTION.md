# Project Description

## Problem

Coding agents increasingly inspect and change software on a developer's behalf. Their completion message does not show which requirements were checked, which files changed, or whether the available evidence supports the requested result. A green test command may still leave a task-specific requirement unproven.

## Insight

The agent's claim and the evidence about its run are different things. A useful review artifact should connect the task and its acceptance criteria to the context supplied, recognized run events, repository diff, verification results, and a deterministic outcome.

## Product

W2 is a local verification layer for coding agents. It stores a JSON and Markdown Run Receipt that lets a developer or reviewer inspect a run without treating the agent's final message as proof. W2 does not generate code, route agents, or replace CI.

```text
TASK → CONTEXT → MODEL / AGENT → TOOLS → DIFF
     → VERIFICATION → ACCEPTANCE EVIDENCE → RECEIPT
```

The receipt reports `PASS`, `FAIL`, `UNPROVEN`, `ABORTED`, or `ERROR`. Each required criterion needs evidence from its referenced deterministic verifier to pass. Missing or insufficient evidence remains `UNPROVEN`.

## Workflow and architecture

In manual mode, a task contract declares acceptance criteria and verifier IDs. The Run Engine validates the contract, builds a Context Manifest, starts the Codex adapter, records recognized events and tool calls in SQLite, captures the Git diff, and runs the declared verification commands. The Evidence Engine links stored verifier results to criteria. The Outcome Engine computes the result, which the Run Receipt presents for inspection.

In Windows interactive mode, the `w2` PowerShell launcher opens the regular Codex TUI and supplies per-invocation native hooks. When BrainW2 is enabled, `UserPromptSubmit` records a bounded, redacted activity excerpt for every user prompt and can route it to Daily and deterministic category notes. Interactive turns and manual `w2 run` tasks can also receive bounded sections from the curated cross-project preferences note and, when mapped, the project note and its optional `Decisions.md`. Separately, likely engineering prompts start W2 verification and record a Git baseline. `PreToolUse` and `PostToolUse` record safe structured metadata and correlate tool activity by `tool_use_id`. `Stop` combines commits with current staged, unstaged, and untracked Git changes, excludes unchanged pre-existing dirt, runs detected non-browser project checks, and writes the receipt through the same run pipeline. Committed changes remain in the receipt diff after the working tree is clean. `Interrupt` and `SessionEnd` preserve unfinished activity and close pending turn state. `PermissionRequest` is passive and leaves approval to Codex. The user reviews hook trust in Codex with `/hooks`; W2 does not bypass that step. The ordinary `codex` command remains plain Codex.

Interactive prompts with an explicit acceptance heading are represented as separate criteria. W2 maps a criterion to a discovered project check only when the criterion directly asserts that named command passes. A generic passing test suite does not prove semantic behavior. Manual task contracts support explicit criterion-to-verifier references for task-specific evidence.

## Verification philosophy and outcomes

Command exit codes, stored verifier results, Git-visible changes, validated evidence references, and computed receipt outcomes are deterministic records. Completion text and model confidence do not set the outcome. A verifier proves only the check it actually ran in that run.

- `PASS`: all required criteria have passing referenced evidence.
- `FAIL`: a required referenced verifier failed or verification failed.
- `UNPROVEN`: required evidence is missing or insufficient.
- `ABORTED`: execution was interrupted.
- `ERROR`: execution or verification infrastructure failed.

## Why it matters

Developers need to review increasingly autonomous software changes. W2 makes the difference between “the agent says it is done” and “the receipt records evidence for these requirements” visible in one artifact. The project makes no measured claim that it improves correctness or speed.

## Current evidence

The latest published stable release is v0.2.1. Windows 11 live Codex TUI integration is verified, and Ubuntu CI covers the core automated suite. The current `main` branch contains post-v0.2.1 BrainW2 reference-context, activity-capture, and launcher changes documented as unreleased in the changelog. The repository also contains a REAL_CODEX task-file PASS case with four required criteria linked to four passing verifiers. The stored benchmark has eight Raw Codex and eight W2 + Codex runs; the external verifier passed 8/8 in both conditions in this one-attempt-per-fixture sample. These are descriptive examples, not a statistical comparison.

## Limitations

Windows 11 live Codex TUI integration is verified. Ubuntu's core automated suite is covered by CI, but Linux live TUI hook trust and macOS remain unverified. Interactive verification receipts are per assistant turn, and only likely engineering prompts start W2 verification. BrainW2 activity capture, when enabled, records bounded excerpts separately from verification. W2 observes only supported Codex activity delivered through native hooks, Git-visible changes, and verifier results; it does not observe every OS operation, file read, internal model reasoning, or external side effect. Semantic requirements remain `UNPROVEN` unless suitable deterministic evidence is directly mapped. W2 is not an OS/container security boundary, a correctness guarantee, or a hosted multi-user service. Node's built-in SQLite API remains experimental in Node 22.

## Future potential

Future work could add explicit adapters for structured test-case results and additional coding-agent environments. Such integrations should retain direct criterion-to-evidence links, disclose observation limits, and keep unsupported claims `UNPROVEN`. This is a direction, not a current capability claim.
