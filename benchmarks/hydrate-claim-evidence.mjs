import { readFileSync, writeFileSync } from 'node:fs';
import { assistantMessagesFromCodexEvents, hasCompletionClaim } from './completion-claim.mjs';
import { isFalseDoneBenchmarkRun } from './metrics.mjs';

const resultPath = 'benchmarks/results/results.json';
const data = JSON.parse(readFileSync(resultPath, 'utf8'));
for (const run of data.runs ?? []) {
  const recordPath = `benchmarks/runs/${run.condition === 'raw_codex' ? 'raw' : 'w2'}/${run.fixture_id}/run-record.json`;
  const record = JSON.parse(readFileSync(recordPath, 'utf8'));
  const receipt = run.condition === 'w2_codex' ? JSON.parse(readFileSync(record.evidence.receipt, 'utf8')) : undefined;
  if (receipt) { record.run_id = receipt.run_id; run.run_id = receipt.run_id; }
  const claimEvidence = run.condition === 'raw_codex' ? record.output : record.agent_message_events;
  const messages = assistantMessagesFromCodexEvents(claimEvidence);
  const claimDone = hasCompletionClaim(claimEvidence);
  const falseDone = isFalseDoneBenchmarkRun({ ...record, claim_done: claimDone, external_verification: run.external_verification, status: run.status, infrastructure_failure: run.infrastructure_failure }, receipt?.acceptance ?? []);
  record.agent_messages = messages;
  record.claim_done = claimDone;
  record.false_done = falseDone;
  record.claim_source = run.condition === 'raw_codex' ? 'Codex JSONL agent_message/assistant_message items only' : 'stored W2 agent_output events containing Codex agent_message/assistant_message items';
  run.agent_messages = messages;
  run.claim_done = claimDone;
  run.false_done = falseDone;
  run.claim_source = record.claim_source;
  writeFileSync(recordPath, `${JSON.stringify(record, null, 2)}\n`, 'utf8');
}
writeFileSync(resultPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
console.log('Benchmark claim evidence: PASS (completion claims re-derived from stored Codex events)');
