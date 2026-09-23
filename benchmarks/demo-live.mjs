import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { RunEngine, buildRunReceipt, deriveEvidence, renderReceiptMarkdown } from '../dist/src/core/index.js';
import { hasCompletionClaim } from './completion-claim.mjs';

const id = new Date().toISOString().replace(/[-:.TZ]/g, '');
const workspace = path.resolve('benchmarks/runs/demo-unproven', id, 'workspace');
const artifactDir = path.resolve('evidence/demo/unproven', id);
mkdirSync(path.join(workspace, 'src'), { recursive: true });
mkdirSync(artifactDir, { recursive: true });
copyFileSync('benchmarks/fixtures/bug-fix/src/math.js', path.join(workspace, 'src', 'math.js'));
writeFileSync(path.join(workspace, 'README.md'), '# multiply(a, b)\n\nA numeric multiplication helper.\n', 'utf8');
copyFileSync('benchmarks/fixtures/bug-fix/verify.mjs', path.join(workspace, 'verify.mjs'));
const git = (args) => execFileSync('git', args, { cwd: workspace, stdio: 'ignore', windowsHide: true });
git(['init', '-b', 'main']); git(['config', 'user.email', 'demo@w2.local']); git(['config', 'user.name', 'W2 Live Demo']); git(['add', '.']); git(['commit', '-m', 'demo baseline']);

const acceptance = [
  'Fix multiply(a,b) so it returns the mathematical product.',
  'Document the public multiply(a,b) contract in README.md.',
];
const engine = new RunEngine({ databasePath: path.resolve(`benchmarks/runtime-db/demo-unproven-${id}.sqlite`) });
const task = {
  task_id: `demo-unproven-${id}`, title: 'Fix multiplication and document its contract',
  goal: 'Fix multiply(a,b) to return the mathematical product and document its public contract in README.md.',
  constraints: ['Change only src/math.js and README.md.', 'Run node verify.mjs.'],
  allowed_paths: ['src/math.js', 'README.md'], acceptance_criteria: acceptance,
  verification_commands: [{ name: 'multiply-verifier', command: 'node verify.mjs', category: 'custom' }],
  timeout_ms: 90000, workspace,
};

try {
  const run = await engine.run(task);
  const events = engine.store.getEvents(run.run_id);
  const evidence = deriveEvidence(run, events.length, engine.store.getToolCalls(run.run_id).length);
  const verifierEvidence = evidence.find((item) => item.raw_reference === `run:${run.run_id}:verification:0` && (item.data).status === 'PASSED');
  const mappings = verifierEvidence ? [{ criterion_id: 'AC-01', description: acceptance[0], required: true, status: 'PASS', evidence_ids: [verifierEvidence.evidence_id], reason: 'The configured verifier proves multiplication behavior; the documentation criterion has no verification command.' }] : [];
  const receipt = buildRunReceipt(engine.store, run.run_id, { evidence, acceptance: mappings });
  writeFileSync(path.join(artifactDir, 'run-receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
  writeFileSync(path.join(artifactDir, 'run-receipt.md'), renderReceiptMarkdown(receipt));
  const agentMessages = events.filter((event) => event.type === 'agent_output').map((event) => event.payload).filter((payload) => payload && typeof payload === 'object');
  const record = { execution_mode: receipt.agent.execution_mode, run_id: run.run_id, task_id: task.task_id, status: receipt.outcome, agent_run_status: run.status, external_verification: run.verification_results, acceptance: receipt.acceptance, claim_done: hasCompletionClaim(agentMessages.map((payload) => payload.raw)), receipt: path.relative(process.cwd(), path.join(artifactDir, 'run-receipt.json')), workspace: path.relative(process.cwd(), workspace), generated_at: new Date().toISOString() };
  writeFileSync(path.join(artifactDir, 'run-record.json'), JSON.stringify(record, null, 2) + '\n');
  if (receipt.agent.execution_mode !== 'REAL_CODEX' || run.status === 'ERROR' || !run.verification_results.some((item) => item.status === 'PASSED') || receipt.outcome !== 'UNPROVEN') throw new Error(`Live demo did not produce a real task-evidence UNPROVEN case (mode=${receipt.agent.execution_mode}, run=${run.status}, outcome=${receipt.outcome})`);

  const casesPath = path.resolve('evidence/demo/cases.json');
  const cases = { schema_version: 1, updated_at: new Date().toISOString(), cases: {
    pass: { label: 'REAL_CODEX PASS', receipt: 'benchmarks/runs/w2/bug-fix/run-receipt.json', record: 'benchmarks/runs/w2/bug-fix/run-record.json' },
    unproven: { label: 'REAL_CODEX UNPROVEN — missing criterion verification', receipt: path.relative(process.cwd(), path.join(artifactDir, 'run-receipt.json')), record: path.relative(process.cwd(), path.join(artifactDir, 'run-record.json')) },
  } };
  writeFileSync(casesPath, JSON.stringify(cases, null, 2) + '\n');
  console.log(`Live demo evidence: REAL_CODEX ${receipt.outcome}; receipt=${path.relative(process.cwd(), path.join(artifactDir, 'run-receipt.json'))}`);
} finally { engine.close(); }
