import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const temp = mkdtempSync(path.join(os.tmpdir(), 'w2-fresh-'));
const archive = path.join(temp, 'repo.tar');
// Keep the archive beside, not inside, the tracked-project copy the validators scan.
const clone = path.join(temp, 'repo');
try {
  mkdirSync(clone);
  writeFileSync(archive, execFileSync('git', ['archive', '--format=tar', 'HEAD'], { maxBuffer: 64 * 1024 * 1024 }));
  execFileSync('tar', ['-xf', archive, '-C', clone], { stdio: 'ignore', windowsHide: true });
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const runNpm = (args) => process.platform === 'win32' ? execFileSync('cmd.exe', ['/d','/s','/c', `${npm} ${args.join(' ')}`], { cwd: clone, stdio: 'inherit', windowsHide: true }) : execFileSync(npm, args, { cwd: clone, stdio: 'inherit', windowsHide: true });
  runNpm(['ci', '--no-audit', '--no-fund']);
  for (const command of [
    ['test'],
    ['run','typecheck'],
    ['run','build'],
    ['run','verify:phase02'],
    ['run','benchmark:validate'],
    ['run','benchmark:verify'],
    ['run','benchmark:hermeticity'],
    ['run','hero:validate'],
    ['run','judge-demo:verify'],
    ['run','audit:public'],
    ['run','demo:smoke'],
  ]) runNpm(command);
  console.log('Fresh clone verification: PASS');
} finally { rmSync(temp, { recursive: true, force: true }); }
