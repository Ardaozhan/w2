/** The only top-level outcomes permitted by the Phase 00 system contract. */
export const RUN_OUTCOMES = [
  "PASS",
  "FAIL",
  "UNPROVEN",
  "ABORTED",
  "ERROR",
] as const;

export type RunOutcome = (typeof RUN_OUTCOMES)[number];
