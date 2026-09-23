# W2 Architecture Decisions

## ADR-001 — Run Receipt is the core artifact

- **Status:** Accepted
- **Decision:** Every run must end in a human- and machine-readable Run Receipt.
- **Reason:** A final agent claim is not sufficient evidence; a receipt makes
  context, actions, changes, verification, and acceptance inspectable together.

## ADR-002 — Deterministic facts precede AI interpretation

- **Status:** Accepted
- **Decision:** File changes, diffs, command results, tool order, timestamps,
  and approvals are produced by deterministic system components. AI can explain
  or map evidence but cannot author those facts.
- **Reason:** This prevents fabricated completion evidence and preserves auditability.

## ADR-003 — One agent before extensibility

- **Status:** Accepted
- **Decision:** v1 starts with one approved coding-agent execution path.
- **Reason:** Reproducibility and a clear judge demo are more valuable than
  speculative multi-agent orchestration during the competition build.

## ADR-004 — TypeScript foundation with deferred product dependencies

- **Status:** Accepted
- **Decision:** Initialize Node.js, TypeScript, Vitest, and Zod now. Defer
  SQLite/Drizzle, React/Next.js, Playwright, and Codex adapter implementation to
  the phases that require them.
- **Reason:** The Phase 00 goal is a stable foundation; adding unused runtime
  systems would increase churn without proving a Phase 00 criterion.
# Publication and license

No license was added during the repair: the repository is currently marked
`private` in `package.json`, and publication intent is not established by the
checked-in project files. Before public distribution, the owner should confirm
the intended license; MIT is a candidate only if that matches the project's
publication intent.

