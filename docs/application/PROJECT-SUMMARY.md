# Project Summary

Coding agents can say “done” while requirements remain unverified. W2 is a local engineering evidence layer that records the task, context W2 selected and provided, recognized events, repository changes, verification, and acceptance evidence for a run. Its central artifact is the Run Receipt: an inspectable account of the recorded task, actions, checks, and evidence-linked outcome.

Deterministic records remain authoritative: missing required evidence is `UNPROVEN`, contradictory evidence can be `FAIL`, and model completion text cannot directly force `PASS`. W2 observes Codex's supported workspace-write execution and recognized events; it does not prove exact file access or intercept every native tool operation. The static judge demo replays stored REAL_CODEX evidence and is not a live run.
