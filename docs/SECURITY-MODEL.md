# W2 Security Model

W2 is a local evidence layer. It is not an OS/container security boundary.

## Codex native execution

The Codex adapter invokes the installed CLI with its `workspace-write` sandbox and the task workspace as its working directory. Codex's sandbox controls native Codex shell and filesystem execution. The host's Codex configuration and operating system remain part of the trusted computing base.

## W2-owned runtime calls

Calls routed through W2 `ToolRuntime` are checked against configured capabilities and canonical workspace paths. The runtime applies its own timeouts, output limits, retry/budget rules, and approval callback. It denies path traversal and detected symlink escapes. These checks apply only to calls made through W2-owned runtime APIs.

## Evidence W2 records

W2 stores structured events recognized by the adapter, the before/after repository diff, and results from declared verification commands. These records are not a complete trace of every native operation or every file read. The context manifest records files considered, selected, and provided; exact Codex file access remains unknown unless separate telemetry establishes it.

## Outside W2's boundary

W2 does not broker, intercept, or authorize every Codex-native filesystem or shell call. It is not a container, OS sandbox, network firewall, secrets vault, multi-user authorization service, or protection against a compromised host. Context selection does not restrict filesystem access.

## Outcome and failure boundary

A Codex process failure or timeout produces receipt outcome `ERROR`. A completed run with missing required criterion evidence produces `UNPROVEN`. The benchmark classifies process failures and timeouts as `INFRASTRUCTURE_FAILURE`; these are not task successes. A model-generated completion message cannot directly set receipt `PASS`.
