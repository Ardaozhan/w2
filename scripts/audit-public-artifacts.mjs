import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const cases = JSON.parse(readFileSync('evidence/demo/cases.json', 'utf8'));
const roots = [
  'docs',
  'README.md', 'LICENSE',
  'docs/ARCHITECTURE.md', 'docs/SECURITY-MODEL.md', 'docs/CONTEXT-MANIFEST.md', 'docs/CLAIM-AUDIT.md',
  'docs/BENCHMARK-REPORT.md', 'docs/HERO-CASE-STUDY.md', 'docs/GPT56-CONTRIBUTION.md', 'docs/GPT56-FINAL-REVIEW.md',
  'docs/DEMO-VIDEO-SCRIPT.md', 'evidence/PUBLIC-EVIDENCE-MANIFEST.md',
  'CONTRIBUTING.md', 'SECURITY.md', 'CHANGELOG.md', '.github',
  'src/core/brainw2.ts', 'src/core/doctor.ts', 'src/core/session.ts', 'src/core/interactive.ts',
  'tests/integration/brainw2.test.ts', 'tests/integration/doctor.test.ts', 'tests/e2e/interactive-hook-boundary.mjs',
  'evidence/demo/cases.json',
  'benchmarks/results/results.json', 'benchmarks/results/results.csv', 'benchmarks/runs',
  'evidence/hero-run', 'judge-demo/index.html', 'judge-demo/assets', 'evidence/screenshots',
  cases.cases.pass.receipt, cases.cases.pass.record, cases.cases.unproven.receipt, cases.cases.unproven.record,
];
const files = new Set();
function collect(target) {
  const info = statSync(target);
  if (info.isDirectory()) for (const entry of readdirSync(target)) collect(path.join(target, entry));
  else files.add(target.replace(/\\/g, '/'));
}
for (const root of roots) collect(root);
const secretPatterns = [
  /sk-[A-Za-z0-9_-]{32,}/i,
  /gh[pousr]_[A-Za-z0-9_]{20,}/i,
  /Bearer\s+[A-Za-z0-9._~+/=-]{12,}/i,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i,
  /(?:api[_-]?(?:key|token)|access[_-]?token|refresh[_-]?token|authorization|bearer|password|secret)\s*[:=]\s*["']?[A-Za-z0-9._~+/=-]{16,}/i,
];
const privacyPatterns = [
  /\b[A-Za-z]:[\\/](?:Users|Documents and Settings)[\\/][^\\/\s"'<>]+/i,
  /\/(?:Users|home)\/[^/\s"'<>]+/i,
  /(?:[A-Za-z]:[\\/]Users[\\/][^\\/\s"'<>]+[\\/](?:\.codex|\.agents)[\\/](?:memories|prompts|rules|skills)|\/(?:Users|home)\/[^/\s]+\/(?:\.codex|\.agents)\/(?:memories|prompts|rules|skills))/i,
  /\b[A-Za-z]:[\\/](?:w2-benchmark-isolation|Windows)[\\/]/i,
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.(?:com|net|org|edu|gov|io)\b/i,
  /BRAINW2_VAULT\s*[:=]\s*["']?[A-Za-z]:[\\/](?:Users|Documents and Settings)[\\/][^\s"']+/i,
];
const secretHits = [];
const privacyHits = [];
const repositorySecretHits = [];
const repositoryPrivacyHits = [];
const repositoryRuntimeArtifactHits = [];
const username = (process.env.USERNAME ?? '').trim();
const usernamePattern = username.length >= 3 ? new RegExp(`(?:^|[\\\\/ ])${username.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}(?:$|[\\\\/ ])`, 'i') : undefined;
for (const file of files) {
  const contents = readFileSync(file);
  if (contents.includes(0)) continue;
  const text = contents.toString('utf8');
  if (secretPatterns.some((pattern) => pattern.test(text))) secretHits.push(file);
  if (privacyPatterns.some((pattern) => pattern.test(text)) || (usernamePattern && usernamePattern.test(text))) privacyHits.push(file);
}
const trackedFiles = (() => {
  try { return execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).split('\0'); }
  catch {
    const output = [];
    const ignoredDirectories = new Set(['.git', 'node_modules', 'dist', 'output', '.playwright-cli', '.w2', 'internal-history']);
    const walk = (directory) => {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const file = path.join(directory, entry.name);
        const normalized = file.replace(/\\/g, '/');
        if (entry.isDirectory() && (ignoredDirectories.has(entry.name) || normalized === 'benchmarks/archive')) continue;
        if (entry.isDirectory()) walk(file); else output.push(file.replace(/\\/g, '/'));
      }
    };
    walk('.');
    return output;
  }
})()
  .filter((file) => file && existsSync(file) && !file.startsWith('benchmarks/archive/'));
for (const file of trackedFiles) {
  const contents = readFileSync(file);
  if (contents.includes(0)) continue;
  const text = contents.toString('utf8');
  if (secretPatterns.some((pattern) => pattern.test(text))) repositorySecretHits.push(file);
  if (privacyPatterns.some((pattern) => pattern.test(text)) || (usernamePattern && usernamePattern.test(text))) {
    // These literals are deliberate inputs to the path-isolation regression test.
    if (file !== 'tests/benchmarks/isolation.test.ts') repositoryPrivacyHits.push(file);
  }
}
for (const file of trackedFiles.map((value) => value.replace(/\\/g, '/'))) {
  if (/(?:^|\/)(?:\.w2|brainw2)(?:\/|$)|hook-diagnostics(?:\.jsonl)?$|\.w2-dev-log\.lock|\.(?:sqlite|sqlite3|db)(?:-(?:wal|shm))?$/i.test(file)) {
    repositoryRuntimeArtifactHits.push(file);
  }
}
const trackedArchivePaths = (() => {
  try { return execFileSync('git', ['ls-files', 'benchmarks/archive'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).split(/\r?\n/); }
  catch { return []; }
})();
const trackedArchives = trackedArchivePaths
  .filter((file) => file && existsSync(file) && !file.startsWith('benchmarks/archive/pre-hermetic-final/'));
if (trackedArchives.length) privacyHits.push('benchmarks/archive (superseded raw archives remain tracked)');
const result = {
  scanned_files: files.size,
  public_evidence_secret_scan: secretHits.length ? 'FAIL' : 'PASS',
  public_evidence_privacy_scan: privacyHits.length ? 'FAIL' : 'PASS',
  tracked_repository_secret_scan: repositorySecretHits.length ? 'FAIL' : 'PASS',
  tracked_repository_privacy_scan: repositoryPrivacyHits.length ? 'FAIL' : 'PASS',
  tracked_runtime_artifact_scan: repositoryRuntimeArtifactHits.length ? 'FAIL' : 'PASS',
  tracked_repository_files_scanned: trackedFiles.length,
  secret_findings: secretHits,
  privacy_findings: privacyHits,
  tracked_repository_secret_findings: repositorySecretHits,
  tracked_repository_privacy_findings: repositoryPrivacyHits,
  tracked_runtime_artifact_findings: repositoryRuntimeArtifactHits,
};
console.log(JSON.stringify(result, null, 2));
if (secretHits.length || privacyHits.length || repositorySecretHits.length || repositoryPrivacyHits.length || repositoryRuntimeArtifactHits.length) process.exitCode = 1;
