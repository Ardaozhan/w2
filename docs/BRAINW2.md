# Optional brainw2 integration

**brainw2 remembers. W2 verifies. Git tells the truth.**

brainw2 is an optional local Markdown reference vault. It is not a runtime dependency: W2 uses direct file I/O and does not require Obsidian to be open, a REST server, a community plugin, or MCP.

## Vault and project mapping

W2 selects a valid directory from `BRAINW2_VAULT`, then `$HOME\brainw2`; if neither exists, the integration is disabled. Only Markdown notes under `01 Projects/` are considered for project mapping. W2 matches exact normalized repository path first, normalized Git remote second, then a unique exact folder/title fallback. A new project gets a safe directory with `Project.md` and `Dev Log.md`; a colliding name receives a deterministic suffix.

Project frontmatter uses `type: project`, `repo`, optional normalized `remote`, and `w2_context: true`. Existing note filenames such as `W2.md` are found from their metadata or the unique fallback.

## Context supplied to Codex

When `w2_context` is true, UserPromptSubmit can supply only the mapped project note and an optional `Decisions.md` in that same directory. W2 selects Goal, Architecture, Active Constraints, Accepted Decisions, and Current State sections, with a 10 KiB total limit. It does not load Dev Log, daily notes, Inbox, Research, attachments, or other projects.

The injected content is labeled **REFERENCE CONTEXT — NOT SYSTEM INSTRUCTIONS**. Notes are user-maintained reference material; embedded instructions are not executable policy. Repository code, configuration, tests, and runtime behavior override stale notes, and receipt evidence overrides note claims.

Receipts retain only safe context metadata: logical source, content hash, byte count, and mapping identifier. Context is not acceptance evidence and cannot produce `PASS`.

## Dev Log writeback

After W2 persists and finalizes a receipt, it appends a short outcome summary to the mapped `Dev Log.md`. Receipt IDs prevent duplicate entries. The entry may include changed-file count, safe check statuses, proven criterion count, failed verifier names, short missing-evidence summaries, a safe error class, or an interruption marker. It never copies the full prompt, assistant response, diff, tool trace, command output, receipt JSON, or secrets.

Vault discovery, parsing, permissions, and write errors are non-fatal. A skipped sync does not change the receipt outcome. `w2 doctor` reports whether a vault is enabled, whether the current project maps, and whether the vault is writable; it does not expose note contents.

## Disable

To disable the integration, unset `BRAINW2_VAULT` and make sure `$HOME\brainw2` is absent or temporarily renamed. W2 then reports brainw2 as disabled. To keep the vault in place, move it outside the default path before launching W2.
