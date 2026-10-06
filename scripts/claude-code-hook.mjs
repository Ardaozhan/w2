import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const w2Home = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cliPath = path.join(w2Home, "dist", "src", "cli.js");
const result = spawnSync(process.execPath, [cliPath, "hook", "--home", w2Home, "--provider", "claude-code"], {
  stdio: "inherit",
  windowsHide: true,
});
if (result.error) {
  process.stderr.write(`W2 Claude Code hook failed to start: ${result.error.message}\n`);
  process.exitCode = 1;
} else {
  process.exitCode = result.status ?? 1;
}
