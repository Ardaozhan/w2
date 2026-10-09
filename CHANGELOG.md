# Changelog

## Unreleased

## 0.2.2 - 2026-10-09

- Supply bounded, curated BrainW2 preferences and selected mapped-project references to interactive Codex turns and manual `w2 run` tasks; keep reference content out of receipts and acceptance evidence.
- Capture bounded, common-secret-redacted prompt excerpts in BrainW2 Daily notes and route eligible prompts to deterministic category notes.
- Append manual task goals and receipt outcomes to the mapped BrainW2 project logs; report writeback targets through the CLI and `w2 doctor`.
- Initialize Git in a folder with no containing repository when starting the interactive W2 launcher, without creating a commit.
- Add BrainW2 note templates, curated reference selection, deduplication markers, safe-path checks, and non-fatal writeback reporting.
- Check GitHub's latest stable W2 release when the interactive launcher is opened, with a 24-hour check interval, clean-checkout protection, and rollback on failed installation.
- Add `w2 update` and `w2 update --check` for explicit release updates and availability checks.
- Update the transitive `source-map-js` dependency to 1.2.2 to clear the high-severity npm audit finding.

## 0.2.1 - 2026-09-25

- Make Codex launch, verifier command, profile isolation, and ancestry test fixtures platform-aware without changing product behavior.
- Add Ubuntu GitHub Actions coverage for the automated suite, fresh-copy checks, and core repository audits while retaining Windows CI.
- Clarify verified Windows and Linux support boundaries, including the Windows-specific PowerShell launcher and unverified Linux live TUI trust.

## 0.2.0 - 2026-09-25

- Add `w2 doctor`, direct manual CLI routing, and a minimal session receipt index.
- Resolve the Windows Codex CLI diagnostic with the same PowerShell command lookup used by the `w2` launcher.
- Observe supported Codex `PreToolUse` and `PostToolUse` events as privacy-safe activity evidence.
- Add optional direct-file brainw2 context mapping and receipt writeback.
- Add conservative English and Turkish engineering prompt capture, Windows CI, and maintainer guidance.
- Preserve deterministic outcomes and turn-scoped receipts.

## 0.1.0 - 2026-09-25

- Publish the first stable W2 release with manual task contracts and interactive Codex hook integration.
- Add deterministic Run Receipts, Git-visible turn diffs, and evidence-linked acceptance outcomes.
