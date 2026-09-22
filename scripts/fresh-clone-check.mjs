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
  execFileSync(npm, ['ci', '--ignore-scripts', '--no-audit', '--no-fund'], { cwd: temp, stdio: 'inherit', windowsHide: true });
  for (const command of [['test'],['run','typecheck'],['run','build'],['run','verify:phase02'],['run','benchmark:verify'],['run','demo:smoke']]) execFileSync(npm, command, { cwd: temp, stdio: 'inherit', windowsHide: true });
  console.log('Fresh clone verification: PASS');
} finally { rmSync(temp, { recursive: true, force: true }); }
