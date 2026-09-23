import { createServer } from 'node:http';
import { readFileSync, realpathSync, statSync } from 'node:fs';
import path from 'node:path';
const root = realpathSync(path.resolve('judge-demo'));
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml' };
const port = Number(process.env.W2_JUDGE_DEMO_PORT ?? 4178);
const server = createServer((request, response) => {
  if (!['GET', 'HEAD'].includes(request.method ?? '')) { response.writeHead(405).end('Method not allowed'); return; }
  let pathname;
  try { pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname); } catch { response.writeHead(400).end('Bad request'); return; }
  if (pathname === '/') pathname = '/index.html';
  const candidate = path.resolve(root, `.${pathname}`);
  let actual;
  try { actual = realpathSync(candidate); } catch { response.writeHead(404).end('Not found'); return; }
  if (actual !== root && !actual.startsWith(`${root}${path.sep}`)) { response.writeHead(403).end('Forbidden'); return; }
  try {
    if (!statSync(actual).isFile()) { response.writeHead(404).end('Not found'); return; }
    const body = readFileSync(actual);
    response.writeHead(200, { 'content-type': mime[path.extname(actual)] ?? 'application/octet-stream', 'content-length': body.length, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
    response.end(request.method === 'HEAD' ? undefined : body);
  } catch { response.writeHead(404).end('Not found'); }
});
server.listen(port, '127.0.0.1', () => console.log(`W2 static judge demo: http://127.0.0.1:${port}/`));
const stop = () => server.close(() => process.exit(0));
process.on('SIGINT', stop); process.on('SIGTERM', stop);
