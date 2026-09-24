# Technical Summary

The W2 Run Engine validates a task contract, builds a Context Manifest, invokes the Codex adapter, records recognized events in SQLite, captures the Git diff, and runs declared verification commands. The Evidence Engine creates deterministic verifier records and maps them to task criteria. The Outcome Engine derives `PASS`, `FAIL`, `UNPROVEN`, `ABORTED`, or `ERROR`; JSON and Markdown Run Receipts expose the result.

The Codex adapter invokes the installed CLI with the `workspace-write` sandbox. W2 observes recognized structured events and resulting diffs, but does not intercept every native Codex operation. Context records what W2 considered, selected, and provided; exact file-read access is not claimed.

W2 capability, path, approval, timeout, and output controls apply to W2-owned `ToolRuntime` calls. W2 is not an OS/container security boundary or a universal native-tool broker.

There is no runtime GPT-5.6 evidence mapper. Criterion mapping and outcome calculation are deterministic. `RunEngine.resume()` inspects persisted checkpoint information; it does not resume agent execution.
