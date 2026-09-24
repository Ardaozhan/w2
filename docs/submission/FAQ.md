# FAQ

## What is W2?

A local verification layer that records coding-agent runs in evidence-backed Run Receipts.

## Is W2 another coding agent?

No. Codex remains the agent. W2 captures a run and verifies declared criteria through deterministic checks.

## Does W2 replace CI?

No. CI runs configured checks. W2 connects task criteria to verifier results and stores them with run context, recognized events, and the diff.

## Does a passing test suite mean PASS?

Only when passing verifier evidence is mapped to every required criterion. A generic passing suite does not prove unrelated semantic behavior.

## What does `UNPROVEN` mean?

The run completed without enough evidence to prove every required criterion. It differs from `ERROR`, which reports execution or verification infrastructure failure.

## Does W2 record everything Codex did or read?

No. W2 records supported structured events and Git-visible changes. This adapter does not capture every Codex-native operation or exact file reads.

## Does W2 change the normal Codex command?

No. The PowerShell `w2` launcher starts Codex with one-run hook configuration. Running `codex` directly remains normal Codex.

## Which platforms are verified?

Windows 11 with Node.js 22.13+ is verified. Other operating systems have not been independently verified.

## Is a hosted W2 service required?

No. Run state and receipts are local. The static judge demo replays stored evidence offline.

## Does W2 guarantee correct or secure code?

No. A verifier proves only its declared check. Codex's sandbox controls native execution; W2 is not an OS/container security boundary.

## Is W2 published on npm?

No. The package is marked private. This checkout has no Git remote or confirmed hosted release target.
