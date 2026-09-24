# Demo Video Script (Target: 2:50)

Show the static judge demo replaying stored evidence. Do not present it as a live agent execution.

- **0:00 — Hook.** “Coding agents can claim they finished. Did they prove the requirements?”
- **0:10 — Question.** “A green test suite does not show which task requirements it covered.”
- **0:20 — W2.** Open `judge-demo/index.html`. “W2 is a verification layer for coding agents. Each run becomes a Run Receipt.”
- **0:35 — Real hero task.** Select the login rate-limit PASS case. Show AC-01 through AC-04 and their declared verifier references.
- **0:50 — Provenance.** Point out `REAL_CODEX`, `VERIFIED STORED RUN`, and `REPLAY OF VERIFIED REAL RUN`. “This page replays a stored run; it is not launching Codex now.”
- **1:05 — Context, actions, and diff.** Show selected/provided context, recognized events, and the two changed files. “The receipt records W2 context and captured events. Exact Codex file reads are unknown to this adapter.”
- **1:30 — Verification.** Open Verification. Show V1–V4 and exit code 0. Mention that Codex's own test-runner attempt reported `spawn EPERM`; W2 then ran the declared verifiers independently, and those stored results are the receipt evidence.
- **1:55 — Acceptance evidence.** Trace each criterion to its deterministic verifier record and the computed PASS outcome.
- **2:10 — Semantic UNPROVEN.** Switch cases. Show AC-01 PASS and the documentation criterion UNPROVEN because it has no verifier reference. “The agent's change and a passing test cannot prove a requirement with no mapped evidence.”
- **2:30 — Benchmark.** Show the paired Raw/W2 table. “Eight fixtures, one attempt per condition. Both conditions passed 8/8 external verifiers in this sample. This is descriptive, not a correctness advantage claim.”
- **2:45 — Close.** “Coding agents can claim they finished. W2 shows the evidence. No evidence, no PASS.”

Before recording, run `npm run judge-demo:verify`, capture the final static demo, check for secret or local-path exposure, and confirm the competition's duration requirement. Recording and the final duration check remain human actions.
