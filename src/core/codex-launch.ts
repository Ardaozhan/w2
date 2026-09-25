import path from "node:path";

export const configuredHookEvents = ["UserPromptSubmit", "PreToolUse", "PostToolUse", "PermissionRequest", "Stop", "Interrupt", "SessionEnd"] as const;

const hookTimeouts: ReadonlyArray<readonly [typeof configuredHookEvents[number], number]> = [
  ["UserPromptSubmit", 120],
  ["PreToolUse", 10],
  ["PostToolUse", 10],
  ["PermissionRequest", 10],
  ["Stop", 1500],
  ["Interrupt", 3],
  ["SessionEnd", 3],
];

function tomlString(value: string): string {
  return `"${[...value].map((character) => {
    switch (character) {
      case "\\": return "\\\\";
      case '"': return "\\\"";
      case "\b": return "\\b";
      case "\t": return "\\t";
      case "\n": return "\\n";
      case "\f": return "\\f";
      case "\r": return "\\r";
      default: {
        const codePoint = character.codePointAt(0)!;
        return codePoint < 0x20 || (codePoint >= 0x7f && codePoint <= 0x9f)
          ? `\\u${codePoint.toString(16).padStart(4, "0")}`
          : character;
      }
    }
  }).join("")}"`;
}

function buildHookCommand(w2Home: string): string {
  const absoluteHome = path.resolve(w2Home);
  const cliPath = path.join(absoluteHome, "dist", "src", "cli.js");
  return `node "${cliPath}" hook --home "${absoluteHome}"`;
}

function powershellLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function buildWindowsHookCommand(w2Home: string): string {
  const absoluteHome = path.resolve(w2Home);
  const cliPath = path.join(absoluteHome, "dist", "src", "cli.js");
  const script = `& ${powershellLiteral(process.execPath)} ${powershellLiteral(cliPath)} hook --home ${powershellLiteral(absoluteHome)}\nexit $LASTEXITCODE`;
  const encodedScript = Buffer.from(script, "utf16le").toString("base64");
  return `powershell.exe -NoLogo -NoProfile -NonInteractive -EncodedCommand ${encodedScript}`;
}

export interface CodexLaunchPlan {
  executable: string;
  args: string[];
}

export function buildCodexLaunchPlan(w2Home: string, executable: string, forwardedArgs: string[] = []): CodexLaunchPlan {
  const command = tomlString(buildHookCommand(w2Home));
  const commandWindows = tomlString(buildWindowsHookCommand(w2Home));
  const hookArguments = hookTimeouts.flatMap(([event, timeout]) => [
    "--config",
    `hooks.${event}=[{ hooks = [{ type = "command", command = ${command}, command_windows = ${commandWindows}, timeout = ${timeout}${event === "UserPromptSubmit" ? ", additionalContextLimit = 12000" : ""} }] }]`,
  ]);
  return { executable, args: [...hookArguments, ...forwardedArgs] };
}
