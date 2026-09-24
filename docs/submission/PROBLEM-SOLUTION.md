# Problem and Solution

## Problem

An AI coding agent can report that a change is complete without showing whether the requested requirements were verified. A diff shows changed files. A green test command shows that command passed. Neither fact alone proves every task requirement.

## Solution

W2 captures the run and creates a receipt that ties declared acceptance criteria to deterministic verifier results. It keeps the agent's claim separate from the evidence and exposes missing coverage as `UNPROVEN`.

| Review question | W2 record |
| --- | --- |
| What was requested? | Task and acceptance criteria |
| What context did W2 supply? | Context Manifest |
| What run activity was recognized? | Structured events and supported tool records |
| What changed? | Git diff |
| What checks ran? | Stored verification results |
| Which requirements have evidence? | Criterion evidence links |
| What can be concluded? | Deterministic outcome and Run Receipt |

W2 complements CI and Codex. It does not guarantee correctness, infer proof from completion language, or turn generic test success into semantic evidence.
