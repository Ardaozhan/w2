import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = process.cwd();
const tempRoot = path.resolve(os.tmpdir());
const temp = mkdtempSync(path.join(tempRoot, 'w2-fresh-'));
const clone = path.join(temp, 'repo');
if (!path.relative(tempRoot, path.resolve(temp)) || path.relative(tempRoot, path.resolve(temp)).startsWith('..')) {
  throw new Error('Fresh-copy target escaped the temporary directory');
}

try {
  mkdirSync(clone);
  const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd: root, encoding: 'buffer', maxBuffer: 64 * 1024 * 1024 })
    .toString('utf8').split('\0').filter(Boolean);
  for (const relative of files) {
    const source = path.resolve(root, relative);
    const fromRoot = path.relative(root, source);
    if (fromRoot === '..' || fromRoot.startsWith(`..${path.sep}`) || path.isAbsolute(fromRoot) || !existsSync(source)) continue;
    const info = lstatSync(source);
    if (!info.isFile()) continue;
    const destination = path.resolve(clone, relative);
    const fromClone = path.relative(clone, destination);
    if (fromClone === '..' || fromClone.startsWith(`..${path.sep}`) || path.isAbsolute(fromClone)) throw new Error(`Fresh-copy path escaped project root: ${relative}`);
    mkdirSync(path.dirname(destination), { recursive: true });
    writeFileSync(destination, readFileSync(source));
  }

  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const runNpm = (args) => process.platform === 'win32'
    ? execFileSync('cmd.exe', ['/d', '/s', '/c', `${npm} ${args.join(' ')}`], { cwd: clone, stdio: 'inherit', windowsHide: true })
    : execFileSync(npm, args, { cwd: clone, stdio: 'inherit', windowsHide: true });

  runNpm(['ci', '--no-audit', '--no-fund']);
  for (const command of [
    ['test'],
    ['run', 'typecheck'],
    ['run', 'build'],
    ['run', 'standalone:check'],
    ['run', 'fixtures:check'],
    ['run', 'benchmark:validate'],
    ['run', 'benchmark:verify'],
    ['run', 'benchmark:hermeticity'],
    ['run', 'hero:validate'],
    ['run', 'judge-demo:verify'],
    ['run', 'audit:public'],
    ['run', 'demo:smoke'],
  ]) runNpm(command);
  console.log(`Fresh project copy verification: PASS (${files.length} candidate paths, current working tree)`);
} finally {
  const resolved = path.resolve(temp);
  const relative = path.relative(tempRoot, resolved);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) throw new Error('Refusing to remove a fresh-copy directory outside the temporary root');
  rmSync(resolved, { recursive: true, force: true });
}
