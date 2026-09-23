# Claim Audit

Audit date: 2026-09-23. Scope: current README, architecture, product, security, benchmark and demo claims. Earlier phase reports are historical and superseded where they conflict with this audit.

| Claim | Disposition | Evidence / limit |
|---|---|---|
| W2 stores task, context manifest, observable actions, diff and verification | SUPPORTED | Run Receipt builder and current real run artifacts |
| W2 proves every file the agent saw | REWRITE | It records W2-selected context; exact Codex file access is not captured |
| W2 intercepts and authorizes every Codex tool call | REMOVE | Codex native tools use Codex sandbox; W2 observes recognized events |
| W2 provides a local control and evidence layer | SUPPORTED WITH LIMIT | W2-owned ToolRuntime controls only apply to W2-owned calls |
| GPT-5.6 maps evidence at runtime | REMOVE | No live mapper implementation or call evidence |
| Resume continues an agent run | REWRITE | `RunEngine.resume()` is checkpoint recovery inspection only |
| Benchmark proves a comparative product advantage | REMOVE | One-run-per-condition sample is descriptive and may contain infrastructure failures |
| Windows, macOS and Linux are supported | REWRITE | Windows 11 verified; other platforms not independently verified |
| Demo runs an agent live | REMOVE | `npm run demo` replays stored evidence; task CLI and benchmark invoke live Codex |
