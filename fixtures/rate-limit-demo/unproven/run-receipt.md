# W2 RUN RECEIPT

- Receipt version: 1.0
- Run: `rate-limit-unproven`
- Execution mode: FAKE_ADAPTER
- Generated: 2026-09-22T10:00:03.000Z

## Task
**Implement login rate limiting**

Limit login attempts to five per minute and return HTTP 429 after the limit.

## Context W2 provided
- 0/0 files selected for the prompt
- 0 approximate tokens
- Exact repository files accessed by Codex: not captured by this adapter

## What the agent did
- 0 observable tool calls
- 1 ordered events
- 1 changed files

## Verification
- PASS per-client-rate-limit (exit 0)
- PASS sixth-attempt-http-429 (exit 0)

## Acceptance Evidence
- **PASS** AC-01: At most five failed attempts per client are accepted in one minute. - Every referenced verifier passed with deterministic evidence.
- **UNPROVEN** AC-02: The sixth failed HTTP login attempt returns 429. - No verifier is mapped to this criterion.

## Outcome
# UNPROVEN

**Why:** No verifier is mapped to this criterion.
