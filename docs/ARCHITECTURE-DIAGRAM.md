# W2 Architecture

```mermaid
flowchart TD
  U[User task] --> R[Run Engine]
  R --> C[Context Manifest]
  R --> A[Codex Adapter]
  R --> T[Tool Runtime]
  R --> S[(SQLite Event Store)]
  R --> D[Diff Capture]
  R --> V[Verification Runner]
  D --> E[Evidence Engine]
  V --> E
  S --> E
  E --> M[Evidence mapping hook]
  M --> O[Deterministic Outcome Engine]
  O --> Q[Run Receipt]
  Q --> J[JSON / Markdown / Receipt UI]
```

Deterministic facts come from Git, SQLite, tool runtime, verification processes, timestamps, diffs, and exit codes. Interpretation is bounded by stored evidence IDs; it cannot create facts or override a deterministic outcome.
