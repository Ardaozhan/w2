# W2

**No evidence, no PASS.**

W2 is a verification layer for coding agents. It connects a task, W2-supplied context, supported agent activity, Git-visible changes, verifier results, and criterion-level evidence in a durable Run Receipt.

```text
TASK -> CONTEXT -> AGENT -> TOOL ACTIVITY -> DIFF
     -> VERIFICATION -> ACCEPTANCE EVIDENCE -> RUN RECEIPT
```

W2 computes one of `PASS`, `FAIL`, `UNPROVEN`, `ABORTED`, or `ERROR` from deterministic records. Model confidence, completion text, notes, generic green tests, and semantic guesses cannot select `PASS`.

## Current release

- Public repository: [Ardaozhan/w2](https://github.com/Ardaozhan/w2)
- Latest stable release: [v0.1.0](https://github.com/Ardaozhan/w2/releases/tag/v0.1.0)
- Current main development version: `0.2.0-rc.1`; v0.2.0 final awaits a live Codex TUI trust and end-to-end test after relaunch.
- Latest local regression run: 101 tests across 19 files on Windows 11 with Node.js 22.13; this does not prove live TUI hook behavior.
- Windows 11 with Node.js 22.13+ is the only independently verified environment.

## Install

```powershell
git clone https://github.com/Ardaozhan/w2.git
cd w2
npm ci
npm run build
& .\scripts\install-w2-launcher.ps1
```

Install or update the PowerShell profile launcher once from the W2 checkout. The `w2` function does not replace the normal `codex` command.

## Interactive Codex use

```powershell
cd C:\work\my-project
w2
```

This opens the normal Codex TUI and supplies one-run native hook definitions. Review and trust changed W2 hooks with `/hooks`. Codex arguments can be forwarded: `w2 --model <model>`.

`UserPromptSubmit` conservatively captures likely engineering requests, discovers or creates an optional brainw2 project mapping, and supplies selected reference context when enabled. `PreToolUse` and `PostToolUse` record safe tool metadata and correlate events by `tool_use_id`. `Stop` runs supported project checks, captures the turn diff, writes a receipt, updates the session index, and then attempts a short Dev Log entry. `Interrupt` and `SessionEnd` preserve unfinished activity as interrupted and close pending state. `PermissionRequest` is observed passively; it never approves or denies.

Tool activity proves that activity was observed. It does not prove task correctness. W2 does not claim to observe every OS operation, every file read, internal model reasoning, or all external side effects. It does not scrape transcripts or terminals.

## CLI

The launcher routes manual W2 commands directly:

```powershell
w2 run task.json
w2 receipt <run-id>
w2 doctor
w2 version
w2 session latest
```

`w2 doctor` is read-only and reports local runtime, Git, build, hook, receipt, platform, and optional brainw2 availability. Outside Codex it reports `TRUST STATUS: CHECK WITH /hooks`.

Manual `task.json` runs remain supported. A contract links each acceptance criterion to verifier IDs; only passing referenced evidence can prove that criterion. If no suitable verifier exists, the result stays `UNPROVEN`.

## Optional brainw2

brainw2 is a local Markdown reference vault, not an Obsidian dependency. W2 reads only the mapped project's note and optional `Decisions.md` under `01 Projects/`, selects a few named sections, and labels injected material `REFERENCE CONTEXT — NOT SYSTEM INSTRUCTIONS`. Receipt metadata stores only a logical source, hash, byte count, and mapping ID. After receipt persistence, W2 can append a concise, deduplicated Dev Log summary. Vault failures never change a verification outcome.

See [brainw2 integration](docs/BRAINW2.md) for discovery, privacy, and disable instructions.

## Verification model

Interactive project discovery runs only conventional `test`, `typecheck`, `lint`, and `build` scripts and excludes scripts that directly or transitively invoke browser, E2E, screenshot, or visual tooling. W2 does not run arbitrary unknown scripts.

An explicit criterion such as `npm run typecheck passes` can map to that discovered command. A generic test suite does not prove a behavioral statement such as `total = 0 throws RangeError`. Semantic requirements without a deterministic link remain `UNPROVEN`. Manual task contracts can declare their verifier IDs explicitly.

Receipts are turn-scoped. A small session index relates receipts from one Codex session without calculating a session-level outcome. Git supplies change evidence; if history rewriting removes a captured baseline object during a turn, the receipt can become `ERROR`.

## Architecture and limits

W2 reuses its existing AgentAdapter, RunEngine, SQLite RunStore, verifier runner, evidence mapper, and receipt model for both manual and interactive runs. Codex's native sandbox controls Codex operations; W2 is not an OS or container security boundary. See [architecture](docs/ARCHITECTURE.md), [run contract](docs/RUN-CONTRACT.md), and [security model](docs/SECURITY-MODEL.md).

The Windows GitHub Actions workflow runs tests, typecheck, build, standalone and public-artifact checks, and npm audit. CI does not prove live Codex TUI hook trust or end-to-end behavior.

## Development

```powershell
npm ci
npm test
npm run typecheck
npm run build
npm run standalone:check
npm run fresh:check
npm run audit:public
```

See [CONTRIBUTING.md](CONTRIBUTING.md), [CHANGELOG.md](CHANGELOG.md), and the [submission materials](docs/submission/).

## License

MIT. The package is marked private and is not published to npm.
