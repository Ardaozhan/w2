# Project Summary

Coding agents can say “done” while requirements remain unverified. W2 is an engineering harness that records context, actions, changes, verification, and acceptance evidence for each run. Its memorable artifact is the Run Receipt: a compact answer to what the agent saw, what it did, and whether it worked.

W2 is technically interesting because deterministic facts remain authoritative. Missing evidence becomes `UNPROVEN`; contradictions become `FAIL`; the model cannot invent evidence IDs or force `PASS`. The local demo makes that contract inspectable in one screen.
