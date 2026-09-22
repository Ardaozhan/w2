# Judge Simulation

1. Read `README.md` and identify the three-question thesis.
2. Run `npm ci` and `npm run demo`.
3. Confirm the hero receipt says `UNPROVEN`, not a vague success state.
4. Open Context, Trace, Diff, Verification, Acceptance Evidence, and Benchmark tabs.
5. Run `npm test`, `npm run typecheck`, and `npm run build`.
6. Run `npm run benchmark:validate` and `npm run benchmark:verify`.
7. Inspect the proof map, claim audit, limitations, and stored raw run records.

Observed friction: the demo is local and read-only, and the benchmark sample records Codex timeouts. Both are called out explicitly rather than hidden behind a hosted or synthetic flow.

Final audit command: `npm run phase06:audit`.
