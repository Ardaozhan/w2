# Contributing

W2 is a local verification layer for coding agents. Changes should preserve the deterministic receipt pipeline: tool activity shows activity, verifier results support only their declared checks, and unsupported criteria stay `UNPROVEN`.

## Development

- Use Node.js 22.13 or newer and npm.
- Install dependencies with `npm ci`.
- Run `npm test`, `npm run typecheck`, and `npm run build` before opening a pull request.
- Keep browser, screenshot, and visual automation out of automatic project-check discovery.
- Add focused regression tests for behavior changes. Use temporary Git projects and temporary brainw2 vaults; never use a personal vault in tests.

Please describe the behavior changed, verification run, and any remaining limitations. Do not include credentials, private prompts, user notes, or runtime receipts in issues or pull requests.
