# Public artifact audit

Date: 2026-09-24

## Scope

`npm run audit:public` checks the judge evidence set, current docs and README, the selected REAL_CODEX receipts, all paired benchmark run records, the static judge demo, screenshots, and the existing tracked text files. It separates credential patterns from local-environment and personal-path patterns. The current working tree is the audit target; Git history is not rewritten or represented as scanned.

## Results

| Scan | Result | Evidence |
|---|---|---|
| Public evidence secret scan | PASS | `npm run audit:public`; zero findings |
| Public evidence privacy scan | PASS | `npm run audit:public`; zero findings |
| Tracked repository secret scan | PASS | `npm run audit:public`; zero findings |
| Tracked repository privacy scan | PASS | `npm run audit:public`; zero findings after sanitizing the three sample receipts |
| Claim audit | PASS | [`CLAIM-AUDIT.md`](CLAIM-AUDIT.md) classifies supported, limited, rewritten, and removed claims |

The current scan covered 97 public evidence files and 237 tracked repository files. Both secret scans and both privacy scans returned zero findings.

The scanner checks common API-key and GitHub-token formats, bearer credentials, private-key headers, long credential assignments, account home paths, local username references, user-level Codex/agent memory and prompt paths, local isolation/system paths, and email addresses. The security regression test contains synthetic `test-user` paths as isolation-test inputs; that one test file is excluded from privacy findings, and those values are not machine or account data.

The sample receipts in `fixtures/rate-limit-demo/` use `<WORKSPACE>` in place of an absolute checkout path. Run semantics and outcomes are unchanged. Current public receipts and benchmark records use canonical placeholders such as `<WORKSPACE>`, `<CODEX_HOME>`, and `<ISOLATION_ROOT>`.

## Publication boundary

No repository publication was performed. The checkout has no Git remote configured, so no remote visibility can be verified. Raw pre-hermetic runs remain in a gitignored local archive and are excluded from the judge evidence manifest. Existing Git history has not been rewritten; any future public release requires a history-aware privacy review, explicit repository-visibility decision, and a license decision if the repository is made public.
