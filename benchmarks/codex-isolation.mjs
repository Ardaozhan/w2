import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const configSource = path.join(repoRoot, 'benchmarks', 'codex-config.toml');
const forbiddenCodexHomeEntries = new Set(['memories', 'prompts', 'rules', 'sessions', 'history.sqlite']);

function locate(name) {
  const locator = process.platform === 'win32' ? 'where.exe' : 'which';
  return execFileSync(locator, [name], { encoding: 'utf8', windowsHide: true }).trim().split(/\r?\n/)[0];
}

function assertOutside(candidate, parent, label) {
  const relative = path.relative(path.resolve(parent), path.resolve(candidate));
  if (!relative.startsWith('..') && !path.isAbsolute(relative)) throw new Error(`${label} must be outside ${path.basename(parent)}`);
}

function setPrivateAcl(root) {
  if (process.platform !== 'win32') return;
  const identity = execFileSync('whoami.exe', [], { encoding: 'utf8', windowsHide: true }).trim();
  execFileSync('icacls.exe', [root, '/inheritance:r', '/grant:r', `${identity}:(OI)(CI)F`], { stdio: 'ignore', windowsHide: true });
}

function setEnvValue(env, key, value) { env[key] = value; }

export function createIsolatedCodexEnvironment(isolationRoot) {
  const root = path.resolve(isolationRoot);
  const originalProfile = path.resolve(process.env.USERPROFILE ?? process.env.HOME ?? osHome());
  assertOutside(root, originalProfile, 'Benchmark isolation root');
  assertOutside(root, repoRoot, 'Benchmark isolation root');
  const expectedName = process.platform === 'win32' ? 'w2-benchmark-isolation' : 'w2-benchmark-isolation';
  if (path.basename(root).toLowerCase() !== expectedName) throw new Error(`Refusing unexpected isolation root: ${path.basename(root)}`);

  const profile = path.join(root, 'profile');
  const codexHome = path.join(root, 'codex-home');
  const temp = path.join(root, 'tmp');
  const workspaces = path.join(root, 'workspaces');
  const npmCache = path.join(root, 'npm-cache');
  for (const directory of [root, profile, codexHome, temp, workspaces, npmCache, path.join(profile, 'AppData', 'Roaming'), path.join(profile, 'AppData', 'Local')]) mkdirSync(directory, { recursive: true });
  const isolatedGitConfig = path.join(profile, '.gitconfig');
  writeFileSync(isolatedGitConfig, '', 'utf8');
  // Keep fixture workspaces on their inherited ACL so Codex's Windows restricted-token sandbox
  // can write inside the explicitly trusted workspace. The copied credential stays private.
  setPrivateAcl(codexHome);

  const authSource = path.join(originalProfile, '.codex', 'auth.json');
  if (!existsSync(authSource) || !statSync(authSource).isFile()) throw new Error('Codex authentication file is unavailable for isolated execution');
  copyFileSync(authSource, path.join(codexHome, 'auth.json'));
  copyFileSync(configSource, path.join(codexHome, 'config.toml'));
  const config = readFileSync(path.join(codexHome, 'config.toml'), 'utf8');
  for (const required of ['model = "gpt-6-luna"', 'model_reasoning_effort = "max"', 'approval_policy = "never"', 'sandbox_mode = "workspace-write"', 'sandbox = "unelevated"', 'use_memories = false', 'generate_memories = false', 'include_instructions = false', 'enabled = false']) {
    if (!config.includes(required)) throw new Error(`Isolated Codex config is missing ${required.split(' = ')[0]}`);
  }

  const codexExe = locate('codex');
  const gitExe = locate('git');
  const nodeDirectory = path.dirname(process.execPath);
  const pathEntries = [...new Set([nodeDirectory, path.dirname(codexExe), path.dirname(gitExe), process.env.SystemRoot ? path.join(process.env.SystemRoot, 'System32') : undefined].filter(Boolean))];
  const env = {};
  const passthrough = ['SystemRoot', 'WINDIR', 'ComSpec', 'PATHEXT', 'OS', 'PROCESSOR_ARCHITECTURE', 'NUMBER_OF_PROCESSORS'];
  for (const key of passthrough) if (process.env[key]) setEnvValue(env, key, process.env[key]);
  setEnvValue(env, 'PATH', pathEntries.join(path.delimiter));
  setEnvValue(env, 'CODEX_HOME', codexHome);
  setEnvValue(env, 'HOME', profile);
  setEnvValue(env, 'USERPROFILE', profile);
  setEnvValue(env, 'APPDATA', path.join(profile, 'AppData', 'Roaming'));
  setEnvValue(env, 'LOCALAPPDATA', path.join(profile, 'AppData', 'Local'));
  setEnvValue(env, 'TEMP', temp);
  setEnvValue(env, 'TMP', temp);
  setEnvValue(env, 'NPM_CONFIG_USERCONFIG', path.join(profile, '.npmrc'));
  setEnvValue(env, 'NPM_CONFIG_CACHE', npmCache);
  setEnvValue(env, 'GIT_CONFIG_GLOBAL', isolatedGitConfig);
  setEnvValue(env, 'GIT_CONFIG_NOSYSTEM', '1');
  setEnvValue(env, 'USERNAME', 'w2-isolated');
  setEnvValue(env, 'USERDOMAIN', 'w2-isolated');
  if (process.platform === 'win32') {
    const parsed = path.parse(profile);
    setEnvValue(env, 'HOMEDRIVE', parsed.root.replace(/[\\/]$/, ''));
    setEnvValue(env, 'HOMEPATH', profile.slice(parsed.root.length - 1));
  }

  const verifierEnv = { ...env };
  delete verifierEnv.CODEX_HOME;
  delete verifierEnv.AUTH_SOURCE;
  const startupCodexHomeEntries = readdirSync(codexHome).sort();
  if (JSON.stringify(startupCodexHomeEntries) !== JSON.stringify(['auth.json', 'config.toml'])) throw new Error('Isolated CODEX_HOME must start with only copied authentication and the explicit config');
  const checks = assertIsolatedEnvironment({ root, profile, codexHome, temp, workspaces, env, startupCodexHomeEntries });
  return { root, profile, codexHome, temp, workspaces, env, verifierEnv, codexExe, model: 'gpt-6-luna', configSha256: checks.config_sha256, startupCodexHomeEntries, checks };
}

