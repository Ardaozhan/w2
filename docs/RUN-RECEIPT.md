# W2 Run Receipt

Run Receipts are versioned JSON records and a compact Markdown rendering of one
persisted run. They answer:

1. What context did W2 provide? (`context`; it does not prove exact Codex file access)
2. What did it do? (`actions` and `changes`)
3. Did it work? (`verification`, `acceptance`, and deterministic `outcome`)

The receipt includes the task, model and run state, context counts, ordered
event/tool counts, diff summary, verification output, all evidence records, and
criterion-level acceptance evidence. `validateReceipt` checks run identity,
evidence references, PASS/FAIL evidence requirements, and recomputes the final
outcome. A receipt that fails validation is not a final artifact.

Generate a receipt from a stored run with:

```text
npm run build
npm run w2 -- receipt <run-id> --db .w2/runs.sqlite --out receipts
```

The Phase 02 fixture command creates synthetic `FAKE_ADAPTER` PASS, FAIL, and
UNPROVEN test inputs through the current RunEngine receipt builder. They are
not REAL_CODEX evidence or benchmark results. Raw evidence lives beside each
fixture receipt; the temporary SQLite database is removed after generation.
