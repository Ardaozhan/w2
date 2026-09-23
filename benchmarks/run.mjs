import { execFile, execFileSync, spawn } from 'node:child_process';
import { cpSync, mkdirSync, rmSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { normalizeTaskContract, taskSemanticsHash } from './task-contract.mjs';
import { assistantMessagesFromCodexEvents, hasCompletionClaim } from './completion-claim.mjs';
import { isFalseDoneBenchmarkRun } from './metrics.mjs';
import { createIsolatedCodexEnvironment, configureTrustedProjects, configureIsolatedGitWorkspace, createRunCodexEnvironment, assertIsolatedEnvironment, assertNoAncestorContext, classifyProfileReference, inspectCodexPromptInput, sanitizeRunValue, cleanupIsolatedCodexEnvironment } from './codex-isolation.mjs';
import { CodexAgentAdapter } from '../dist/src/core/agent.js';
import { RunEngine, buildRunReceipt, computeCriterionEvidenceCoverage, renderReceiptMarkdown } from '../dist/src/core/index.js';

const exec = promisify(execFile);
const fixturesRoot = path.resolve('benchmarks/fixtures');
const runsRoot = path.resolve('benchmarks/runs');
const resultsRoot = path.resolve('benchmarks/results');
const timeoutMs = Number(process.env.W2_BENCHMARK_TIMEOUT_MS ?? 90000);
const model = 'gpt-6-luna';
if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 30000 || timeoutMs > 180000) throw new Error('W2_BENCHMARK_TIMEOUT_MS must be 30-180 seconds');
const defaultIsolationRoot = path.join(path.parse(process.cwd()).root, 'w2-benchmark-isolation');
const isolationRoot = path.resolve(process.env.W2_BENCHMARK_ISOLATION_ROOT ?? defaultIsolationRoot);
const redact = (value) => String(value ?? '').replace(/(sk-[A-Za-z0-9_-]{12,}|Bearer\s+[A-Za-z0-9._~+/=-]{8,})/g, '[REDACTED]');
const now = () => Date.now();

