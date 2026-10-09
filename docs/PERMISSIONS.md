# W2 Permissions

This table applies only to calls routed through W2's `ToolRuntime`. Codex-native file and shell operations are governed by the installed Codex CLI's sandbox and are not intercepted by W2.

Interactive package scripts are project-controlled shell commands and run with the user's normal account permissions. W2 discovers only conventional non-browser `test`, `typecheck`, `lint`, and `build` scripts; it skips them by default. `w2 trust-checks trust` explicitly enables those discovered scripts for the current workspace and current `package.json` plus supported lockfile contents. Review the scripts before trusting them. A changed fingerprint disables execution until trusted again. `w2 trust-checks revoke` disables it immediately. This trust is an opt-in record, not an OS sandbox.

| Capability | Default | Gate |
| --- | --- | --- |
| `fs.read` | allow | workspace canonical path |
| `fs.write` | allow | workspace canonical path |
| `fs.delete` | deny | capability + explicit approval |
| `shell.execute` | allow | filtered environment, timeout, output limit |
| `git.read` | allow | workspace shell boundary |
| `git.write` | deny | capability + explicit approval |
| `network.read` / `network.write` | deny | explicit task policy, not implemented as ambient access |
| `secret.read` | deny | no secret injection into context |
| `external.write` | deny | explicit approval and capability |

Every denial is recorded as a safety event. Approval is an evidence-bearing
decision, never an implicit elevation.
