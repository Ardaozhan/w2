# Changelog

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
