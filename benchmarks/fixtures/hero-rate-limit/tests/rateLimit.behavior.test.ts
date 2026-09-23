import assert from "node:assert/strict";
import { test } from "node:test";
import { LoginRateLimiter } from "../src/rateLimit.ts";

test("limits each client to five failed attempts in a rolling minute", () => {
  const limiter = new LoginRateLimiter();
  const startedAt = 1_000;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    assert.equal(limiter.isRateLimited("client-a", startedAt + attempt), false);
    limiter.recordFailure("client-a", startedAt + attempt);
  }
  assert.equal(limiter.isRateLimited("client-a", startedAt + 5), true);
  assert.equal(limiter.isRateLimited("client-b", startedAt + 5), false);
  assert.equal(limiter.isRateLimited("client-a", startedAt + 60_000), false);
});
