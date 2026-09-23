# Claim Audit

Audit date: 2026-09-23. Scope: README, architecture, product, security, benchmark, and judge-demo claims. Earlier phase reports are historical and do not override this audit or `FINAL-SUBMISSION-READINESS.md`.

| Claim | Disposition | Evidence / limit |
|---|---|---|
| W2 stores task, selected context, recognized events, diff, verification, and evidence | SUPPORTED | Current REAL_CODEX receipts and receipt tests |
| W2 proves every file the agent saw | REWRITE | W2-selected/provided context is recorded; exact Codex file-read access is unavailable |
| W2 intercepts and authorizes every Codex tool call | REMOVE | Codex native tools use Codex sandbox; W2 observes recognized events |
| W2 provides a local control and evidence layer | SUPPORTED WITH LIMIT | W2-owned ToolRuntime controls only apply to W2-owned calls; not an OS/container boundary |
| GPT-5.6 maps evidence at runtime | REMOVE | No runtime mapper implementation or call evidence; outcomes remain deterministic |
| GPT-5.6 contributed to final review | SUPPORTED | Authorized review model/task metadata and review artifact in `GPT56-FINAL-REVIEW.md` |
| Resume continues an agent run | REWRITE | `RunEngine.resume()` is checkpoint recovery inspection only |
| Benchmark proves a comparative product advantage | REMOVE | Eight paired runs are descriptive, one attempt per fixture/condition |
| Windows, macOS, and Linux are verified | REWRITE | Windows 11 verified; other platforms are not independently verified |
| Static demo runs an agent live | REMOVE | It replays stored artifacts; the separate `demo:live` command invokes Codex |
| Benchmark false-DONE metric includes infrastructure timeouts | REMOVE | Infrastructure outcomes are excluded; false-DONE requires an actual assistant completion claim and failed/unproven acceptance verification |
| W2 is faster, safer, or more reliable | REMOVE | No such comparative conclusion follows from the current sample |

The current README uses the above dispositions. Earlier completion reports are historical; the final submission readiness report supersedes conflicting status statements.
