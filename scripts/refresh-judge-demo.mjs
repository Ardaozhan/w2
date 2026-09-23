import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

const read = (file) => JSON.parse(readFileSync(file, 'utf8'));
const passRecordPath = 'benchmarks/runs/w2/bug-fix/run-record.json';
const passReceiptPath = 'benchmarks/runs/w2/bug-fix/run-receipt.json';
const unprovenRecordPath = 'evidence/demo/unproven/20260923101252840/run-record.json';
const unprovenReceiptPath = 'evidence/demo/unproven/20260923101252840/run-receipt.json';
const passRecord = read(passRecordPath);
const passReceipt = read(passReceiptPath);
const unprovenRecord = read(unprovenRecordPath);
const unprovenReceipt = read(unprovenReceiptPath);
const benchmark = read('benchmarks/results/results.json');
// Git may normalize checkout line endings. Hash the canonical UTF-8/LF form so
// a clean archive verifies the same stored source bytes semantically.
const sha256 = (file) => createHash('sha256').update(readFileSync(file, 'utf8').replace(/\r\n/g, '\n')).digest('hex');
if (passRecord.execution_mode !== 'REAL_CODEX' || passRecord.status !== 'TASK_PASS' || passReceipt.agent?.execution_mode !== 'REAL_CODEX' || passReceipt.outcome !== 'PASS' || passRecord.run_id !== passReceipt.run_id) throw new Error('Judge demo PASS case is not a stored real Codex PASS receipt');
if (unprovenRecord.execution_mode !== 'REAL_CODEX' || unprovenRecord.status !== 'UNPROVEN' || unprovenReceipt.agent?.execution_mode !== 'REAL_CODEX' || unprovenReceipt.outcome !== 'UNPROVEN' || unprovenRecord.run_id !== unprovenReceipt.run_id) throw new Error('Judge demo UNPROVEN case is not a stored real Codex UNPROVEN receipt');
if (unprovenRecord.infrastructure_failure === true || unprovenRecord.timed_out === true || !unprovenReceipt.acceptance.some((item) => item.required && item.status === 'UNPROVEN')) throw new Error('UNPROVEN judge case must be semantic, not infrastructure-related');
if (benchmark.runs?.length !== 16) throw new Error('Current benchmark must contain all sixteen stored runs');
const target = path.resolve('judge-demo/assets');
mkdirSync(target, { recursive: true });
const payload = {
  generated_from: 'verified stored repository artifacts',
  benchmark_sha256: sha256('benchmarks/results/results.json'),
  benchmark: { methodology: benchmark.methodology, generated_at: benchmark.generated_at, runs: benchmark.runs.map(({ fixture_id, condition, execution_mode, status, false_done, criterion_evidence_coverage, runtime_ms, infrastructure_failure }) => ({ fixture_id, condition, execution_mode, status, false_done, criterion_evidence_coverage, runtime_ms, infrastructure_failure })) },
  cases: {
    pass: { label: 'PASS', provenance: 'REAL_CODEX', replay: 'REPLAY OF VERIFIED REAL RUN', record_path: passRecordPath, receipt_path: passReceiptPath, record_sha256: sha256(passRecordPath), receipt_sha256: sha256(passReceiptPath), record: passRecord, receipt: passReceipt },
    unproven: { label: 'UNPROVEN', provenance: 'REAL_CODEX', replay: 'REPLAY OF VERIFIED REAL RUN', record_path: unprovenRecordPath, receipt_path: unprovenReceiptPath, record_sha256: sha256(unprovenRecordPath), receipt_sha256: sha256(unprovenReceiptPath), record: unprovenRecord, receipt: unprovenReceipt },
  },
};
writeFileSync(path.join(target, 'demo-data.js'), `window.W2_JUDGE_DATA = ${JSON.stringify(payload).replace(/</g, '\\u003c')};\n`, 'utf8');
console.log('Judge demo data refreshed from REAL_CODEX PASS, semantic UNPROVEN, and current benchmark artifacts.');
