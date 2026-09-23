import { readFileSync, existsSync } from 'node:fs';
import { normalizeTaskContract, taskSemanticsHash } from './task-contract.mjs';
import { assistantMessagesFromCodexEvents, hasCompletionClaim } from './completion-claim.mjs';
import { isFalseDoneBenchmarkRun } from './metrics.mjs';

const resultPath = 'benchmarks/results/results.json';
if (!existsSync(resultPath)) throw new Error('benchmark results missing; run npm run benchmark');
const data = JSON.parse(readFileSync(resultPath, 'utf8'));
if (!Array.isArray(data.runs) || data.runs.length !== 16 || data.methodology?.fixtures !== 8 || data.methodology?.timeout_ms < 30000) throw new Error('expected eight fixtures, sixteen runs, and a documented timeout');
if (data.methodology.conditions?.join(',') !== 'raw_codex,w2_codex') throw new Error('benchmark conditions mismatch');
const allowed = new Set(['TASK_PASS','TASK_FAIL','TASK_UNPROVEN','INFRASTRUCTURE_FAILURE']);
for (const id of JSON.parse(readFileSync('benchmarks/fixtures/index.json', 'utf8')).map((item) => item.fixture_id)) {
  const pair = data.runs.filter((run) => run.fixture_id === id);
  if (pair.length !== 2 || !['raw_codex','w2_codex'].every((condition) => pair.some((run) => run.condition === condition))) throw new Error(`${id}: missing condition pair`);
  const [raw, w2] = ['raw_codex','w2_codex'].map((condition) => pair.find((run) => run.condition === condition));
  for (const run of pair) {
    for (const field of ['baseline_commit','baseline_hash','task_semantics_hash','timeout_ms','execution_mode','status','external_verification','evidence']) if (!(field in run)) throw new Error(`${id}: missing ${field}`);
    if (!/^[0-9a-f]{40}$/.test(run.baseline_commit) || !/^[0-9a-f]{40}$/.test(run.baseline_hash) || run.timeout_ms !== data.methodology.timeout_ms || !allowed.has(run.status) || run.execution_mode !== 'REAL_CODEX' || typeof run.timed_out !== 'boolean') throw new Error(`${id}: invalid run provenance or classification`);
    const runDir = `benchmarks/runs/${run.condition === 'raw_codex' ? 'raw' : 'w2'}/${id}`;
    if (!existsSync(`${runDir}/run-record.json`)) throw new Error(`${id}: run artifact missing`);
    const artifact = JSON.parse(readFileSync(`${runDir}/run-record.json`, 'utf8'));
    if (artifact.execution_mode !== 'REAL_CODEX' || artifact.status !== run.status || artifact.baseline_hash !== run.baseline_hash || artifact.task_semantics_hash !== run.task_semantics_hash || artifact.timeout_ms !== run.timeout_ms) throw new Error(`${id}: result does not match stored run artifact`);
    const claimEvents = run.condition === 'raw_codex' ? artifact.output : run.agent_message_events;
    if (!run.claim_source || !Array.isArray(run.agent_messages) || JSON.stringify(run.agent_messages) !== JSON.stringify(assistantMessagesFromCodexEvents(claimEvents)) || run.claim_done !== hasCompletionClaim(claimEvents)) throw new Error(`${id}: completion claim is not derived from stored assistant-message events`);
    if (artifact.claim_done !== run.claim_done || artifact.false_done !== run.false_done) throw new Error(`${id}: stored run metric differs from aggregate`);
    if (run.infrastructure_failure !== (run.status === 'INFRASTRUCTURE_FAILURE')) throw new Error(`${id}: infrastructure classification mismatch`);
    if (run.status === 'INFRASTRUCTURE_FAILURE' && run.external_verification.status !== 'NOT_RUN') throw new Error(`${id}: infrastructure failure must not be scored as a task outcome`);
    if (run.timed_out && run.status !== 'INFRASTRUCTURE_FAILURE') throw new Error(`${id}: agent timeout must be an infrastructure failure`);
    if (run.status === 'INFRASTRUCTURE_FAILURE' && run.false_done) throw new Error(`${id}: infrastructure failure cannot count as false-DONE`);
  }
  if (raw.task_semantics_hash !== w2.task_semantics_hash || raw.baseline_commit !== w2.baseline_commit || raw.baseline_hash !== w2.baseline_hash || raw.timeout_ms !== w2.timeout_ms) throw new Error(`${id}: Raw/W2 condition mismatch`);
  if (!Number.isFinite(w2.criterion_evidence_coverage) || w2.criterion_evidence_coverage < 0 || w2.criterion_evidence_coverage > 1) throw new Error(`${id}: invalid criterion coverage`);
  const receiptPath = w2.evidence?.receipt;
  if (!receiptPath || !existsSync(receiptPath)) throw new Error(`${id}: W2 receipt missing`);
  const receipt = JSON.parse(readFileSync(receiptPath, 'utf8'));
  if (receipt.agent?.execution_mode !== 'REAL_CODEX' || !receipt.run_id) throw new Error(`${id}: receipt is not bound to a real run`);
  if (w2.false_done !== isFalseDoneBenchmarkRun(w2, receipt.acceptance)) throw new Error(`${id}: W2 false-DONE metric mismatch`);
  const required = receipt.acceptance.filter((item) => item.required);
  const evidence = new Map(receipt.evidence.map((item) => [item.evidence_id, item]));
  const coverage = required.length ? required.filter((criterion) => criterion.evidence_ids.some((id) => {
    const item = evidence.get(id);
    if (!item || item.confidence_class !== 'DETERMINISTIC') return false;
    const verificationType = ['TEST_EVIDENCE','LINT_EVIDENCE','TYPECHECK_EVIDENCE','BUILD_EVIDENCE'].includes(item.type);
    const verifierAssertion = item.type === 'ASSERTION_EVIDENCE' && item.raw_reference.includes(':verification:');
    const status = item.data?.status;
    return (verificationType || verifierAssertion) && ['PASSED','FAILED'].includes(status);
  })).length / required.length : 0;
  if (coverage !== w2.criterion_evidence_coverage) throw new Error(`${id}: coverage is not derived from attached evidence`);
  if (raw.false_done !== isFalseDoneBenchmarkRun(raw)) throw new Error(`${id}: Raw Codex false-DONE metric mismatch`);
  const fixture = normalizeTaskContract(JSON.parse(readFileSync(`benchmarks/fixtures/${id}/task.json`, 'utf8')));
  if (taskSemanticsHash(fixture) !== raw.task_semantics_hash || fixture.baseline_hash !== raw.baseline_hash) throw new Error(`${id}: run task contract or baseline differs from fixture`);
}
for (const file of ['benchmarks/results/results.csv','docs/BENCHMARK-REPORT.md']) if (!existsSync(file)) throw new Error(`benchmark report artifact missing: ${file}`);
console.log(`Benchmark result validation: PASS (${data.runs.length} stored REAL_CODEX runs)`);
