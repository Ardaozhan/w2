# W2 — Phase 05: Product UX & Judge Demo

## Status
**Gate:** BLOCKING  
**Prerequisite:** Benchmark evidence must be stable enough to drive the product story.

---

## 1. Objective

Turn W2 into a coherent, judge-friendly developer product.

The UI exists to answer three questions:

> What did the agent see?  
> What did it do?  
> Did it work?

The Run Receipt is the center of the experience.

---

## 2. Product Flow

Primary flow:

```text
CREATE / SELECT TASK
↓
START RUN
↓
LIVE EXECUTION
↓
RUN RECEIPT
↓
INSPECT EVIDENCE
```

Do not design a generic analytics dashboard.

---

## 3. Primary Views

Recommended:

```text
Runs
Run Detail / Receipt
Context
Trace
Diff
Verification
Acceptance Evidence
Benchmarks
Settings
```

---

## 4. Runs View

Show:

- task
- status
- outcome
- duration
- files changed
- verification summary
- created time

Outcome semantics must be obvious:

```text
PASS
FAIL
UNPROVEN
ABORTED
ERROR
```

Do not use vague “success-like” visuals for UNPROVEN.

---

## 5. Run Receipt View

This is the hero screen.

Recommended sections:

### Header
```text
run ID
task
agent/model
outcome
duration
```

### What the Agent Saw
```text
context sources
files
size
selection summary
```

### What the Agent Did
```text
tool calls
timeline
changed files
diff
```

### Did It Work?
```text
verification
acceptance criteria
evidence
final outcome
```

---

## 6. Context Inspector

Show:

- included files
- included sections
- selection rationale
- size
- excluded items due to budget if applicable

Allow drill-down to raw context where practical.

---

## 7. Trace Inspector

Chronological timeline.

Each event:

```text
time
type
tool/model
input summary
output summary
duration
status
```

Highlight:

- error
- retry
- approval
- verification
- boundary violation

---

## 8. Diff Inspector

Show:

- changed files
- additions/deletions
- unified diff
- link from tool event to resulting change where possible

The reviewer should be able to follow:

```text
action
→
change
→
verification
```

---

## 9. Verification

Show each check independently.

Example:

```text
Tests       PASS
Lint        PASS
Typecheck   PASS
API Probe   FAIL
```

Each item exposes:

- command/probe
- result
- duration
- exit code
- logs/evidence

---

## 10. Acceptance Evidence

Show every acceptance criterion:

```text
AC-01 PASS
Evidence: ev_17, ev_22

AC-02 UNPROVEN
Reason: no evidence verifies 429 behavior
```

Do not use opaque AI scores.

---

## 11. Benchmark View

Show only evidence-backed metrics.

Recommended:

- false DONE
- task pass rate
- criterion evidence coverage
- verification coverage
- runtime overhead

Provide access to methodology.

---

## 12. Demo Mode

Create a judge-safe deterministic entry point.

Example:

```bash
npm run demo
```

or:

```bash
w2 demo
```

Demo must:

1. load known fixture
2. execute or replay a clearly labeled real captured run
3. open/show receipt
4. expose context
5. expose trace
6. expose diff
7. expose verification
8. expose acceptance evidence

If replay is used, label it as replay.

---

## 13. Demo Story

Target video sequence:

### 0:00–0:15
Show result first.

```text
Agent: DONE
W2: UNPROVEN / FAIL
```

### 0:15–0:35
Explain the problem.

### 0:35–1:25
Show real run.

### 1:25–1:55
Inspect context, trace, diff.

### 1:55–2:20
Show verification and acceptance evidence.

### 2:20–2:45
Show benchmark comparison.

### 2:45–End
Close on:

> Know what the agent saw.  
> Know what it did.  
> Know whether it worked.

---

## 14. Visual Standard

Target:

- developer-tool clarity
- dense but readable
- restrained visual design
- excellent hierarchy
- real data
- no ornamental clutter
- no fake terminal animation

Every visual component should improve comprehension.

---

## 15. Error States

Implement:

- no runs
- failed run
- missing context
- verification not configured
- approval required
- budget exceeded
- interrupted run
- receipt integrity failure
- benchmark unavailable

Never show unexplained blank states.

---

## 16. Accessibility

Minimum:

- keyboard-accessible primary actions
- visible focus
- readable contrast
- color-independent status labels
- laptop-friendly layout
- responsive enough for common judging screens

---

## 17. Usability Test

Run at least 3 lightweight tests if possible.

Without architecture explanation, ask users:

1. What was the task?
2. What context did the agent see?
3. What changed?
4. Did verification pass?
5. Why did W2 choose this outcome?

Fix repeated confusion.

---

## 18. Non-Goals

Do not add:

- collaboration
- comments
- team analytics
- social features
- complex theming
- visual node editor
- unrelated dashboards

---

## 19. Acceptance Criteria

### Core UX
- [ ] Run Receipt is the primary view.
- [ ] A reviewer can identify outcome immediately.
- [ ] Context is inspectable.
- [ ] Trace is inspectable.
- [ ] Diff is inspectable.
- [ ] Verification is inspectable.
- [ ] Acceptance evidence is inspectable.

### Truthfulness
- [ ] UI values come from persisted data.
- [ ] No fake metrics.
- [ ] No fake runs.
- [ ] UNPROVEN cannot be mistaken for PASS.

### Demo
- [ ] Demo starts quickly.
- [ ] Demo fixture is reproducible.
- [ ] Demo shows a meaningful evidence story.
- [ ] Judge can reach the core experience without hidden setup.

### Robustness
- [ ] Error states exist.
- [ ] Empty states exist.
- [ ] Interrupted runs render.
- [ ] Receipt integrity errors render.

### Quality
- [ ] No placeholder primary controls.
- [ ] No stale benchmark values.
- [ ] No broken primary navigation.

---

## 20. Required Artifacts

```text
/docs/PRODUCT-UX.md
/docs/DEMO-FLOW.md
/demo/
/tests/ui/
/evidence/screenshots/
```

Optional:

```text
/docs/USABILITY.md
```

---

## 21. Phase Lock

**STOP after Phase 05.**

No new major product feature may begin after this phase unless it fixes a submission-blocking weakness.
