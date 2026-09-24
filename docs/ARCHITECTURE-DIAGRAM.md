# W2 Run Flow

```mermaid
flowchart TD
  U[User task + acceptance criteria] --> R[W2 Run Engine]
  R --> C[Context Manifest]
  C --> A[Codex Adapter]
  A --> SBOX[Codex workspace-write sandbox]
  SBOX --> REPO[Repository]
  A -. recognized events .-> EV[Event Store]
  REPO --> D[Diff Capture]
  R --> V[Declared Verification]
  R --> T[W2-owned ToolRuntime calls]
  EV --> E[Evidence Engine]
  D --> E
  V --> E
  E --> AC[Criterion statuses]
  AC --> O[Deterministic Outcome Engine]
  O --> Q[Run Receipt]
  Q --> CLI[CLI]
  Q --> UI[Local UI]
  Q --> J[Static judge demo]
```

Codex native operations use the Codex sandbox and do not pass through W2 `ToolRuntime`. W2 stores recognized events, repository diffs, and verifier results. The context record distinguishes what W2 considered, selected, and provided; exact Codex file reads remain unknown unless telemetry establishes them.
