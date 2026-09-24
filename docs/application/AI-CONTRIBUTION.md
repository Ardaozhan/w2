# AI Contribution

## Codex

Codex CLI was used for real coding-agent executions preserved in the benchmark and demo evidence. It also assisted implementation and repository validation. W2 stores the structured events it recognizes and resulting diffs; it does not intercept every Codex-native tool call.

## GPT-5.6

GPT-5.6 reviewed benchmark methodology, Run Receipt semantics, and public claims during development. It did not run W2, map runtime evidence, or select outcomes. The recorded review provenance and findings are in [GPT-5.6 Contribution](../GPT56-CONTRIBUTION.md) and [GPT-5.6 Final Review](../GPT56-FINAL-REVIEW.md). No separate provider session ID was exposed by that review host.

## Human decisions

Human engineering decisions set the Run Receipt contract, deterministic evidence rules, outcome semantics, benchmark controls, security boundaries, and product scope. Failed and infrastructure-failed runs remain visible in the benchmark results.
