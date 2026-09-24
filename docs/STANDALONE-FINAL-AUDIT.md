# Historical Standalone Audit (Superseded)

> This audit records a prior project-copy snapshot based on commit `983f9c0`. Its counts and browser-check results are historical and do not verify the current `a1a73a9` interactive integration or v0.1.0 preparation. Use the current [W2 Final Preparation Report](W2-FINAL-REPORT.md) for present status.

## Initial State

**W2 STANDALONE FINAL GATE = NOT YET PROVEN**

- Baseline HEAD: `983f9c07ae42e09006591897cb6ec53e2e295944` on `main`.
- The initial worktree was not clean: 23 modified or newly created paths were already present before this audit began. Those in-progress W2 edits were preserved and reviewed.
- No repository `AGENTS.md` file was present.
- The existing README and architecture already described W2 as a local verification product. Historical phase documents, local ignored runtime state, a duplicate npm script key, and the unfinished standalone checker still needed review.
- This audit started with `W2 STANDALONE FINAL GATE = NOT YET PROVEN`; none of the final completion criteria are inferred from the baseline commit alone.

## Baseline Commands

Executed against the initial working tree after recording its starting state:

| Command | Result |
|---|---|
| `npm ci` | PASS; 41 packages installed, 42 audited, 0 vulnerabilities reported |
| `npm test` | PASS; 14 test files, 57 tests |
| `npm run typecheck` | PASS |
| `npm run build` | PASS |

## Audit Scope

Review the product architecture and normal CLI path; historical-document classification; package scripts and imports; Codex sandbox invocation; Run Receipt and criterion evidence behavior; benchmark and hero artifacts; static demo; public privacy and secret checks; fresh-copy reproducibility; and final Git state.

## Final Gate Evidence

Checks completed against the current W2 project copy:

| Gate | Result | Recorded evidence |
|---|---|---|
| Dependency install | PASS | `npm ci`; 41 packages installed, zero vulnerabilities reported |
| Tests | PASS | 14 files, 57 tests |
| Typecheck and build | PASS | `npm run typecheck`; `npm run build` |
| Local product scripts | PASS | 27 scripts; local targets resolve; no absolute local imports |
| Codex runtime | PASS | Active adapter requests `workspace-write`; no bypass mode |
| Fixture and receipt validation | PASS | 8 benchmark fixtures plus synthetic PASS/FAIL/UNPROVEN receipt integrity |
| Benchmark | PASS | 16 REAL_CODEX records; paired-result and hermeticity validators pass |
| Hero and semantic example | PASS | Hero REAL_CODEX PASS; latest semantic REAL_CODEX UNPROVEN retained and replayed |
| Public privacy and secret scan | PASS | 97 evidence files and 237 project files; zero findings |
| Static judge demo | PASS | Stored cases and receipt integrity validated; local UI smoke passes |
| Browser QA | PASS | Desktop and 390px viewport; seven tabs and both cases; no overflow, console errors, or warnings |
| Fresh project copy | PASS | 238 candidate paths copied without ignored dependencies/runtime data; install and all critical checks pass |
| Requested CLI path | PASS | A real isolated `w2 run` returned PASS with one verifier; stored receipt was read back |

At the time of this historical audit, the report [`W2-FINAL-REPORT.md`](W2-FINAL-REPORT.md) described the then-current source state. It has since been superseded; see the current report linked above.
