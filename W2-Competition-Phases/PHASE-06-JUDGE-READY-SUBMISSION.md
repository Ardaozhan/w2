# W2 — Phase 06: Judge-Ready Submission

## Status
**Final Phase**  
**Prerequisite:** Phases 00–05 must be COMPLETE.

---

## 1. Objective

Package W2 into a competition submission that is:

- technically credible
- reproducible
- easy to understand
- easy to test
- evidence-backed
- visually coherent
- honest about limitations

Formula:

```text
PRODUCT
+
EVIDENCE
+
STORY
```

---

## 2. Final Positioning

Primary positioning:

> **W2 is an engineering harness for coding agents that turns every run into verifiable evidence.**

Primary message:

> **Know what the agent saw.  
> Know what it did.  
> Know whether it worked.**

Core product concept:

> **Run Receipt**

Avoid alternate positioning unless competition language requires adaptation.

---

## 3. README

Recommended structure:

### Hero
Project name + one-sentence value proposition.

### Problem
Why coding-agent completion is difficult to trust.

### Solution
W2 + Run Receipt.

### Demo
Fastest path to working product.

### Core Flow

```text
TASK
→ CONTEXT
→ AGENT
→ TOOLS
→ DIFF
→ VERIFICATION
→ EVIDENCE
→ RUN RECEIPT
```

### Screenshots
Curated, current.

### Benchmark
Evidence-backed summary.

### Architecture
High-level diagram.

### Installation
Exact commands.

### Usage
Minimal real example.

### Security / Limitations
Accurate scope.

### Documentation
Links.

---

## 4. One-Command Demo

Aim for one entry point:

```bash
npm run demo
```

or equivalent.

It must:

- detect missing prerequisites
- fail clearly
- avoid hidden manual steps
- load a meaningful W2 example
- surface the Run Receipt

---

## 5. Fresh Clone Test

Perform from a clean directory:

```text
clone
install
configure
run tests
run demo
run canonical fixture
```

Every undocumented manual step is a bug in submission packaging.

---

## 6. Repository Hygiene

Before submission:

- remove secrets
- remove stale screenshots
- remove dead code
- remove unused packages
- remove machine-specific paths
- remove old benchmark data
- remove abandoned experiments
- verify gitignore
- verify license if appropriate
- verify clean install

---

## 7. Application Documents

Prepare:

```text
/docs/application/PROJECT-SUMMARY.md
/docs/application/TECHNICAL-SUMMARY.md
/docs/application/IMPACT.md
/docs/application/AI-CONTRIBUTION.md
/docs/application/LIMITATIONS.md
```

---

## 8. Project Summary

Must answer:

1. What problem exists?
2. Who experiences it?
3. What is W2?
4. What is a Run Receipt?
5. Why is W2 technically interesting?
6. What evidence shows it works?
7. How is it different?

---

## 9. Technical Summary

Explain:

- Run Engine
- Context Manifest
- Codex Adapter
- Tool Runtime
- Event Store
- Diff Capture
- Verification
- Evidence Engine
- GPT-5.6 Evidence Mapper
- Outcome Engine
- Run Receipt
- Permission model
- benchmark methodology

Separate implemented behavior from roadmap.

---

## 10. AI Contribution

Truthfully document:

- what Codex assisted with
- what GPT-5.6 does inside the product
- architecture decisions made by the developer
- human review
- benchmark validation
- generated code/assets where relevant

Do not minimize or exaggerate AI involvement.

---

## 11. Screenshots

Curated set:

1. Run Receipt overview
2. Context Inspector
3. Trace
4. Diff + Verification
5. Acceptance Evidence
6. Benchmark comparison

Only use real current product data.

---

## 12. Architecture Diagram

Create one clean diagram showing:

```text
USER TASK
↓
RUN ENGINE
├─ CONTEXT ENGINE
├─ CODEX ADAPTER
├─ TOOL RUNTIME
└─ EVENT STORE
↓
DIFF + VERIFICATION
↓
EVIDENCE ENGINE
↓
GPT-5.6 EVIDENCE MAPPER
↓
OUTCOME ENGINE
↓
RUN RECEIPT
↓
UI / JSON / MARKDOWN
```

---

## 13. Demo Video

Use the real product.

Recommended structure:

### 0:00–0:15 — Hook
Show agent completion vs W2 evidence.

### 0:15–0:35 — Problem
Explain the trust gap.

### 0:35–1:25 — Run
Show W2 processing a task.

### 1:25–1:55 — Inspection
Context, trace, diff.

### 1:55–2:20 — Verification
Criteria and evidence.

### 2:20–2:45 — Benchmark
Raw Codex vs W2.

### Final
Close with the three-question thesis.

Cut loading time.

Do not use fake UI or simulated metrics.

---

## 14. Competition Matrix Audit

For each judging criterion, create a final proof map.

Example:

| Criterion | W2 Proof | Asset |
|---|---|---|
| Technical Implementation | Run Engine + Evidence Engine | repo/demo |
| Design | Run Receipt UX | demo/screens |
| Impact | benchmark | report/video |
| Quality of Idea | evidence-first coding-agent harness | summary/demo |

No criterion should rely only on marketing copy.

---

## 15. Claim Audit

Search all public materials for terms such as:

```text
best
first
secure
safe
faster
more reliable
improves
reduces
production-ready
```

For every claim:

```text
evidence exists
or
rewrite/remove
```

---

## 16. Judge Simulation

Run one full simulation.

Reviewer has only:

- submission page
- demo video
- repository

They must be able to:

1. understand W2
2. understand Run Receipt
3. see the working product
4. install/run it
5. inspect benchmark evidence
6. understand architecture
7. verify claims
8. identify limitations

Record friction and fix only high-impact issues.

---

## 17. Freeze

Apply:

```text
feature freeze
benchmark freeze
copy freeze
video freeze
```

After freeze:

- only blocking fixes
- any benchmark-affecting code change requires rerun
- any UI screenshot-affecting change requires screenshot refresh
- docs must match current code

---

## 18. Final Acceptance Criteria

### Product
- [ ] Canonical run works.
- [ ] Run Receipt integrity validates.
- [ ] Demo works.
- [ ] Main UI paths work.
- [ ] No critical placeholder remains.

### Evidence
- [ ] Benchmark is reproducible.
- [ ] Public numbers match raw data.
- [ ] Case study is real.
- [ ] Limitations are documented.

### Repository
- [ ] Fresh clone works.
- [ ] Tests pass.
- [ ] No secrets.
- [ ] No stale artifacts.
- [ ] README is current.

### Submission
- [ ] Project summary complete.
- [ ] Technical summary complete.
- [ ] Impact document complete.
- [ ] AI contribution document complete.
- [ ] Limitations complete.
- [ ] Demo video uses real product.
- [ ] Screenshots are current.
- [ ] Architecture visual is readable.
- [ ] Competition matrix is fully mapped.

### Story
- [ ] Problem is understandable quickly.
- [ ] W2 positioning is consistent.
- [ ] Run Receipt is memorable and clear.
- [ ] Technical depth is visible.
- [ ] Claims are evidence-backed.

---

## 19. Final Standard

The submission must let a judge conclude from evidence:

```text
The problem is real.
The product is coherent.
The engineering is substantial.
The AI is used meaningfully.
The output is verifiable.
The benchmark is reproducible.
The claims are honest.
The idea is differentiated.
```

---

## 20. Final Rule

Do not introduce new major features in Phase 06.

This phase is about:

```text
clarity
evidence
reproducibility
presentation
```

Not scope expansion.
