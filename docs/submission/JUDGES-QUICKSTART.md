# Judges Quickstart (Windows)

## Requirements

Windows 11, Node.js 22.13+, npm, Git, and the Codex CLI. Live runs require the judge's normal Codex authentication. This platform combination is the one verified for W2.

## Run W2

Replace the placeholder with the repository URL supplied by the project owner:

```powershell
git clone <W2 repository URL> w2
cd w2
npm ci
npm run build
npm test
& .\scripts\install-w2-launcher.ps1
```

Open a new PowerShell session, then run W2 from a Git project:

```powershell
cd C:\work\sample-project
w2
```

Codex starts as the normal interactive TUI. Review and trust W2's hook definition in Codex with `/hooks` when prompted.

## Inspect the receipt

After an engineering turn, W2 prints the computed outcome and receipt location. Open the JSON or Markdown file under the W2 installation's `.w2\interactive\<project-hash>\receipts\` directory. The receipt shows the captured task, criteria, diff, checks, linked evidence, and outcome. `UNPROVEN` means W2 did not find sufficient verifier evidence for at least one required criterion; it does not mean the run timed out.

The static judge demo can also be opened directly at `judge-demo/index.html`; it replays stored runs and does not launch Codex. Validate it with `npm run judge-demo:verify`.

This checkout has no configured Git remote, so the clone URL is intentionally a placeholder until the owner supplies the hosted repository address.
