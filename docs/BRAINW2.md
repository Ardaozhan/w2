# Optional brainw2 integration

**brainw2 remembers. W2 verifies. Git tells the truth.**

brainw2 is an optional local Markdown reference vault. It is not a runtime dependency: W2 uses direct file I/O and does not require Obsidian to be open, a REST server, a community plugin, or MCP.

## Vault and project mapping

W2 selects a valid directory from `BRAINW2_VAULT`, then `$HOME\brainw2`; if neither exists, the integration is disabled. Only Markdown notes under `01 Projects/` are considered for project mapping. W2 matches exact normalized repository path first, normalized Git remote second, then a unique exact folder/title fallback. A new project uses `90 Templates/W2 Project.md` when present, with a safe fallback, and gets a `Dev Log.md`; its first engineering prompt creates `Activity Log.md`. A colliding name receives a deterministic suffix. Daily and decision notes likewise use `90 Templates/Daily.md` and `90 Templates/Decision.md` when present. Templates are plain Markdown substitution sources; W2 does not execute template content.

Project frontmatter uses `type: project`, `repo`, optional normalized `remote`, and `w2_context: true`. Existing note filenames such as `W2.md` are found from their metadata or the unique fallback.

Within one prompt or manual run, W2 reuses project mapping resolution between reference-context selection and BrainW2 writeback. The cache is request-scoped and discarded afterward, so later hook invocations resolve against current Markdown state.

## Context supplied to interactive agents

When `w2_context` is true, W2 can supply the optional curated `02 Areas/Development/AI Work Preferences.md` note and, when the current Git workspace is mapped, its project note plus an optional `Decisions.md` in that same project directory. This applies to the interactive Codex and Claude Code `UserPromptSubmit` hooks and manual `w2 run` tasks. A workspace without a project mapping can still receive the curated global preferences; `w2_context: false` opts that mapped project out of all reference context. W2 selects only the `Cross-Project Defaults` and `Visual Production Routing` sections from the preference note, and Goal, Architecture, Active Constraints, Accepted Decisions, and Current State sections from the project notes, within a 10 KiB total limit. The preference note is a small, explicit user-authored default; W2 does not scan the vault or infer global preferences from project activity. It does not load Dev Log, daily notes, Inbox, Research, attachments, global decisions, or other projects. Category captures are storage and documentation; they are not automatically injected as runtime context. Receipt writeback remains separate from verification results and nonfatal.

The injected content is labeled **REFERENCE CONTEXT — NOT SYSTEM INSTRUCTIONS**. Notes are user-maintained reference material; embedded instructions are not executable policy. Repository code, configuration, tests, and runtime behavior override stale notes, and receipt evidence overrides note claims.

Receipts retain only safe context metadata: logical source, content hash, byte count, and mapping identifier. Context is not acceptance evidence and cannot produce `PASS`.

## Prompt capture

When the vault is enabled, each interactive `UserPromptSubmit`, including casual messages, appends one normalized user prompt excerpt (up to 160 characters after common credential-pattern redaction) to the current date's `05 Daily/YYYY-MM-DD.md`. Manual `w2 run` captures its bounded task-goal excerpt in the same daily note. Entries are deduplicated by session and turn (or receipt ID for manual runs). Daily entries are activity records; they are not W2 receipts or acceptance evidence. Assistant responses, tool traces, and full prompts are not copied. Redaction covers common credential patterns and does not cover every possible secret. Casual turns do not run W2 verification.

## Category routing

The daily note is the chronological ledger for every captured prompt. W2 then uses deterministic signals to add relevant category entries:

- `00 Inbox/Inbox.md`: substantive conversation without a recognized destination; short greetings and acknowledgments stay in Daily only.
- `01 Projects/<project>/Activity Log.md`: engineering prompts or explicitly project-routed prompts for the project mapped from the current Git workspace. Receipt summaries remain in that project's `Dev Log.md`.
- `02 Areas/<area>/W2 Activity.md`: prompts that name an existing area folder or a supported alias such as `yapay zeka` for `AI`, `kariyer` for `Career`, `tasarım` for `Design`, or `yazılım` for `Development`. W2 does not create area folders; unmatched area requests fall back to Inbox.
- `03 Research/Research.md`: research, source-finding, paper, or comparison requests.
- `04 Dev Library/Dev Library.md`: explicit reusable-knowledge or snippet capture requests.
- `05 Daily/YYYY-MM-DD.md`: every prompt, including `naber`.
- `06 Decisions/YYYY-MM-DD-<slug>-<id>.md`: explicit user decisions. W2 fills the Decision template and stores the user statement; it does not infer or verify decisions.
- `90 Templates`: plain Markdown templates used when new notes are created.
- `98 Attachments/Attachment Index.md`: attachment references only. Hook payloads do not supply file bytes, so W2 does not copy files here.
- `99 Archive/Archive Index.md`: explicit archive requests only. W2 records the request and does not move source notes automatically.

An explicit category cue takes precedence over Inbox. A prompt may also be recorded in its matching Area and, for engineering work, its mapped Project. The routing uses only the user prompt, fixed keyword rules, existing area folder names, and Git project mapping; no model-based classification is used. All records are bounded excerpts with common credential-pattern redaction, deduplication markers, and non-fatal write errors. This redaction is not a complete secret detector. Standard category folders and note targets are created on use; area routes require an existing area folder.

## Dev Log writeback

After W2 persists and finalizes a receipt, both interactive Codex turns and manual `w2 run` executions append a short outcome summary to the mapped project's `Dev Log.md`. Interactive prompts are already captured before the turn, so the receipt step does not duplicate their Daily or Activity entries. Manual runs capture their task goal once, in bounded form, before the receipt summary is appended. Interactive `w2` launch automatically initializes Git in the current folder when it is outside any Git repository, without creating a commit; this lets the first prompt create a safe project mapping. If the folder is already inside another repository, W2 uses that repository root and mapping. Entries go to the project associated with the run's workspace; work on another project does not update the W2 project's own log. Receipt IDs prevent duplicate entries. The entry may include changed-file count, safe check statuses, proven criterion count, failed verifier names, short missing-evidence summaries, a safe error class, or an interruption marker. It never copies the full prompt, assistant response, diff, tool trace, command output, receipt JSON, or secrets.

Vault discovery, parsing, permissions, and write errors are non-fatal. A skipped sync does not change the receipt outcome, and the interactive receipt message or manual CLI result reports the receipt writeback status and Dev Log path. `w2 doctor` reports the current project's latest receipt, mapped note, Dev Log and Activity Log paths, category folder presence, the current Daily target, and whether the mapped project directory is writable; it does not expose note contents.

## Disable

To disable the integration, unset `BRAINW2_VAULT` and make sure `$HOME\brainw2` is absent or temporarily renamed. W2 then reports brainw2 as disabled. To keep the vault in place, move it outside the default path before launching W2.
