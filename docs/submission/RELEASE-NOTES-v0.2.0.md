# W2 v0.2.0

W2 v0.2.0 completes the local interactive verification workflow while preserving turn-scoped receipts and the deterministic evidence boundary.

## What's included

- Route `w2`, `w2 run`, `w2 receipt`, `w2 doctor`, `w2 version`, and `w2 session latest` through the existing PowerShell launcher while leaving ordinary `codex` unchanged.
- Add a read-only diagnostic report for local tooling, Git state, runtime/build availability, receipts, hooks, platform support, and optional brainw2 status. On Windows, Codex detection uses PowerShell `Get-Command`, matching the launcher's command resolution.
- Add optional brainw2 Markdown mapping, bounded reference context, safe receipt metadata, and idempotent non-fatal Dev Log writeback.
- Observe supported native Codex `PreToolUse` and `PostToolUse` events as privacy-safe activity evidence. Leave `PermissionRequest` decisions to Codex.
- Preserve incomplete and interrupted tool activity, and relate turn receipts with a minimal session index.
- Improve deterministic English and Turkish engineering prompt capture and direct command-to-verifier mapping.
- Add Windows GitHub Actions CI and concise open-source maintainer files.

## Verification boundary

Tool activity proves activity only. brainw2 context is reference evidence only. Unsupported semantic requirements remain `UNPROVEN`. W2 observes only activity delivered through supported Codex hooks, Git-visible changes, and verifier results; it does not claim every OS operation, file read, internal model reasoning, or external side effect.

Codex controls native hook trust and approval. Review hook trust in Codex with `/hooks`; W2 does not bypass that step.

## Release checks

- `npm test` — 103 tests and the interactive hook boundary check pass.
- `npm run typecheck` and `npm run build` pass.
- `npm run fresh:check` passes from a clean project copy.
- `npm run audit:public` reports no secret, privacy, or tracked runtime artifact findings.
- `npm audit --audit-level=high` reports no vulnerabilities.
- `git diff --check` passes.
