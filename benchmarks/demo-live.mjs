import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { CodexAgentAdapter } from '../dist/src/core/agent.js';
import { renderReceiptMarkdown } from '../dist/src/core/evidence.js';
import { runTaskAndPersistReceipt } from '../dist/src/core/cli-run.js';
import { assertNoAncestorContext, assertNoUserHomeLeak, cleanupIsolatedCodexEnvironment, configureTrustedProjects, configureIsolatedGitWorkspace, createIsolatedCodexEnvironment, createRunCodexEnvironment, inspectCodexPromptInput, sanitizeRunValue } from './codex-isolation.mjs';
import { hasCompletionClaim } from './completion-claim.mjs';

const id = new Date().toISOString().replace(/[-:.TZ]/g, '');
const isolation = createIsolatedCodexEnvironment(path.join(path.parse(process.cwd()).root, 'w2-benchmark-isolation'));
const workspace = path.join(isolation.workspaces, 'demo', `semantic-unproven-${id}`);
configureTrustedProjects(isolation, [workspace]);
const runIsolation = createRunCodexEnvironment(isolation, `semantic-unproven-${id}`);
const artifactDir = path.resolve('evidence/demo/unproven', id);
const dbPath = path.join(isolation.root, 'runtime-db', `semantic-unproven-${id}.sqlite`);
const fixture = 'benchmarks/fixtures/bug-fix';
const replacements = [
  [workspace, '<WORKSPACE>'], [runIsolation.codexHome, '<CODEX_HOME>'],
  [path.dirname(runIsolation.codexExe), '<CODEX_RUNTIME>'], [runIsolation.codexExe, '<CODEX_RUNTIME>'],
  [runIsolation.profile, '<USER_HOME>'], [isolation.root, '<ISOLATION_ROOT>'],
  ...(process.env.SystemRoot ? [[process.env.SystemRoot, '<SYSTEM_ROOT>']] : []),
];
const runGit = (args) => execFileSync('git', args, {
  cwd: workspace, windowsHide: true, stdio: 'ignore',
  env: { ...runIsolation.env, GIT_AUTHOR_DATE: '2000-01-01T00:00:00Z', GIT_COMMITTER_DATE: '2000-01-01T00:00:00Z' },
});
const save = (name, value) => writeFileSync(path.join(artifactDir, name), typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`, 'utf8');

try {
  mkdirSync(path.dirname(workspace), { recursive: true });
  cpSync(fixture, workspace, { recursive: true });
  writeFileSync(path.join(workspace, 'README.md'), '# multiply(a, b)\n\nA numeric multiplication helper.\n', 'utf8');
  runGit(['init', '-b', 'main']);
  runGit(['config', 'user.email', 'benchmark@w2.local']);
  runGit(['config', 'user.name', 'W2 Semantic Demo']);
  runGit(['config', 'core.autocrlf', 'false']);
  runGit(['add', '.']);
  runGit(['commit', '-m', 'semantic demo baseline']);
  assertNoAncestorContext(workspace);
  configureIsolatedGitWorkspace(runIsolation, workspace);

  const task = {
    task_id: `semantic-unproven-${id}`,
    title: 'Fix multiplication and document its contract',
    goal: 'Fix multiply(a,b) to return the mathematical product and document its public contract in README.md.',
    constraints: ['Change only src/math.js and README.md.', 'Run node verify.mjs.'],
    allowed_paths: ['src/math.js', 'README.md'],
    acceptance_criteria: [
      { id: 'AC-01', statement: 'Fix multiply(a,b) so it returns the mathematical product.', required: true, verification_refs: ['multiply-verifier'] },
      { id: 'AC-02', statement: 'Document the public multiply(a,b) contract in README.md.', required: true, verification_refs: [] },
    ],
    verification_commands: [{ id: 'multiply-verifier', name: 'multiply-verifier', command: 'node verify.mjs', category: 'custom' }],
    timeout_ms: 90000,
    model: 'gpt-6-luna',
    workspace,
  };
  const promptPreflight = inspectCodexPromptInput(runIsolation, workspace, JSON.stringify(task));
  const result = await runTaskAndPersistReceipt({
    task,
    databasePath: dbPath,
    receiptDirectory: path.join(isolation.root, 'semantic-receipts'),
    adapter: new CodexAgentAdapter({ env: runIsolation.env, noDaemon: true, extraArgs: ['--ephemeral', '--ignore-rules'] }),
    runtime: { env: runIsolation.verifierEnv },
  });
  const rawRun = result.run;
  const rawReceipt = result.receipt;
  const rawPayload = JSON.stringify({ receipt: rawReceipt, events: result.events, verification: rawRun.verification_results });
  const runtimeSafePayload = sanitizeRunValue(rawPayload, [
    [path.dirname(runIsolation.codexExe), '<CODEX_RUNTIME>'], [runIsolation.codexExe, '<CODEX_RUNTIME>'],
  ]);
  assertNoUserHomeLeak(runtimeSafePayload);
  const receipt = sanitizeRunValue(rawReceipt, replacements);
  const events = sanitizeRunValue(result.events, replacements);
  const acceptanceIds = new Set(receipt.acceptance.flatMap((item) => item.evidence_ids));
  const acceptanceEvidence = receipt.evidence.filter((item) => acceptanceIds.has(item.evidence_id));
  const agentPayloads = result.events.filter((event) => event.type === 'agent_output').map((event) => event.payload).filter((payload) => payload && typeof payload === 'object');
  const agentMessages = hasCompletionClaim(agentPayloads.map((payload) => payload.raw).filter(Boolean));
  const record = {
    execution_mode: receipt.agent.execution_mode,
    run_id: receipt.run_id,
    task_id: receipt.task.task_id,
    status: receipt.outcome,
    agent_run_status: rawRun.status,
    infrastructure_failure: rawRun.status === 'ERROR',
    timed_out: rawRun.error?.includes('timed out') ?? false,
    prompt_isolation: promptPreflight,
    external_verification: sanitizeRunValue(rawRun.verification_results, replacements),
    acceptance: receipt.acceptance,
    claim_done: agentMessages,
    changed_files: receipt.changes.changed_files,
    receipt: path.relative(process.cwd(), path.join(artifactDir, 'run-receipt.json')).replace(/\\/g, '/'),
    generated_at: receipt.generated_at,
  };

  mkdirSync(artifactDir, { recursive: true });
  save('task.json', sanitizeRunValue(task, replacements));
  save('context.json', sanitizeRunValue(rawRun.context_manifest, replacements));
  save('events.jsonl', events.map((event) => JSON.stringify(event)).join('\n') + '\n');
  save('diff.patch', sanitizeRunValue(rawRun.diff?.unified_diff ?? '', replacements));
  save('verification.json', receipt.verification);
  save('acceptance-evidence.json', { acceptance: receipt.acceptance, evidence: acceptanceEvidence });
  save('run-receipt.json', receipt);
  save('run-receipt.md', renderReceiptMarkdown(receipt));
  save('run-record.json', record);

  if (receipt.agent.execution_mode !== 'REAL_CODEX' || rawRun.status === 'ERROR' || !rawRun.verification_results.some((item) => item.status === 'PASSED') || receipt.acceptance[0]?.status !== 'PASS' || receipt.acceptance[1]?.status !== 'UNPROVEN' || receipt.outcome !== 'UNPROVEN') {
    throw new Error(`Semantic example was not the expected real task-evidence UNPROVEN case (agent=${rawRun.status}, outcome=${receipt.outcome}); stored evidence is preserved.`);
  }
  console.log(`Stored REAL_CODEX semantic UNPROVEN run ${receipt.run_id}; acceptance outcomes=${receipt.acceptance.map((item) => `${item.criterion_id}:${item.status}`).join(',')}.`);
} finally {
  cleanupIsolatedCodexEnvironment(isolation);
}