export function configureTrustedProjects(isolation, projectPaths) {
  const unique = [...new Set(projectPaths.map((candidate) => path.resolve(candidate)))].sort();
  if (!unique.length) throw new Error('At least one isolated Codex project path is required');
  for (const project of unique) {
    const relative = path.relative(path.resolve(isolation.workspaces), project);
    if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) throw new Error('Codex trust entry escaped isolated benchmark workspaces');
  }
  const configPath = path.join(isolation.codexHome, 'config.toml');
  const baseConfig = readFileSync(configPath, 'utf8').trimEnd();
  const trustConfig = unique.map((project) => `[projects.${JSON.stringify(project)}]\ntrust_level = "trusted"`).join('\n\n');
  const writableConfig = `[sandbox_workspace_write]\nwritable_roots = [${unique.map((project) => JSON.stringify(project)).join(', ')}]`;
  writeFileSync(configPath, `${baseConfig}\n\n${writableConfig}\n\n${trustConfig}\n`, 'utf8');
  isolation.trustedProjects = unique;
  isolation.writableRoots = unique;
  isolation.configSha256 = sha256(readFileSync(configPath));
  isolation.checks = assertIsolatedEnvironment(isolation);
  return { count: unique.length, config_sha256: isolation.configSha256 };
}

export function configureIsolatedGitWorkspace(runIsolation, workspace) {
  const resolved = path.resolve(workspace);
  const relative = path.relative(path.resolve(runIsolation.workspaces), resolved);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) throw new Error('Git safe.directory escaped the isolated fixture workspace root');
  execFileSync('git', ['config', '--file', runIsolation.env.GIT_CONFIG_GLOBAL, '--add', 'safe.directory', resolved], { env: runIsolation.env, windowsHide: true });
  const entries = execFileSync('git', ['config', '--file', runIsolation.env.GIT_CONFIG_GLOBAL, '--get-all', 'safe.directory'], { env: runIsolation.env, encoding: 'utf8', windowsHide: true }).trim().split(/\r?\n/);
  if (entries.length !== 1 || path.resolve(entries[0]) !== resolved) throw new Error('Isolated Git safe.directory does not exactly match the current fixture workspace');
  return resolved;
}

