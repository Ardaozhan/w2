# W2 v0.2.0 (planned)

W2 v0.2.0 completes the local interactive verification workflow while preserving turn-scoped receipts and the deterministic evidence boundary. The current development package is `0.2.0-rc.1`. Do not tag or publish v0.2.0 until the new hook definitions have passed a live Codex TUI trust and end-to-end run after relaunch.

## Planned changes

- Route `w2`, `w2 run`, `w2 receipt`, `w2 doctor`, `w2 version`, and `w2 session latest` through the existing PowerShell launcher while leaving ordinary `codex` unchanged.
- Add a read-only diagnostic report for local tooling, Git state, runtime/build availability, receipts, hooks, platform support, and optional brainw2 status.
- Add optional brainw2 Markdown mapping, bounded reference context, safe receipt metadata, and idempotent non-fatal Dev Log writeback.
- Observe supported native Codex `PreToolUse` and `PostToolUse` events as privacy-safe activity evidence. Leave `PermissionRequest` decisions to Codex.
- Preserve incomplete and interrupted tool activity, and relate turn receipts with a minimal session index.
- Improve deterministic English and Turkish engineering prompt capture and direct command-to-verifier mapping.
- Add Windows GitHub Actions CI and concise open-source maintainer files.

## Verification boundary

Tool activity proves activity only. brainw2 context is reference evidence only. Unsupported semantic requirements remain `UNPROVEN`. W2 observes only activity delivered through supported Codex hooks, Git-visible changes, and verifier results; it does not claim every OS operation, file read, internal model reasoning, or external side effect.

The final release remains contingent on one live trusted Codex TUI run using the newly launched hook definitions. CI and child-process hook command tests do not prove that live TUI flow.
