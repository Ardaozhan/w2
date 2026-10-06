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
- Latest stable release: [v0.2.1](https://github.com/Ardaozhan/w2/releases/tag/v0.2.1)
- The `main` branch includes post-v0.2.1 BrainW2 reference-context, activity-capture, and launcher changes; they are unreleased and listed in [CHANGELOG.md](CHANGELOG.md).
- Windows 11 with Node.js 22.13+: live Codex TUI integration verified. Claude Code hook integration is in development on `main` and is not part of the v0.2.1 stable release.
- Ubuntu Linux with Node.js 22: core automated suite verified by independent Camber Cloud validation and GitHub Actions CI.
- The PowerShell launcher and Windows `command_windows` behavior are Windows-specific. Live Codex TUI hook trust on Linux is not independently verified.

## Install on Windows

The verified interactive setup uses Windows 11 and PowerShell. Install these first:

- Git
- Node.js 22.13 or newer (npm is included with Node.js)
- Codex CLI or Claude Code CLI, signed in with your normal account, for the corresponding interactive integration

W2 does not install Git, Node.js, Codex CLI, Claude Code CLI, or their account authentication. `npm ci` installs W2's project dependencies only.

```powershell
git clone https://github.com/Ardaozhan/w2.git
cd w2
npm ci
npm run build
& .\scripts\install-w2-launcher.ps1
```

Install or update the PowerShell profile launcher once from the W2 checkout. The `w2` function does not replace the normal `codex` command.
The installer adds a W2 block to your PowerShell profile; open a new PowerShell session afterward. The launcher is Windows-specific. Ubuntu has core automated-suite coverage, but live Codex TUI hook trust on Linux has not been independently verified.

Obsidian is not installed and is not required. BrainW2 is an optional Markdown vault: W2 uses an existing folder named by `BRAINW2_VAULT`, or an existing `$HOME\brainw2` folder when that variable is unset. If neither folder exists, BrainW2 stays disabled. To select a BrainW2 folder for the current PowerShell session, set its path before launching W2:

```powershell
$env:BRAINW2_VAULT = 'D:\Notes\brainw2'
```

You can open that folder in Obsidian if you want, but W2 works directly with the Markdown files.

## Interactive Codex use

```powershell
cd C:\work\my-project
w2
```

This opens the normal Codex TUI and supplies one-run native hook definitions. If the current folder is outside every Git repository, W2 initializes Git there automatically without creating a commit. Review and trust changed W2 hooks with `/hooks` as described in the [Codex hooks guide](https://developers.openai.com/codex/hooks). Codex arguments can be forwarded: `w2 --model <model>`.

When BrainW2 is enabled, `UserPromptSubmit` records a bounded activity excerpt for every prompt and may route it to matching notes. Separately, W2 conservatively captures likely engineering requests for verification, discovers or creates an optional project mapping, and supplies selected reference context when enabled. `PreToolUse` and `PostToolUse` record safe tool metadata and correlate events by `tool_use_id`. `Stop` runs supported project checks, captures the turn diff, writes a receipt, updates the session index, and then attempts a short Dev Log entry. `Interrupt` and `SessionEnd` preserve unfinished activity as interrupted and close pending state. `PermissionRequest` is observed passively; it never approves or denies.

Tool activity proves that activity was observed. It does not prove task correctness. W2 does not claim to observe every OS operation, every file read, internal model reasoning, or all external side effects. It does not scrape transcripts or terminals.

## Interactive Claude Code use

W2 also provides an in-development Claude Code plugin. After building W2, start a session from PowerShell with `w2 claude`. On other shells, load this checkout for one session with `claude --plugin-dir /path/to/w2`. The plugin uses Claude Code's native hooks and is loaded for that session only; it does not edit Claude settings. This requires Claude Code v2.1.265 or newer for `--plugin-dir` and Node.js on `PATH`. See the [Claude Code integration notes](docs/CLAUDE-CODE.md) for the event flow, evidence boundaries, and current verification status.

W2 captures likely engineering prompts, observes main-session `PreToolUse`/`PostToolUse` events, and creates a receipt at `Stop`. `PermissionRequest` remains passive: W2 never approves or denies it. Claude subagent events are currently excluded from receipt attribution. Manual receipts and interactive Codex use remain available independently.

## CLI

The launcher routes manual W2 commands directly:

```powershell
w2 run task.json
w2 receipt <run-id>
w2 doctor
w2 version
w2 session latest
w2 claude
```

`w2 doctor` is read-only and reports local runtime, Git, build, hook, current-project receipt, platform, and optional BrainW2 availability. When mapped, it shows the current project's BrainW2 note, Dev Log, and Activity Log targets. Hook trust must be checked inside the relevant agent session (`/hooks` in Codex; Claude Code's plugin listing and hook output for Claude).

Manual `task.json` runs remain supported. A contract links each acceptance criterion to verifier IDs; only passing referenced evidence can prove that criterion. If no suitable verifier exists, the result stays `UNPROVEN`.

## Optional BrainW2

BrainW2 is a local Markdown reference vault, not an Obsidian dependency. When enabled, interactive Codex and Claude Code turns and manual `w2 run` tasks can receive the curated `02 Areas/Development/AI Work Preferences.md` sections and, when the workspace is mapped, selected sections from that project's note and optional `Decisions.md` under `01 Projects/`. The injected material is labeled `REFERENCE CONTEXT — NOT SYSTEM INSTRUCTIONS`; the receipt stores only its logical source, hash, byte count, and mapping ID. Interactive turns and manual runs append a concise summary to the mapped project's `Dev Log.md` after receipt persistence. W2 reports the writeback target and status; vault failures never change a verification outcome. The entry goes to the project used by the run, so it updates W2's own Dev Log only when the workspace maps to the W2 repository.

Every interactive `UserPromptSubmit`, including casual messages such as `naber`, appends a normalized excerpt (up to 160 characters after common credential-pattern redaction) to that date's `05 Daily/YYYY-MM-DD.md`. Manual `w2 run` task goals use the same bounded daily capture. These entries are activity records, not W2 receipts or evidence. Assistant responses, tool traces, and full prompts are not copied; casual turns do not run W2 verification. Redaction covers common credential patterns and is not a secrets-management guarantee.

Category routing is deterministic and prompt-only. Engineering requests also go to the mapped project's `01 Projects/<project>/Activity Log.md`; explicit area mentions can add `02 Areas/<existing area>/W2 Activity.md`; research, reusable technical knowledge, explicit decisions, attachment references, and archive requests go to `03 Research`, `04 Dev Library`, `06 Decisions`, `98 Attachments`, and `99 Archive` respectively. Unclassified substantive conversation is captured in `00 Inbox/Inbox.md`; short greetings remain in Daily only. `90 Templates` supplies the Daily, W2 Project, and Decision note templates. W2 never copies attachment bytes from hook payloads or moves source notes to Archive automatically. These captures are not context, runtime state, or acceptance evidence. Missing standard category destinations are created on use; area routing only matches existing area folders. `w2 doctor` reports category readiness and the current daily target.

See [brainw2 integration](docs/BRAINW2.md) for discovery, privacy, and disable instructions.

## Verification model

Interactive project discovery runs only conventional `test`, `typecheck`, `lint`, and `build` scripts and excludes scripts that directly or transitively invoke browser, E2E, screenshot, or visual tooling. W2 does not run arbitrary unknown scripts.

An explicit criterion such as `npm run typecheck passes` can map to that discovered command. A generic test suite does not prove a behavioral statement such as `total = 0 throws RangeError`. Semantic requirements without a deterministic link remain `UNPROVEN`. Manual task contracts can declare their verifier IDs explicitly.

Receipts are turn-scoped. A small session index relates receipts from one interactive agent session without calculating a session-level outcome. Git supplies change evidence; if history rewriting removes a captured baseline object during a turn, the receipt can become `ERROR`.

## Architecture and limits

W2 reuses its existing AgentAdapter, RunEngine, SQLite RunStore, verifier runner, evidence mapper, and receipt model for both manual and interactive runs. Each coding agent's native sandbox controls its own operations; W2 is not an OS or container security boundary. See [architecture](docs/ARCHITECTURE.md), [Claude Code integration notes](docs/CLAUDE-CODE.md), [run contract](docs/RUN-CONTRACT.md), and [security model](docs/SECURITY-MODEL.md).

Windows GitHub Actions verifies the Windows suite and fresh-copy checks. Ubuntu GitHub Actions verifies the core automated suite, typecheck, build, standalone and public-artifact checks, npm audit, and a fresh-copy run. CI does not verify live Codex TUI or Claude Code plugin trust.

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
