import { describe, expect, it } from "vitest";
import { RUN_OUTCOMES } from "../src/core/index.js";

describe("Phase 00 foundation", () => {
  it("exposes the constitution's complete run outcome vocabulary", () => {
    expect(RUN_OUTCOMES).toEqual([
      "PASS",
      "FAIL",
      "UNPROVEN",
      "ABORTED",
      "ERROR",
    ]);
  });
});
