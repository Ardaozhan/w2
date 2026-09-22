import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const temp = mkdtempSync(path.join(os.tmpdir(), 'w2-fresh-'));
const archive = path.join(temp, 'repo.tar');
try {
  writeFileSync(archive, execFileSync('git', ['archive', '--format=tar', 'HEAD'], { maxBuffer: 64 * 1024 * 1024 }));
  execFileSync('tar', ['-xf', archive, '-C', temp], { stdio: 'ignore', windowsHide: true });
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const runNpm = (args) => process.platform === 'win32' ? execFileSync('cmd.exe', ['/d','/s','/c', `${npm} ${args.join(' ')}`], { cwd: temp, stdio: 'inherit', windowsHide: true }) : execFileSync(npm, args, { cwd: temp, stdio: 'inherit', windowsHide: true });
  runNpm(['ci', '--ignore-scripts', '--no-audit', '--no-fund']);
  for (const command of [['test'],['run','typecheck'],['run','build'],['run','verify:phase02'],['run','benchmark:verify'],['run','demo:smoke']]) runNpm(command);
  console.log('Fresh clone verification: PASS');
} finally { rmSync(temp, { recursive: true, force: true }); }
