# Demo Script (60–90 seconds)

Target length: about 85 seconds. Record a real Windows terminal and Codex TUI session. Do not synthesize terminal output or substitute mock receipts. Use a disposable Git project with a small real bug and an existing test command.

| Time | Show | Narration |
| --- | --- | --- |
| 0–8 sec | Start on the project's code or test failure. | “Your coding agent says it's done. How do you know?” |
| 8–17 sec | In the project directory, run `w2`; show the normal Codex TUI opening. | “W2 starts regular Codex and captures the engineering turn through native hooks.” |
| 17–32 sec | Enter a small real engineering task with an `Acceptance criteria:` heading and separate behavior and test-command bullets. | “The request and its acceptance criteria become part of the run record.” |
| 32–55 sec | Let Codex make the change. Show only the actual diff and actual test activity. | “W2 captures Git-visible changes and runs the project's detected checks when the turn stops.” |
| 55–75 sec | Show the actual receipt, criterion entries, evidence links, and computed outcome. | “This test command passed. The receipt shows which criterion that proves. Any semantic requirement without direct evidence remains unproven.” |
| 75–85 sec | Return to the W2 title or receipt outcome. | “Know what the agent saw. Know what it did. Know whether it worked.” |

Use the receipt and results produced by the recorded run. If the outcome or checks differ from the planned narration, describe the observed result accurately. A passing generic test suite must not be presented as proof of an unrelated semantic criterion. This document is a recording plan; no video has been created.
