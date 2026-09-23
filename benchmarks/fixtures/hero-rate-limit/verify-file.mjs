import { readFileSync } from 'node:fs';

const behavior = readFileSync('tests/rateLimit.behavior.test.ts', 'utf8');
const http = readFileSync('tests/rateLimit.http.test.ts', 'utf8');
if (!behavior.includes('five failed attempts') || !behavior.includes('client-b') || !http.includes('sixth failed HTTP login request') || !http.includes('429')) {
  throw new Error('Required rate-limit behavior and HTTP 429 assertions are missing');
}
console.log(JSON.stringify({ verifier_id: 'V4', status: 'PASSED', files: ['tests/rateLimit.behavior.test.ts', 'tests/rateLimit.http.test.ts'] }));
