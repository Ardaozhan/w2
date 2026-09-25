# Limitations

- The local demo replays stored evidence; there is no hosted service or multi-user collaboration.
- Codex's sandbox controls native Codex execution. W2 checks only W2-owned `ToolRuntime` calls and is not an OS/container security boundary.
- The benchmark has one attempt per fixture and condition; it does not support generalized speed, correctness, safety, or reliability claims.
- W2 records selected/provided context and recognized events, not exact Codex file-read access.
- GPT-5.6 is development-time review only and is not called at runtime.
- `RunEngine.resume()` inspects checkpoint state and does not continue agent execution.
- Run storage uses Node's built-in [`node:sqlite` API](https://nodejs.org/api/sqlite.html), which remains experimental in Node 22 and can emit an ExperimentalWarning.
- Live runs require Codex CLI availability and authentication. Windows 11 live Codex TUI integration is verified. Ubuntu Linux core automated tests are verified by independent Camber Cloud validation and GitHub Actions CI; the PowerShell launcher, Windows `command_windows` behavior, and live Codex TUI hook trust on Linux remain unverified.
- macOS has not been independently verified.
- Repository visibility and competition submission remain human decisions/actions. The source package is licensed under MIT; the video is intentionally not included in the source release.
