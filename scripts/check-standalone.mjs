import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const packagePath = path.join(root, 'package.json');
const packageText = readFileSync(packagePath, 'utf8');
const pkg = JSON.parse(packageText);
const issues = [];
const scriptBlock = packageText.match(/^\s*"scripts"\s*:\s*\{([\s\S]*?)^\s*\}/m)?.[1] ?? '';
const scriptNames = [...scriptBlock.matchAll(/^\s*"([^"]+)"\s*:/gm)].map((match) => match[1]);
const duplicateScripts = scriptNames.filter((name, index) => scriptNames.indexOf(name) !== index);
const requiredScripts = ['test', 'typecheck', 'build', 'w2', 'demo', 'demo:live', 'standalone:check', 'fresh:check', 'judge-demo:verify', 'audit:public'];
const packageLockPath = path.join(root, 'package-lock.json');
const packageLock = existsSync(packageLockPath) ? JSON.parse(readFileSync(packageLockPath, 'utf8')) : undefined;

if (pkg.name !== 'w2') issues.push('package name must be w2');
if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(pkg.version ?? '')) issues.push('package version must be valid semver');
if (!/verification layer for coding agents/i.test(pkg.description ?? '')) issues.push('package description must identify W2 as a verification layer for coding agents');
if (pkg.engines?.node !== '>=22.13' || !/Node\.js 22\.13\+/i.test(readFileSync(path.join(root, 'README.md'), 'utf8'))) issues.push('Node.js requirement must match between package.json and README');
if (existsSync(path.join(root, '.codex-project'))) issues.push('project-specific Codex metadata is present');
const obsoleteMetadataNames = [
  new RegExp(`^\\.${['v', '42'].join('')}(?:$|[._-])`, 'i'),
  new RegExp(`^\\.${['v', '5'].join('')}(?:$|[._-])`, 'i'),
  new RegExp(`^${['CODEX_', 'V', '42'].join('')}(?:$|[._-])`, 'i'),
];
for (const entry of readdirSync(root, { withFileTypes: true })) {
  if (obsoleteMetadataNames.some((pattern) => pattern.test(entry.name))) issues.push(`retired project metadata remains at repository root: ${entry.name}`);
}
if (duplicateScripts.length) issues.push(`package.json has duplicate npm script keys: ${[...new Set(duplicateScripts)].join(', ')}`);
for (const name of requiredScripts) if (!pkg.scripts?.[name]) issues.push(`required local npm script is missing: ${name}`);
if (packageLock && (packageLock.name !== pkg.name || packageLock.version !== pkg.version || packageLock.packages?.['']?.name !== pkg.name || packageLock.packages?.['']?.version !== pkg.version)) {
  issues.push('package-lock identity does not match package.json');
}

for (const [group, dependencies] of Object.entries({ dependencies: pkg.dependencies ?? {}, devDependencies: pkg.devDependencies ?? {}, optionalDependencies: pkg.optionalDependencies ?? {} })) {
  for (const [name, version] of Object.entries(dependencies)) {
    if (/^(?:file:|link:|workspace:)/i.test(version)) issues.push(`${group}.${name} depends on a local workspace path`);
  }
}

const files = [];
try {
  files.push(...execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).split('\0').filter(Boolean));
} catch {
  const skippedDirectories = new Set(['.git', 'node_modules', 'dist', 'output', '.playwright-cli', '.w2', 'internal-history', 'runtime-db']);
  const walk = (directory, prefix = '') => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const relative = path.join(prefix, entry.name).replace(/\\/g, '/');
      if (entry.isDirectory() && (skippedDirectories.has(entry.name) || relative.startsWith('benchmarks/archive/'))) continue;
      if (entry.isDirectory()) walk(path.join(directory, entry.name), relative);
      else if (entry.isFile()) files.push(relative);
    }
  };
  walk(root);
}

const normalizedFiles = [...new Set(files.map((file) => file.replace(/\\/g, '/')))]
  .filter((file) => !file.startsWith('internal-history/') && !file.startsWith('benchmarks/archive/'))
  .filter((file) => existsSync(path.resolve(root, file)));
