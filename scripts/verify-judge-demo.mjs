import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { validateReceipt } from '../dist/src/core/evidence.js';

const required = ['judge-demo/index.html', 'judge-demo/assets/demo.css', 'judge-demo/assets/demo-data.js', 'evidence/demo/cases.json'];
for (const file of required) if (!existsSync(file)) throw new Error(`Judge demo file missing: ${file}`);
const dataSource = readFileSync('judge-demo/assets/demo-data.js', 'utf8');
if (!dataSource.startsWith('window.W2_JUDGE_DATA = ')) throw new Error('Judge demo must load local static data without a backend');
const data = JSON.parse(dataSource.slice('window.W2_JUDGE_DATA = '.length).replace(/;\s*$/, ''));
const sha256 = (file) => createHash('sha256').update(readFileSync(file, 'utf8').replace(/\r\n/g, '\n')).digest('hex');
const casesManifest = JSON.parse(readFileSync('evidence/demo/cases.json', 'utf8'));
for (const key of ['pass', 'unproven']) {
  const item = data.cases[key];
  if (item.provenance !== 'REAL_CODEX' || item.replay !== 'REPLAY OF VERIFIED REAL RUN' || !item.record_path || !item.receipt_path) throw new Error(`Judge ${key} provenance or replay label mismatch`);
  if (item.record.run_id !== item.receipt.run_id || item.record.execution_mode !== 'REAL_CODEX' || item.receipt.agent?.execution_mode !== 'REAL_CODEX' || item.record_sha256 !== sha256(item.record_path) || item.receipt_sha256 !== sha256(item.receipt_path)) throw new Error(`Judge ${key} values do not match stored REAL_CODEX artifacts`);
  validateReceipt(item.receipt);
  if (casesManifest.cases[key]?.record !== item.record_path || casesManifest.cases[key]?.receipt !== item.receipt_path) throw new Error(`Judge ${key} manifest paths are stale`);
}
if (data.cases.pass.record.status !== 'PASS' || data.cases.pass.receipt.outcome !== 'PASS' || data.cases.pass.receipt.task.task_id !== 'hero-login-rate-limit') throw new Error('Judge PASS case is not the stored hero receipt');
if (data.cases.pass.record.infrastructure_failure === true || data.cases.pass.record.timed_out === true || data.cases.pass.receipt.acceptance.some((item) => item.required && item.status !== 'PASS')) throw new Error('Judge hero PASS contains an infrastructure failure or unproven criterion');
if (data.cases.unproven.record.status !== 'UNPROVEN' || data.cases.unproven.receipt.outcome !== 'UNPROVEN' || data.cases.unproven.record.infrastructure_failure === true || data.cases.unproven.record.timed_out === true || !data.cases.unproven.receipt.acceptance.some((item) => item.required && item.status === 'UNPROVEN')) throw new Error('Judge UNPROVEN case is not semantic');
if (data.benchmark_sha256 !== sha256('benchmarks/results/results.json') || data.benchmark.runs.length !== 16 || data.benchmark.runs.some((run) => run.execution_mode !== 'REAL_CODEX')) throw new Error('Judge benchmark snapshot is stale or incomplete');
const publicText = readFileSync('judge-demo/assets/demo-data.js', 'utf8');
if (/[A-Za-z]:\\|(?:\/Users\/[^/\s]+\/|\/home\/[^/\s]+\/)|(?:\.codex[\\/](?:memories|prompts|rules|skills))/i.test(publicText)) throw new Error('Judge demo contains an absolute machine/profile path');
if (/sk-[A-Za-z0-9_-]{16,}|Bearer\s+[A-Za-z0-9._~+/=-]{12,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i.test(publicText)) throw new Error('Judge demo contains a credential-like value');
console.log('Judge demo static data validation: PASS (hero REAL_CODEX PASS, semantic REAL_CODEX UNPROVEN, 16 verified benchmark runs)');
