# W2 — Phase 00: Constitution & Foundation

## Status
**Gate:** BLOCKING  
**Purpose:** Lock the product thesis, scope, architecture boundaries, judging alignment, and repository standards before implementation begins.

> No Phase 01 implementation may begin until this phase is complete.

---

## 1. Product Thesis

W2 is:

> **An engineering harness for coding agents that turns every agent run into verifiable evidence.**

Primary product promise:

> **Know what the agent saw.  
> Know what it did.  
> Know whether it worked.**

Core artifact:

> **Run Receipt**

A Run Receipt is the human-readable and machine-readable record of a coding-agent run.

---

## 2. Problem Definition

Coding agents can:

- read large amounts of code
- invoke tools
- modify many files
- claim a task is complete

but developers may still lack a compact, trustworthy answer to:

1. What context influenced the run?
2. What actions actually happened?
3. What changed in the codebase?
4. What verification was executed?
5. Which acceptance criteria are actually proven?
6. Why did the system mark the run PASS / FAIL / UNPROVEN?

W2 exists to make those answers explicit.

---

## 3. Product Boundary

W2 is **not**:

- a replacement for Codex
- a new foundation model
- a generic autonomous AI operating system
- a multi-agent framework
- a project management tool
- a generic logging dashboard
- a CI/CD replacement
- a general-purpose RAG platform
- an IDE replacement

W2 is an **evidence and control layer around coding-agent execution**.

---

## 4. Competition Alignment

Every important implementation choice must contribute to at least one of:

### Technical Implementation
- agent integration
- structured context
- tool execution
- event trace
- deterministic verification
- evidence mapping
- run receipt generation
- permission boundaries

### Product / Design
- coherent run flow
- understandable evidence hierarchy
- fast judge demo
- clear inspection UI

### Potential Impact
- reduced false completion
- better verification coverage
- easier debugging
- easier code review
- better trust in coding-agent work

### Quality of Idea
- the “run receipt” abstraction
- evidence-first completion
- explicit PASS / FAIL / UNPROVEN semantics
- deterministic + AI evidence mapping

If a proposed feature does not materially strengthen one of these categories, defer it.

---

## 5. Core System Contract

Every W2 run must produce:

```text
TASK
↓
CONTEXT MANIFEST
↓
AGENT ACTIONS
↓
TOOL TRACE
↓
CODE DIFF
↓
VERIFICATION
↓
ACCEPTANCE EVIDENCE
↓
RUN RECEIPT
```

A coding agent saying “done” is never sufficient evidence.

---

## 6. Run Outcome Semantics

W2 must support exactly these top-level outcomes unless a later phase explicitly extends them:

```text
PASS
FAIL
UNPROVEN
ABORTED
ERROR
```

### PASS
All required acceptance criteria are proven by valid evidence.

### FAIL
At least one required acceptance criterion is contradicted by verification or deterministic evidence.

### UNPROVEN
No contradiction is known, but required evidence is missing or insufficient.

### ABORTED
The run was intentionally stopped.

### ERROR
Infrastructure or execution failure prevented a valid conclusion.

Never collapse `UNPROVEN` into `PASS`.

---

## 7. Deterministic vs AI Responsibilities

### Deterministic Layer

W2 itself owns facts such as:

- changed files
- git diff
- command exit codes
- test results
- lint results
- typecheck results
- build results
- tool call sequence
- timestamps
- runtime
- file access
- approval events

### AI Layer

GPT-5.6 may assist with:

- mapping evidence to acceptance criteria
- interpreting ambiguous evidence
- explaining why evidence is sufficient or insufficient
- summarizing a run

The model must never fabricate deterministic facts.

---

## 8. Initial Technology Direction

Default stack:

```text
TypeScript
Node.js
React / Next.js
Zod
SQLite
Drizzle
Vitest
Playwright
Git
OpenAI GPT-5.6
Codex integration
```

Changes are allowed only when there is a clear engineering reason.

Avoid technology churn.

---

## 9. Repository Shape

Recommended starting structure:

```text
w2/
├─ app/
├─ src/
│  ├─ core/
│  ├─ context/
│  ├─ agent/
│  ├─ tools/
│  ├─ trace/
│  ├─ verification/
│  ├─ evidence/
│  ├─ receipt/
│  └─ db/
├─ tests/
├─ fixtures/
├─ benchmarks/
├─ docs/
├─ evidence/
├─ README.md
└─ package.json
```

The actual structure may evolve, but responsibilities must stay clear.

---

## 10. Naming

Use `W2` consistently as the product name during development.

Do not create alternate product names during the implementation phases.

Final branding may be revisited only during the submission phase if necessary.

---

## 11. Engineering Principles

1. Evidence before claims.
2. Deterministic facts before model interpretation.
3. One agent before multi-agent.
4. One clear execution path before extensibility.
5. Explicit state before implicit state.
6. Reproducibility before polish.
7. Scope discipline before feature count.
8. Real failures are retained, not hidden.
9. Every PASS must be explainable.
10. Every public metric must be traceable to raw data.

---

## 12. Explicit Non-Goals for v1

Do not build during the competition version:

- multi-agent orchestration
- vector database
- enterprise RBAC
- cloud fleet execution
- plugin marketplace
- multiple coding-agent providers unless needed
- broad IDE integration
- team collaboration
- autonomous project planning
- speculative memory system
- mobile application
- complex billing
- large analytics platform

---

## 13. Required Foundation Documents

Create:

```text
/docs/PRODUCT-THESIS.md
/docs/ARCHITECTURE.md
/docs/COMPETITION-MATRIX.md
/docs/SCOPE.md
/docs/DECISIONS.md
/docs/PHASE-STATUS.md
```

### `PRODUCT-THESIS.md`
Must state:
- problem
- user
- solution
- Run Receipt concept
- differentiator

### `ARCHITECTURE.md`
Must show:
- main components
- data flow
- deterministic vs AI boundaries

### `COMPETITION-MATRIX.md`
Must map:
- judging criterion
- W2 capability
- required evidence
- current status

### `SCOPE.md`
Must contain:
- in-scope
- out-of-scope
- deferred work

### `DECISIONS.md`
Use lightweight ADR-style entries for important architecture decisions.

### `PHASE-STATUS.md`
Initial state:

```text
Phase 00 — IN PROGRESS
Phase 01 — LOCKED
Phase 02 — LOCKED
Phase 03 — LOCKED
Phase 04 — LOCKED
Phase 05 — LOCKED
Phase 06 — LOCKED
```

---

## 14. Acceptance Criteria

- [ ] Product thesis is written and unambiguous.
- [ ] Run Receipt is defined as the core product artifact.
- [ ] PASS / FAIL / UNPROVEN semantics are documented.
- [ ] Deterministic and AI responsibilities are separated.
- [ ] Competition criteria are mapped to W2 capabilities.
- [ ] v1 non-goals are explicit.
- [ ] Repository structure is initialized.
- [ ] Core technology stack is initialized.
- [ ] `PHASE-STATUS.md` exists.
- [ ] No Phase 01 feature implementation has started prematurely.
- [ ] Project installs successfully from a clean checkout.
- [ ] Base test command runs successfully, even if the suite is initially minimal.
- [ ] No secrets are committed.

---

## 15. Required Exit Evidence

Before Phase 00 can close:

1. repository tree
2. successful install output
3. successful base test command
4. all required foundation documents
5. competition matrix
6. scope document
7. phase status file

---

## 16. Phase Lock

**STOP after Phase 00.**

Do not begin Phase 01 automatically.

Phase 01 can start only after every acceptance criterion above is verified and Phase 00 is marked `COMPLETE`.
