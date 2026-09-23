import { execFile, execFileSync, spawn } from 'node:child_process';
import { promises as fs, cpSync, mkdirSync, rmSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { normalizeTaskContract, taskSemanticsHash } from './task-contract.mjs';
import { assistantMessagesFromCodexEvents, hasCompletionClaim } from './completion-claim.mjs';
import { isFalseDoneBenchmarkRun } from './metrics.mjs';
import { RunEngine, buildRunReceipt, computeCriterionEvidenceCoverage, deriveEvidence, renderReceiptMarkdown } from '../dist/src/core/index.js';

const exec = promisify(execFile);
const fixturesRoot = path.resolve('benchmarks/fixtures');
const runsRoot = path.resolve('benchmarks/runs');
const resultsRoot = path.resolve('benchmarks/results');
const timeoutMs = Number(process.env.W2_BENCHMARK_TIMEOUT_MS ?? 90000);
if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 30000 || timeoutMs > 180000) throw new Error('W2_BENCHMARK_TIMEOUT_MS must be 30-180 seconds');
const redact = (value) => String(value ?? '').replace(/(sk-[A-Za-z0-9_-]{12,}|Bearer\s+[A-Za-z0-9._~+/=-]{8,})/g, '[REDACTED]');
const now = () => Date.now();

