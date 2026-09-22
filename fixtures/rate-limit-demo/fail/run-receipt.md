# W2 RUN RECEIPT

- Receipt version: 1.0
- Run: `rate-limit-fail`
- Generated: 2026-09-22T10:00:03.000Z

## Task
**Implement login rate limiting**

Limit login attempts to five per minute and return HTTP 429 after the limit.

## What the agent saw
- 0/0 files supplied
- 0 approximate tokens

## What the agent did
- 0 tool calls
- 1 ordered events
- 1 changed files

## Verification
- PASS auth tests (exit 0)

## Acceptance Evidence
- **FAIL** AC-01: Maximum five attempts per minute — External assertion contradicts the limit.
- **PASS** AC-02: HTTP 429 is returned after the limit — Recorded auth tests cover the response.

## Outcome
# FAIL

**Why:** External assertion contradicts the limit.
