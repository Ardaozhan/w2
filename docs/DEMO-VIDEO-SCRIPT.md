# Demo Video Script (target: under 3 minutes)

Keep the capture under 2:50. Show the static stored-run replay; do not suggest that the video is a live agent execution.

- **0:00 Hook** — “A coding agent can say ‘done’. W2 asks what evidence supports that claim.”
- **0:15 Problem** — Show a task completion message beside a missing required criterion. “A passing test may not prove every acceptance criterion.”
- **0:30 W2** — Open `judge-demo/index.html`. “This local receipt puts the task, selected context, observed events, diff, verification, and acceptance evidence together.”
- **0:45 Real Run Receipt** — Show the PASS case. Point out `REAL_CODEX` and `REPLAY OF VERIFIED REAL RUN`; clarify the page replays stored artifacts.
- **1:10 Context / Trace / Diff** — Move through the tabs. “Context shows what W2 selected and provided. The trace is the recognized event record, not every native tool call. The diff shows captured repository changes.”
- **1:40 Verification / Acceptance Evidence** — Show verifier output and evidence IDs. “The configured verifier passes, while criteria without attached evidence remain visible.”
- **2:05 Benchmark** — Show all 16 Raw/W2 rows. “Eight local fixtures, one attempt per condition, same task contract and verifier. Errors and timeouts remain in the results; this sample does not claim a performance win.”
- **2:25 Architecture** — Show README architecture paragraph. “Codex's workspace-write sandbox protects native execution; W2 records evidence around it and is not an OS/container boundary.”
- **2:40 Closing** — “W2 makes a coding-agent run easier to inspect—not magically certain.”

Before recording, refresh the static demo, verify PASS and semantic UNPROVEN labels, ensure no secret is visible, and confirm the final duration against competition rules.
