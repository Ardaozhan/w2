# Claude Code Integration

W2's Claude Code integration is an in-development native hooks plugin. It sends supported interactive Claude Code events through W2's existing deterministic RunEngine and Run Receipt pipeline. The plugin does not call the Claude API, change Claude settings, or control Claude Code permissions.

## Run it

Build W2 first. From the installed PowerShell launcher, run:

```powershell
w2 claude
```

From another shell, load the W2 checkout for one Claude Code session:

```sh
claude --plugin-dir /path/to/w2
```

Claude Code folder-plugin loading requires v2.1.265 or later, and W2's hook command requires Node.js on `PATH`. The plugin is session-scoped. It does not add W2 hooks to Claude's persistent settings. The PowerShell launcher builds the W2 Claude integration when its compiled hook files are missing.

## Captured events

- `UserPromptSubmit` writes optional bounded BrainW2 activity and reference context. A likely engineering prompt starts a W2 turn and records its Git baseline.
- `PreToolUse`, `PostToolUse`, and `PostToolUseFailure` collect privacy-safe tool metadata and correlate results by `tool_use_id`.
- `PermissionRequest` is passive; W2 sends no allow or deny decision.
- `Stop` captures Git-visible changes, runs detected project checks, and writes the receipt.
- `SessionEnd` clears an unfinished session pointer and lets the shared hook pipeline preserve incomplete activity.

Claude Code does not provide W2's turn ID in the hook payload. W2 creates a random local turn ID at prompt submission and keeps it in an atomic pointer keyed by the normalized project and Claude session ID. It removes that pointer at `Stop` or `SessionEnd`. Hook payloads carrying an `agent_id` are ignored, so subagent changes are not attributed to the main session.

## Evidence and limitations

The receipt's `CLAUDE_CODE_HOOK` execution mode identifies how W2 observed the turn; it does not establish that the tool activity or model output is correct. W2 records supported hook-delivered tool calls, Git-visible changes, and declared verification results. It does not see every operation, file read, reasoning step, or external side effect. A passing project command proves only that command passed; semantic criteria without a direct verifier mapping remain `UNPROVEN`.

The Claude integration has automated launch-plan and synthetic lifecycle/receipt tests. The available local Claude Code CLI is v2.1.224, below the v2.1.265 folder-plugin minimum, so a real interactive Claude session has not yet been verified. Treat the feature as in development until it is exercised on a supported version. The v0.2.1 stable release does not include this integration.
