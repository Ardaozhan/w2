import { readFileSync, existsSync } from 'node:fs';
const resultPath = 'benchmarks/results/results.json';
if (!existsSync(resultPath)) throw new Error('benchmark results missing; run npm run benchmark');
const data = JSON.parse(readFileSync(resultPath, 'utf8'));
if (!Array.isArray(data.runs) || data.runs.length < 16) throw new Error('expected raw and w2 records for eight fixtures');
for (const run of data.runs) for (const field of ['fixture_id','condition','status','external_verification','evidence']) if (!(field in run)) throw new Error(`missing ${field}`);
if (!['raw_codex','w2_codex'].every((condition) => data.runs.some((run) => run.condition === condition))) throw new Error('both benchmark conditions are required');
if (!existsSync('benchmarks/results/results.csv') || !existsSync('docs/BENCHMARK-REPORT.md')) throw new Error('benchmark report artifacts missing');
console.log(`Benchmark result validation: PASS (${data.runs.length} stored runs)`);
