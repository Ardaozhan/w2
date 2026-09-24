# W2 Final Report

This is the current source of truth for W2's technical and submission status.

## Overall Status

`W2 STANDALONE FINAL GATE = NOT YET PROVEN` until the final fresh-copy and Git checks are recorded below.

## Product

W2 is a verification layer for coding agents. It turns a run into an auditable Run Receipt. The governing rule is: no evidence, no PASS.

## Standalone Status

- Package name: `w2`; Node.js requirement: `>=22.13`, matching the README and lockfile.
- The project uses Git, Node.js/npm, and the installed Codex CLI for live agent runs. No private service, external project path, or user-level script is required.
- `npm ci` installed 41 packages and reported zero vulnerabilities.
- `npm run standalone:check` passed: 27 npm scripts, all local script references resolved, zero absolute local imports, zero active retired-system matches, `workspace-write` Codex sandbox, and zero tracked runtime databases.
- `.codex-project` and the obsolete ignored runtime state were removed. Historical planning documents are excluded from the current project and evidence manifest.

## Architecture

```text
Task and acceptance criteria
    -> W2 Run Engine
    -> Context Manifest
    -> Codex Adapter and workspace-write sandbox
    -> Repository changes
    -> Recognized events, diff, and verifier results
    -> Evidence Engine
    -> Deterministic criterion and outcome calculation
    -> Run Receipt
    -> CLI, local UI, and static judge demo
```

W2 checks calls made through its own `ToolRuntime` and records recognized execution evidence. The Codex sandbox controls native Codex execution. W2 is not an OS/container security boundary or a universal pre-execution tool broker.

## Run Receipt

The receipt outcomes are `PASS`, `FAIL`, `UNPROVEN`, `ABORTED`, and `ERROR`. Agent completion text cannot set `PASS`; missing required evidence stays `UNPROVEN`; a verifier failure yields `FAIL`; aborts stay `ABORTED`; and timeout or infrastructure failure yields `ERROR`.

Receipt integrity is exercised by the product-path tests, the stored REAL_CODEX cases, `npm run hero:validate`, `npm run judge-demo:verify`, and the synthetic receipt fixture validator. Synthetic `FAKE_ADAPTER` fixtures are explicitly excluded from REAL_CODEX evidence.

## Automatic Criterion Evidence Mapping

Each acceptance criterion declares verifier IDs in the task contract. W2 validates references, stores verifier results, builds deterministic evidence, maps evidence to the referenced criterion, and recomputes the receipt outcome. Tests cover mapped PASS, mapped FAIL, missing evidence as `UNPROVEN`, completion claims, invalid references, multiple passing verifiers, and one failing verifier.

## Real Codex Evidence

- `npm run demo:live` completed a live run with Codex and stored a sanitized REAL_CODEX UNPROVEN package under `evidence/demo/unproven/20260924133117996/`.
- That run's receipt ID is `4ace33db-c824-4cc4-9e70-21ea121a2663`. The agent completed and reported done; its multiplication verifier passed; AC-01 is `PASS`, while the required documentation criterion AC-02 is `UNPROVEN` because it has no verifier reference.
- A separate temporary CLI smoke used the documented `npm run w2 -- run <task> --db <path>` command on an isolated bug-fix fixture. It returned a REAL_CODEX `PASS` with one verifier-backed criterion; its ignored scratch database was removed after the `receipt` command re-read and validated it. This smoke is not part of the submission evidence set.

## Hero Case

The stored login rate-limit run is REAL_CODEX `PASS`, run ID `4a1a90fa-c013-4437-aa14-cc335b5a3062`. It covers four required criteria with four passing verifiers and a two-file source diff. `npm run hero:validate` passed against the stored receipt.

## Semantic UNPROVEN Case

The stored example demonstrates a completed REAL_CODEX run with a passing implementation verifier while a separate required documentation criterion has no verifier reference. The outcome is `UNPROVEN`, not `PASS`, timeout, or infrastructure error. The current static demo manifest points to this latest run.

## Benchmark

The current matrix contains 8 Raw Codex and 8 W2 + Codex runs; all 16 are marked REAL_CODEX. The independent external verifier passed 8/8 in each condition. All 16 stored task outcomes are `TASK_PASS`. The sample has one attempt per fixture and condition; it does not establish that W2 writes better code, is faster, or reduces failures. W2's demonstrated value is criterion-level evidence, receipt traceability, inspectable runs, and explicit `UNPROVEN` status.

