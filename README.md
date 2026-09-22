# W2

W2 is an engineering harness for coding agents that turns every agent run into
verifiable evidence. Its core artifact is the Run Receipt: a human- and
machine-readable record of context, actions, changes, verification, and
acceptance evidence.

## Phase status

Phase 00 is complete. Phase 01 implements the Core Run Engine; Phases 02-06
remain locked.

## Local commands

```text
npm ci
npm test
npm run typecheck
npm run build
npm run w2 -- run fixtures/canonical/task.json
```

The Phase 01 entry point persists operational state in `.w2/runs.sqlite`.

## Source of truth

The active phase contract is
[PHASE-01-CORE-RUN-ENGINE.md](W2-Competition-Phases/PHASE-01-CORE-RUN-ENGINE.md).
