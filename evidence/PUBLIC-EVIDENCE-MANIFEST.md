# Public evidence manifest

This manifest lists the sanitized artifacts intended for judge review. No repository publication was performed. This checkout has no configured Git remote, so remote visibility cannot be verified here; the list is not publication authorization.

## Product and method

- [`README.md`](../README.md)
- [`docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md)
- [`docs/SECURITY-MODEL.md`](../docs/SECURITY-MODEL.md)
- [`docs/CONTEXT-MANIFEST.md`](../docs/CONTEXT-MANIFEST.md)
- [`docs/CLAIM-AUDIT.md`](../docs/CLAIM-AUDIT.md)
- [`docs/BENCHMARK-REPORT.md`](../docs/BENCHMARK-REPORT.md)
- [`docs/HERO-CASE-STUDY.md`](../docs/HERO-CASE-STUDY.md)
- [`docs/GPT56-CONTRIBUTION.md`](../docs/GPT56-CONTRIBUTION.md)
- [`docs/GPT56-FINAL-REVIEW.md`](../docs/GPT56-FINAL-REVIEW.md)
- [`docs/W2-FINAL-REPORT.md`](../docs/W2-FINAL-REPORT.md)

## Verified stored runs

- Hero REAL_CODEX PASS: all files in [`evidence/hero-run/`](hero-run/), including task, context, events, diff, verification, acceptance evidence, and Run Receipt.
- Semantic REAL_CODEX UNPROVEN: the newest live run's task, context, events, diff, verification, criterion evidence, receipt, and record; the record and receipt paths are referenced by [`evidence/demo/cases.json`](demo/cases.json).
- Canonical paired benchmark: [`benchmarks/results/results.json`](../benchmarks/results/results.json), [`benchmarks/results/results.csv`](../benchmarks/results/results.csv), the sanitized run records under `benchmarks/runs/{raw,w2}/<fixture>/`, the current W2 JSON/Markdown receipts, the shared task contracts and verifier fixtures under `benchmarks/fixtures/`, and the generated report. Raw Codex attempts have run records without W2 receipts.

## Judge demo and screenshots

- Static no-build demo: [`judge-demo/index.html`](../judge-demo/index.html), `judge-demo/assets/demo.css`, and the generated `judge-demo/assets/demo-data.js`.
- Current screenshots: [`hero-receipt.png`](screenshots/hero-receipt.png), [`semantic-unproven-receipt.png`](screenshots/semantic-unproven-receipt.png), [`context.png`](screenshots/context.png), [`trace.png`](screenshots/trace.png), [`diff.png`](screenshots/diff.png), [`verification.png`](screenshots/verification.png), [`acceptance-evidence.png`](screenshots/acceptance-evidence.png), [`benchmark.png`](screenshots/benchmark.png), [`static-judge-demo.png`](screenshots/static-judge-demo.png), and [`static-judge-demo-mobile.png`](screenshots/static-judge-demo-mobile.png).

## Excluded from this manifest

- Raw files under `benchmarks/archive/pre-hermetic-final/` are gitignored local archive data that can contain unsanitized pre-hermetic Codex output; the folder's small README is the only intended tracked item. No archived raw output is part of judge evidence.
- Superseded benchmark archives were removed from the current tracked tree and preserved only in that local ignored archive. Existing Git history has not been rewritten; any future public release requires a history-aware privacy review and explicit visibility/license decisions.
- Runtime databases, temporary workspaces, credentials, Codex home contents, and the live profile are not included.
