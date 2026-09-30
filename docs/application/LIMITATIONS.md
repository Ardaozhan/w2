# Limitations

- The local demo replays stored evidence; there is no hosted service or multi-user collaboration.
- Codex's sandbox controls native Codex execution. W2 checks only W2-owned `ToolRuntime` calls and is not an OS/container security boundary.
- The benchmark has one attempt per fixture and condition; it does not support generalized speed, correctness, safety, or reliability claims.
- W2 records selected/provided context and recognized events, not exact Codex file-read access.
- Optional BrainW2 activity capture stores prompt excerpts of up to 160 characters after common credential-pattern redaction. Redaction is bounded, category routing is deterministic, and these notes are not a secrets vault or acceptance evidence.
- GPT-5.6 is development-time review only and is not called at runtime.
- `RunEngine.resume()` inspects checkpoint state and does not continue agent execution.
- Run storage uses Node's built-in [`node:sqlite` API](https://nodejs.org/api/sqlite.html), which remains experimental in Node 22 and can emit an ExperimentalWarning.
- Live runs require Codex CLI availability and authentication. Windows 11 live Codex TUI integration is verified, including the Windows PowerShell launcher path. Ubuntu Linux core automated tests are verified by independent Camber Cloud validation and GitHub Actions CI; live Codex TUI hook trust on Linux remains unverified.
- macOS has not been independently verified.
- The source repository is currently public. Competition submission remains a human action. The source package is licensed under MIT; the video is intentionally not included in the source release.