function runSync(command, args, cwd) { return execFileSync(command, args, { cwd, encoding: 'utf8', windowsHide: true, env: { ...process.env, GIT_AUTHOR_DATE: '2000-01-01T00:00:00Z', GIT_COMMITTER_DATE: '2000-01-01T00:00:00Z' } }); }
function baselineCommit(cwd) { return runSync('git', ['rev-parse', 'HEAD'], cwd).trim(); }
function copyFixture(id, condition) { const destination = path.join(runsRoot, condition, id); rmSync(destination, { recursive: true, force: true }); mkdirSync(path.dirname(destination), { recursive: true }); cpSync(path.join(fixturesRoot, id), destination, { recursive: true }); runSync('git', ['init', '-b', 'main'], destination); runSync('git', ['config', 'user.email', 'benchmark@w2.local'], destination); runSync('git', ['config', 'user.name', 'W2 Benchmark'], destination); runSync('git', ['add', '.'], destination); runSync('git', ['commit', '-m', 'fixture baseline'], destination); return destination; }
function promptFor(task, dir) {
  return [`Task: ${task.title}`, `Goal: ${task.goal}`, `Constraints: ${task.constraints.join('; ')}`, `Allowed paths: ${task.allowed_paths.join(', ')}`, `Acceptance criteria: ${task.acceptance_criteria.map((item) => `${item.id}: ${item.statement}`).join('; ')}`, `Verification requirements: ${task.verification_commands.join('; ')}`, `Work in ${dir}. Run node verify.mjs and only report completion based on its actual result.`].join('\n\n');
}
async function verify(dir) { const started = now(); try { const result = await exec(process.execPath, ['verify.mjs'], { cwd: dir, timeout: 30000, windowsHide: true }); return { status: 'PASS', exit_code: 0, stdout: redact(result.stdout), stderr: redact(result.stderr), runtime_ms: now() - started }; } catch (error) { return { status: 'FAIL', exit_code: typeof error.code === 'number' ? error.code : 1, stdout: redact(error.stdout), stderr: redact(error.stderr ?? error.message), runtime_ms: now() - started }; } }
async function runRaw(contract, dir) {
  const task = { ...contract.task, allowed_paths: contract.allowed_paths };
  const started = now(); let stdout = ''; let stderr = ''; let exit_code = 1; let timed_out = false;
  try {
    const child = spawn('codex', ['exec', '--json', '--sandbox', 'workspace-write', '-C', dir, promptFor(task, dir)], { cwd: dir, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.setEncoding('utf8').on('data', (chunk) => { stdout += chunk; });
    child.stderr.setEncoding('utf8').on('data', (chunk) => { stderr += chunk; });
    const timer = setTimeout(() => { timed_out = true; child.kill(); }, timeoutMs);
    exit_code = await new Promise((resolve) => { child.once('error', (error) => { stderr += error.message; resolve(1); }); child.once('close', (code) => resolve(code ?? 1)); });
    clearTimeout(timer); stdout = redact(stdout); stderr = redact(stderr);
  } catch (error) { stderr = redact(error.message); exit_code = 1; }
  const external_verification = exit_code === 0 ? await verify(dir) : { status: 'NOT_RUN', exit_code: null, stdout: '', stderr: 'Agent execution did not complete.', runtime_ms: 0 };
  const changed = runSync('git', ['diff', '--name-only'], dir).split(/\r?\n/).map((value) => value.trim()).filter(Boolean); const scope_violations = changed.filter((file) => !contract.allowed_paths.includes(file));
  const agent_messages = assistantMessagesFromCodexEvents(stdout);
  const claim_done = hasCompletionClaim(stdout);
  const status = exit_code !== 0 ? 'INFRASTRUCTURE_FAILURE' : external_verification.status === 'PASS' && scope_violations.length === 0 ? 'TASK_PASS' : 'TASK_FAIL';
  const record = { condition: 'raw_codex', fixture_id: contract.fixture_id, baseline_commit: baselineCommit(dir), baseline_hash: contract.baseline_hash, task_semantics_hash: taskSemanticsHash(contract), timeout_ms: timeoutMs, execution_mode: 'REAL_CODEX', status, infrastructure_failure: status === 'INFRASTRUCTURE_FAILURE', timed_out, claim_done, agent_messages, claim_source: 'Codex JSONL agent_message/assistant_message items only', external_verification, runtime_ms: now() - started, model_calls: 1, tool_calls: null, steps: null, retries: null, manual_interventions: 0, scope_violations, evidence: { context: 'same normalized task contract in prompt', tool_trace: 'Codex JSON stdout stored', diff: changed, verification: external_verification }, output: stdout, stderr, exit_code };
  record.false_done = isFalseDoneBenchmarkRun(record);
  return record;
}
async function runW2(contract, dir) {
  const dbRoot = path.resolve('benchmarks/runtime-db'); mkdirSync(dbRoot, { recursive: true });
  const engine = new RunEngine({ databasePath: path.join(dbRoot, `${contract.fixture_id}.sqlite`) }); const started = now();
  const task = { task_id: contract.fixture_id, title: contract.task.title, goal: contract.task.goal, constraints: contract.task.constraints, allowed_paths: contract.allowed_paths, acceptance_criteria: contract.task.acceptance_criteria.map((item) => item.statement), verification_commands: contract.task.verification_commands.map((command) => ({ name: 'external-verifier', command, category: 'custom' })), workspace: dir, timeout_ms: timeoutMs };
  const run = await engine.run(task);
  const external_verification = run.verification_results.length ? { status: run.verification_results.every((item) => item.status === 'PASSED') ? 'PASS' : 'FAIL', exit_code: run.verification_results[0].exit_code, stdout: run.verification_results.map((item) => item.stdout).join('\n'), stderr: run.verification_results.map((item) => item.stderr).join('\n'), runtime_ms: run.verification_results.reduce((sum, item) => sum + item.duration_ms, 0) } : { status: 'NOT_RUN', exit_code: null, stdout: '', stderr: run.error ?? 'No verification evidence', runtime_ms: 0 };
  const evidence = deriveEvidence(run, engine.store.getEvents(run.run_id).length, engine.store.getToolCalls(run.run_id).length);
  const verifierEvidence = evidence.find((item) => item.type === 'ASSERTION_EVIDENCE' && item.raw_reference.includes(':verification:'));
  const acceptance = verifierEvidence && external_verification.status !== 'NOT_RUN' ? [{ criterion_id: 'AC-01', description: contract.task.acceptance_criteria[0].statement, required: true, status: external_verification.status === 'PASS' ? 'PASS' : 'FAIL', evidence_ids: [verifierEvidence.evidence_id], reason: `External verifier ${external_verification.status}.` }] : [];
  const receipt = buildRunReceipt(engine.store, run.run_id, { evidence, acceptance }); writeFileSync(path.join(dir, 'run-receipt.json'), JSON.stringify(receipt, null, 2) + '\n'); writeFileSync(path.join(dir, 'run-receipt.md'), renderReceiptMarkdown(receipt));
  const changed = run.diff?.changed_files ?? []; const scope_violations = changed.filter((file) => !contract.allowed_paths.includes(file) && file !== 'run-receipt.json' && file !== 'run-receipt.md');
  const status = run.status === 'ERROR' ? 'INFRASTRUCTURE_FAILURE' : receipt.outcome === 'PASS' && external_verification.status === 'PASS' && scope_violations.length === 0 ? 'TASK_PASS' : receipt.outcome === 'FAIL' ? 'TASK_FAIL' : 'TASK_UNPROVEN';
  const agentEvents = engine.store.getEvents(run.run_id).filter((event) => event.type === 'agent_output').map((event) => event.payload).filter((payload) => payload && typeof payload === 'object');
  const agent_message_events = agentEvents.map((payload) => payload.raw).filter(Boolean);
  const agent_messages = assistantMessagesFromCodexEvents(agent_message_events);
  const claim_done = hasCompletionClaim(agent_message_events);
  engine.close(); const record = { condition: 'w2_codex', fixture_id: contract.fixture_id, run_id: run.run_id, baseline_commit: baselineCommit(dir), baseline_hash: contract.baseline_hash, task_semantics_hash: taskSemanticsHash(contract), timeout_ms: timeoutMs, execution_mode: 'REAL_CODEX', status, infrastructure_failure: status === 'INFRASTRUCTURE_FAILURE', timed_out: run.error?.includes('timed out') ?? false, claim_done, agent_messages, agent_message_events, claim_source: 'persisted W2 agent_output events containing Codex agent_message/assistant_message items', external_verification, runtime_ms: now() - started, model_calls: 1, tool_calls: receipt.actions.tool_calls, steps: receipt.actions.events, retries: 0, manual_interventions: 0, scope_violations, criterion_evidence_coverage: computeCriterionEvidenceCoverage(receipt.acceptance, receipt.evidence), evidence: { context: receipt.context, tool_trace: receipt.actions, diff: receipt.changes, verification: receipt.verification, receipt: path.relative(process.cwd(), path.join(dir, 'run-receipt.json')) }, output: '' };
  record.false_done = isFalseDoneBenchmarkRun(record, receipt.acceptance);
  return record;
}
function writeReport(data) {
  mkdirSync(resultsRoot, { recursive: true }); writeFileSync(path.join(resultsRoot, 'results.json'), JSON.stringify(data, null, 2) + '\n');
  const columns = ['fixture_id','condition','execution_mode','status','false_done','criterion_evidence_coverage','runtime_ms','model_calls','tool_calls','steps','retries','manual_interventions','scope_violations'];
  const csv = [columns.join(','), ...data.runs.map((run) => columns.map((column) => JSON.stringify(Array.isArray(run[column]) ? run[column].length : run[column] ?? '')).join(','))].join('\n') + '\n'; writeFileSync(path.join(resultsRoot, 'results.csv'), csv);
  const summary = ['# Benchmark Report', '', '## Methodology', '', `Eight baseline-reset fixtures, two real Codex conditions, identical normalized task semantics and verifier, workspace-write sandbox, and a shared ${data.methodology.timeout_ms} ms agent timeout. Every run, including errors and timeouts, is retained.`, '', '## Metric definitions', '', '- **Criterion evidence coverage:** required criteria with at least one attached, existing deterministic verifier/assertion record carrying PASS or FAIL status, divided by required criteria. Diff, tool, context, lifecycle-only, interpreted, and nonexistent evidence references do not count. Zero required criteria yields 0.', '- **False DONE:** an affirmative completion claim in actual assistant/agent message text plus Raw external verifier FAIL/UNPROVEN, or W2 required criterion FAIL/UNPROVEN. Lifecycle/tool output is ignored; infrastructure failure is excluded.', '- **Infrastructure failure:** Codex process error or timeout; it is not counted as a task failure.', '- **Denominator:** all eight attempted runs per condition; infrastructure failures are separately shown and excluded from task-outcome rates.', '', '## Outcomes', '', '| Outcome | Raw Codex | W2 + Codex |', '|---|---:|---:|'];
  for (const status of ['TASK_PASS','TASK_FAIL','TASK_UNPROVEN','INFRASTRUCTURE_FAILURE']) { const raw = data.runs.filter((run) => run.condition === 'raw_codex'); const w2 = data.runs.filter((run) => run.condition === 'w2_codex'); summary.push(`| ${status} | ${raw.filter((run) => run.status === status).length}/8 | ${w2.filter((run) => run.status === status).length}/8 |`); }
  summary.push('', '## Limitations', '', '- One real run per task and condition is descriptive, not statistical.', '- This benchmark tests eight local fixtures only.', '- No speed, reliability, or safety advantage is inferred from this sample.', ''); writeFileSync('docs/BENCHMARK-REPORT.md', summary.join('\n'));
}

function validateRuns(runs, entries) {
  if (runs.length !== entries.length * 2) throw new Error('Benchmark validation failed: incomplete condition matrix');
  for (const entry of entries) {
    const pair = runs.filter((run) => run.fixture_id === entry.fixture_id);
    if (pair.length !== 2 || pair[0].task_semantics_hash !== pair[1].task_semantics_hash || pair[0].baseline_commit !== pair[1].baseline_commit || pair.some((run) => run.timeout_ms !== timeoutMs || run.execution_mode !== 'REAL_CODEX')) throw new Error(`${entry.fixture_id}: condition mismatch or missing Codex evidence`);
    for (const run of pair) {
      const dir = path.join(runsRoot, run.condition === 'raw_codex' ? 'raw' : 'w2', entry.fixture_id);
      if (!existsSync(path.join(dir, 'run-record.json'))) throw new Error(`${entry.fixture_id}: persisted run record missing`);
      if (run.condition === 'w2_codex' && (!run.evidence.receipt || !existsSync(run.evidence.receipt))) throw new Error(`${entry.fixture_id}: persisted receipt missing`);
    }
  }
  console.log(`Benchmark raw-data validation: PASS (${runs.length} actual condition records)`);
}

const entries = JSON.parse(readFileSync(path.join(fixturesRoot, 'index.json'), 'utf8'));
const runs = [];
if (process.argv.includes('--aggregate-only')) {
  for (const entry of entries) for (const condition of ['raw', 'w2']) runs.push(JSON.parse(readFileSync(path.join(runsRoot, condition, entry.fixture_id, 'run-record.json'), 'utf8')));
} else {
  for (const entry of entries) { const rawContract = normalizeTaskContract(JSON.parse(readFileSync(path.join(fixturesRoot, entry.fixture_id, 'task.json'), 'utf8'))); const w2Contract = normalizeTaskContract(JSON.parse(readFileSync(path.join(fixturesRoot, entry.fixture_id, 'task.json'), 'utf8'))); if (taskSemanticsHash(rawContract) !== taskSemanticsHash(w2Contract)) throw new Error(`${entry.fixture_id}: Raw/W2 task semantics mismatch`); const rawDir = copyFixture(entry.fixture_id, 'raw'); const raw = await runRaw(rawContract, rawDir); writeFileSync(path.join(rawDir, 'run-record.json'), JSON.stringify(raw, null, 2) + '\n'); runs.push(raw); const w2Dir = copyFixture(entry.fixture_id, 'w2'); const w2 = await runW2(w2Contract, w2Dir); writeFileSync(path.join(w2Dir, 'run-record.json'), JSON.stringify(w2, null, 2) + '\n'); runs.push(w2); }
}
validateRuns(runs, entries);
writeReport({ schema_version: 2, generated_at: new Date().toISOString(), methodology: { fixtures: entries.length, conditions: ['raw_codex','w2_codex'], model_config: 'local Codex configuration', sandbox: 'workspace-write', timeout_ms: timeoutMs, task_contract: 'normalized nested task contract' }, runs });
console.log(`Benchmark complete: ${runs.length} stored runs.`);
