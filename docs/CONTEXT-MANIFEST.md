# Context Manifest

Before Codex starts, `buildContextManifest` walks the run workspace while excluding `.git`, `node_modules`, `dist`, and `.w2`. It records every considered file, selected files, excluded candidates, absolute source path, selection reason, sections, byte size, and approximate token count (bytes / 4, rounded up).

The manifest is stored in the `runs.context_manifest` SQLite column and is passed to the adapter. This answers “What did the agent see?” without relying on a transient log.
