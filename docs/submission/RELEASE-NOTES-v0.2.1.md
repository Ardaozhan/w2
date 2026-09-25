# W2 v0.2.1

W2 v0.2.1 is a patch release that hardens the automated test suite across Windows and Linux without changing W2 product behavior.

## What's included

- Use native paths in Codex launch and benchmark isolation tests.
- Select shell-compatible success and failure commands in verifier fixtures.
- Cover successful and failing verifier exit codes, profile and HOME path detection, unrelated path exclusion, and both clean and contaminated ancestry cases.
- Add an Ubuntu GitHub Actions job while retaining the existing Windows verification and fresh-copy jobs.
- Clarify platform support and verification boundaries in the README and limitations.

Camber Cloud's independent Linux validation reported Windows-specific test assumptions and no product bug or Linux portability defect. This release updates the fixtures and adds continuing Ubuntu CI coverage.

## Platform support

- Windows 11: live Codex TUI integration verified.
- Ubuntu Linux: core automated suite verified by Camber Cloud and GitHub Actions CI.
- The PowerShell launcher and Windows `command_windows` behavior are Windows-specific.
- Live Codex TUI hook trust on Linux and macOS remains unverified.

## Product behavior

No product logic or verification semantics changed in this release.

## Verification

- Windows 11 local: `npm test` (103 tests across 19 files, including the interactive hook boundary), typecheck, build, standalone check, fresh-copy check, public audit, and high-severity npm audit passed.
- The fresh-copy run also passed benchmark fixture validation, receipt fixture integrity, benchmark result validation, benchmark hermeticity, hero receipt validation, and judge-demo validation.
- GitHub Actions: Windows verification, Windows fresh-copy verification, and Ubuntu core verification passed.
- Ubuntu CI verifies the automated core and fresh-copy behavior. It does not verify the PowerShell launcher, Windows `command_windows` behavior, or live Codex TUI hook trust on Linux.
