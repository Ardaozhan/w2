# W2 Architecture

```mermaid
flowchart TD
  U[User task] --> R[W2 Run Engine]
  R --> C[Context Manifest]
  R --> A[Codex Adapter]
  A --> SBOX[Codex workspace-write sandbox]
  SBOX --> REPO[Repository]
  A -. recognized events .-> R
  R --> T[W2-owned ToolRuntime calls]
  R --> S[(SQLite Event Store)]
  R --> D[Diff Capture]
  R --> V[Verification Runner]
  D --> E[Evidence Engine]
  V --> E
  S --> E
  E --> O[Deterministic Outcome Engine]
  O --> Q[Run Receipt]
  Q --> J[JSON / Markdown / Receipt UI]
```

Native Codex calls use Codex's sandbox and do not pass through W2 ToolRuntime. W2 observes recognized events, the resulting repository diff, and verifier results; it does not capture all file reads or broker every native action. No live GPT-5.6 evidence mapper is installed.
