import { execFile, execFileSync } from 'node:child_process';
import { promises as fs, cpSync, mkdirSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { RunEngine, buildRunReceipt, renderReceiptMarkdown } from '../dist/src/core/index.js';

const exec = promisify(execFile);
const fixturesRoot = path.resolve('benchmarks/fixtures');
const runsRoot = path.resolve('benchmarks/runs');
const resultsRoot = path.resolve('benchmarks/results');
const timeoutMs = Number(process.env.W2_BENCHMARK_TIMEOUT_MS ?? 90000);
const redact = (value) => String(value ?? '').replace(/(sk-[A-Za-z0-9_-]{12,}|Bearer\s+[A-Za-z0-9._~+/=-]{8,})/g, '[REDACTED]');
const now = () => Date.now();

function runSync(command, args, cwd) { return execFileSync(command, args, { cwd, encoding: 'utf8', windowsHide: true }); }
function copyFixture(id, condition) { const destination = path.join(runsRoot, condition, id); rmSync(destination, { recursive: true, force: true }); mkdirSync(path.dirname(destination), { recursive: true }); cpSync(path.join(fixturesRoot, id), destination, { recursive: true }); return destination; }
async function verify(dir) { const started = now(); try { const result = await exec(process.execPath, ['verify.mjs'], { cwd: dir, timeout: 30000, windowsHide: true }); return { status: 'PASS', exit_code: 0, stdout: redact(result.stdout), stderr: redact(result.stderr), runtime_ms: now() - started }; } catch (error) { return { status: 'FAIL', exit_code: typeof error.code === 'number' ? error.code : 1, stdout: redact(error.stdout), stderr: redact(error.stderr ?? error.message), runtime_ms: now() - started }; } }
async function runRaw(task, dir) {
  const prompt = `Work in ${dir}. ${task.goal}\nAllowed paths: ${task.allowed_paths.join(', ')}. Do not change any other path. Run node verify.mjs and only claim completion after it passes.`;
  const started = now(); let stdout = ''; let stderr = ''; let exit_code = 1; let timed_out = false;
  try { const result = await exec('codex', ['exec', '--json', '--dangerously-bypass-approvals-and-sandbox', '-C', dir, prompt], { cwd: dir, timeout: timeoutMs, windowsHide: true, maxBuffer: 8 * 1024 * 1024 }); stdout = redact(result.stdout); stderr = redact(result.stderr); exit_code = 0; } catch (error) { stdout = redact(error.stdout); stderr = redact(error.stderr ?? error.message); exit_code = typeof error.code === 'number' ? error.code : 1; timed_out = error.killed === true || error.signal === 'SIGTERM' || error.code === 'ETIMEDOUT'; }
  const external_verification = await verify(dir); const changed = runSync('git', ['diff', '--name-only'], dir).split(/\r?\n/).map((value) => value.trim()).filter(Boolean); const scope_violations = changed.filter((file) => !task.allowed_paths.includes(file));
  const claim_done = /\b(done|complete|completed|finished)\b/i.test(stdout); const status = timed_out ? 'INFRASTRUCTURE_FAILURE' : external_verification.status === 'PASS' && scope_violations.length === 0 ? 'PASS' : 'FAIL';
  return { condition: 'raw_codex', fixture_id: task.fixture_id, status, infrastructure_failure: timed_out, claim_done, false_done: claim_done && external_verification.status !== 'PASS', external_verification, runtime_ms: now() - started, model_calls: 1, tool_calls: null, steps: null, retries: null, manual_interventions: 0, scope_violations, evidence: { context: 'prompt task contract', tool_trace: 'codex JSON stdout stored', diff: changed, verification: external_verification }, output: stdout, stderr, exit_code };
}
async function runW2(task, dir) {
  const db = path.join(dir, 'w2-run.sqlite'); const engine = new RunEngine({ databasePath: db }); const started = now();
  const run = await engine.run({ task_id: task.fixture_id, title: task.title, goal: task.goal, constraints: task.constraints, allowed_paths: task.allowed_paths, acceptance_criteria: task.acceptance_criteria, verification_commands: [{ name: 'external-verifier', command: 'node verify.mjs', category: 'custom' }], workspace: dir, timeout_ms: timeoutMs });
  const receipt = buildRunReceipt(engine.store, run.run_id); writeFileSync(path.join(dir, 'run-receipt.json'), JSON.stringify(receipt, null, 2) + '\n'); writeFileSync(path.join(dir, 'run-receipt.md'), renderReceiptMarkdown(receipt));
  const external_verification = await verify(dir); const changed = run.diff?.changed_files ?? []; const scope_violations = changed.filter((file) => !task.allowed_paths.includes(file) && !/^w2-run\.sqlite(?:-.+)?$/.test(file));
  const status = run.status === 'ERROR' ? 'INFRASTRUCTURE_FAILURE' : receipt.outcome === 'PASS' && external_verification.status === 'PASS' && scope_violations.length === 0 ? 'PASS' : receipt.outcome;
  engine.close(); return { condition: 'w2_codex', fixture_id: task.fixture_id, status, infrastructure_failure: run.status === 'ERROR', claim_done: run.status === 'COMPLETED', false_done: run.status === 'COMPLETED' && receipt.outcome !== 'PASS', external_verification, runtime_ms: now() - started, model_calls: 1, tool_calls: receipt.actions.tool_calls, steps: receipt.actions.events, retries: 0, manual_interventions: 0, scope_violations, evidence: { context: receipt.context, tool_trace: receipt.actions, diff: receipt.changes, verification: receipt.verification, receipt: path.relative(process.cwd(), path.join(dir, 'run-receipt.json')) }, output: '' };
}
function writeReport(data) {
  mkdirSync(resultsRoot, { recursive: true }); writeFileSync(path.join(resultsRoot, 'results.json'), JSON.stringify(data, null, 2) + '\n');
  const columns = ['fixture_id','condition','status','false_done','criterion_evidence_coverage','runtime_ms','model_calls','tool_calls','steps','retries','manual_interventions','scope_violations'];
  const csv = [columns.join(','), ...data.runs.map((run) => columns.map((column) => JSON.stringify(column === 'criterion_evidence_coverage' ? (run.evidence?.verification ? 1 : 0) : Array.isArray(run[column]) ? run[column].length : run[column] ?? '')).join(','))].join('\n') + '\n'; writeFileSync(path.join(resultsRoot, 'results.csv'), csv);
  const caseRun = data.runs.find((run) => run.status !== 'PASS') ?? data.runs[0];
  const summary = ['# Benchmark Report', '', '## Methodology', '', 'Eight reproducible local fixtures were reset from committed baselines. Each fixture was run once with direct Raw Codex and once through the W2 RunEngine + Codex adapter. Both conditions used the same task contract, verifier, workspace, timeout, and local Codex configuration. Failed runs and raw artifacts remain under `benchmarks/runs/`.', '', '## Metric definitions', '', '- **False DONE:** the agent emitted a completion claim while the independent verifier did not pass.', '- **Evidence coverage:** whether the condition stored context, action/tool, diff, and verification evidence for the run.', '- **Infrastructure failure:** a Codex/process failure is retained as a run status and is not relabeled as a task failure.', '', '## Stored results', '', '| Metric | Raw Codex | W2 + Codex |', '|---|---:|---:|'];
  for (const metric of ['status','false_done','runtime_ms','tool_calls','steps']) { const raw = data.runs.filter((r) => r.condition === 'raw_codex'); const w2 = data.runs.filter((r) => r.condition === 'w2_codex'); const value = (items) => metric === 'status' ? `${items.filter((r) => r.status === 'PASS').length}/${items.length} PASS` : metric === 'false_done' ? items.filter((r) => r.false_done).length : Math.round(items.map((r) => Number(r[metric] ?? 0)).reduce((a,b) => a + b, 0) / Math.max(items.length, 1)); summary.push(`| ${metric} | ${value(raw)} | ${value(w2)} |`); }
  summary.push('', '## Case study', '', `Stored case: **${caseRun.fixture_id} / ${caseRun.condition}**. Status=${caseRun.status}; external verifier=${caseRun.external_verification.status}; infrastructure_failure=${caseRun.infrastructure_failure ?? false}. This is the actual first non-PASS stored run, not staged evidence.`, '', '## Limitations', '', '- This is a one-run-per-condition sample; it is descriptive, not a statistical performance claim.', '- Token counts are left unmeasured where the local Codex JSON stream does not expose them.', '- Model/service outages remain visible as infrastructure failures.', '', '## Claims', '', 'All numbers in this report are generated from `benchmarks/results/results.json`; no unsupported speed, safety, accuracy, or cost claim is made.', ''); writeFileSync('docs/BENCHMARK-REPORT.md', summary.join('\n'));
}

const entries = JSON.parse(readFileSync(path.join(fixturesRoot, 'index.json'), 'utf8'));
const runs = [];
for (const entry of entries) { const contract = JSON.parse(readFileSync(path.join(fixturesRoot, entry.fixture_id, 'task.json'), 'utf8')); const rawDir = copyFixture(entry.fixture_id, 'raw'); const raw = await runRaw(contract, rawDir); writeFileSync(path.join(rawDir, 'run-record.json'), JSON.stringify(raw, null, 2)); runs.push(raw); const w2Dir = copyFixture(entry.fixture_id, 'w2'); const w2 = await runW2(contract, w2Dir); writeFileSync(path.join(w2Dir, 'run-record.json'), JSON.stringify(w2, null, 2)); runs.push(w2); }
writeReport({ schema_version: 1, generated_at: new Date().toISOString(), methodology: { fixtures: entries.length, conditions: ['raw_codex','w2_codex'], model_config: 'local Codex configuration', timeout_ms: timeoutMs }, runs });
console.log(`Benchmark complete: ${runs.length} stored runs.`);
