import { describe, expect, it } from "vitest";
import { RUN_OUTCOMES } from "../src/core/index.js";

describe("W2 task and contract foundation", () => {
  it("exposes the complete W2 run outcome vocabulary", () => {
    expect(RUN_OUTCOMES).toEqual([
      "PASS",
      "FAIL",
      "UNPROVEN",
      "ABORTED",
      "ERROR",
    ]);
  });
});
