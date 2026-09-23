# Hero case study: login rate limiting

## Task

Implement a per-client login limit: allow five failed attempts in a rolling minute, then return HTTP 429 on the next request. Keep existing authentication behavior and add independent behavior checks.

## Why it matters

Authentication changes often affect more than a helper function. The result needs to preserve valid logins, isolate clients, reset limits on time, and expose the correct HTTP response.

## Acceptance criteria

| Criterion | Deterministic verifier | Result |
|---|---|---|
| AC-01: five failed attempts per client, sixth limited, clients isolated | V1 behavior test | PASS |
| AC-02: sixth failed HTTP request returns 429 after five 401 responses | V2 HTTP test | PASS |
| AC-03: existing valid and invalid authentication behavior | V3 auth regression | PASS |
| AC-04: automated rate-limit tests and required assertions are present | V4 test-file verifier | PASS |

These references are part of the task contract. The RunEngine created the criterion evidence from the stored verifier results; the demo does not supply a separate mapping.

## What Codex did

The stored `REAL_CODEX` event stream shows Codex added per-client failure timestamps with a 60-second expiry and captured one request timestamp for both the limit check and failure record. It changed only `src/rateLimit.ts` and `src/app.ts`; supplied tests stayed unchanged.

## What changed

The limiter now retains active failures per client, drops timestamps at the one-minute cutoff, blocks after five active failures, and records only failed authentication attempts. The request handler uses one timestamp for the limit decision and the subsequent failed-login update.

## What verification ran

W2 ran V1, V2, V3, and V4 as independent declared verification commands. Each returned exit code 0. The exact result and output are in the receipt. Codex's own attempt to launch the test runner reported `spawn EPERM`; the W2 verification results are separate records produced after agent execution.

The first Markdown export attempt raised a renderer error after the REAL_CODEX JSON receipt had been persisted. The saved JSON was validated, the Markdown was regenerated from that exact receipt, and the recovery is recorded in `persistence-recovery.json`. The export path was then fixed to validate and render before replacing artifacts. `npm run hero:validate` checks the final stored package.

## What W2 proved

Every required criterion is attached to deterministic verifier evidence. AC-01 through AC-04 are `PASS`, and the computed receipt outcome is `PASS`. The changed-file list contains only the two allowed paths.

## What W2 refused to infer

The context manifest records which files W2 considered, selected, and provided. This adapter does not expose exact Codex file-read access, so the receipt does not claim a complete read trace. The verifier evidence proves this fixture's declared cases; it does not establish distributed, persistent, or production deployment behavior.

## Final Run Receipt

- Run ID: `4a1a90fa-c013-4437-aa14-cc335b5a3062`
- Execution mode: `REAL_CODEX`
- Outcome: `PASS`
- Stored receipt: [`run-receipt.json`](../evidence/hero-run/run-receipt.json)
- Human-readable receipt: [`run-receipt.md`](../evidence/hero-run/run-receipt.md)

## Limitations

This is a small in-memory fixture. It does not cover persistence across server restarts, shared limits across multiple server instances, forwarded client identity configuration, or an operational security review.
