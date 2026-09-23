# Pre-hermetic benchmark archive

This local archive preserves superseded benchmark runs and failed harness attempts from before the isolated Codex home and fixture-only workspace controls were added. It can contain raw Codex output and machine-specific context, so it is intentionally ignored by Git and excluded from all judge/public evidence manifests.

The current benchmark is regenerated from clean fixture baselines by `npm run benchmark`. Only the validated current result set under `benchmarks/results/` and the explicitly listed artifacts in `evidence/PUBLIC-EVIDENCE-MANIFEST.md` are intended for review.

The archived attempts remain unscored historical diagnostics. They are not mixed into the current eight-by-two benchmark matrix and are not silently counted as task failures or successes.