## Security Model

The active adapter requests Codex `workspace-write`. Codex's sandbox controls native execution. W2 applies capability and path checks only to W2-owned `ToolRuntime` calls and records recognized events, repository changes, and verifier results. W2 is not an OS/container boundary and does not intercept every native Codex operation.

## Context Model

W2 records files considered, selected, and provided to its adapter. It records observed or accessed files only when supported telemetry reports them; exact Codex file reads otherwise remain unknown. Context selection is not a filesystem restriction.

## Static Judge Demo

The static demo is served from local HTML, CSS, and stored data. It has no build step, API key, backend, or external asset request. Browser QA exercised both REAL_CODEX cases and all seven receipt tabs. At 390px the document width was 390px with no horizontal overflow. The browser console reported zero errors and warnings; observed requests were all to the loopback demo server. Desktop and mobile screenshots were regenerated.

The Playwright CLI blocks direct `file:` navigation, so browser QA used the documented local static server. The demo's source references only local static assets.

## GPT-5.6 Contribution

The recorded GPT-5.6 work was a read-only development-time review of benchmark methodology, Run Receipt semantics, and public claims. The model did not map runtime evidence or choose outcomes. The collaboration host did not expose a separate provider session ID, and none is claimed.

## Privacy Audit

`npm run audit:public` passed with zero privacy findings in the selected evidence set and tracked project files. See [Public Artifact Audit](PUBLIC-ARTIFACT-AUDIT.md) for the scan scope and current file counts. The ignored local archive is excluded from the judge package and fresh-copy verification.

## Secret Audit

`npm run audit:public` passed with zero credential findings in selected public evidence and tracked project files.

## Tests

- `npm ci`: PASS; zero vulnerabilities reported.
- `npm test`: PASS; 14 files and 57 tests.
- `npm run typecheck`: PASS.
- `npm run build`: PASS.
- Fixture, synthetic receipt integrity, benchmark schema/result/hermeticity, hero receipt, judge demo integrity, public privacy/secret, and local UI smoke validators: PASS.
- The current Windows environment is Node.js 22.13.1 and npm 10.9.2. SQLite emits Node's experimental API warning under this supported Node 22 runtime.

## Browser QA

Playwright Chromium passed the static judge demo at 1440×1000 and 390×844. Both stored cases rendered, all seven receipt tabs switched correctly, the semantic case showed AC-02 as `UNPROVEN`, the mobile layout had no horizontal overflow, and the browser console had zero errors or warnings.

## Fresh Copy Verification

`npm run fresh:check` passed against a clean project copy with 286 candidate paths. It installed dependencies and passed all 57 tests, typecheck, build, standalone checks, fixture and receipt validation, benchmark validation, hero and demo checks, privacy/secret scans, and local UI smoke. The copy excluded `node_modules`, `dist`, runtime databases, and ignored local archives.

## Legacy System Cleanup

The standalone checker and repository scans found zero active retired-system matches, zero machine-specific imports, zero missing local script targets, zero sandbox-bypass flags in the active runtime, and zero tracked runtime databases. Current architecture, package scripts, judge UI, and submission documents describe W2 only.

## Known Limitations

- The benchmark is descriptive: one run per fixture and condition.
- Exact Codex file-read access is not available from this adapter.
- W2 is not an OS/container security boundary or a complete native-tool broker.
- Only Windows 11 with Node.js 22.13.1 has been independently exercised here; other operating systems remain unverified.
- Node's built-in `node:sqlite` API remains experimental in Node 22 and may change.
- The static judge demo replays stored runs; it does not launch Codex or provide a hosted multi-user service.

## Human Actions Remaining

- Run `/feedback` interactively and record the real session ID if required by the submission.
- Record and review the demo video.
- Choose repository visibility and add a license if publishing.
- Submit the competition form.

## Final Commit

Pending creation of the requested W2 completion commit. Its full hash will be recorded here after commit.

## Final Gate

`W2 TECHNICAL PACKAGE READY: NOT YET PROVEN`

`W2 SUBMISSION READY: PENDING HUMAN ACTIONS`
