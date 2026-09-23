import assert from "node:assert/strict";
import { once } from "node:events";
import { test } from "node:test";
import { createLoginServer } from "../src/app.ts";

test("existing login accepts valid credentials and rejects invalid credentials", async (context) => {
  const server = createLoginServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  context.after(() => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const login = (username: string, password: string) => fetch(`http://127.0.0.1:${address.port}/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username, password }) });
  assert.equal((await login("demo", "correct-horse")).status, 200);
  assert.equal((await login("demo", "wrong-password")).status, 401);
});
