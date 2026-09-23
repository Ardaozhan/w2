import { createServer } from "node:http";
import { authenticate } from "./auth.ts";
import { LoginRateLimiter } from "./rateLimit.ts";

export function createLoginServer(now: () => number = Date.now) {
  const limiter = new LoginRateLimiter();
  return createServer(async (request, response) => {
    if (request.method !== "POST" || request.url !== "/login") {
      response.writeHead(404).end();
      return;
    }
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    let body: { username?: unknown; password?: unknown };
    try { body = JSON.parse(Buffer.concat(chunks).toString("utf8")); }
    catch { response.writeHead(400).end(); return; }
    if (typeof body.username !== "string" || typeof body.password !== "string") {
      response.writeHead(400).end();
      return;
    }
    const clientId = request.socket.remoteAddress ?? "unknown";
    if (limiter.isRateLimited(clientId, now())) {
      response.writeHead(429).end();
      return;
    }
    if (!authenticate(body.username, body.password)) {
      limiter.recordFailure(clientId, now());
      response.writeHead(401).end();
      return;
    }
    response.writeHead(200).end();
  });
}
