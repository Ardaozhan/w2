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

In Windows interactive mode, the `w2` PowerShell launcher opens the regular Codex TUI and supplies per-invocation native hooks. `UserPromptSubmit` captures a likely engineering prompt and Git baseline and can supply bounded project reference context from an optional brainw2 Markdown vault. `PreToolUse` and `PostToolUse` record safe structured metadata and correlate tool activity by `tool_use_id`. `Stop` combines commits with current staged, unstaged, and untracked Git changes, excludes unchanged pre-existing dirt, runs detected non-browser project checks, and writes the receipt through the same run pipeline. Committed changes remain in the receipt diff after the working tree is clean. `Interrupt` and `SessionEnd` preserve unfinished activity and close pending turn state. `PermissionRequest` is passive and leaves approval to Codex. The user reviews hook trust in Codex with `/hooks`; W2 does not bypass that step. The ordinary `codex` command remains plain Codex.

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

The repository contains a real Windows Codex TUI receipt from the v0.1.0 hook set with `UNPROVEN`, two of three criteria proven, a passing project test check, and a two-file diff. The v0.2 hook definitions are undergoing automated command-boundary verification; their live trusted TUI run remains pending after relaunch. It also contains a REAL_CODEX task-file PASS case with four required criteria linked to four passing verifiers. The stored benchmark has eight Raw Codex and eight W2 + Codex runs; the external verifier passed 8/8 in both conditions in this one-attempt-per-fixture sample. These are descriptive examples, not a statistical comparison.

## Limitations

Only Windows 11 with Node.js 22.13+ has been independently verified. Interactive receipts are per assistant turn and prompt capture is a conservative deterministic filter. W2 observes only supported Codex activity delivered through native hooks, Git-visible changes, and verifier results; it does not observe every OS operation, file read, internal model reasoning, or external side effect. Semantic requirements remain `UNPROVEN` unless suitable deterministic evidence is directly mapped. W2 is not an OS/container security boundary, a correctness guarantee, or a hosted multi-user service. Node's built-in SQLite API remains experimental in Node 22.

## Future potential

Future work could add explicit adapters for structured test-case results and additional coding-agent environments. Such integrations should retain direct criterion-to-evidence links, disclose observation limits, and keep unsupported claims `UNPROVEN`. This is a direction, not a current capability claim.
