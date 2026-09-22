# W2 Architecture

## Boundary

W2 is a single-agent evidence and control layer. It is not a replacement for
Codex, a model provider, an autonomous multi-agent framework, CI/CD, an IDE, or
a generic logging dashboard.

## Components

| Component | Responsibility |
| --- | --- |
| Context manifest | Records the repository, task, relevant inputs, and permissions visible to a run. |
| Agent adapter | Starts one coding-agent execution through the approved Codex integration boundary. |
| Tool trace | Records ordered tool calls, timestamps, approvals, and outcomes. |
| Change observer | Captures changed files and the repository diff. |
| Verification runner | Executes declared tests, lint, typecheck, and build commands with exit codes. |
| Evidence mapper | Maps deterministic evidence to acceptance criteria; AI may explain ambiguity only. |
| Run Receipt | Produces the final human- and machine-readable result with outcome semantics. |

## Data flow

```text
Task
  -> Context Manifest
  -> Single Agent Run
  -> Tool Trace + Change Observer
  -> Deterministic Verification
  -> Acceptance Evidence
  -> Run Receipt
```

## Deterministic / AI boundary

W2 deterministically owns changed files, diffs, command exit codes, test/lint/
typecheck/build results, tool order, timestamps, runtime, file access, and
approval events. GPT-5.6 may map evidence to criteria, interpret ambiguity, or
summarize a receipt, but it may not fabricate deterministic facts.

## Foundation technology

The repository is initialized with Node.js, TypeScript, Vitest, and Zod. SQLite,
Drizzle, React/Next.js, Playwright, and the Codex integration are documented as
the default direction for later phases; they are intentionally not activated as
feature implementation during Phase 00.