function runSync(command, args, cwd, env = process.env) { return execFileSync(command, args, { cwd, encoding: 'utf8', windowsHide: true, env: { ...env, GIT_AUTHOR_DATE: '2000-01-01T00:00:00Z', GIT_COMMITTER_DATE: '2000-01-01T00:00:00Z' } }); }
function baselineCommit(cwd, env) { return runSync('git', ['rev-parse', 'HEAD'], cwd, env).trim(); }
function isUnder(root, candidate) { const relative = path.relative(root, candidate); return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative)); }
function copyFixture(id, condition, isolation) {
  const destination = path.resolve(isolation.workspaces, 'current');
  if (!isUnder(isolation.workspaces, destination)) throw new Error('Benchmark workspace escaped the isolated workspace root');
  rmSync(destination, { recursive: true, force: true });
  mkdirSync(path.dirname(destination), { recursive: true });
  cpSync(path.join(fixturesRoot, id), destination, { recursive: true });
  runSync('git', ['init', '-b', 'main'], destination, isolation.env);
  runSync('git', ['config', 'user.email', 'benchmark@w2.local'], destination, isolation.env);
  runSync('git', ['config', 'user.name', 'W2 Benchmark'], destination, isolation.env);
  runSync('git', ['config', 'core.autocrlf', 'false'], destination, isolation.env);
  runSync('git', ['add', '.'], destination, isolation.env);
  runSync('git', ['commit', '-m', 'fixture baseline'], destination, isolation.env);
  assertNoAncestorContext(destination);
  return destination;
}
function promptFor(task) {
  return [
    `Task: ${task.title}`,
    `Goal: ${task.goal}`,
    `Constraints: ${task.constraints.join('; ')}`,
    `Allowed paths: ${task.allowed_paths.join(', ')}`,
    `Acceptance criteria: ${task.acceptance_criteria.map((item) => `${item.id} (${item.required ? 'required' : 'optional'}): ${item.statement} [verifiers: ${item.verification_refs.join(', ') || 'none'}]`).join('; ')}`,
    `Verification requirements: ${task.verification_commands.map((item) => `${item.id} / ${item.name}: ${item.command}`).join('; ')}`,
    'Work in the supplied workspace only. Run the declared verification command and report the actual result.',
  ].join('\n\n');
}
function verifyText(text, workspace, isolation) {
  const userHome = process.env.USERPROFILE ?? process.env.HOME ?? '';
  const runtimeDirectory = path.dirname(isolation.codexExe);
  const normalizedText = String(text ?? '').replace(/\\\\/g, '\\').replace(/\//g, '\\').replace(/\\+/g, '\\');
  const runtimeSanitized = sanitizeRunValue(normalizedText, [[runtimeDirectory, '<CODEX_RUNTIME>'], [isolation.codexExe, '<CODEX_RUNTIME>']]);
  const profileReference = classifyProfileReference(runtimeSanitized, userHome);
  if (profileReference !== 'NONE') throw new Error(`Captured Codex output referenced ${profileReference}`);
  if (runtimeSanitized.includes(path.resolve(process.cwd()))) throw new Error('Captured Codex output referenced the W2 repository outside the fixture');
  const parentWorkspaces = path.resolve(isolation.workspaces);
  const allowedPath = path.resolve(workspace);
  const normalized = runtimeSanitized.replace(/\//g, '\\').toLowerCase();
  const normalizedParent = parentWorkspaces.replace(/\//g, '\\').toLowerCase();
  const normalizedAllowed = allowedPath.replace(/\//g, '\\').toLowerCase();
  if (normalized.includes(normalizedParent) && !normalized.includes(normalizedAllowed)) throw new Error('Captured Codex output referenced an unrelated benchmark workspace');
}
function publicReplacements(workspace, isolation) {
  return [
    [path.resolve(workspace), '<WORKSPACE>'],
    [path.resolve(isolation.codexHome), '<CODEX_HOME>'],
    [path.dirname(isolation.codexExe), '<CODEX_RUNTIME>'],
    [isolation.codexExe, '<CODEX_RUNTIME>'],
    [path.resolve(isolation.profile), '<USER_HOME>'],
    [path.resolve(isolation.root), '<ISOLATION_ROOT>'],
    ...(process.env.SystemRoot ? [[process.env.SystemRoot, '<SYSTEM_ROOT>']] : []),
  ];
}
function storeArtifact(condition, fixtureId, record, receipt) {
  const destination = path.join(runsRoot, condition, fixtureId);
  rmSync(destination, { recursive: true, force: true });
  mkdirSync(destination, { recursive: true });
  if (receipt) {
    writeFileSync(path.join(destination, 'run-receipt.json'), `${JSON.stringify(receipt, null, 2)}\n`);
    writeFileSync(path.join(destination, 'run-receipt.md'), renderReceiptMarkdown(receipt));
    record.evidence.receipt = path.join(destination, 'run-receipt.json').replace(`${process.cwd()}${path.sep}`, '').replace(/\\/g, '/');
  }
  writeFileSync(path.join(destination, 'run-record.json'), `${JSON.stringify(record, null, 2)}\n`);
  return record;
}
async function verify(dir, env) {
  const started = now();
  try {
    const result = await exec(process.execPath, ['verify.mjs'], { cwd: dir, timeout: 30000, windowsHide: true, env });
    return { status: 'PASS', exit_code: 0, stdout: redact(result.stdout), stderr: redact(result.stderr), runtime_ms: now() - started };
  } catch (error) {
    const timedOut = error.killed === true || error.code === 'ETIMEDOUT';
    const launchFailure = ['ENOENT','EACCES','EPERM'].includes(error.code);
    return { status: timedOut || launchFailure ? 'ERROR' : 'FAIL', exit_code: typeof error.code === 'number' ? error.code : null, stdout: redact(error.stdout), stderr: redact(error.stderr ?? error.message), runtime_ms: now() - started };
  }
}
async function runRaw(contract, dir, isolation, promptValidation) {
  const runIsolation = createRunCodexEnvironment(isolation, `raw-${contract.fixture_id}`);
  configureIsolatedGitWorkspace(runIsolation, dir);
  const baseline_commit = baselineCommit(dir, runIsolation.env);
  let envCheck = assertIsolatedEnvironment(runIsolation);
  const task = { ...contract.task, allowed_paths: contract.allowed_paths };
  const started = now(); let stdout = ''; let stderr = ''; let exit_code = 1; let timed_out = false; let spawnError = false;
  try {
    const args = ['--no-daemon', '--sandbox', 'workspace-write', 'exec', '--json', '--ephemeral', '--ignore-rules', '-C', dir, '--model', model, promptFor(task)];
    const child = spawn('codex', args, { cwd: dir, env: runIsolation.env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.setEncoding('utf8').on('data', (chunk) => { stdout += chunk; });
    child.stderr.setEncoding('utf8').on('data', (chunk) => { stderr += chunk; });
    const timer = setTimeout(() => { timed_out = true; child.kill(); }, timeoutMs);
    exit_code = await new Promise((resolve) => { child.once('error', (error) => { spawnError = true; stderr += error.message; resolve(1); }); child.once('close', (code) => resolve(code ?? 1)); });
    clearTimeout(timer);
  } catch (error) { spawnError = true; stderr = error instanceof Error ? error.message : String(error); exit_code = 1; }
  const combinedOutput = `${stdout}\n${stderr}`;
  let hermeticity = { ...envCheck };
  let hermeticityFailure = false;
  let hermeticityFailureReason;
  try { verifyText(combinedOutput, dir, runIsolation); }
  catch (error) { hermeticityFailure = true; hermeticityFailureReason = error instanceof Error ? error.message : 'Captured output referenced a global or unrelated local context path.'; }
  const external_verification = exit_code === 0 ? await verify(dir, runIsolation.verifierEnv) : { status: 'NOT_RUN', exit_code: null, stdout: '', stderr: 'Agent execution did not complete.', runtime_ms: 0 };
  try { verifyText(JSON.stringify(external_verification), dir, runIsolation); }
  catch (error) { hermeticityFailure = true; hermeticityFailureReason = error instanceof Error ? error.message : 'External verifier output referenced global or unrelated local context.'; }
  try { envCheck = assertIsolatedEnvironment(runIsolation); if (!hermeticityFailure) hermeticity = envCheck; }
  catch (error) { hermeticityFailure = true; hermeticityFailureReason = error instanceof Error ? error.message : 'Per-run Codex home gained forbidden global context.'; }
  if (hermeticityFailure) hermeticity = { ...hermeticity, status: 'FAIL', failure: hermeticityFailureReason ?? 'Per-run isolation validation failed.' };
  hermeticity.model_prompt_validation = promptValidation.status;
  const changed = runSync('git', ['diff', '--name-only'], dir, runIsolation.env).split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
  const scope_violations = changed.filter((file) => !contract.allowed_paths.includes(file));
  const agent_messages = assistantMessagesFromCodexEvents(stdout);
  const claim_done = hasCompletionClaim(stdout);
  const status = spawnError || timed_out || exit_code !== 0 || external_verification.status === 'ERROR' || hermeticityFailure ? 'INFRASTRUCTURE_FAILURE' : external_verification.status === 'PASS' && scope_violations.length === 0 ? 'TASK_PASS' : 'TASK_FAIL';
  const replacements = publicReplacements(dir, runIsolation);
  const publicOutput = hermeticityFailure ? '[OMITTED: hermeticity check rejected captured output]' : sanitizeRunValue(redact(stdout), replacements);
  const publicStderr = hermeticityFailure ? '[OMITTED: hermeticity check rejected captured output]' : sanitizeRunValue(redact(stderr), replacements);
  const publicVerification = sanitizeRunValue(external_verification, replacements);
  const record = { condition: 'raw_codex', fixture_id: contract.fixture_id, baseline_commit, baseline_hash: contract.baseline_hash, task_semantics_hash: taskSemanticsHash(contract), timeout_ms: timeoutMs, model, model_config_sha256: isolation.configSha256, execution_mode: 'REAL_CODEX', status, infrastructure_failure: status === 'INFRASTRUCTURE_FAILURE', execution_failure: spawnError || timed_out || exit_code !== 0 || external_verification.status === 'ERROR', timed_out, claim_done: hermeticityFailure ? false : claim_done, agent_messages: hermeticityFailure ? [] : sanitizeRunValue(agent_messages, replacements), claim_source: 'Codex JSONL agent_message/assistant_message items only', external_verification: publicVerification, verification_coverage: external_verification.status === 'NOT_RUN' ? 0 : 1, runtime_ms: now() - started, model_calls: null, tool_calls: null, event_count: stdout.split(/\r?\n/).filter((line) => line.trim()).length, retries: null, manual_interventions: 0, scope_violations, criterion_evidence_coverage: null, hermeticity, evidence: { context: 'normalized task and acceptance contract; explicit isolated CODEX_HOME; inherited instructions ignored', tool_trace: 'Codex JSON stdout stored when hermeticity validation passes', diff: changed, verification: publicVerification }, output: publicOutput, stderr: publicStderr, exit_code };
  record.false_done = isFalseDoneBenchmarkRun(record);
  return storeArtifact('raw', contract.fixture_id, record);
}
async function runW2(contract, dir, isolation, promptValidation) {
  const runIsolation = createRunCodexEnvironment(isolation, `w2-${contract.fixture_id}`);
  configureIsolatedGitWorkspace(runIsolation, dir);
  const baseline_commit = baselineCommit(dir, runIsolation.env);
  let envCheck = assertIsolatedEnvironment(runIsolation);
  const task = { task_id: contract.fixture_id, title: contract.task.title, goal: contract.task.goal, constraints: contract.task.constraints, allowed_paths: contract.allowed_paths, acceptance_criteria: contract.task.acceptance_criteria, verification_commands: contract.task.verification_commands, workspace: dir, timeout_ms: timeoutMs, model };
  const dbRoot = path.join(isolation.root, 'runtime-db'); mkdirSync(dbRoot, { recursive: true });
  const engine = new RunEngine({ databasePath: path.join(dbRoot, `${contract.fixture_id}.sqlite`), adapter: new CodexAgentAdapter({ env: runIsolation.env, noDaemon: true, extraArgs: ['--ephemeral', '--ignore-rules'] }), runtime: { env: runIsolation.verifierEnv } });
  const started = now();
  try {
    const run = await engine.run(task);
    const receipt = buildRunReceipt(engine.store, run.run_id);
    const verifierStatuses = run.verification_results.map((item) => item.status);
    const external_verification = run.verification_results.length ? {
      status: verifierStatuses.includes('ERROR') ? 'ERROR' : verifierStatuses.every((item) => item === 'PASSED') ? 'PASS' : 'FAIL',
      exit_code: run.verification_results[0]?.exit_code ?? null,
      stdout: run.verification_results.map((item) => item.stdout).join('\n'), stderr: run.verification_results.map((item) => item.stderr).join('\n'),
      runtime_ms: run.verification_results.reduce((sum, item) => sum + item.duration_ms, 0),
    } : { status: 'NOT_RUN', exit_code: null, stdout: '', stderr: run.error ?? 'No verification evidence', runtime_ms: 0 };
    const changed = run.diff?.changed_files ?? [];
    const scope_violations = changed.filter((file) => !contract.allowed_paths.includes(file));
    let hermeticity = { ...envCheck };
    let hermeticityFailure = false;
    let hermeticityFailureReason;
    try { verifyText(JSON.stringify({ events: engine.store.getEvents(run.run_id), receipt, verification: external_verification }), dir, runIsolation); }
    catch (error) { hermeticityFailure = true; hermeticityFailureReason = error instanceof Error ? error.message : 'Captured W2 run evidence referenced a global or unrelated local context path.'; }
    try { envCheck = assertIsolatedEnvironment(runIsolation); if (!hermeticityFailure) hermeticity = envCheck; }
    catch (error) { hermeticityFailure = true; hermeticityFailureReason = error instanceof Error ? error.message : 'Per-run Codex home gained forbidden global context.'; }
    if (hermeticityFailure) hermeticity = { ...hermeticity, status: 'FAIL', failure: hermeticityFailureReason ?? 'Per-run isolation validation failed.' };
    hermeticity.model_prompt_validation = promptValidation.status;
    const status = run.status === 'ERROR' || hermeticityFailure ? 'INFRASTRUCTURE_FAILURE' : receipt.outcome === 'PASS' && external_verification.status === 'PASS' && scope_violations.length === 0 ? 'TASK_PASS' : receipt.outcome === 'FAIL' ? 'TASK_FAIL' : 'TASK_UNPROVEN';
    const agentEvents = engine.store.getEvents(run.run_id).filter((event) => event.type === 'agent_output').map((event) => event.payload).filter((payload) => payload && typeof payload === 'object');
    const replacements = publicReplacements(dir, runIsolation);
    const publicReceipt = sanitizeRunValue(receipt, replacements);
    const publicEvents = hermeticityFailure ? [] : sanitizeRunValue(agentEvents, replacements);
    const agentMessages = hermeticityFailure ? [] : assistantMessagesFromCodexEvents(publicEvents.map((payload) => payload.raw).filter(Boolean));
    const claim_done = hermeticityFailure ? false : hasCompletionClaim(publicEvents.map((payload) => payload.raw).filter(Boolean));
    const record = { condition: 'w2_codex', fixture_id: contract.fixture_id, run_id: run.run_id, baseline_commit, baseline_hash: contract.baseline_hash, task_semantics_hash: taskSemanticsHash(contract), timeout_ms: timeoutMs, model, model_config_sha256: isolation.configSha256, execution_mode: 'REAL_CODEX', status, infrastructure_failure: status === 'INFRASTRUCTURE_FAILURE', execution_failure: run.status === 'ERROR', timed_out: run.error?.includes('timed out') ?? false, claim_done, agent_messages: agentMessages, agent_message_events: publicEvents, claim_source: 'persisted W2 agent_output events containing Codex agent_message/assistant_message items', external_verification: sanitizeRunValue(external_verification, replacements), verification_coverage: task.verification_commands.length ? run.verification_results.length / task.verification_commands.length : 0, runtime_ms: now() - started, model_calls: null, tool_calls: publicReceipt.actions.tool_calls, event_count: publicReceipt.actions.events, retries: null, manual_interventions: 0, scope_violations, criterion_evidence_coverage: computeCriterionEvidenceCoverage(publicReceipt.acceptance, publicReceipt.evidence), hermeticity, evidence: { context: publicReceipt.context, tool_trace: publicReceipt.actions, diff: publicReceipt.changes, verification: publicReceipt.verification, receipt: null }, output: hermeticityFailure ? '[OMITTED: hermeticity check rejected captured evidence]' : '', stderr: '' };
    record.false_done = isFalseDoneBenchmarkRun(record, publicReceipt.acceptance);
    const stored = storeArtifact('w2', contract.fixture_id, record, hermeticityFailure ? undefined : publicReceipt);
    return stored;
  } finally { engine.close(); }
}

function writeReport(data) {
  mkdirSync(resultsRoot, { recursive: true });
  writeFileSync(path.join(resultsRoot, 'results.json'), `${JSON.stringify(data, null, 2)}\n`);
  const columns = ['fixture_id','condition','execution_mode','status','false_done','criterion_evidence_coverage','verification_coverage','runtime_ms','model_calls','tool_calls','event_count','retries','manual_interventions','scope_violations'];
  const csv = [columns.join(','), ...data.runs.map((run) => columns.map((column) => JSON.stringify(Array.isArray(run[column]) ? run[column].length : run[column] ?? '')).join(','))].join('\n') + '\n';
  writeFileSync(path.join(resultsRoot, 'results.csv'), csv);
  const counts = (condition, status) => data.runs.filter((run) => run.condition === condition && run.status === status).length;
  const raw = data.runs.filter((run) => run.condition === 'raw_codex');
  const w2 = data.runs.filter((run) => run.condition === 'w2_codex');
  const average = (values) => values.length ? (values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1) : 'n/a';
  const summary = [
    '# Benchmark Report', '', '## Environment', '',
    `- Codex CLI: ${data.methodology.codex_version}`, `- Model/config: ${data.methodology.model} (config SHA-256 ${data.methodology.model_config_sha256})`,
    `- Codex home: isolated temporary CODEX_HOME with copied authentication only, explicit config, no user memories/prompts/sessions`,
    `- Sandbox: ${data.methodology.sandbox}; Windows implementation: ${data.methodology.windows_sandbox}; rules: ignored; execution: ephemeral`,
    `- Workspaces: independent fixture copies outside the repository and user profile`,
    `- Runtime file access: direct OS reads beyond captured events are not observable through the Codex CLI adapter`, '',
    '## Methodology', '',
    `Eight baseline-reset fixtures, two REAL_CODEX conditions, ${data.methodology.timeout_ms} ms per Codex run. Both conditions use the same normalized task, acceptance references, model/config, baseline files, workspace-write sandbox, and external verifier. The harness runs eight Raw Codex runs and eight W2 + Codex runs; all attempted records, including failures and timeouts, are retained.`,
    '', 'A few earlier harness attempts stopped before a valid paired matrix was produced. Their raw data and reasons remain in the gitignored local archive at `benchmarks/archive/pre-hermetic-final/`; none of those records are cherry-picked into this final 8×2 score set.',
    '', '## Results', '', '| Metric | Raw Codex | W2 + Codex |', '|---|---:|---:|',
    ...['TASK_PASS','TASK_FAIL','TASK_UNPROVEN','INFRASTRUCTURE_FAILURE'].map((status) => `| ${status} | ${counts('raw_codex', status)}/8 | ${counts('w2_codex', status)}/8 |`),
    `| False-DONE | ${raw.filter((run) => run.false_done).length} | ${w2.filter((run) => run.false_done).length} |`,
    `| External verifier PASS | ${raw.filter((run) => run.external_verification.status === 'PASS').length}/8 | ${w2.filter((run) => run.external_verification.status === 'PASS').length}/8 |`,
    `| Verification coverage (mean) | ${average(raw.map((run) => run.verification_coverage * 100))}% | ${average(w2.map((run) => run.verification_coverage * 100))}% |`,
    `| Criterion evidence coverage (mean) | n/a (Raw has no receipt mapping) | ${average(w2.map((run) => run.criterion_evidence_coverage * 100))}% |`,
    `| Scope violations | ${raw.reduce((sum, run) => sum + run.scope_violations.length, 0)} | ${w2.reduce((sum, run) => sum + run.scope_violations.length, 0)} |`,
    `| Runtime mean | ${average(raw.map((run) => run.runtime_ms))} ms | ${average(w2.map((run) => run.runtime_ms))} ms |`,
    `| Observable tool/event counts | not comparable in this adapter | ${w2.reduce((sum, run) => sum + run.tool_calls, 0)} tool calls / ${w2.reduce((sum, run) => sum + run.event_count, 0)} W2 events |`,
    '', '## Raw results', '', '| Fixture | Raw Codex | W2 + Codex | W2 evidence coverage |', '|---|---|---|---:|',
    ...data.fixture_ids.map((id) => { const left = raw.find((run) => run.fixture_id === id); const right = w2.find((run) => run.fixture_id === id); return `| ${id} | ${left?.status ?? 'MISSING'} | ${right?.status ?? 'MISSING'} | ${right ? (right.criterion_evidence_coverage * 100).toFixed(0) : 'n/a'}% |`; }),
    '', '## Metric definitions', '',
    '- **False-DONE:** an actual assistant completion claim plus Raw verifier FAIL/UNPROVEN, or W2 required acceptance FAIL/UNPROVEN. Infrastructure failures are excluded.',
    '- **Criterion evidence coverage:** required criteria with attached existing deterministic verifier evidence, divided by required criteria. Missing, interpreted, context, diff, tool, and lifecycle evidence do not count.',
    '- **Infrastructure failure:** Codex launch/process/timeout, verification infrastructure error, or hermeticity failure. It is not a task failure.',
    '- **Runtime:** elapsed Codex run wall time, including W2 preparation/verification for the W2 condition.',
    `- **Canonical matrix validation:** ${data.validation?.status ?? 'NOT_RUN'}${data.validation?.reason ? ` (${data.validation.reason})` : ''}.`,
    '', '## Limitations', '',
    '- One run per fixture and condition is descriptive, not statistical.',
    '- The benchmark covers eight local fixtures and does not include OS-level file-read tracing; isolated config, environment, workspace ancestry, and captured outputs are validated.',
    '- This benchmark does not establish a correctness advantage unless the measured results support one.',
    '- W2 demonstrates acceptance-level evidence, observability, auditability, and explicit uncertainty; it does not replace CI.', '',
  ];
  writeFileSync('docs/BENCHMARK-REPORT.md', summary.join('\n'));
}

function validateRuns(runs, entries, isolation) {
  if (runs.length !== entries.length * 2) throw new Error('Benchmark validation failed: incomplete condition matrix');
  for (const entry of entries) {
    const pair = runs.filter((run) => run.fixture_id === entry.fixture_id);
    if (pair.length !== 2 || pair[0].task_semantics_hash !== pair[1].task_semantics_hash || pair[0].baseline_hash !== pair[1].baseline_hash || pair.some((run) => run.timeout_ms !== timeoutMs || run.model !== model || run.model_config_sha256 !== isolation.configSha256 || run.execution_mode !== 'REAL_CODEX')) throw new Error(`${entry.fixture_id}: condition mismatch or missing Codex evidence`);
    for (const run of pair) {
      if (run.hermeticity?.status !== 'PASS' || run.hermeticity?.workspace_write_sandbox !== 'workspace-write' || run.hermeticity?.windows_sandbox !== 'unelevated' || run.hermeticity?.model_prompt_validation !== 'PASS') throw new Error(`${entry.fixture_id}: benchmark hermeticity validation failed`);
      const dir = path.join(runsRoot, run.condition === 'raw_codex' ? 'raw' : 'w2', entry.fixture_id);
      const stored = JSON.parse(readFileSync(path.join(dir, 'run-record.json'), 'utf8'));
      if (stored.status !== run.status || stored.hermeticity?.status !== 'PASS') throw new Error(`${entry.fixture_id}: stored run record does not match validated output`);
      if (run.condition === 'w2_codex' && (!run.evidence.receipt || !existsSync(run.evidence.receipt))) throw new Error(`${entry.fixture_id}: persisted automatic Run Receipt missing`);
      if (run.condition === 'raw_codex') {
        const receiptEvidence = run.external_verification.status;
        if (!['PASS','FAIL','NOT_RUN'].includes(receiptEvidence)) throw new Error(`${entry.fixture_id}: invalid external verifier status`);
      }
    }
    if (pair[0].baseline_hash !== pair[1].baseline_hash) throw new Error(`${entry.fixture_id}: baseline content differs between conditions`);
  }
  console.log(`Benchmark data and environment validation: PASS (${runs.length} actual REAL_CODEX records; user context excluded)`);
}

const entries = JSON.parse(readFileSync(path.join(fixturesRoot, 'index.json'), 'utf8'));
const isolation = createIsolatedCodexEnvironment(isolationRoot);
const runs = [];
let methodology;
try {
  const trustedProjects = [path.join(isolation.workspaces, 'current')];
  configureTrustedProjects(isolation, trustedProjects);
  const promptValidation = inspectCodexPromptInput(createRunCodexEnvironment(isolation, 'hermeticity-preflight'), isolation.workspaces, 'Verify that this session has no inherited user or host repository instructions.');
  isolation.promptInputValidation = promptValidation;
  const codexVersion = execFileSync('codex', ['--version'], { encoding: 'utf8', windowsHide: true, env: isolation.env }).trim();
  methodology = { fixtures: entries.length, conditions: ['raw_codex','w2_codex'], model, model_config_sha256: isolation.configSha256, codex_version: codexVersion, sandbox: 'workspace-write', windows_sandbox: 'unelevated', approval_policy: 'never; sandbox remains enforced', writable_scope: 'one isolated fixture workspace, reset to its source baseline before every run', isolated_home: '<CODEX_HOME>', isolation_root: '<ISOLATION_ROOT>', timeout_ms: timeoutMs, task_contract: 'normalized nested contract with explicit verifier references', user_memory: 'disabled', user_skill_instructions: 'disabled', model_prompt_isolation: promptValidation, project_rules: 'ignored', runtime_file_reads: 'UNOBSERVED beyond captured CLI evidence' };
  for (const entry of entries) {
    const rawContract = normalizeTaskContract(JSON.parse(readFileSync(path.join(fixturesRoot, entry.fixture_id, 'task.json'), 'utf8')));
    const w2Contract = normalizeTaskContract(JSON.parse(readFileSync(path.join(fixturesRoot, entry.fixture_id, 'task.json'), 'utf8')));
    if (taskSemanticsHash(rawContract) !== taskSemanticsHash(w2Contract)) throw new Error(`${entry.fixture_id}: Raw/W2 task semantics mismatch`);
    const rawDir = copyFixture(entry.fixture_id, 'raw', isolation);
    const raw = await runRaw(rawContract, rawDir, isolation, promptValidation);
    runs.push(raw);
    if (raw.hermeticity.status !== 'PASS') throw new Error(`${entry.fixture_id}/raw: hermeticity check failed; benchmark stopped after retaining the run record`);
    const w2Dir = copyFixture(entry.fixture_id, 'w2', isolation);
    const w2 = await runW2(w2Contract, w2Dir, isolation, promptValidation);
    runs.push(w2);
    if (w2.hermeticity.status !== 'PASS') throw new Error(`${entry.fixture_id}/w2: hermeticity check failed; benchmark stopped after retaining the run record`);
  }
  const data = { schema_version: 3, generated_at: new Date().toISOString(), fixture_ids: entries.map((entry) => entry.fixture_id), methodology, runs };
  try {
    validateRuns(runs, entries, isolation);
    data.validation = { status: 'PASS' };
  } catch (error) {
    data.validation = { status: 'FAIL', reason: error instanceof Error ? error.message : String(error) };
    writeReport(data);
    throw error;
  }
  writeReport(data);
  console.log(`Benchmark complete: ${runs.length} stored paired REAL_CODEX runs.`);
} catch (error) {
  if (methodology && runs.length) {
    writeReport({ schema_version: 3, generated_at: new Date().toISOString(), fixture_ids: entries.map((entry) => entry.fixture_id), methodology, runs, validation: { status: 'FAIL', reason: error instanceof Error ? error.message : 'Benchmark harness failed.' } });
  }
  throw error;
} finally {
  cleanupIsolatedCodexEnvironment(isolation);
}
