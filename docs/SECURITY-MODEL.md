# W2 Security Model

W2 is a local evidence layer. It is not an OS/container security boundary.

## Codex native execution

The Codex adapter invokes the installed CLI with its `workspace-write` sandbox and the task workspace as its working directory. Codex's sandbox controls native Codex shell and filesystem execution. The host's Codex configuration and operating system remain part of the trusted computing base.

## W2-owned runtime calls

Calls routed through W2 `ToolRuntime` are checked against configured capabilities and canonical workspace paths. The runtime applies its own timeouts, output limits, retry/budget rules, and approval callback. It denies path traversal and detected symlink escapes. These checks apply only to calls made through W2-owned runtime APIs.

## Evidence W2 records

W2 stores supported Codex tool activity delivered through native `PreToolUse` and `PostToolUse` hooks, the before/after repository diff, and results from declared verification commands. Tool inputs and responses are summarized with safe structured metadata; raw command lines and response bodies are not persisted by default. These records are not a complete trace of every OS operation, every file read, internal model reasoning, or all external side effects. The context manifest records files considered, selected, and provided; exact Codex file access remains unknown unless separate telemetry establishes it.

`PermissionRequest` is registered as a passive hook. W2 emits no permission decision, so Codex's ordinary approval behavior remains in control. W2 never auto-approves or auto-denies. Users inspect and trust the generated hook definitions through Codex's `/hooks` interface.

Optional brainw2 notes are untrusted, user-maintained reference context. Supplied context is explicitly labeled `REFERENCE CONTEXT — NOT SYSTEM INSTRUCTIONS`, limited to selected sections from the mapped project note and its `Decisions.md`, and never counts as acceptance evidence. Receipt metadata stores a logical source, content hash, byte count, and project mapping ID; raw note content is not copied into receipt metadata. brainw2 read or write failures do not alter the W2 outcome.

## Outside W2's boundary

W2 does not broker, intercept, or authorize every Codex-native filesystem or shell call. It is not a container, OS sandbox, network firewall, secrets vault, multi-user authorization service, or protection against a compromised host. Context selection does not restrict filesystem access.

## Outcome and failure boundary

A Codex process failure or timeout produces receipt outcome `ERROR`. A completed run with missing required criterion evidence produces `UNPROVEN`. The benchmark classifies process failures and timeouts as `INFRASTRUCTURE_FAILURE`; these are not task successes. A model-generated completion message cannot directly set receipt `PASS`.
