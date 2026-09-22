import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
const root = path.resolve('benchmarks/fixtures');
const index = JSON.parse(readFileSync(path.join(root, 'index.json'), 'utf8'));
if (index.length < 8) throw new Error('At least eight fixtures are required');
const categories = new Set();
for (const entry of index) {
  const dir = path.join(root, entry.fixture_id); const contract = JSON.parse(readFileSync(path.join(dir, 'task.json'), 'utf8'));
  for (const field of ['fixture_id','baseline_commit','task','constraints','allowed_paths','acceptance_criteria','verification_commands','external_verifier','reset_command']) if (!(field in contract)) throw new Error(`${entry.fixture_id}: missing ${field}`);
  if (contract.fixture_id !== entry.fixture_id || !/^[0-9a-f]{40}$/.test(contract.baseline_commit)) throw new Error(`${entry.fixture_id}: invalid baseline commit`);
  categories.add(contract.category); if (!statSync(path.join(dir, 'verify.mjs')).isFile()) throw new Error(`${entry.fixture_id}: verifier missing`);
}
if (categories.size < 4) throw new Error('Fixtures must span multiple categories');
console.log(`Benchmark fixture validation: PASS (${index.length} fixtures, ${categories.size} categories)`);
