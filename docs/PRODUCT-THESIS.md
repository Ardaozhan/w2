# W2 Product Thesis

## Problem

Coding agents can inspect code, call tools, modify files, and report success,
while developers still lack a compact, trustworthy account of what influenced
the run, what actually happened, what changed, and which acceptance criteria
are proven.

## User

The primary user is a developer or technical reviewer who needs to trust,
debug, reproduce, and review coding-agent work without treating the agent's
final sentence as evidence.

## Solution

W2 is an evidence and control layer around coding-agent execution. It captures
context, actions, tool traces, code diffs, verification results, and acceptance
evidence in one inspectable run flow.

## Run Receipt

The Run Receipt is W2's core product artifact. It is both human-readable and
machine-readable and records:

```text
TASK -> CONTEXT MANIFEST -> AGENT ACTIONS -> TOOL TRACE -> CODE DIFF
     -> VERIFICATION -> ACCEPTANCE EVIDENCE -> RUN RECEIPT
```

## Differentiator

W2 makes completion evidence-first: deterministic facts are captured by the
system, AI interpretation is explicitly bounded, and missing evidence remains
`UNPROVEN` rather than being promoted to `PASS`.

