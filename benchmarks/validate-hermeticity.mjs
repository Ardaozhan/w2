import { existsSync, readFileSync } from 'node:fs';
import { assertNoUserHomeLeak } from './codex-isolation.mjs';

const resultPath = 'benchmarks/results/results.json';
if (!existsSync(resultPath)) throw new Error('Benchmark result data is missing; run the canonical benchmark first');
const data = JSON.parse(readFileSync(resultPath, 'utf8'));
if (data.validation?.status !== 'PASS') throw new Error('Canonical paired benchmark matrix did not validate');
if (data.methodology?.user_memory !== 'disabled' || data.methodology?.user_skill_instructions !== 'disabled' || data.methodology?.isolated_home !== '<CODEX_HOME>' || data.methodology?.sandbox !== 'workspace-write' || data.methodology?.windows_sandbox !== 'unelevated' || data.methodology?.model_prompt_isolation?.status !== 'PASS' || data.methodology?.model_prompt_isolation?.global_profile_references !== 0 || data.methodology?.model_prompt_isolation?.host_repository_references !== 0) throw new Error('Benchmark isolation methodology or model-visible prompt preflight is incomplete');
if (data.runs?.length !== 16) throw new Error('Hermeticity validation requires all sixteen canonical runs');
for (const run of data.runs) {
  if (run.hermeticity?.status !== 'PASS' || run.hermeticity.memory_files !== 0 || run.hermeticity.global_credential_environment !== 'excluded' || run.hermeticity.workspace_write_sandbox !== 'workspace-write' || run.hermeticity.windows_sandbox !== 'unelevated' || run.hermeticity.model_prompt_validation !== 'PASS') throw new Error(`${run.fixture_id}/${run.condition}: isolated environment did not pass validation`);
  if (!String(run.hermeticity.runtime_file_reads).startsWith('UNOBSERVED:')) throw new Error(`${run.fixture_id}/${run.condition}: runtime read-observation limitation is not classified`);
  const artifactPath = `benchmarks/runs/${run.condition === 'raw_codex' ? 'raw' : 'w2'}/${run.fixture_id}/run-record.json`;
  if (!existsSync(artifactPath)) throw new Error(`${run.fixture_id}/${run.condition}: public run artifact is missing`);
  const artifactText = readFileSync(artifactPath, 'utf8');
  assertNoUserHomeLeak(artifactText);
  if (/C:\\Users\\[^\\\s"']+\\\.codex\\(?:memories|prompts|rules|skills)|\/Users\/[^/\s"']+\/\.codex\/(?:memories|prompts|rules|skills)|\/home\/[^/\s"']+\/\.codex\/(?:memories|prompts|rules|skills)/i.test(artifactText)) throw new Error(`${run.fixture_id}/${run.condition}: public record references global Codex context`);
}
console.log('Benchmark hermeticity validation: PASS (isolated CODEX_HOME, memory/config exclusion, workspace ancestry, captured output and public artifact scans; direct OS reads are explicitly unobserved)');
