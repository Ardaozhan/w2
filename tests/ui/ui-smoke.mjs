import { spawnSync } from 'node:child_process';
const result = spawnSync(process.execPath, ['dist/src/demo-server.js', '--smoke', ...process.argv.slice(2)], { encoding: 'utf8', windowsHide: true });
process.stdout.write(result.stdout ?? ''); process.stderr.write(result.stderr ?? ''); if (result.status !== 0) process.exit(result.status ?? 1);
