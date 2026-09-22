# W2 Permissions

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
