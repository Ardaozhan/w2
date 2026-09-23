# Context Model

Before Codex starts, `buildContextManifest` walks the run workspace while excluding `.git`, `node_modules`, `dist`, and `.w2`. It records files considered, files selected for the adapter prompt, excluded candidates, selection reasons, sections, byte size, and approximate token count.

The manifest is stored in SQLite and provided to the adapter. It is deterministic evidence of what W2 selected and supplied. It does not establish which files Codex later opened or read. Exact agent access remains unknown unless separate telemetry records it.

## Four distinct states

- **Considered:** a file appeared in W2's workspace scan.
- **Selected:** W2 chose the file for context.
- **Provided:** the manifest or selected file content was sent through the adapter.
- **Observed / unknown access:** only explicit access telemetry can establish a later read; this Codex adapter does not provide a complete file-read trace.

Context selection describes prompt construction. It is not a filesystem permission boundary. See [Security Model](SECURITY-MODEL.md).
