# Hero Case Study: Login Rate Limiting

## Task

Implement a per-client login limit: allow five failed attempts in a rolling minute, return HTTP 429 on the sixth request, preserve valid and invalid authentication behavior, and keep the independent tests green.

The stored task contract names four required acceptance criteria and four verifier IDs. It limits the intended code diff to `src/rateLimit.ts` and `src/app.ts`, and forbids changing the supplied tests and verifiers.

## Acceptance Criteria

| Criterion | Declared verifier | Stored result |
|---|---|---|
| AC-01: five failures per client, sixth limited, separate client counters | V1 behavior test | PASS |
| AC-02: sixth failed HTTP request returns 429 after five 401 responses | V2 HTTP test | PASS |
| AC-03: existing valid and invalid authentication behavior | V3 auth regression | PASS |
| AC-04: required rate-limit tests and assertions are present | V4 test-file verifier | PASS |

The RunEngine attached evidence from each declared verifier result. No demo-only mapping was supplied.

## Real Codex Actions

The stored event stream is marked `REAL_CODEX`. It records Codex adding per-client failure timestamps with a 60-second expiry and using one request timestamp for the limit decision and failure record. The captured diff changes only the two allowed source files; the supplied tests remain unchanged.

## Diff

- `src/rateLimit.ts`
- `src/app.ts`

The limiter retains active failures per client, expires timestamps outside the one-minute window, blocks after five active failures, and counts failed authentication attempts only.

## Verification

W2 ran V1, V2, V3, and V4 as independent declared verification commands. All returned exit code 0. The exact stored results appear in the [Run Receipt](../evidence/hero-run/run-receipt.json).

Codex's own attempt to launch the test runner reported `spawn EPERM`. W2's declared verifiers ran independently after the agent execution; those stored results are the receipt evidence. The first Markdown export attempt raised a renderer error after the JSON receipt had been persisted. The JSON was validated, the Markdown was regenerated from that receipt, and the recovery is recorded in `persistence-recovery.json`. `npm run hero:validate` validates the current stored package.

## Criterion Evidence

Every required criterion has deterministic evidence from its referenced verifier. AC-01 through AC-04 are `PASS`; the receipt validator recomputes the mapping from canonical verifier records. The task outcome is not selected by Codex's completion message.

## Final Run Receipt

- Run ID: `4a1a90fa-c013-4437-aa14-cc335b5a3062`
- Execution mode: `REAL_CODEX`
- Outcome: `PASS`
- JSON: [`run-receipt.json`](../evidence/hero-run/run-receipt.json)
- Markdown: [`run-receipt.md`](../evidence/hero-run/run-receipt.md)

## Why W2 Matters

The receipt connects each task criterion to the exact declared verifier result and shows the diff beside that evidence. A reviewer can inspect why this run passed instead of relying on an agent's completion claim or a generic green test suite.

## Limits

This is a small in-memory fixture. It does not cover persistence across server restarts, shared limits across multiple server instances, forwarded-client identity configuration, or an operational security review. The context manifest does not reveal every file Codex read; this adapter does not expose a complete file-read trace.