export function createRunCodexEnvironment(isolation, runLabel) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,80}$/.test(runLabel)) throw new Error('Invalid isolated Codex run label');
  const profile = path.join(isolation.root, 'profiles', runLabel);
  const codexHome = path.join(isolation.root, 'codex-homes', runLabel);
  const temp = path.join(isolation.root, 'run-tmp', runLabel);
  const npmCache = path.join(isolation.root, 'npm-cache', runLabel);
  for (const directory of [profile, codexHome, temp, npmCache, path.join(profile, 'AppData', 'Roaming'), path.join(profile, 'AppData', 'Local')]) mkdirSync(directory, { recursive: true });
  const isolatedGitConfig = path.join(profile, '.gitconfig');
  writeFileSync(isolatedGitConfig, '', 'utf8');
  copyFileSync(path.join(isolation.codexHome, 'auth.json'), path.join(codexHome, 'auth.json'));
  copyFileSync(path.join(isolation.codexHome, 'config.toml'), path.join(codexHome, 'config.toml'));
  const env = { ...isolation.env };
  env.CODEX_HOME = codexHome;
  env.HOME = profile;
  env.USERPROFILE = profile;
  env.APPDATA = path.join(profile, 'AppData', 'Roaming');
  env.LOCALAPPDATA = path.join(profile, 'AppData', 'Local');
  env.TEMP = temp;
  env.TMP = temp;
  env.NPM_CONFIG_USERCONFIG = path.join(profile, '.npmrc');
  env.NPM_CONFIG_CACHE = npmCache;
  env.GIT_CONFIG_GLOBAL = isolatedGitConfig;
  env.GIT_CONFIG_NOSYSTEM = '1';
  if (process.platform === 'win32') {
    const parsed = path.parse(profile);
    env.HOMEDRIVE = parsed.root.replace(/[\\/]$/, '');
    env.HOMEPATH = profile.slice(parsed.root.length - 1);
  }
  const verifierEnv = { ...env };
  delete verifierEnv.CODEX_HOME;
  const startupCodexHomeEntries = readdirSync(codexHome).sort();
  if (JSON.stringify(startupCodexHomeEntries) !== JSON.stringify(['auth.json', 'config.toml'])) throw new Error('Per-run CODEX_HOME must start empty apart from explicit auth and config');
  const runIsolation = { ...isolation, profile, codexHome, temp, npmCache, env, verifierEnv, startupCodexHomeEntries };
  runIsolation.checks = assertIsolatedEnvironment(runIsolation);
  return runIsolation;
}

function osHome() { return process.env.HOME ?? process.cwd(); }

