import { readFileSync, writeFileSync } from 'node:fs';

const data = JSON.parse(readFileSync('benchmarks/results/results.json', 'utf8'));
if (data.methodology?.fixtures !== 8 || data.runs?.length !== 16) throw new Error('Cannot generate report without the complete 8x2 stored run set');
const conditions = ['raw_codex', 'w2_codex'];
const statuses = ['TASK_PASS', 'TASK_FAIL', 'TASK_UNPROVEN', 'INFRASTRUCTURE_FAILURE'];
const count = (condition, predicate) => data.runs.filter((run) => run.condition === condition && predicate(run)).length;
const lines = [
  '# Benchmark Report', '', '## Methodology', '',
  `Eight baseline-reset fixtures, Raw Codex and W2 + Codex, identical normalized task semantics, baseline, external verifier, workspace-write sandbox, and a shared ${data.methodology.timeout_ms} ms agent timeout. Model configuration follows the local Codex CLI configuration. All attempts, including errors, timeouts, and UNPROVEN outcomes, are retained.`, '',
  '## Metric definitions', '',
  '- **Criterion evidence coverage:** required criteria with at least one attached, existing deterministic verifier/assertion record carrying PASS or FAIL status, divided by required criteria. Diff, tool, context, lifecycle-only, interpreted, and nonexistent evidence references do not count. Zero required criteria yields 0.',
  '- **False DONE:** an affirmative completion claim in actual assistant/agent message text plus Raw external verifier FAIL/UNPROVEN, or W2 required criterion FAIL/UNPROVEN. Lifecycle/tool output is ignored; infrastructure failure is excluded.',
  '- **Infrastructure failure:** Codex process error or timeout. It is reported separately and not silently counted as task failure.',
  '- **Outcome denominator:** all eight attempts per condition are shown in the outcome table. Task-outcome rates exclude infrastructure failures; false-DONE denominator likewise excludes infrastructure failures.', '',
  '## Outcomes (all attempted runs)', '', '| Outcome | Raw Codex | W2 + Codex |', '|---|---:|---:|',
];
for (const status of statuses) lines.push(`| ${status} | ${count('raw_codex', (run) => run.status === status)}/8 | ${count('w2_codex', (run) => run.status === status)}/8 |`);
lines.push('', '## False-DONE metric', '', '| Condition | False-DONE | Non-infrastructure attempts |', '|---|---:|---:|');
for (const condition of conditions) {
  const infra = count(condition, (run) => run.infrastructure_failure === true);
  lines.push(`| ${condition === 'raw_codex' ? 'Raw Codex' : 'W2 + Codex'} | ${count(condition, (run) => run.false_done === true)} | ${8 - infra} |`);
}
lines.push('', '## Limitations', '', '- One real run per task and condition is descriptive, not statistical.', '- This benchmark tests eight local fixtures only.', '- No speed, reliability, safety, or comparative product advantage is inferred from this sample.', '');
writeFileSync('docs/BENCHMARK-REPORT.md', lines.join('\n'), 'utf8');
console.log('Benchmark report generated from current stored run records.');
