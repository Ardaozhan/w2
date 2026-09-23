# Technical Summary

The Run Engine creates a run contract, builds a Context Manifest, invokes the Codex adapter, records ordered events in SQLite, captures Git diff, runs declared verification, and projects the result into JSON/Markdown Run Receipts. ToolRuntime capability/path/approval/time/output controls apply to W2-owned tool calls. The Evidence Engine validates attached records before the deterministic Outcome Engine computes `PASS`, `FAIL`, `UNPROVEN`, `ABORTED`, or `ERROR`.

The Codex adapter invokes the CLI with its `workspace-write` sandbox. W2 observes recognized structured events and resulting diffs, but does not intercept every native Codex operation. Context records considered/selected/provided data where available; exact file-read access is not claimed.

There is no runtime GPT-5.6 Evidence Mapper. Evidence mapping/validation and outcome computation remain deterministic; a development-time GPT-5.6 review is documented separately and does not participate in receipts.

`RunEngine.resume()` loads persisted checkpoint information for inspection and records recovery events; it does not resume agent execution. See the README and Security Model for the precise limits.
