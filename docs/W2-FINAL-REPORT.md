# W2 v0.2 Completion Status (2026-09-25)

## Release status

W2 is published at [github.com/Ardaozhan/w2](https://github.com/Ardaozhan/w2). `v0.1.0` remains the immutable stable release. This forward-only engineering pass prepares the `0.2.0-rc.1` development package; it does not create a `v0.2.0` tag or GitHub release. A live Codex TUI trust and end-to-end run with the new hook definitions is still required before the final release.

The pre-change `main` commit was `7d5333d61db1b9261c64eb3e7da60aac36b88b4e`.

## Current architecture

W2 preserves its deterministic turn receipt pipeline: task, selected context, supported Codex activity, Git-visible diff, declared verification, criterion evidence, outcome, and receipt. Tool activity proves activity only. Generic passing checks and assistant completion text do not prove semantic acceptance criteria; unsupported criteria remain `UNPROVEN`.

The v0.2 work adds direct CLI routing and `w2 doctor`, optional Markdown-only brainw2 project mapping/context/writeback, privacy-safe `PreToolUse` and `PostToolUse` activity in existing receipts, interruption handling, a minimal session index, conservative English and Turkish engineering prompt capture, Windows CI, and maintainer guidance. `PermissionRequest` is passive and makes no approval decision. W2 observes only structured activity delivered through supported Codex hooks, Git-visible changes, and verifier results; it does not claim to observe every OS operation, file read, internal model reasoning, or external side effect.

brainw2 is optional. It supplies bounded, labeled reference context from a mapped project note and local `Decisions.md`, never acceptance evidence. Receipt writeback occurs only after persistence, is idempotent, and cannot change the W2 outcome.

## Verification

Final local verification ran on Windows 11 with Node.js 22.13 and package version `0.2.0-rc.1`:

- `npm test`: PASS, 19 test files and 102 tests; the generated native hook commands passed the child-process boundary for all seven events.
- `npm run typecheck`, `npm run build`, and `npm run standalone:check`: PASS.
- `npm run fresh:check`: PASS on a clean project copy; it reran tests, the hook boundary, typecheck/build, standalone, receipt/benchmark/hero/judge validators, privacy audit, and non-browser smoke checks.
- `npm run fixtures:check`, `npm run benchmark:verify`, `npm run benchmark:hermeticity`, `npm run hero:validate`, `npm run judge-demo:verify`, and `npm run demo:smoke`: PASS.
- `npm run audit:public`: PASS with zero secret, privacy, or tracked runtime-artifact findings. `npm audit --audit-level=high`: PASS with zero vulnerabilities.
- Relative Markdown link validation: PASS across 76 Markdown files; 55 relative links resolved. The public v0.1.0 release URL was verified.

The hook boundary used an external temporary Git project and temporary brainw2 vault. These child-process checks do not prove the new hooks are trusted or working in a newly launched live Codex TUI. No browser QA, Playwright, or screenshot testing was run. Node emitted its documented experimental SQLite warning during tests.

## Historical stable release

The v0.1.0 release facts and feature notes are preserved in [v0.1.0 release notes](submission/RELEASE-NOTES-v0.1.0.md). This current-status report supersedes preparation-era statements that the repository, remote, or hosted release did not exist.
