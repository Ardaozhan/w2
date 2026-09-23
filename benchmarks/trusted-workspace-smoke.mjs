import { execFileSync, spawn } from 'node:child_process';
import { cpSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import {
  assertNoAncestorContext,
  assertNoUserHomeLeak,
  cleanupIsolatedCodexEnvironment,
  configureIsolatedGitWorkspace,
  configureTrustedProjects,
  createIsolatedCodexEnvironment,
  createRunCodexEnvironment,
  inspectCodexPromptInput,
  sanitizeRunValue,
} from './codex-isolation.mjs';

const root = path.join(path.parse(process.cwd()).root, 'w2-benchmark-isolation');
const isolation = createIsolatedCodexEnvironment(root);
try {
  const workspace = path.join(isolation.workspaces, 'trust-smoke');
  configureTrustedProjects(isolation, [workspace]);
  const run = createRunCodexEnvironment(isolation, 'trusted-workspace-smoke');
  mkdirSync(workspace, { recursive: true });
  cpSync(path.resolve('benchmarks/fixtures/bug-fix'), workspace, { recursive: true });
  const git = (args) => execFileSync('git', args, { cwd: workspace, env: run.env, windowsHide: true, stdio: 'ignore' });
  git(['init', '-b', 'main']);
  git(['config', 'user.email', 'benchmark@w2.local']);
  git(['config', 'user.name', 'W2 Trust Smoke']);
  git(['config', 'core.autocrlf', 'false']);
  git(['add', '.']);
  git(['commit', '-m', 'fixture baseline']);
  assertNoAncestorContext(workspace);
  configureIsolatedGitWorkspace(run, workspace);
  const prompt = 'In src/math.js implement multiply(a, b) as the mathematical product. Run node verify.mjs. Do not modify any other file.';
  const modelPrompt = inspectCodexPromptInput(run, workspace, prompt);
  const promptInput = execFileSync('codex', ['debug', 'prompt-input', prompt], { cwd: workspace, env: run.env, encoding: 'utf8', windowsHide: true });
  const child = spawn('codex', ['--no-daemon', '--sandbox', 'workspace-write', 'exec', '--json', '--ephemeral', '--ignore-rules', '-C', workspace, '--model', 'gpt-6-luna', prompt], {
    cwd: workspace, env: run.env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = '';
  let stderr = '';
  let timedOut = false;
  child.stdout.setEncoding('utf8').on('data', (chunk) => { stdout += chunk; });
  child.stderr.setEncoding('utf8').on('data', (chunk) => { stderr += chunk; });
  const timer = setTimeout(() => { timedOut = true; child.kill(); }, 90000);
  const exit = await new Promise((resolve) => {
    child.once('error', () => resolve(1));
    child.once('close', (code) => resolve(code ?? 1));
  });
  clearTimeout(timer);
  const output = sanitizeRunValue(`${stdout}\n${stderr}`.replace(/\\\\/g, '\\').replace(/\//g, '\\'), [
    [path.dirname(run.codexExe), '<CODEX_RUNTIME>'], [run.codexExe, '<CODEX_RUNTIME>'],
  ]);
  assertNoUserHomeLeak(output);
  const changed = execFileSync('git', ['diff', '--name-only'], { cwd: workspace, env: run.env, encoding: 'utf8', windowsHide: true }).trim().split(/\r?\n/).filter(Boolean);
  let verifier = 'FAIL';
  if (exit === 0) {
    try {
      execFileSync(process.execPath, ['verify.mjs'], { cwd: workspace, env: run.verifierEnv, stdio: 'ignore', windowsHide: true });
      verifier = 'PASS';
    } catch {}
  }
  const diagnosticError = /unknown argument|unexpected argument|unrecognized|invalid value/i.test(stderr) ? 'CLI_ARGUMENT'
    : /config|toml|parse/i.test(stderr) ? 'CONFIG'
      : /auth|login|401/i.test(stderr) ? 'AUTH'
        : /sandbox|CreateProcess|permission/i.test(stderr) ? 'SANDBOX'
      : /model/i.test(stderr) ? 'MODEL'
            : stderr ? 'OTHER' : 'NONE';
  const events = stdout.split(/\r?\n/).filter(Boolean).flatMap((line) => { try { return [JSON.parse(line)]; } catch { return []; } });
  const eventTypes = [...new Set(events.map((event) => event.type).filter(Boolean))];
  const categoryFlags = {
    approval: /approval|approve/i.test(output),
    outsideWorkspace: /outside (?:the )?workspace|not in (?:the )?workspace/i.test(output),
    workspaceTrust: /untrusted|trust this|not trusted/i.test(output),
    readOnly: /read[ -]only|read_only/i.test(output),
    sandboxPolicy: /sandbox|policy/i.test(output),
    windowsSpawn: /CreateProcessAsUserW|SpawnChild/i.test(output),
    accessDenied: /access denied|permission denied/i.test(output),
  };
  const finalItems = events.filter((event) => event.type === 'item.completed').map((event) => event.item ?? event);
  console.log(JSON.stringify({ execution_mode: 'REAL_CODEX', exit, timedOut, outputChars: stdout.length + stderr.length, diagnosticError, eventTypes, categoryFlags, promptMentionsReadOnly: /read[ -]only|read_only/i.test(promptInput), promptMentionsWorkspaceWrite: /workspace[- ]write/i.test(promptInput), modified_files: changed.length, verifier, model_prompt_validation: modelPrompt.status, finalItems, stderrExcerpt: stderr.slice(-1600) }, null, 2));
} finally {
  cleanupIsolatedCodexEnvironment(isolation);
}
