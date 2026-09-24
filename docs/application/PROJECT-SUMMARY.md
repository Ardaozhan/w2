# Project Summary

W2 is a verification layer for coding agents. Coding agents can claim they finished; W2 shows the evidence in a Run Receipt.

The receipt brings together the task contract, context W2 selected and provided, recognized events, repository changes, declared verification, and criterion evidence. Deterministic records remain authoritative: missing required evidence is `UNPROVEN`, failed evidence can produce `FAIL`, and agent completion text cannot force `PASS`.

In interactive Codex mode, an explicitly headed acceptance list is represented item by item. Only criteria that directly assert a discovered project command passes are mapped to that command's result; generic tests do not prove semantic requirements.

W2 records only the events and file access available through its current adapter. The static judge demo replays stored REAL_CODEX evidence; it is not a live run.
