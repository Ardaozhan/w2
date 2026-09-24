# Judge Walkthrough

1. Read `README.md` and identify W2's evidence-first product claim.
2. Open the no-build `judge-demo/index.html` or run `npm run judge-demo:serve`.
3. Inspect the stored REAL_CODEX hero PASS receipt and its four verifier-linked criteria.
4. Switch to the stored REAL_CODEX semantic UNPROVEN example and inspect the unmapped required criterion.
5. Open Context, Trace, Diff, Verification, Acceptance Evidence, and Benchmark in the demo.
6. Run `npm ci`, `npm test`, `npm run typecheck`, and `npm run build`.
7. Run the benchmark, hero, public-artifact, standalone, receipt, and fresh-copy validators listed in the README.

The judge demo is a static replay of stored evidence; it does not start Codex. The separate live-run commands require an authenticated Codex CLI. W2 reports exact Codex file access as unknown unless supported telemetry establishes it.
