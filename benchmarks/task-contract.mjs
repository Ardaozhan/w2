import { createHash } from 'node:crypto';

export function normalizeTaskContract(value) {
  if (!value || typeof value !== 'object' || typeof value.fixture_id !== 'string' || !/^[0-9a-f]{40}$/.test(value.baseline_hash ?? '') || !value.task || typeof value.task !== 'object') throw new Error('Malformed benchmark fixture contract');
  const task = value.task;
  if (typeof task.goal !== 'string' || !task.goal.trim() || typeof task.title !== 'string' || !task.title.trim()) throw new Error(`${value.fixture_id}: task title and goal are required`);
  for (const field of ['constraints', 'acceptance_criteria', 'verification_commands']) if (!Array.isArray(task[field])) throw new Error(`${value.fixture_id}: task.${field} must be an array`);
  if (!task.constraints.every((item) => typeof item === 'string' && item.trim())) throw new Error(`${value.fixture_id}: malformed task constraints`);
  if (!task.acceptance_criteria.length || !task.acceptance_criteria.every((item) => item && typeof item.id === 'string' && item.id.trim() && typeof item.statement === 'string' && item.statement.trim() && typeof item.required === 'boolean' && Array.isArray(item.verification_refs) && item.verification_refs.every((ref) => typeof ref === 'string' && ref.trim()))) throw new Error(`${value.fixture_id}: malformed acceptance criteria`);
  const criterionIds = task.acceptance_criteria.map((item) => item.id);
  if (new Set(criterionIds).size !== criterionIds.length) throw new Error(`${value.fixture_id}: duplicate criterion ID`);
  if (!task.verification_commands.length || !task.verification_commands.every((item) => item && typeof item.id === 'string' && item.id.trim() && typeof item.name === 'string' && item.name.trim() && typeof item.command === 'string' && item.command.trim() && ['test','lint','typecheck','build','custom'].includes(item.category))) throw new Error(`${value.fixture_id}: malformed verification commands`);
  const verifierIds = task.verification_commands.map((item) => item.id);
  if (new Set(verifierIds).size !== verifierIds.length) throw new Error(`${value.fixture_id}: duplicate verifier ID`);
  for (const criterion of task.acceptance_criteria) for (const ref of criterion.verification_refs) if (!verifierIds.includes(ref)) throw new Error(`${value.fixture_id}: criterion ${criterion.id} references missing verifier ${ref}`);
  if (!Array.isArray(value.allowed_paths) || !value.allowed_paths.length || !value.allowed_paths.every((item) => typeof item === 'string' && item.trim())) throw new Error(`${value.fixture_id}: allowed paths are required`);
  if (typeof value.external_verifier !== 'string' || typeof value.reset_command !== 'string') throw new Error(`${value.fixture_id}: verifier and reset command are required`);
  if (!Array.isArray(value.baseline_files) || !value.baseline_files.length) throw new Error(`${value.fixture_id}: baseline file manifest is required`);
  return { fixture_id: value.fixture_id, baseline_hash: value.baseline_hash, baseline_kind: value.baseline_kind, baseline_files: [...value.baseline_files], task: { title: task.title, goal: task.goal, constraints: [...task.constraints], acceptance_criteria: task.acceptance_criteria.map((item) => ({ id: item.id, statement: item.statement, required: item.required, verification_refs: [...item.verification_refs] })), verification_commands: task.verification_commands.map((item) => ({ id: item.id, name: item.name, command: item.command, category: item.category })) }, allowed_paths: [...value.allowed_paths], external_verifier: value.external_verifier, reset_command: value.reset_command };
}

export function taskSemanticsHash(contract) {
  const normalized = normalizeTaskContract(contract);
  return createHash('sha256').update(JSON.stringify({ task: normalized.task, allowed_paths: normalized.allowed_paths, external_verifier: normalized.external_verifier })).digest('hex');
}
