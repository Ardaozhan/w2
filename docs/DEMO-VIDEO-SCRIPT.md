# Demo video script (target: 2:50)

Show the static judge demo replaying stored evidence. Do not present it as a live agent execution.

- **0:00 — Hook.** “Coding agents can say they finished. Did they prove the requirements?”
- **0:10 — Problem.** Show a task with four acceptance criteria. “A passing test suite does not tell us which requirements it covered.”
- **0:20 — W2.** Open `judge-demo/index.html`. “W2 is a verification layer for coding agents. Each execution becomes a Run Receipt.”
- **0:35 — Hero task.** Select the login rate-limit PASS case. Show the task, AC-01 through AC-04, and the explicit verifier references.
- **0:50 — Provenance.** Point out `REAL_CODEX`, `VERIFIED STORED RUN`, and `REPLAY OF VERIFIED REAL RUN`. “This page replays a stored real run; it is not launching Codex now.”
- **1:05 — Context, Trace, and Diff.** Show the selected/provided context, recognized actions, and two changed files. “The receipt records W2 context and captured events. Exact Codex file reads are unknown to this adapter.”
- **1:30 — Verification.** Open Verification. Show V1–V4 and exit 0. Mention that Codex's own test-runner attempt reported `spawn EPERM`; W2 then ran the declared verifiers independently, and those results are what the receipt uses.
- **1:55 — Acceptance evidence.** Open Acceptance Evidence. Trace each criterion to its deterministic verifier record and the computed PASS outcome.
- **2:10 — Semantic UNPROVEN.** Switch cases. Show AC-01 PASS and the documentation criterion UNPROVEN because it has no verifier reference. “The agent's change and a passing test cannot prove a requirement with no mapped evidence.”
- **2:30 — Benchmark.** Show the paired Raw/W2 table and current sample size. “Eight fixtures, one attempt per condition; failures and infrastructure outcomes stay visible. This is descriptive, not a correctness advantage claim.”
- **2:45 — Close.** “Coding agents can claim they finished. W2 shows the evidence. No evidence, no PASS.”

Before recording, run `npm run judge-demo:verify`, capture the final static demo, check that no secret or local path appears, and confirm the competition's video duration requirement. Video recording and the final duration check remain human actions.