const textExtensions = /\.(?:[cm]?js|jsx|ts|tsx|json|ya?ml|ps1|md|html|css|svg|toml|txt|csv)$/i;
const textFiles = normalizedFiles.filter((file) => textExtensions.test(file));
const activeLegacyPatterns = [
  { label: 'retired phase framework', pattern: new RegExp(`\\b${['V', '42'].join('')}\\b`, 'i') },
  { label: 'previous internal framework', pattern: new RegExp(`\\b${['V', '5'].join('')}\\b`, 'i') },
  { label: 'retired Codex wrapper', pattern: new RegExp([
    ['CODEX_', 'V', '42'].join(''),
    ['codex-', 'v', '42'].join(''),
    ['codex_', 'v', '42'].join(''),
  ].join('|'), 'i') },
  { label: 'retired readiness marker', pattern: new RegExp(['V', '42', '_EXECUTION_READY'].join(''), 'i') },
  { label: 'old project runtime path', pattern: new RegExp(['pro\\.', 'v', '42-runtime'].join(''), 'i') },
  { label: 'retired orchestration layer', pattern: new RegExp(['control', '-plane'].join(''), 'i') },
  { label: 'external engineering framework', pattern: new RegExp(['arda', 'engineering'].join('-'), 'i') },
  { label: 'unrelated knowledge system', pattern: new RegExp(['bey', 'in'].join(''), 'i') },
  { label: 'retired external launcher', pattern: new RegExp(['old ', 'launcher'].join(''), 'i') },
  { label: 'retired runtime system', pattern: new RegExp(['legacy ', 'runtime'].join(''), 'i') },
];
const absoluteLocalImport = /(?:\bfrom\s*|\bimport\s*\()\s*["'](?:[A-Za-z]:[\\/]|\\\\|\/(?:Users|home)\/)/;
const nodeCommand = /\bnode(?:\.exe)?\s+(?:"([^"]+)"|'([^']+)'|([^\s"';&|]+))/gi;
const npmRunCommand = /\bnpm(?:\.cmd)?\s+run(?:-script)?\s+([A-Za-z0-9][A-Za-z0-9:._-]*)/gi;
const separator = path.sep;
const bannedSandboxOverride = ['--dangerously', '-bypass-approvals-and-sandbox'].join('');

const sourceRoots = ['src/', 'tests/', 'scripts/', 'benchmarks/'];
const sourceFiles = textFiles.filter((file) => sourceRoots.some((prefix) => file.startsWith(prefix)));
let legacyMatches = 0;
let absoluteImportMatches = 0;
for (const file of textFiles) {
  if (file === 'scripts/check-standalone.mjs') continue;
  const contents = readFileSync(path.resolve(root, file));
  if (contents.includes(0)) continue;
  const source = contents.toString('utf8');
  for (const { label, pattern } of activeLegacyPatterns) {
    if (pattern.test(source)) {
      issues.push(`${label} reference in active file ${file}`);
      legacyMatches += 1;
    }
  }
  if (sourceRoots.some((prefix) => file.startsWith(prefix)) && absoluteLocalImport.test(source)) {
    issues.push(`source imports an absolute local path: ${file}`);
    absoluteImportMatches += 1;
  }
}

for (const [name, command] of Object.entries(pkg.scripts ?? {})) {
  if (/(?:^|[\s"'])[A-Za-z]:[\\/]Users[\\/]/i.test(command)) issues.push(`script ${name} contains a machine-specific user path`);
  for (const match of command.matchAll(npmRunCommand)) {
    if (!pkg.scripts?.[match[1]]) issues.push(`script ${name} invokes missing local npm script ${match[1]}`);
  }
  for (const match of command.matchAll(nodeCommand)) {
    const reference = (match[1] ?? match[2] ?? match[3] ?? '').replace(/\\/g, '/');
    if (!reference || reference.startsWith('-')) continue;
    if (path.isAbsolute(reference) || /^[A-Za-z]:[\\/]/.test(reference) || reference === '..' || reference.startsWith('../')) {
      issues.push(`script ${name} invokes a file outside the repository: ${reference}`);
      continue;
    }
    if (reference.startsWith('dist/')) continue;
    const target = path.resolve(root, reference);
    const fromRoot = path.relative(root, target);
    if (fromRoot === '..' || fromRoot.startsWith(`..${separator}`) || path.isAbsolute(fromRoot)) issues.push(`script ${name} points outside the repository`);
    else if (reference.includes('/') && (!existsSync(target) || !lstatSync(target).isFile())) issues.push(`script ${name} references missing local file ${reference}`);
  }
  if (command.includes(bannedSandboxOverride)) issues.push(`script ${name} contains a sandbox bypass flag`);
}

const activeRuntimePath = path.join(root, 'src/core/agent.ts');
const activeRuntime = readFileSync(activeRuntimePath, 'utf8');
if (!activeRuntime.includes('"--sandbox", "workspace-write"')) issues.push('Codex adapter does not explicitly request workspace-write');
if (activeRuntime.includes(bannedSandboxOverride) || /danger-full-access|--full-auto/i.test(activeRuntime)) issues.push('Codex adapter contains a sandbox bypass or full-access mode');

let trackedFiles = [];
try {
  trackedFiles = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).split('\0').filter(Boolean);
} catch {
  trackedFiles = normalizedFiles;
}
if (trackedFiles.some((file) => /\.(?:sqlite|sqlite3|db)(?:-(?:wal|shm))?$/i.test(file))) issues.push('a runtime database is tracked by Git');

if (issues.length) {
  console.error(JSON.stringify({ status: 'FAIL', active_text_files: textFiles.length, legacy_matches: legacyMatches, absolute_local_imports: absoluteImportMatches, issues }, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({ status: 'PASS', package: pkg.name, package_scripts: Object.keys(pkg.scripts).length, active_text_files: textFiles.length, local_script_references: 'resolved', absolute_local_imports: 0, legacy_matches: 0, codex_sandbox: 'workspace-write', tracked_runtime_databases: 0 }, null, 2));
}
