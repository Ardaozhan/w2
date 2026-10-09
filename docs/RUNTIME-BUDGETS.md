# Runtime Budgets

Task contracts may declare `runtime_budget` with `max_steps`,
`max_tool_calls`, `max_runtime_ms`, `max_output_bytes`, and
`max_context_size`. The runtime counts steps and tool calls, bounds child
process output, and applies the remaining wall-clock budget to each child
process timeout. A shell call also has a five-minute default timeout when no
task timeout or runtime wall-clock budget is declared. All verifier commands
in a task share one ten-minute verification budget by default, so several
checks cannot each consume a full timeout in sequence. Set
`verification_timeout_ms` to choose a total verifier budget from 1 ms to 30
minutes. `timeout_ms` remains the per-command timeout and is clamped to the
remaining verification budget. Interactive turns additionally share one
five-minute W2 runtime budget. An exhausted budget is recorded as verification
`ERROR`; checks not started after exhaustion are also recorded as `ERROR` with
the budget reason. Timed-out POSIX commands run in a dedicated process group,
which W2 force-terminates. On Windows a bundled PowerShell/.NET runner creates
the command suspended, assigns it to a Job Object with kill-on-close, then
resumes it; child processes inherit job membership. If Windows refuses the
nested job assignment, W2 records the fallback and uses `taskkill /T /F`.
Job Objects do not capture processes created through `Win32_Process.Create`,
so this remains process lifecycle management rather than an OS security
sandbox. Retry policy is bounded by `RetryPolicy.maxRetries` and records every
attempt with cause, decision, and result.
