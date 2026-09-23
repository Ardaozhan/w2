# Submission Checklist

## Machine actions

- [x] V42 execution readiness resolved and this final-completion task accepted through the supported task lifecycle.
- [x] Automatic criterion-to-verifier evidence mapping runs through RunEngine and the normal `w2 run task.json` CLI path.
- [x] Product-path integration and receipt-integrity tests cover PASS, FAIL, UNPROVEN, multiple verifiers, unmapped criteria, missing verifier references, and agent completion claims.
- [x] Receipt validation binds criterion evidence to canonical stored verifier results and rejects fabricated extra verifier evidence.
- [x] Isolated Codex benchmark completed from reset fixture baselines: 8 Raw Codex runs and 8 W2 + Codex runs; all 16 attempts retained.
- [x] Benchmark result and hermeticity validators pass.
- [x] Hero TypeScript/Node rate-limit fixture and stored REAL_CODEX PASS Run Receipt validate.
- [x] Stored REAL_CODEX semantic UNPROVEN receipt validates and remains distinct from infrastructure ERROR.
- [x] Public evidence manifest, separate secret/privacy audit, claim audit, hero case study, and benchmark report match current stored artifacts.
- [x] No-build judge demo validates and passes browser QA: both cases, all seven receipt tabs, local-only requests, no console errors, and 390px layout without horizontal overflow.
- [x] Current screenshots refreshed for the hero receipt, semantic UNPROVEN receipt, receipt tabs, benchmark, static demo, and mobile view.
- [x] README, security/context wording, benchmark methodology, and video script are current; unsupported correctness, superiority, and full-access claims are removed or limited.
- [x] GPT-5.6 development-time review provenance is retained without inventing a provider session ID.
- [x] Current Codex session/thread IDs were read from the runtime environment and recorded. No `/feedback` ID was fabricated.
- [x] Repository privacy scan found no local account paths in the current tracked tree after sanitizing the three sample receipts.
- [x] Final current-tree `npm ci`, test, typecheck, build, Phase 02, benchmark, hero, privacy, judge-demo, and demo-smoke validators pass.
- [x] Phase 06 final audit passes on the committed HEAD.
- [x] Fresh tracked-project copy passes install, tests, typecheck, build, fixture, benchmark, hero, privacy, judge-demo, and demo smoke validators.
- [x] Review final diff, create the requested final commit, and confirm clean Git status.

## Human actions remaining

- [ ] In the interactive Codex thread, run `/feedback` and record the exact ID it returns if required by the submission form. No supported programmatic feedback ID is exposed to this workspace.
- [ ] Record the demo video from [`DEMO-VIDEO-SCRIPT.md`](DEMO-VIDEO-SCRIPT.md) and verify the competition's duration requirement.
- [ ] Choose repository visibility. No Git remote is configured in this checkout, and no publication was performed.
- [ ] If choosing a public repository, choose and add a license, then perform a history-aware privacy review before publication.
- [ ] Submit the competition form.

The static demo is a replay of stored runs. It does not launch Codex. The current checkout contains no remote, so external repository visibility is unverified.
