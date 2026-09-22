# W2 — Phase 01: Core Run Engine

## Status
**Gate:** BLOCKING  
**Prerequisite:** Phase 00 must be COMPLETE.

---

## 1. Objective

Build the smallest reliable W2 execution engine capable of running a coding-agent task and recording the complete operational history of that run.

Canonical flow:

```text
TASK
↓
CONTEXT
↓
AGENT
↕
TOOLS
↓
TRACE
↓
DIFF
↓
VERIFICATION
↓
FINAL RUN STATE
```

This phase does **not** build the final Evidence Engine or polished UI.

---

## 2. Run Contract

Every run must have:

```text
run_id
task_id
status
started_at
finished_at
model
workspace
context_manifest
tool_events
diff
verification_results
error
```

Recommended states:

```text
CREATED
PREPARING
RUNNING
VERIFYING
COMPLETED
FAILED
ABORTED
ERROR
```

State transitions must be explicit and persisted.

---

## 3. Task Contract

Create a structured task schema.

Minimum fields:

```text
task_id
title
goal
constraints
allowed_paths
acceptance_criteria
verification_commands
```

Use schema validation.

The system must reject malformed tasks early.

---

## 4. Context Manifest

Before the agent executes, W2 must record:

- files considered
- files included
- sections/chunks included
- source path
- reason for inclusion
- approximate size/token count
- excluded candidates when relevant

The context manifest must remain inspectable after the run.

Required question:

> What did the agent see?

---

## 5. Agent Adapter

Create one clean adapter boundary for Codex.

The rest of W2 should not depend directly on ad hoc Codex-specific internals.

The adapter must expose a minimal contract such as:

```text
startRun()
sendTask()
receiveAction()
receiveOutput()
cancel()
```

Exact API may differ based on the integration mechanism.

Do not add multiple providers in Phase 01.

---

## 6. Tool Runtime

Minimum tool capabilities:

- filesystem read
- filesystem write
- shell command
- git status
- git diff

All agent-triggered operations must pass through a central runtime boundary.

Each tool invocation must have:

```text
tool_name
input
started_at
finished_at
result
error
```

---

## 7. Event Trace

Persist ordered events.

Minimum event types:

```text
run_created
context_built
agent_started
agent_output
tool_requested
tool_started
tool_finished
file_changed
verification_started
verification_finished
run_finished
run_failed
run_aborted
```

Each event must include:

```text
event_id
run_id
sequence
timestamp
type
payload
```

Ordering must not depend only on log timestamps.

---

## 8. SQLite State

Use SQLite as the operational source of truth.

Persist at minimum:

- runs
- tasks
- events
- tool calls
- verification results

Migrations must be reproducible.

Do not use flat JSON files as the only operational state.

---

## 9. Diff Capture

Capture:

```text
git status before
git status after
changed files
additions
deletions
unified diff
```

Required question:

> What did the agent change?

The diff must be tied to a `run_id`.

---

## 10. Verification Runner

Support task-defined verification commands.

Each verification execution must record:

```text
name
command
exit_code
stdout
stderr
duration
status
```

Initial supported categories:

- test
- lint
- typecheck
- build
- custom

The system must not mark a run successful solely because the agent claims completion.

---

## 11. Canonical Fixture

Create one deterministic fixture.

Recommended example:

> Fix a bug in a small TypeScript project where one test fails and the intended behavior is objectively verifiable.

The fixture must:

- initialize quickly
- be resettable
- produce an actual diff
- have deterministic verification
- expose a clear failure when incorrectly implemented

---

## 12. CLI / Developer Entry Point

Provide a minimal entry point.

Example:

```bash
w2 run fixtures/basic-bug/task.json
```

or equivalent.

The command must:

1. load task
2. prepare context
3. invoke agent
4. capture tools
5. capture diff
6. run verification
7. persist result
8. print run ID and final state

---

## 13. Failure Handling

Handle at minimum:

- invalid task
- agent failure
- tool failure
- verification failure
- timeout
- process interruption where practical

Infrastructure failure must never be represented as a successful run.

---

## 14. Non-Goals

Do not build yet:

- AI Evidence Mapper
- Run Receipt final format
- polished web UI
- benchmark suite
- sandbox
- permission approvals
- multi-agent system
- submission site

---

## 15. Acceptance Criteria

### Run Engine
- [ ] A structured task can be executed end-to-end.
- [ ] Every run receives a persistent `run_id`.
- [ ] Run state is stored in SQLite.
- [ ] State transitions are explicit.

### Context
- [ ] Context manifest is persisted.
- [ ] Included sources are inspectable.
- [ ] Context size is recorded.

### Agent
- [ ] Codex integration exists behind an adapter boundary.
- [ ] Agent failure is captured correctly.

### Tools
- [ ] Filesystem operations are traced.
- [ ] Shell operations are traced.
- [ ] Git status/diff are available.

### Trace
- [ ] Events are ordered by sequence.
- [ ] Trace survives process completion.
- [ ] Errors appear in the trace.

### Diff
- [ ] Before/after git state is recorded.
- [ ] Changed files are persisted.
- [ ] Unified diff is persisted or reconstructable.

### Verification
- [ ] Required commands execute automatically.
- [ ] Exit codes and outputs are recorded.
- [ ] Verification failure cannot be represented as successful completion.

### Regression
- [ ] Canonical fixture exists.
- [ ] Canonical fixture can be reset.
- [ ] Five consecutive infrastructure-clean runs succeed in producing complete evidence.

---

## 16. Required Artifacts

```text
/docs/RUN-CONTRACT.md
/docs/CONTEXT-MANIFEST.md
/docs/AGENT-ADAPTER.md
/docs/EVENT-MODEL.md
/fixtures/canonical/
/tests/core/
/tests/integration/
```

---

## 17. Exit Evidence

Must include:

1. one complete run ID
2. context manifest
3. ordered trace
4. tool call records
5. git diff
6. verification results
7. persisted SQLite state
8. five-run regression summary

---

## 18. Phase Lock

**STOP after Phase 01.**

Do not begin Evidence Engine work until all blocking criteria pass.
