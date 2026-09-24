import { describe, expect, it } from "vitest";
import { buildCodexLaunchPlan } from "../../src/core/codex-launch.js";

describe("Codex TUI launch arguments", () => {
  it("uses native one-run hook overrides and preserves forwarded Codex arguments", () => {
    const plan = buildCodexLaunchPlan("C:\\W2 Install", "C:\\Codex\\codex.exe", ["--model", "gpt-6-sol"]);
    expect(plan.executable).toBe("C:\\Codex\\codex.exe");
    expect(plan.args.filter((argument) => argument === "--config")).toHaveLength(4);
    const configs = plan.args.filter((argument) => argument.startsWith("hooks."));
    expect(configs.map((argument) => argument.split("=", 1)[0])).toEqual([
      "hooks.UserPromptSubmit", "hooks.Stop", "hooks.Interrupt", "hooks.SessionEnd",
    ]);
    expect(configs[0]).toContain('command = "node \\\"C:\\\\W2 Install\\\\dist\\\\src\\\\cli.js\\\" hook --home \\\"C:\\\\W2 Install\\\""');
    expect(configs[1]).toContain("timeout = 1500");
    expect(configs[2]).toContain("timeout = 3");
    const windowsConfig = configs[0]!.match(/command_windows = ("(?:\\.|[^"\\])*")/)?.[1];
    expect(windowsConfig).toBeDefined();
    const windowsCommand = JSON.parse(windowsConfig!) as string;
    expect(windowsCommand).toMatch(/^powershell\.exe -NoLogo -NoProfile -NonInteractive -EncodedCommand [A-Za-z0-9+/=]+$/);
    const powershellScript = Buffer.from(windowsCommand.split(" ").at(-1)!, "base64").toString("utf16le");
    expect(powershellScript).toContain("'C:\\W2 Install\\dist\\src\\cli.js'");
    expect(powershellScript).toContain("hook --home 'C:\\W2 Install'");
    expect(powershellScript).toContain(process.execPath);
    expect(plan.args.slice(-2)).toEqual(["--model", "gpt-6-sol"]);
  });

  it("escapes TOML command paths without normalizing away spaces", () => {
    const plan = buildCodexLaunchPlan("C:\\W2's Install", "codex", []);
    const stop = plan.args[plan.args.indexOf("--config", 2) + 1];
    expect(stop).toContain("C:\\\\W2's Install\\\\dist\\\\src\\\\cli.js");
    expect(stop).toContain('hook --home \\\"C:\\\\W2\'s Install\\\"');
    const windowsConfig = stop.match(/command_windows = ("(?:\\.|[^"\\])*")/)?.[1];
    expect(windowsConfig).toBeDefined();
    const windowsCommand = JSON.parse(windowsConfig!) as string;
    const powershellScript = Buffer.from(windowsCommand.split(" ").at(-1)!, "base64").toString("utf16le");
    expect(powershellScript).toContain("'C:\\W2''s Install\\dist\\src\\cli.js'");
    expect(powershellScript).toContain("hook --home 'C:\\W2''s Install'");
  });
});
