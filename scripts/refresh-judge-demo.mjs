import { mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

const read = (file) => JSON.parse(readFileSync(file, 'utf8'));
const heroRecordPath = 'evidence/hero-run/run-record.json';
const heroReceiptPath = 'evidence/hero-run/run-receipt.json';
const benchmarkPath = 'benchmarks/results/results.json';
const sha256 = (file) => createHash('sha256').update(readFileSync(file, 'utf8').replace(/\r\n/g, '\n')).digest('hex');
const heroRecord = read(heroRecordPath);
const heroReceipt = read(heroReceiptPath);
if (heroRecord.execution_mode !== 'REAL_CODEX' || heroRecord.status !== 'PASS' || heroReceipt.agent?.execution_mode !== 'REAL_CODEX' || heroReceipt.outcome !== 'PASS' || heroRecord.run_id !== heroReceipt.run_id) throw new Error('Judge PASS case must be the verified stored REAL_CODEX hero run');
if (heroRecord.infrastructure_failure === true || heroRecord.timed_out === true || heroReceipt.acceptance.some((item) => item.required && item.status !== 'PASS')) throw new Error('Hero PASS case has incomplete criteria or an infrastructure failure');

const unprovenCandidates = readdirSync('evidence/demo/unproven', { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => ({ directory: `evidence/demo/unproven/${entry.name}`, recordPath: `evidence/demo/unproven/${entry.name}/run-record.json`, receiptPath: `evidence/demo/unproven/${entry.name}/run-receipt.json` }));
let unproven;
for (const candidate of unprovenCandidates) {
  try {
    const record = read(candidate.recordPath);
    const receipt = read(candidate.receiptPath);
    if (record.execution_mode === 'REAL_CODEX' && record.status === 'UNPROVEN' && record.infrastructure_failure !== true && record.timed_out !== true && receipt.agent?.execution_mode === 'REAL_CODEX' && receipt.outcome === 'UNPROVEN' && receipt.acceptance.some((item) => item.required && item.status === 'UNPROVEN')) {
      if (!unproven || record.generated_at > unproven.record.generated_at) unproven = { ...candidate, record, receipt };
    }
  } catch {}
}
if (!unproven) throw new Error('A stored, semantic REAL_CODEX UNPROVEN receipt is required for the judge demo');
const benchmark = read(benchmarkPath);
if (benchmark.validation?.status !== 'PASS' || benchmark.runs?.length !== 16 || benchmark.runs.some((run) => run.execution_mode !== 'REAL_CODEX')) throw new Error('Judge demo benchmark snapshot is not the validated sixteen-run REAL_CODEX set');

const casesManifest = {
  schema_version: 1,
  updated_at: new Date().toISOString(),
  cases: {
    pass: { label: 'REAL_CODEX PASS — hero rate-limit fixture', receipt: heroReceiptPath, record: heroRecordPath },
    unproven: { label: 'REAL_CODEX UNPROVEN — required criterion has no verifier', receipt: unproven.receiptPath, record: unproven.recordPath },
  },
};
writeFileSync('evidence/demo/cases.json', `${JSON.stringify(casesManifest, null, 2)}\n`, 'utf8');

const target = path.resolve('judge-demo/assets');
mkdirSync(target, { recursive: true });
const payload = {
  generated_from: 'verified stored repository artifacts',
  benchmark_sha256: sha256(benchmarkPath),
  benchmark: { methodology: benchmark.methodology, generated_at: benchmark.generated_at, runs: benchmark.runs.map(({ fixture_id, condition, execution_mode, status, false_done, criterion_evidence_coverage, runtime_ms, tool_calls, event_count, verification_coverage, infrastructure_failure, scope_violations }) => ({ fixture_id, condition, execution_mode, status, false_done, criterion_evidence_coverage, runtime_ms, tool_calls, event_count, verification_coverage, infrastructure_failure, scope_violations })) },
  cases: {
    pass: { label: 'PASS — hero login rate-limit task', provenance: 'REAL_CODEX', replay: 'REPLAY OF VERIFIED REAL RUN', record_path: heroRecordPath, receipt_path: heroReceiptPath, record_sha256: sha256(heroRecordPath), receipt_sha256: sha256(heroReceiptPath), record: heroRecord, receipt: heroReceipt },
    unproven: { label: 'UNPROVEN — semantic evidence gap', provenance: 'REAL_CODEX', replay: 'REPLAY OF VERIFIED REAL RUN', record_path: unproven.recordPath, receipt_path: unproven.receiptPath, record_sha256: sha256(unproven.recordPath), receipt_sha256: sha256(unproven.receiptPath), record: unproven.record, receipt: unproven.receipt },
  },
};
writeFileSync(path.join(target, 'demo-data.js'), `window.W2_JUDGE_DATA = ${JSON.stringify(payload).replace(/</g, '\\u003c')};\n`, 'utf8');
console.log('Judge demo refreshed from the verified REAL_CODEX hero PASS, semantic UNPROVEN, and current benchmark artifacts.');
