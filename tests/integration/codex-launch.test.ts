import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildCodexLaunchPlan } from "../../src/core/codex-launch.js";

function hookConfigs(plan: ReturnType<typeof buildCodexLaunchPlan>): string[] {
  return plan.args.filter((argument) => argument.startsWith("hooks."));
}

function decodeWindowsCommand(config: string): string {
  const encoded = config.match(/command_windows = ("(?:\\.|[^"\\])*")/)?.[1];
  expect(encoded).toBeDefined();
  return JSON.parse(encoded!) as string;
}

describe("Codex TUI launch arguments", () => {
  it("uses the current platform's absolute paths and preserves forwarded arguments", () => {
    const w2Home = path.resolve(path.join(os.tmpdir(), "W2 Install"));
    const cliPath = path.join(w2Home, "dist", "src", "cli.js");
    const plan = buildCodexLaunchPlan(w2Home, "codex", ["--model", "gpt-6-sol"]);
    const configs = hookConfigs(plan);

    expect(plan.executable).toBe("codex");
    expect(plan.args.filter((argument) => argument === "--config")).toHaveLength(7);
    expect(configs.map((argument) => argument.split("=", 1)[0])).toEqual([
      "hooks.UserPromptSubmit", "hooks.PreToolUse", "hooks.PostToolUse", "hooks.PermissionRequest", "hooks.Stop", "hooks.Interrupt", "hooks.SessionEnd",
    ]);
    expect(configs[0]).toContain(`command = ${JSON.stringify(`node "${cliPath}" hook --home "${w2Home}"`)}`);
    expect(configs[1]).toContain("timeout = 10");
    expect(configs[2]).toContain("timeout = 10");
    expect(configs[3]).toContain("timeout = 10");
    expect(configs[4]).toContain("timeout = 1500");
    expect(configs[5]).toContain("timeout = 3");
    expect(configs[6]).toContain("timeout = 3");
    expect(plan.args.slice(-2)).toEqual(["--model", "gpt-6-sol"]);

    if (process.platform === "win32") {
      const windowsCommand = decodeWindowsCommand(configs[0]!);
      expect(windowsCommand).toMatch(/^powershell\.exe -NoLogo -NoProfile -NonInteractive -EncodedCommand [A-Za-z0-9+/=]+$/);
      const powershellScript = Buffer.from(windowsCommand.split(" ").at(-1)!, "base64").toString("utf16le");
      expect(powershellScript).toContain(`'${cliPath}'`);
      expect(powershellScript).toContain(`hook --home '${w2Home}'`);
      expect(powershellScript).toContain(process.execPath);
    }
  });

  it("escapes native TOML paths containing spaces and apostrophes", () => {
    const w2Home = path.resolve(path.join(os.tmpdir(), "W2's Install"));
    const cliPath = path.join(w2Home, "dist", "src", "cli.js");
    const plan = buildCodexLaunchPlan(w2Home, "codex", []);
    const stop = hookConfigs(plan).find((argument) => argument.startsWith("hooks.Stop="))!;

    expect(stop).toContain(`command = ${JSON.stringify(`node "${cliPath}" hook --home "${w2Home}"`)}`);
    if (process.platform === "win32") {
      const windowsCommand = decodeWindowsCommand(stop);
      const powershellScript = Buffer.from(windowsCommand.split(" ").at(-1)!, "base64").toString("utf16le");
      expect(powershellScript).toContain(`'${cliPath.replaceAll("'", "''")}'`);
      expect(powershellScript).toContain(`hook --home '${w2Home.replaceAll("'", "''")}'`);
    }
  });
});
