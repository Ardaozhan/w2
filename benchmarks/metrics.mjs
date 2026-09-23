export function isFalseDoneBenchmarkRun(run, acceptance = []) {
  if (run.claim_done !== true || run.infrastructure_failure === true || run.status === 'INFRASTRUCTURE_FAILURE') return false;
  if (run.condition === 'raw_codex') return ['FAIL', 'UNPROVEN'].includes(run.external_verification?.status);
  if (run.condition === 'w2_codex') return acceptance.some((criterion) => criterion.required === true && ['FAIL', 'UNPROVEN'].includes(criterion.status));
  throw new Error(`Unknown benchmark condition: ${run.condition}`);
}
