# Submission Checklist

## Machine actions

- [x] W2 package, architecture, dependencies, and commands are self-contained within this repository.
- [x] `npm ci`, `npm test`, `npm run typecheck`, and `npm run build` pass on the final tree.
- [x] Product-path tests cover criterion PASS, criterion FAIL, missing evidence as UNPROVEN, completion claims, invalid references, multiple passing verifiers, and one failing verifier.
- [x] Receipt validation derives outcomes from canonical verifier results; timeout and infrastructure failure cannot become PASS or UNPROVEN.
- [x] The stored paired benchmark validates as 8 Raw Codex and 8 W2 + Codex REAL_CODEX runs with matched task semantics, baselines, timeout, verifier, and isolated Codex configuration.
- [x] The benchmark report states the measured 8/8 external-verifier result for both conditions without claiming a correctness or speed advantage.
- [x] The login rate-limit hero receipt validates as a multi-criterion REAL_CODEX PASS with a real diff and verifier results.
- [x] The semantic REAL_CODEX UNPROVEN example validates and remains distinct from execution ERROR.
- [x] Current architecture, security, context, AI-contribution, application, and submission docs describe standalone W2 and its limits accurately.
- [x] The static judge demo has no build or API-key requirement and replays the REAL_CODEX hero PASS and semantic UNPROVEN cases.
- [x] Desktop and 390px browser checks pass; both demo cases and receipt tabs work, there is no horizontal overflow, and the browser console has no W2-attributable errors or warnings.
- [x] The public evidence manifest lists current W2-only artifacts; privacy and credential scans return zero findings.
- [x] Repository-wide standalone scan finds no active old framework, machine-specific import, missing local script, sandbox bypass, or tracked runtime database.
- [x] Fresh project-copy install, tests, typecheck, build, validators, public scan, and demo smoke pass.
- [ ] Final diff is reviewed, the requested completion commit exists, and the Git worktree is clean.

## Human actions remaining

- [ ] Run `/feedback` interactively and record the real session ID if required by submission.
- [ ] Record the demo video from [`DEMO-VIDEO-SCRIPT.md`](DEMO-VIDEO-SCRIPT.md) and verify the competition's duration requirement.
- [ ] Choose repository visibility. No publication is performed by this checklist.
- [ ] If making the repository public, choose and add a license, then perform a history-aware privacy review.
- [ ] Submit the competition form.

The static judge demo replays stored runs; it does not launch Codex. Human actions above are external submission decisions or interactive steps.
