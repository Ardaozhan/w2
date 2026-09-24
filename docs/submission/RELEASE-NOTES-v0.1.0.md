# W2 v0.1.0

**First competition-ready source release.**

W2 is a verification layer for coding agents. It turns a run into a receipt that shows the task, W2-supplied context, recognized events, repository diff, verification results, acceptance evidence, and a deterministic outcome.

## Highlights

- Evidence-backed JSON and Markdown Run Receipts.
- Deterministic `PASS`, `FAIL`, `UNPROVEN`, `ABORTED`, and `ERROR` outcomes.
- Windows interactive Codex mode using native `UserPromptSubmit`, `Stop`, `Interrupt`, and `SessionEnd` hooks.
- Automatic capture of explicitly headed acceptance criteria, with verifier mapping limited to criteria that directly assert a discovered command passes.
- Git diff evidence, detected project checks, and manual task-to-verifier mappings.
- SQLite-backed local run state and privacy-conscious local runtime directories.
- Offline static judge demo and stored REAL_CODEX PASS and UNPROVEN examples.
- MIT-licensed source; npm publication remains disabled with `private: true`.

## Known limitations

- Windows 11 with Node.js 22.13+ is the only independently verified environment.
- Interactive receipts are per assistant turn; prompt detection is heuristic.
- Semantic criteria without direct deterministic verifier evidence remain `UNPROVEN`.
- The Codex adapter does not capture exact file reads or every native operation.
- W2 is not an OS/container security boundary or correctness guarantee.
- The benchmark has one attempt per fixture and condition and is descriptive only.
- Node's built-in SQLite API is experimental in Node 22.
- No hosted repository URL or remote release target is configured in this checkout.

## Verification

The exact final test, typecheck, build, fresh-copy, standalone, receipt, benchmark, and privacy scan results are recorded in [`../W2-FINAL-REPORT.md`](../W2-FINAL-REPORT.md) after the release preparation checks complete.

## Not included

The demo video has intentionally not been created. See [`DEMO-SCRIPT.md`](DEMO-SCRIPT.md) for the 60–90 second recording plan.
