import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
const required = ['judge-demo/index.html', 'judge-demo/assets/demo.css', 'judge-demo/assets/demo-data.js'];
for (const file of required) if (!existsSync(file)) throw new Error(`Judge demo file missing: ${file}`);
const dataSource = readFileSync('judge-demo/assets/demo-data.js', 'utf8');
if (!dataSource.startsWith('window.W2_JUDGE_DATA = ')) throw new Error('Judge demo must load local static data without a backend');
const data = JSON.parse(dataSource.slice('window.W2_JUDGE_DATA = '.length).replace(/;\s*$/, ''));
if (data.cases.pass.provenance !== 'REAL_CODEX' || data.cases.pass.receipt.outcome !== 'PASS') throw new Error('Judge PASS case provenance/outcome mismatch');
if (data.cases.unproven.provenance !== 'REAL_CODEX' || data.cases.unproven.receipt.outcome !== 'UNPROVEN') throw new Error('Judge UNPROVEN case provenance/outcome mismatch');
if (data.cases.unproven.record.infrastructure_failure === true || data.cases.unproven.record.timed_out === true) throw new Error('Judge UNPROVEN case is an infrastructure failure');
if (data.benchmark.runs.length !== 16 || data.benchmark.runs.some((run) => run.execution_mode !== 'REAL_CODEX')) throw new Error('Judge benchmark data is not the current sixteen-run REAL_CODEX set');
const sha256 = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');
for (const key of ['pass','unproven']) {
  const item = data.cases[key];
  if (item.record.run_id !== item.receipt.run_id || item.record_sha256 !== sha256(item.record_path) || item.receipt_sha256 !== sha256(item.receipt_path)) throw new Error(`Judge ${key} values do not match stored run artifacts`);
}
if (data.benchmark_sha256 !== sha256('benchmarks/results/results.json')) throw new Error('Judge benchmark snapshot is stale');
console.log('Judge demo static data validation: PASS (real PASS, semantic UNPROVEN, 16 real benchmark runs)');
