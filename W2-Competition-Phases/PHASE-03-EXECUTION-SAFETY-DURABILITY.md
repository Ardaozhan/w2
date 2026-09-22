# W2 — Phase 03: Execution Safety & Durability

## Status
**Gate:** BLOCKING  
**Prerequisite:** Phase 02 must be COMPLETE.

---

## 1. Objective

Add credible control boundaries around agent execution and ensure long-running work does not collapse when interrupted.

This phase protects the integrity of the evidence W2 produces.

---

## 2. Permission Model

Define capabilities such as:

```text
fs.read
fs.write
fs.delete
shell.execute
git.read
git.write
network.read
network.write
secret.read
external.write
```

Default policy:

> Minimum capability required.

High-risk operations must not execute silently.

---

## 3. Workspace Boundary

The agent must have an explicit workspace root.

Required protections:

- path traversal prevention
- symlink escape handling
- canonical path validation
- outside-workspace write rejection
- outside-workspace delete rejection

Rejected actions must appear in the trace.

---

## 4. Approval Gates

Require explicit approval for selected risky actions.

At minimum consider gating:

- destructive delete
- git commit
- git push
- network write
- external API write
- elevated shell action

Approval record:

```text
approval_id
run_id
action
risk
reason
status
requested_at
resolved_at
```

---

## 5. Shell Controls

Implement:

- working-directory restriction
- timeout
- output size limit
- environment filtering
- exit code capture
- child process cleanup where feasible

Avoid pretending that a simple string blocklist is a sandbox.

---

## 6. Secrets

Secrets must not enter normal model context by default.

Requirements:

- separate secret access
- log redaction
- trace redaction
- environment redaction
- secret-leak regression tests

Never store real secrets in fixtures.

---

## 7. Runtime Budgets

Add:

```text
max_steps
max_tool_calls
max_runtime
max_output_bytes
max_context_size
```

Optional if reliably measurable:

```text
max_tokens
max_estimated_cost
```

Budget exhaustion must produce an explicit terminal state and receipt explanation.

---

## 8. Retry Policy

Retries must be bounded and observable.

Store:

```text
attempt
cause
decision
result
```

No recursive unbounded retry loop.

---

## 9. Checkpoint

Persist checkpoints sufficient to recover from interruption.

Minimum:

```text
run state
current sequence
context manifest
completed tool calls
workspace reference
verification progress
pending approvals
```

---

## 10. Resume

Resume behavior must:

- continue from persisted state
- avoid replaying completed destructive actions
- preserve original run identity or clearly link resumed runs
- keep trace continuity

---

## 11. Abort

Provide a user-controlled abort.

On abort:

- stop new work
- terminate active execution where feasible
- persist final state
- generate an `ABORTED` receipt
- retain evidence collected so far

---

## 12. Sandbox

If feasible within competition scope, isolate command execution using:

- Docker container, or
- dedicated disposable workspace with restricted permissions

Document actual guarantees accurately.

Do not use the phrase “secure sandbox” unless implementation supports that claim.

---

## 13. Security Regression Cases

Test at minimum:

1. `../` path traversal
2. symlink escape
3. unauthorized external write
4. denied approval
5. shell timeout
6. large output
7. secret leakage
8. runaway tool loop
9. interrupted run
10. resumed run
11. abort
12. budget exceeded

---

## 14. Receipt Integration

Run Receipts must record:

- permission denials
- approval events
- budget exhaustion
- resume events
- abort
- execution errors

Safety events are part of run evidence.

---

## 15. Non-Goals

Do not build:

- enterprise IAM
- organizational policy management
- remote fleet sandbox orchestration
- zero-trust network product
- compliance certification
- broad secrets platform

---

## 16. Acceptance Criteria

### Permissions
- [ ] Tools declare required capabilities.
- [ ] High-risk operations can require approval.
- [ ] Denied actions never execute.

### Workspace
- [ ] Path traversal is blocked.
- [ ] Symlink escape is tested.
- [ ] External writes are rejected by default.

### Shell
- [ ] Timeouts work.
- [ ] Output limits work.
- [ ] Exit codes are retained.

### Secrets
- [ ] Secrets are not injected into normal context.
- [ ] Traces redact secret values.
- [ ] Leakage regression test passes.

### Budgets
- [ ] Step limit exists.
- [ ] Tool-call limit exists.
- [ ] Runtime limit exists.
- [ ] Exhaustion is visible in the receipt.

### Durability
- [ ] Controlled interruption can be resumed.
- [ ] Completed actions are not blindly replayed.
- [ ] Abort persists a valid final state.

### Evidence
- [ ] Safety events appear in trace.
- [ ] Safety events appear in Run Receipt where relevant.

---

## 17. Required Artifacts

```text
/docs/SECURITY-MODEL.md
/docs/PERMISSIONS.md
/docs/RUNTIME-BUDGETS.md
/docs/RESUME.md
/tests/security/
/tests/durability/
```

---

## 18. Exit Evidence

Demonstrate repeatably:

1. allowed workspace write
2. denied external write
3. approval-gated action
4. timeout
5. secret redaction
6. budget exhaustion
7. interrupted run
8. successful resume
9. explicit abort receipt

---

## 19. Phase Lock

**STOP after Phase 03.**

Do not start benchmark optimization or product polish while safety and durability tests are red.