export function assertIsolatedEnvironment(isolation) {
  const { root, profile, codexHome, temp, workspaces, env } = isolation;
  if (path.resolve(env.CODEX_HOME) !== path.resolve(codexHome) || path.resolve(env.USERPROFILE ?? env.HOME) !== path.resolve(profile)) throw new Error('Codex home/profile escaped the isolated runtime');
  if (path.resolve(env.TEMP) !== path.resolve(temp) || path.resolve(env.TMP) !== path.resolve(temp)) throw new Error('Temporary files are not isolated');
  const globalKeys = Object.keys(env).filter((key) => /^(?:OPENAI_API_KEY|CODEX_API_KEY|CODEX_ACCESS_TOKEN|CODEX_HOME)$/i.test(key) && key.toLowerCase() !== 'codex_home');
  if (globalKeys.length) throw new Error(`Global credential variables are present in benchmark environment: ${globalKeys.join(', ')}`);
  const config = readFileSync(path.join(codexHome, 'config.toml'), 'utf8');
  if (!/^approval_policy\s*=\s*"never"/m.test(config)) throw new Error('Non-interactive Codex approval behavior is not explicit');
  if (!/^sandbox_mode\s*=\s*"workspace-write"/m.test(config) || !/^sandbox\s*=\s*"unelevated"/m.test(config)) throw new Error('Codex must use workspace-write with the explicit supported Windows sandbox fallback');
  for (const workspace of isolation.writableRoots ?? []) {
    const relative = path.relative(path.resolve(workspaces), path.resolve(workspace));
    if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative) || !config.includes(JSON.stringify(path.resolve(workspace)))) throw new Error('Codex writable root is missing or outside isolated workspaces');
  }
  if (!/use_memories\s*=\s*false/.test(config) || !/generate_memories\s*=\s*false/.test(config)) throw new Error('Codex memories are not disabled in the explicit config');
  if (!/include_instructions\s*=\s*false/.test(config) || !/\[skills\.bundled\][\s\S]*?enabled\s*=\s*false/.test(config)) throw new Error('Global and bundled skills are not excluded from the Codex prompt');
  for (const project of isolation.trustedProjects ?? []) {
    const relative = path.relative(path.resolve(workspaces), path.resolve(project));
    const entry = `[projects.${JSON.stringify(path.resolve(project))}]\ntrust_level = "trusted"`;
    if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative) || !config.includes(entry)) throw new Error('Codex trusted-project entry is missing or escapes the isolated workspace root');
  }
  for (const entry of forbiddenCodexHomeEntries) if (existsSync(path.join(codexHome, entry))) throw new Error(`Isolated CODEX_HOME contains forbidden user context: ${entry}`);
  const files = readdirSync(codexHome);
  if (!isolation.startupCodexHomeEntries || JSON.stringify([...isolation.startupCodexHomeEntries].sort()) !== JSON.stringify(['auth.json', 'config.toml'])) throw new Error('Isolated CODEX_HOME startup contents were not verified');
  if (!files.includes('auth.json') || !files.includes('config.toml') || files.some((entry) => forbiddenCodexHomeEntries.has(entry.toLowerCase()))) throw new Error('Isolated CODEX_HOME contains forbidden global config or context');
  let generatedSkillFiles = 0;
  const skillsPath = path.join(codexHome, 'skills');
  if (existsSync(skillsPath)) {
    const pending = [skillsPath];
    while (pending.length) {
      const current = pending.pop();
      for (const entry of readdirSync(current, { withFileTypes: true })) {
        const target = path.join(current, entry.name);
        if (entry.isSymbolicLink()) throw new Error('Codex runtime skill directory contains a link outside the isolated home');
        if (entry.isDirectory()) pending.push(target);
        else {
          generatedSkillFiles += 1;
          if (/\.(?:md|toml|json|txt)$/i.test(entry.name)) {
            const contents = readFileSync(target, 'utf8');
            const originalProfile = path.resolve(process.env.USERPROFILE ?? process.env.HOME ?? '').replace(/\//g, '\\').toLowerCase();
            if (originalProfile && contents.replace(/\//g, '\\').toLowerCase().includes(originalProfile)) throw new Error('Codex runtime skills contain a reference to the global profile');
          }
        }
      }
    }
  }
  return { status: 'PASS', codex_home: '<CODEX_HOME>', workspaces: '<ISOLATED_WORKSPACES>', memory_files: 0, generated_runtime_skill_files: generatedSkillFiles, global_credential_environment: 'excluded', workspace_write_sandbox: 'workspace-write', windows_sandbox: 'unelevated', config_sha256: sha256(readFileSync(path.join(codexHome, 'config.toml'))), runtime_file_reads: 'UNOBSERVED: Codex CLI file reads outside captured events are not exposed by this adapter' };
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function assertNoAncestorContext(workspace) {
  let current = path.resolve(workspace);
  for (;;) {
    for (const entry of ['AGENTS.md', 'AGENTS.override.md', '.codex', '.agents']) if (existsSync(path.join(current, entry))) throw new Error(`Benchmark workspace has inherited instruction/config context: ${entry}`);
    const parent = path.dirname(current);
    if (parent === current) return;
    current = parent;
  }
}

export function assertNoUserHomeLeak(text, userHome = process.env.USERPROFILE ?? process.env.HOME ?? '') {
  const raw = String(text ?? '');
  const normalized = raw.replace(/\\\\/g, '\\').replace(/\//g, '\\').toLowerCase();
  const target = path.resolve(userHome).replace(/\//g, '\\').toLowerCase();
  if (target && normalized.includes(target)) throw new Error('Codex output referenced the global user profile; benchmark context is contaminated');
  if (/[A-Za-z]:\\Users\\[^\\\s]+\\\.(?:codex|agents)\\/i.test(normalized) || /(?:\/Users\/[^/\s]+\/\.(?:codex|agents)\/|\/home\/[^/\s]+\/\.(?:codex|agents)\/)/i.test(raw)) throw new Error('Codex output referenced a global Codex home, skill, or memory path');
}

export function assertModelPromptIsolation(text, userHome = process.env.USERPROFILE ?? process.env.HOME ?? '', repositoryRoot = repoRoot) {
  const normalized = String(text ?? '').replace(/\\\\/g, '\\').replace(/\//g, '\\').toLowerCase();
  const profileClass = classifyProfileReference(normalized, userHome);
  if (profileClass !== 'NONE') throw new Error(`Model-visible prompt included ${profileClass}`);
  if (/(?:[A-Za-z]:\\Users\\[^\\\s]+\\\.(?:codex|agents)\\|\/Users\/[^/\s]+\/\.(?:codex|agents)\/|\/home\/[^/\s]+\/\.(?:codex|agents)\/)/i.test(normalized)) throw new Error('Model-visible prompt included a global Codex configuration or skills path');
  const normalizedRepository = path.resolve(repositoryRoot).replace(/\//g, '\\').toLowerCase();
  if (normalizedRepository && normalized.includes(normalizedRepository)) throw new Error('Model-visible prompt included the benchmark host repository');
  return { status: 'PASS', source: 'codex debug prompt-input', global_profile_references: 0, host_repository_references: 0 };
}

export function inspectCodexPromptInput(isolation, workspace, prompt) {
  assertNoAncestorContext(workspace);
  let output;
  try {
    output = execFileSync('codex', ['--no-daemon', 'debug', 'prompt-input', prompt], {
      cwd: workspace,
      env: isolation.env,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 30000,
    });
  } catch {
    throw new Error('Codex model-visible prompt isolation preflight could not complete');
  }
  const sanitized = sanitizeRunValue(output, [
    [path.dirname(isolation.codexExe), '<CODEX_RUNTIME>'],
    [isolation.codexExe, '<CODEX_RUNTIME>'],
  ]);
  return assertModelPromptIsolation(sanitized);
}

export function classifyProfileReference(text, userHome = process.env.USERPROFILE ?? process.env.HOME ?? '') {
  const normalized = String(text ?? '').replace(/\\\\/g, '\\').replace(/\//g, '\\').replace(/\\+/g, '\\').toLowerCase();
  const target = path.resolve(userHome).replace(/\//g, '\\').toLowerCase().replace(/\\+$/g, '');
  if (!target) return 'NONE';
  const index = normalized.indexOf(target);
  if (index < 0) return 'NONE';
  const suffix = normalized.slice(index + target.length);
  if (suffix.startsWith('\\.codex\\')) return 'GLOBAL_CODEX_HOME';
  if (suffix.startsWith('\\appdata\\local\\programs\\openai\\codex')) return 'CODEX_RUNTIME_PATH';
  if (suffix.startsWith('\\appdata\\roaming\\npm')) return 'NODE_RUNTIME_PATH';
  if (suffix.startsWith('\\appdata\\local\\temp')) return 'GLOBAL_TEMP_PATH';
  if (suffix.startsWith('\\appdata\\')) return 'PROFILE_APPDATA_PATH';
  return 'USER_PROFILE_PATH';
}

export function sanitizeRunValue(value, replacements) {
  if (typeof value === 'string') {
    let output = value;
    for (const [source, target] of replacements) {
      if (!source) continue;
      const variants = new Set([source, source.replace(/\\/g, '/'), source.replace(/\//g, '\\'), source.replace(/\\/g, '\\\\')]);
      for (const variant of variants) output = output.replace(new RegExp(variant.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), target);
    }
    return output;
  }
  if (Array.isArray(value)) return value.map((item) => sanitizeRunValue(item, replacements));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, sanitizeRunValue(item, replacements)]));
  return value;
}

export function cleanupIsolatedCodexEnvironment(isolation) {
  const root = path.resolve(isolation.root);
  if (path.basename(root).toLowerCase() !== 'w2-benchmark-isolation' || path.parse(root).root !== path.dirname(root)) throw new Error('Refusing to clean an unexpected Codex isolation path');
  rmSync(root, { recursive: true, force: true });
}
