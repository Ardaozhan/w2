# W2 v0.2.2

W2 v0.2.2 adds stable-release self-updates and expands the interactive verification workflows.

## What's included

- Check GitHub's latest stable W2 release when the PowerShell launcher starts, at most once per 24 hours.
- Add `w2 update --check` and `w2 update` for explicit update checks and installs.
- Protect local work by requiring the official W2 repository and a clean checkout, building the selected release, and restoring the previous revision if installation fails.
- Add bounded, curated BrainW2 reference context and activity capture for interactive Codex turns and manual tasks, with reference content excluded from acceptance evidence.
- Improve child-process timeouts, process-tree cleanup, interactive hook verification, and job runner handling.
- Update `source-map-js` to 1.2.2 to clear the high-severity npm audit finding.

## Update behavior

The automatic updater uses published stable GitHub releases; commits pushed only to `main` do not update installations. Users who installed W2 before v0.2.2 need one `git pull` in their W2 checkout to receive the updater. After that, bare `w2` checks for a stable release no more than once every 24 hours.

An update checks out the published release commit, leaving the installation clone detached from a branch. Keep development changes in a separate clone.

## Verification

Release verification results are recorded in [W2 Current Status](../W2-FINAL-REPORT.md) and the GitHub Actions checks for this release commit.
