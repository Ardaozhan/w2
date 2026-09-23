# Public claim audit

Audit scope: artifacts named by [`evidence/PUBLIC-EVIDENCE-MANIFEST.md`](../evidence/PUBLIC-EVIDENCE-MANIFEST.md), README, judge demo, benchmark report, architecture/security/context docs, and hero case study. Historical phase/repair reports describe their original checkpoints; the current status is in `FINAL-COMPLETION-REPORT.md`.

| Claim | Disposition | Evidence or wording limit |
|---|---|---|
| W2 is a verification layer for coding agents | SUPPORTED | RunEngine, CLI, automatic acceptance mapping, persisted receipt, and integration coverage. |
| Coding agents can claim they finished; W2 shows evidence | SUPPORTED WITH LIMIT | Receipt outcome is computed from stored run status and verifier-linked deterministic evidence; the agent does not select it. |
| No evidence, no PASS | SUPPORTED | Receipt validator rejects missing/non-deterministic evidence for required criteria and tests cover PASS, FAIL, and UNPROVEN. |
| W2 automatically maps criteria to evidence in the normal product path | SUPPORTED | Hero REAL_CODEX receipt and RunEngine/CLI integration tests use task-contract verifier references without demo-only mapping. |
| A task-specific verifier record proves its exact declared fixture checks | SUPPORTED WITH LIMIT | It supports only the named verifier result in that run; it is not a general or production guarantee. |
| W2 proves a particular required criterion | REWRITE AS “the receipt has deterministic evidence for this declared criterion” | The evidence supports only the exact task, verifier, and recorded run; it is not a general guarantee. |
| The context manifest proves every file Codex accessed | REWRITE | It records W2-selected and provided context; exact Codex reads are unknown with this adapter. |
| The benchmark proves general observability | REWRITE | It shows recorded events and classification for this stored sample; direct OS-level reads remain unobserved. |
| W2 sees every file Codex opened | REMOVE | W2 records considered, selected, and provided context. Exact Codex reads are unknown with this adapter. |
| W2 controls or authorizes every Codex action | REMOVE | Codex-native calls use Codex's sandbox. W2's capability/path checks apply only to W2-owned ToolRuntime calls. |
| The installed Codex CLI uses workspace-write for the isolated run | SUPPORTED FOR THIS WINDOWS RUN | Explicit isolated config, actual smoke write/verifier, and saved REAL_CODEX run events. The Windows implementation is `unelevated`; this does not make W2 an OS boundary. |
| W2 is safer, more reliable, faster, or more accurate than raw Codex | REMOVE | Not claimed. The one-attempt-per-fixture sample cannot establish comparative superiority. |
| W2 replaces CI | REMOVE | W2 can use test/CI output as evidence in a receipt; it does not replace a CI system. |
| GPT-5.6 maps evidence or selects runtime outcomes | REMOVE | GPT-5.6 evidence is a development-time review only; the runtime outcome is deterministic. |
| W2 is production-ready | REMOVE | Not claimed. The hero is an in-memory fixture; distributed limits, persistence, deployment, and operational review are outside its scope. |
| The static judge demo runs Codex live | REMOVE | It is a no-build replay of verified stored artifacts. The separate `demo:live` command creates a real run. |

Search terms reviewed: `better`, `safer`, `secure`, `reliable`, `proves`, `prevents`, `reduces`, `faster`, `more accurate`, `sees`, `controls`, `sandbox`, and `production-ready`. Direct Codex file reads and operating-system activity beyond the captured adapter events remain unobserved.
