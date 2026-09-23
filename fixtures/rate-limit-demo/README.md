# Synthetic receipt fixtures

The `pass`, `fail`, and `unproven` folders are synthetic schema and integrity-test inputs generated with `RunStore` and the production `buildRunReceipt`/`validateReceipt` path. They use fixture verifier results and `FAKE_ADAPTER`; they are not real agent executions, independent benchmark runs, or judge evidence.

The PASS fixture maps AC-01 and AC-02 to separate verifier IDs. The FAIL fixture has a failed AC-01 verifier and a passing AC-02 verifier. The UNPROVEN fixture leaves AC-02 unmapped while retaining a verifier result for the task, showing that unrelated test success does not prove that criterion.

Regenerate with `npm run fixtures:phase02` and validate with `npm run verify:phase02`. The generator stores its temporary SQLite database outside the repository and removes it after producing the JSON and Markdown fixtures.
