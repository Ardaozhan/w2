import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { cleanupIsolatedCodexEnvironment, configureTrustedProjects, createIsolatedCodexEnvironment, createRunCodexEnvironment, sanitizeRunValue } from './codex-isolation.mjs';

const isolation = createIsolatedCodexEnvironment('C:/w2-benchmark-isolation');
try {
  const workspace = path.join(isolation.workspaces, 'prompt-inspect');
  configureTrustedProjects(isolation, [workspace]);
  const run = createRunCodexEnvironment(isolation, 'prompt-inspect');
  mkdirSync(workspace, { recursive: true });
  cpSync(path.resolve('benchmarks/fixtures/bug-fix'), workspace, { recursive: true });
  for (const args of [
    ['init', '-b', 'main'],
    ['config', 'user.email', 'benchmark@w2.local'],
    ['config', 'user.name', 'W2 Prompt Inspect'],
    ['add', '.'],
    ['commit', '-m', 'baseline'],
  ]) execFileSync('git', args, { cwd: workspace, env: run.env, windowsHide: true, stdio: 'ignore' });
  const prompt = execFileSync('codex', ['--no-daemon', 'debug', 'prompt-input', '-c', 'sandbox_mode="workspace-write"', 'Read and update the allowed source file.'], { cwd: workspace, env: run.env, encoding: 'utf8', windowsHide: true });
  const doctorRaw = execFileSync('codex', ['doctor', '--json'], { cwd: workspace, env: run.env, encoding: 'utf8', windowsHide: true });
  const doctor = JSON.parse(doctorRaw);
  const doctorSummary = { topLevelKeys: Object.keys(doctor).sort(), statusCounts: {}, sandboxStatus: [] };
  const visit = (value, key = '') => {
    if (!value || typeof value !== 'object') return;
    if (!Array.isArray(value) && /sandbox/i.test(key) && typeof value.status === 'string') doctorSummary.sandboxStatus.push(value.status);
    for (const [childKey, child] of Object.entries(value)) {
      if (/^(status|state|result)$/i.test(childKey) && typeof child === 'string') doctorSummary.statusCounts[child] = (doctorSummary.statusCounts[child] ?? 0) + 1;
      visit(child, childKey);
    }
  };
  visit(doctor);
  const safePrompt = sanitizeRunValue(prompt, [
    [process.env.USERPROFILE ?? process.env.HOME, '<ORIGINAL_PROFILE>'],
    [path.dirname(run.codexExe), '<CODEX_RUNTIME>'], [run.codexExe, '<CODEX_RUNTIME>'],
    [isolation.root, '<ISOLATION_ROOT>'], [workspace, '<WORKSPACE>'],
  ]);
  const readonlySnippets = [...safePrompt.matchAll(/read[ -]only/gi)].slice(0, 4).map((match) => safePrompt.slice(Math.max(0, match.index - 60), match.index + match[0].length + 90).replace(/\s+/g, ' '));
  console.log(JSON.stringify({
    workspaceWriteMentioned: /workspace[- ]write/i.test(prompt),
    readOnlyMentioned: /read[ -]only|read_only/i.test(prompt),
    trustLevelMentioned: /trust_level/i.test(prompt),
    userProfileMentioned: /[A-Za-z]:\\Users\\[^\\]+\\\.agents\\skills/i.test(prompt),
    readonlySnippets,
    doctorSummary,
    configSha256: run.checks.config_sha256,
  }, null, 2));
} finally {
  cleanupIsolatedCodexEnvironment(isolation);
}
