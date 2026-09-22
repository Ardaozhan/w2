# Runtime Budgets

Task contracts may declare `runtime_budget` with `max_steps`,
`max_tool_calls`, `max_runtime_ms`, `max_output_bytes`, and
`max_context_size`. The runtime counts steps and tool calls, bounds child
process output, and emits `budget_exhausted` before raising a terminal runtime
error. Retry policy is bounded by `RetryPolicy.maxRetries` and records every
attempt with cause, decision, and result.
