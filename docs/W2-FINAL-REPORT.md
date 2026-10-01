# W2 Current Status (2026-10-01)

This report describes the current `main` branch. Historical release notes remain scoped to the tagged version they document.

## Release and branch

The public repository is [Ardaozhan/w2](https://github.com/Ardaozhan/w2). The latest published stable release is [v0.2.1](https://github.com/Ardaozhan/w2/releases/tag/v0.2.1). The current `main` branch includes later BrainW2 reference-context, activity-capture, and launcher changes listed under `Unreleased` in `CHANGELOG.md`; no new package version or release tag has been created. `package.json` therefore still reports `0.2.1`.

W2 remains a standalone local verification tool. BrainW2 is an optional local Markdown integration, not a runtime dependency.

## Current behavior

Manual task contracts and interactive Codex turns share the same deterministic Run Engine, verifier, evidence mapper, and Run Receipt pipeline. Outcomes are `PASS`, `FAIL`, `UNPROVEN`, `ABORTED`, or `ERROR`; model confidence, completion text, BrainW2 notes, and generic passing checks cannot select `PASS` without criterion-linked evidence.

When BrainW2 is enabled, interactive turns and manual `w2 run` tasks can receive selected sections from the curated `02 Areas/Development/AI Work Preferences.md` note and, when mapped, the current project's note and optional `Decisions.md`. Selection is bounded to 10 KiB total and labeled as untrusted reference context; neither the content nor model interpretation of it can prove acceptance criteria. The receipt records only logical source metadata, content hash, byte count, and mapping ID.

Separately, interactive `UserPromptSubmit` hooks store a normalized prompt excerpt of up to 160 characters after common credential-pattern redaction. Fixed rules can route the excerpt to Daily, Inbox, mapped Project, existing Area, Research, Dev Library, Decisions, Attachment Index, or Archive request notes. Manual `w2 run` captures its bounded task goal through the same activity path. These activity captures are records, not injected context or acceptance evidence. Full prompts, assistant responses, tool traces, and attachment bytes are not copied to these notes. Redaction covers common patterns only and is not a secrets-management guarantee. Vault read/write errors are non-fatal to verification.

Interactive turns with likely engineering requests still use the normal W2 verification pipeline. Receipt summaries go to the mapped project's `Dev Log.md`; prompt activity goes to `Activity Log.md` and category notes. `w2 doctor` reports the current project targets and category readiness. The Windows launcher initializes Git in the current folder if no containing repository exists; it does not create a commit.

## Verification performed

The current working tree was checked on Windows with Node.js `v22.13.1` and npm `10.9.2`:

- `npm test`: PASS — 19 test files, 110 tests; the generated command boundary passed for all seven Codex hook events.
- `npm run typecheck` and `npm run build`: PASS.
- `npm run standalone:check`: PASS — 28 package scripts, 251 active text files, no legacy matches, absolute local imports, or tracked runtime databases.
- `npm run audit:public`: PASS — 127 public evidence files and 274 tracked repository files scanned; no secret, privacy, or runtime-artifact findings.
- `npm run fresh:check`: PASS — a clean temporary project copy installed dependencies and passed tests, typecheck, build, standalone, fixture, benchmark, hero, judge-demo, public-artifact, and non-browser smoke checks. It covered 275 candidate paths.
- `w2 doctor`: BrainW2 is enabled and writable, the W2 project mapping and all 10 category folders are present, and the current build is available. Hook trust remains subject to Codex review with `/hooks`.
- Markdown link check: PASS — all 56 relative links resolved across 77 tracked Markdown files. `git diff --check` also passed.

The stored benchmark validator passed 16 REAL_CODEX run records; this is repository fixture validation, not a new benchmark execution or comparative performance claim. The static judge demo validation and non-browser smoke passed. No live Codex TUI session or visual browser inspection was performed for this update.

## Support and limitations

The v0.2.1 release notes record Windows 11 live Codex TUI integration and Ubuntu core CI verification. Linux live TUI hook trust and macOS remain unverified. The PowerShell launcher and Windows `command_windows` behavior are Windows-specific. W2 records supported hook events and Git-visible changes; it does not observe every OS operation, file read, internal model action, or external side effect. W2 is not an OS/container security boundary or a correctness guarantee. Node's built-in SQLite API remains experimental in Node 22.

Release-specific facts and results are preserved in the [versioned release notes](submission/RELEASE-NOTES-v0.2.1.md). This report is the current status source for the main branch.
