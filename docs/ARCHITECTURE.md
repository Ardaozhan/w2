# W2 Architecture

## Boundary

W2 is a single-agent evidence and control layer. It is not a replacement for
Codex, a model provider, an autonomous multi-agent framework, CI/CD, an IDE, or
a generic logging dashboard.

## Components

| Component | Responsibility |
| --- | --- |
| Context manifest | Records candidate files and the subset selected and placed in the prompt. It does not restrict Codex workspace access. |
| Agent adapter | Starts one Codex CLI execution with its `workspace-write` sandbox and captures recognized JSONL events. |
| Tool trace | Records W2-owned calls and observable Codex events; it is not a complete pre-execution broker trace. |
| Change observer | Captures changed files and the repository diff. |
| Verification runner | Executes declared tests, lint, typecheck, and build commands with exit codes. |
| Evidence mapper | Maps deterministic evidence to acceptance criteria; AI may explain ambiguity only. |
| Run Receipt | Produces the final human- and machine-readable result with outcome semantics. |

## Data flow and security boundary

```text
Task
  -> Context Manifest
  -> Codex Adapter -> Codex workspace-write sandbox -> Repository
  -> W2 observes structured events + captures repository diff
  -> Deterministic Verification
  -> Acceptance Evidence
  -> Run Receipt
```

W2's `ToolRuntime` is a separate control path for calls made through W2-owned APIs. Native Codex actions do not pass through it.

## Deterministic / AI boundary

W2 deterministically stores changed-file diffs and its declared verifier exit
codes. It stores the context it supplied and recognized Codex events, not exact
file access or all native tool actions. No live GPT-5.6 evidence mapper is
implemented. Receipt validation and outcome computation are deterministic.

## Foundation technology

The repository is initialized with Node.js, TypeScript, Vitest, and Zod. SQLite,
Drizzle, React/Next.js, Playwright, and the Codex integration are documented as
the default direction for later phases; they are intentionally not activated as
feature implementation during Phase 00.
