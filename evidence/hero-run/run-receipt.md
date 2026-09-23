# W2 RUN RECEIPT

- Receipt version: 1.0
- Run: `4a1a90fa-c013-4437-aa14-cc335b5a3062`
- Execution mode: REAL_CODEX
- Generated: 2026-09-23T17:53:13.063Z

## Task
**Implement login rate limiting**

Allow at most five failed login attempts per client during a rolling one-minute window. The sixth request from that client during the window must return HTTP 429. Preserve successful authentication behavior and keep the independent tests green.

## Context W2 provided
- 8/10 files selected for the prompt
- 1189 approximate tokens
- Exact repository files accessed by Codex: not captured by this adapter

## What the agent did
- 26 observable tool calls
- 136 ordered events
- 2 changed files

## Verification
- PASS per-client-rate-limit-behavior (exit 0)
- PASS http-sixth-attempt-429 (exit 0)
- PASS existing-auth-regression (exit 0)
- PASS rate-limit-test-presence (exit 0)

## Acceptance Evidence
- **PASS** AC-01: Each client may make five failed login attempts in one minute; the next attempt is rate limited, and another client has an independent counter. - Every referenced verifier passed with deterministic evidence.
- **PASS** AC-02: The sixth failed HTTP login request returns 429 after five 401 responses. - Every referenced verifier passed with deterministic evidence.
- **PASS** AC-03: Existing valid and invalid authentication behavior remains green. - Every referenced verifier passed with deterministic evidence.
- **PASS** AC-04: Automated rate-limit behavior and HTTP 429 tests are present and make their required assertions. - Every referenced verifier passed with deterministic evidence.

## Outcome
# PASS

**Why:** All required criteria have valid evidence.
