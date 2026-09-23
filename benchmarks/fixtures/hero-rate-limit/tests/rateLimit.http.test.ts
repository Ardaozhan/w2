import assert from "node:assert/strict";
import { once } from "node:events";
import { test } from "node:test";
import { createLoginServer } from "../src/app.ts";

test("the sixth failed HTTP login request returns 429 after five 401 responses", async (context) => {
  const server = createLoginServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  context.after(() => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const url = `http://127.0.0.1:${address.port}/login`;
  const sendFailedLogin = () => fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: "demo", password: "wrong-password" }) });
  for (let attempt = 0; attempt < 5; attempt += 1) assert.equal((await sendFailedLogin()).status, 401);
  assert.equal((await sendFailedLogin()).status, 429);
});
