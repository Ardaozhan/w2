# W2 Security Model

W2 provides a local control and evidence layer. It is not an OS/container security boundary.

## Enforced by W2 for W2-owned calls

Calls routed through `ToolRuntime` are checked against the configured capability set and canonical workspace paths. The runtime applies its own timeout, output limit, retry/budget rules and approval callback. Path traversal and detected symlink escapes are denied. These controls apply only when work uses the W2 runtime APIs.

## Enforced by Codex

The Codex adapter invokes the installed Codex CLI with its supported `workspace-write` sandbox and the target workspace as the working directory. Codex enforces that sandbox for its native shell and filesystem tools. The host's Codex configuration and operating system remain part of the trusted computing base.

## Observed by W2

W2 stores Codex JSONL events that the adapter recognizes, captures repository diff before and after execution, and records declared verification command results. Event capture is not a complete record of every internal action or every file read. The context manifest records files W2 selected and supplied; exact agent file access is unknown unless separately present in structured telemetry.

## Not enforced by W2

W2 does not broker, intercept, or authorize every Codex-native filesystem/shell call. It is not a container, OS sandbox, network firewall, secrets vault, multi-user authorization service, or protection against a compromised host. Do not interpret context selection as an access restriction.

## Evidence boundary

An outcome is calculated from persisted run state and required criterion evidence. Model-generated completion text cannot directly set a `PASS`. Infrastructure failures are classified as `ERROR`; missing criterion evidence after a completed execution is `UNPROVEN`.
