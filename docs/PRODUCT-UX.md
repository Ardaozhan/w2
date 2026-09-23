# Product UX

W2 is a receipt-first developer tool, not a generic analytics dashboard. The primary screen answers three questions in order:

1. What context did W2 provide? The Context view exposes files selected for the prompt. Exact Codex file access is not captured.
2. What did it do? Trace and Diff expose persisted actions and changed files.
3. Did it work? Verification and Acceptance Evidence show independent checks and why the outcome is PASS, FAIL, UNPROVEN, ABORTED, or ERROR.

The demo uses captured repository artifacts. It never upgrades UNPROVEN to PASS and visibly labels the demo as captured data.
