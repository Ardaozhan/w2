import { readFileSync, writeFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { assistantMessagesFromCodexEvents, hasCompletionClaim } from './completion-claim.mjs';
import { isFalseDoneBenchmarkRun } from './metrics.mjs';

const path = 'benchmarks/results/results.json';
const data = JSON.parse(readFileSync(path, 'utf8'));
for (const run of data.runs) {
  const recordPath = `benchmarks/runs/${run.condition === 'raw_codex' ? 'raw' : 'w2'}/${run.fixture_id}/run-record.json`;
  const record = JSON.parse(readFileSync(recordPath, 'utf8'));
  const receipt = run.condition === 'w2_codex' ? JSON.parse(readFileSync(record.evidence.receipt, 'utf8')) : undefined;
  if (receipt) { record.run_id = receipt.run_id; run.run_id = receipt.run_id; }
  let messages;
  if (run.condition === 'raw_codex') {
    messages = assistantMessagesFromCodexEvents(record.output);
    record.claim_source = 'Codex JSONL agent_message/assistant_message items only';
    record.agent_messages = messages;
  } else {
    const db = new DatabaseSync(`benchmarks/runtime-db/${run.fixture_id}.sqlite`, { readOnly: true });
    try {
      const rows = db.prepare("SELECT payload FROM events WHERE run_id = ? AND type = 'agent_output' ORDER BY sequence").all(receipt.run_id);
      const rawEvents = rows.map((row) => JSON.parse(row.payload).raw).filter(Boolean);
      messages = assistantMessagesFromCodexEvents(rawEvents);
      record.agent_message_events = rawEvents;
      record.agent_messages = messages;
      record.claim_source = 'persisted W2 agent_output events containing Codex agent_message/assistant_message items';
    } finally { db.close(); }
  }
  const derivedClaim = hasCompletionClaim(run.condition === 'raw_codex' ? record.output : record.agent_message_events);
  const metricInput = { ...record, claim_done: derivedClaim, external_verification: run.external_verification, status: run.status, infrastructure_failure: run.infrastructure_failure };
  const falseDone = isFalseDoneBenchmarkRun(metricInput, receipt?.acceptance ?? []);
  record.claim_done = derivedClaim;
  record.false_done = falseDone;
  run.agent_messages = messages;
  run.claim_done = derivedClaim;
  run.false_done = falseDone;
  run.claim_source = record.claim_source;
  if (record.agent_message_events) run.agent_message_events = record.agent_message_events;
  writeFileSync(recordPath, `${JSON.stringify(record, null, 2)}\n`, 'utf8');
}
writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
console.log('Benchmark claim evidence: PASS (all claims re-derived from stored Codex assistant-message events)');
