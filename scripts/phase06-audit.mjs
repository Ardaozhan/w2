import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const criterion = process.argv[2] ?? 'ALL';
const required = {
  'AC-README': ['README.md'],
  'AC-DOCS': ['docs/application/PROJECT-SUMMARY.md','docs/application/TECHNICAL-SUMMARY.md','docs/application/IMPACT.md','docs/application/AI-CONTRIBUTION.md','docs/application/LIMITATIONS.md'],
  'AC-PROOF': ['docs/ARCHITECTURE-DIAGRAM.md','docs/COMPETITION-PROOF-MAP.md','docs/CLAIM-AUDIT.md','evidence/screenshots/run-receipt-hero.png','benchmarks/results/results.json'],
  'AC-JUDGE': ['docs/JUDGE-SIMULATION.md','benchmarks/README.md']
};
function assertFiles(list) { for (const file of list) if (!existsSync(file)) throw new Error(`missing ${file}`); }
if (criterion === 'AC-README' || criterion === 'ALL') { assertFiles(required['AC-README']); const readme = readFileSync('README.md','utf8'); for (const term of ['npm run demo','Run Receipt','benchmark','Limitations']) if (!readme.includes(term)) throw new Error(`README missing ${term}`); }
if (criterion === 'AC-DOCS' || criterion === 'ALL') assertFiles(required['AC-DOCS']);
if (criterion === 'AC-PROOF' || criterion === 'ALL') assertFiles(required['AC-PROOF']);
if (criterion === 'AC-FRESH' || criterion === 'ALL') execFileSync(process.execPath, ['scripts/fresh-clone-check.mjs'], { stdio: 'inherit', windowsHide: true });
if (criterion === 'AC-SECURITY' || criterion === 'ALL') {
  const tracked = ['README.md','docs/BENCHMARK-REPORT.md','docs/CLAIM-AUDIT.md', ...readdirSync('docs/application').map((file) => path.join('docs/application', file))];
  const secret = /(?<![A-Za-z0-9])(sk-[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9_]{20,}|Bearer\s+[A-Za-z0-9._~+/=-]{12,}|-----BEGIN .*PRIVATE KEY-----)/i;
  for (const file of tracked) { if (!statSync(file).isFile()) continue; if (secret.test(readFileSync(file,'utf8'))) throw new Error(`credential pattern in ${file}`); }
  const publicText = ['README.md','docs/BENCHMARK-REPORT.md','docs/CLAIM-AUDIT.md'].map((file) => readFileSync(file,'utf8')).join('\n'); const unsupported = publicText.split(/\r?\n/).filter((line) => !/^Search terms reviewed:/i.test(line) && /\b(best|fastest|more reliable|production-ready)\b/i.test(line) && !/(not claimed|no supporting|does not|no unsupported)/i.test(line)); if (unsupported.length) throw new Error(`unsupported superlative claim: ${unsupported[0]}`);
}
if (criterion === 'AC-JUDGE' || criterion === 'ALL') assertFiles(required['AC-JUDGE']);
console.log(`Phase 06 audit ${criterion}: PASS`);
