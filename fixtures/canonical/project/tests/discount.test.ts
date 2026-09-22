import { describe, expect, it } from "vitest";
import { applyDiscount } from "../src/discount.js";

describe("applyDiscount", () => {
  it("subtracts the percentage from the price", () => {
    expect(applyDiscount(100, 10)).toBe(90);
  });
});
