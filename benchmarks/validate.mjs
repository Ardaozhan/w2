import { readFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { normalizeTaskContract } from './task-contract.mjs';
const root = path.resolve('benchmarks/fixtures');
const index = JSON.parse(readFileSync(path.join(root, 'index.json'), 'utf8'));
if (index.length < 8) throw new Error('At least eight fixtures are required');
const categories = new Set();
for (const entry of index) {
  const dir = path.join(root, entry.fixture_id); const contract = JSON.parse(readFileSync(path.join(dir, 'task.json'), 'utf8'));
  for (const field of ['fixture_id','baseline_hash','baseline_kind','task','allowed_paths','external_verifier','reset_command']) if (!(field in contract)) throw new Error(`${entry.fixture_id}: missing ${field}`);
  normalizeTaskContract(contract);
  if (contract.fixture_id !== entry.fixture_id || contract.baseline_kind !== 'fixture-content-sha1' || !/^[0-9a-f]{40}$/.test(contract.baseline_hash)) throw new Error(`${entry.fixture_id}: invalid baseline fingerprint`);
  if (!Array.isArray(contract.baseline_files) || !contract.baseline_files.length) throw new Error(`${entry.fixture_id}: baseline file manifest missing`);
  const files = Object.fromEntries(contract.baseline_files.map((file) => [file, readFileSync(path.join(dir, file), 'utf8')]));
  const expectedBaseline = createHash('sha1').update(JSON.stringify({ files, verify: readFileSync(path.join(dir, 'verify.mjs'), 'utf8') })).digest('hex');
  if (contract.baseline_hash !== expectedBaseline) throw new Error(`${entry.fixture_id}: baseline does not match fixture files and verifier`);
  categories.add(contract.category); if (!statSync(path.join(dir, 'verify.mjs')).isFile()) throw new Error(`${entry.fixture_id}: verifier missing`);
}
if (categories.size < 4) throw new Error('Fixtures must span multiple categories');
console.log(`Benchmark fixture validation: PASS (${index.length} fixtures, ${categories.size} categories)`);
