import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assistantMessagesFromCodexEvents, hasCompletionClaim } from './completion-claim.mjs';
import { createIsolatedCodexEnvironment, configureTrustedProjects, configureIsolatedGitWorkspace, createRunCodexEnvironment, assertNoAncestorContext, assertNoUserHomeLeak, sanitizeRunValue, cleanupIsolatedCodexEnvironment } from './codex-isolation.mjs';
import { CodexAgentAdapter } from '../dist/src/core/agent.js';
import { runTaskAndPersistReceipt } from '../dist/src/core/cli-run.js';
import { renderReceiptMarkdown, validateReceipt } from '../dist/src/core/evidence.js';

const fixtureDir = path.resolve('benchmarks/fixtures/hero-rate-limit');
const outputDir = path.resolve('evidence/hero-run');
const isolation = createIsolatedCodexEnvironment(path.join(path.parse(process.cwd()).root, 'w2-benchmark-isolation'));
const workDir = path.join(isolation.workspaces, 'hero', 'hero-rate-limit');
configureTrustedProjects(isolation, [workDir]);
const runIsolation = createRunCodexEnvironment(isolation, 'hero-rate-limit');
const databasePath = path.join(isolation.root, 'runtime-db', 'hero-rate-limit.sqlite');
const taskInput = JSON.parse(readFileSync(path.join(fixtureDir, 'task.json'), 'utf8'));
const replacements = [[workDir, '<WORKSPACE>'], [runIsolation.codexHome, '<CODEX_HOME>'], [path.dirname(runIsolation.codexExe), '<CODEX_RUNTIME>'], [runIsolation.codexExe, '<CODEX_RUNTIME>'], [runIsolation.profile, '<USER_HOME>'], [isolation.root, '<ISOLATION_ROOT>'], ...(process.env.SystemRoot ? [[process.env.SystemRoot, '<SYSTEM_ROOT>']] : [])];
const runSync = (command, args, cwd) => execFileSync(command, args, { cwd, encoding: 'utf8', windowsHide: true, env: { ...runIsolation.env, GIT_AUTHOR_DATE: '2000-01-01T00:00:00Z', GIT_COMMITTER_DATE: '2000-01-01T00:00:00Z' } });

function save(name, value) {
  writeFileSync(path.join(outputDir, name), typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

try {
  mkdirSync(path.dirname(workDir), { recursive: true });
  cpSync(fixtureDir, workDir, { recursive: true });
  runSync('git', ['init', '-b', 'main'], workDir);
  runSync('git', ['config', 'user.email', 'benchmark@w2.local'], workDir);
  runSync('git', ['config', 'user.name', 'W2 Hero Fixture'], workDir);
  runSync('git', ['config', 'core.autocrlf', 'false'], workDir);
  runSync('git', ['add', '.'], workDir);
  runSync('git', ['commit', '-m', 'hero fixture baseline'], workDir);
  assertNoAncestorContext(workDir);
  configureIsolatedGitWorkspace(runIsolation, workDir);

  const task = { ...taskInput, task_id: 'hero-login-rate-limit', workspace: workDir };
  const result = await runTaskAndPersistReceipt({
    task, databasePath, receiptDirectory: path.join(isolation.root, 'hero-receipts'),
    adapter: new CodexAgentAdapter({ env: runIsolation.env, noDaemon: true, extraArgs: ['--ephemeral', '--ignore-rules'] }),
    runtime: { env: runIsolation.verifierEnv },
  });
  const { run, receipt } = result;
  if (receipt.agent.execution_mode !== 'REAL_CODEX') throw new Error('Hero run was not produced by the real Codex adapter');
  const events = result.events;
  assertNoUserHomeLeak(JSON.stringify({ receipt, events, verification: run.verification_results }));
  const publicReceipt = sanitizeRunValue(receipt, replacements);
  validateReceipt(publicReceipt);
  const publicEvents = sanitizeRunValue(events, replacements);
  const publicContext = sanitizeRunValue(run.context_manifest, replacements);
  const acceptanceIds = new Set(publicReceipt.acceptance.flatMap((item) => item.evidence_ids));
  const acceptanceEvidence = publicReceipt.evidence.filter((item) => acceptanceIds.has(item.evidence_id));
  const agentPayloads = events.filter((event) => event.type === 'agent_output').map((event) => event.payload);
  const agentMessages = assistantMessagesFromCodexEvents(agentPayloads.map((payload) => payload.raw).filter(Boolean));
  const record = {
    execution_mode: publicReceipt.agent.execution_mode,
    run_id: publicReceipt.run_id,
    task_id: publicReceipt.task.task_id,
    status: publicReceipt.outcome,
    agent_run_status: publicReceipt.agent.status,
    model: publicReceipt.agent.model,
    baseline_commit: runSync('git', ['rev-parse', 'HEAD'], workDir).trim(),
    task_semantics: 'benchmarks/fixtures/hero-rate-limit/task.json',
    infrastructure_failure: run.status === 'ERROR',
    timed_out: run.error?.includes('timed out') ?? false,
    claim_done: hasCompletionClaim(agentPayloads.map((payload) => payload.raw).filter(Boolean)),
    agent_messages: sanitizeRunValue(agentMessages, replacements),
    changed_files: publicReceipt.changes.changed_files,
    scope_violations: publicReceipt.changes.changed_files.filter((file) => !taskInput.allowed_paths.includes(file)),
    receipt: 'evidence/hero-run/run-receipt.json',
    generated_at: publicReceipt.generated_at,
  };

  const artifacts = [
    ['task.json', sanitizeRunValue(task, replacements)],
    ['context.json', publicContext],
    ['events.jsonl', publicEvents.map((event) => JSON.stringify(event)).join('\n') + '\n'],
    ['diff.patch', run.diff?.unified_diff ?? ''],
    ['verification.json', publicReceipt.verification],
    ['acceptance-evidence.json', { acceptance: publicReceipt.acceptance, evidence: acceptanceEvidence }],
    ['run-receipt.json', publicReceipt],
    ['run-receipt.md', renderReceiptMarkdown(publicReceipt)],
    ['run-record.json', record],
  ];
  rmSync(outputDir, { recursive: true, force: true });
  mkdirSync(outputDir, { recursive: true });
  for (const [name, value] of artifacts) save(name, value);
  console.log(JSON.stringify({ execution_mode: record.execution_mode, run_status: record.agent_run_status, outcome: record.status, acceptance: record.scope_violations.length ? 'scope violation recorded' : publicReceipt.acceptance.map((item) => `${item.criterion_id}:${item.status}`).join(', '), receipt: record.receipt }, null, 2));
} finally {
  cleanupIsolatedCodexEnvironment(isolation);
}
