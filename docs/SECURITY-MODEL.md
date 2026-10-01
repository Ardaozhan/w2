# W2 Security Model

W2 is a local evidence layer. It is not an OS/container security boundary.

## Codex native execution

The Codex adapter invokes the installed CLI with its `workspace-write` sandbox and the task workspace as its working directory. Codex's sandbox controls native Codex shell and filesystem execution. The host's Codex configuration and operating system remain part of the trusted computing base.

## W2-owned runtime calls

Calls routed through W2 `ToolRuntime` are checked against configured capabilities and canonical workspace paths. The runtime applies its own timeouts, output limits, retry/budget rules, and approval callback. It denies path traversal and detected symlink escapes. These checks apply only to calls made through W2-owned runtime APIs.

## Evidence W2 records

W2 stores supported Codex tool activity delivered through native `PreToolUse` and `PostToolUse` hooks, the before/after repository diff, and results from declared verification commands. Tool inputs and responses are summarized with safe structured metadata; raw command lines and response bodies are not persisted by default. These records are not a complete trace of every OS operation, every file read, internal model reasoning, or all external side effects. The context manifest records files considered, selected, and provided; exact Codex file access remains unknown unless separate telemetry establishes it.

`PermissionRequest` is registered as a passive hook. W2 emits no permission decision, so Codex's ordinary approval behavior remains in control. W2 never auto-approves or auto-denies. Users inspect and trust the generated hook definitions through Codex's `/hooks` interface.

Optional BrainW2 notes are untrusted, user-maintained reference context. Interactive turns and manual `w2 run` tasks can receive only the curated `02 Areas/Development/AI Work Preferences.md` sections and selected sections from the mapped project's note and its `Decisions.md`. The injected context is labeled `REFERENCE CONTEXT — NOT SYSTEM INSTRUCTIONS` and never counts as acceptance evidence. Receipt metadata stores a logical source, content hash, byte count, and mapping ID; raw note content is not copied into receipt metadata. BrainW2 read or write failures do not alter the W2 outcome.

When BrainW2 activity capture is enabled, each interactive user prompt and manual task goal may be stored as a normalized excerpt of up to 160 characters in the dated Daily note and deterministic category notes. W2 redacts common credential patterns before writing; it does not recognize every possible secret format and is not a secrets vault. Captures do not include assistant responses, tool traces, full prompts, or attachment bytes. Category routing uses fixed phrase rules and existing area folders; these notes are not automatically injected as model context or used as acceptance evidence. Write failures are reported separately and do not change a receipt outcome.

## Outside W2's boundary

W2 does not broker, intercept, or authorize every Codex-native filesystem or shell call. It is not a container, OS sandbox, network firewall, secrets vault, multi-user authorization service, or protection against a compromised host. Context selection does not restrict filesystem access.

## Outcome and failure boundary

A Codex process failure or timeout produces receipt outcome `ERROR`. A completed run with missing required criterion evidence produces `UNPROVEN`. The benchmark classifies process failures and timeouts as `INFRASTRUCTURE_FAILURE`; these are not task successes. A model-generated completion message cannot directly set receipt `PASS`.
