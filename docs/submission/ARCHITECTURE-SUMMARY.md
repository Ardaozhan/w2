# Architecture Summary

```text
Task contract
     │
     ▼
Run Engine ──► Context Manifest ──► Codex Adapter
     │                                  │
     │                       Codex workspace-write sandbox
     │                                  │
     └───────────────┬──────────────────┘
                     ▼
      recognized events + Git diff + verifier results
                     │
                     ▼
             SQLite Event Store
                     │
                     ▼
        Evidence Engine: criterion links
                     │
                     ▼
       Deterministic Outcome Engine
                     │
                     ▼
        JSON / Markdown Run Receipt
```

Interactive Codex mode enters through `UserPromptSubmit`, `Stop`, `Interrupt`, and `SessionEnd` hooks and then reuses the normal run, verification, evidence, outcome, and receipt pipeline. W2 does not mediate every Codex-native operation. Its `ToolRuntime` controls only calls made through W2-owned runtime APIs.
