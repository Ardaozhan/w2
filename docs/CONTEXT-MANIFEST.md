# Context Model

Before Codex starts, `buildContextManifest` walks the run workspace while excluding `.git`, `node_modules`, `dist`, and `.w2`. It records files considered, selected files, excluded candidates, selection reasons, content sections, byte size, and approximate token count. The manifest is stored and provided to the adapter.

## Context states

- **Considered:** a file appeared in W2's workspace scan.
- **Selected:** W2 chose a file for the adapter prompt.
- **Provided:** the selected manifest or file content was sent through the adapter.
- **Observed/accessed:** a later read is recorded only when supported telemetry reports it.
- **Unknown:** this Codex adapter does not provide a complete file-read trace, so exact reads are unknown unless separate telemetry establishes them.

The manifest is deterministic evidence of W2's prompt construction. It is not a filesystem permission boundary, and selection does not prove that the agent did or did not open a file. See [Security Model](SECURITY-MODEL.md).
