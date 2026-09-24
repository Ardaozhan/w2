import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildCodexLaunchPlan } from "../dist/src/core/codex-launch.js";

function parseArguments(args) {
  const homeIndex = args.indexOf("--w2-home");
  const codexIndex = args.indexOf("--codex");
  const forwardedIndex = args.indexOf("--forward-count");
  if (homeIndex < 0 || !args[homeIndex + 1] || codexIndex < 0 || !args[codexIndex + 1] || forwardedIndex < 0) {
    throw new Error("Usage: codex-tui-launcher --w2-home <path> --codex <executable> --forward-count <count> [Codex arguments]");
  }
  const forwardedCount = Number(args[forwardedIndex + 1]);
  const forwardedArgs = args.slice(forwardedIndex + 2);
  if (!Number.isInteger(forwardedCount) || forwardedCount < 0 || forwardedArgs.length !== forwardedCount) {
    throw new Error("The forwarded Codex argument count does not match the supplied arguments.");
  }
  return { w2Home: args[homeIndex + 1], executable: args[codexIndex + 1], forwardedArgs };
}

function main() {
  try {
    const input = parseArguments(process.argv.slice(2));
    const plan = buildCodexLaunchPlan(input.w2Home, input.executable, input.forwardedArgs);
    const result = spawnSync(plan.executable, plan.args, { stdio: "inherit", windowsHide: false });
    if (result.error) throw result.error;
    process.exitCode = result.status ?? 1;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`W2 could not start the normal Codex TUI: ${message}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
