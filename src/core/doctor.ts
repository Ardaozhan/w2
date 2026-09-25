import { execFile } from "node:child_process";
import { constants } from "node:fs";
import { access, readdir, readFile, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { brainw2Writable, resolveBrainw2Vault, resolveProjectMapping } from "./brainw2.js";
import { configuredHookEvents } from "./codex-launch.js";
import { getInteractiveRuntimeRoot } from "./interactive.js";

const execFileAsync = promisify(execFile);

async function commandOutput(command: string, args: string[], timeout = 3000, env?: NodeJS.ProcessEnv): Promise<string | undefined> {
  try {
    const result = await execFileAsync(command, args, { encoding: "utf8", windowsHide: true, timeout, maxBuffer: 64 * 1024, ...(env ? { env } : {}) });
    const value = result.stdout.trim().split(/\r?\n/, 1)[0]?.trim();
    return value ? value.slice(0, 200) : undefined;
  } catch { return undefined; }
}

async function shellCommand(command: string, env?: NodeJS.ProcessEnv): Promise<string | undefined> {
  if (command === "codex" && process.platform === "win32") {
    const script = [
      "$command = Get-Command codex -ErrorAction SilentlyContinue",
      "if (-not $command) { exit 1 }",
      "if ($command.CommandType -eq 'Application' -and $command.Source) { & $command.Source --version } else { & codex --version }",
      "exit $LASTEXITCODE",
    ].join("\n");
    const encodedScript = Buffer.from(script, "utf16le").toString("base64");
    return commandOutput("powershell.exe", ["-NoLogo", "-NoProfile", "-NonInteractive", "-EncodedCommand", encodedScript], 3000, env);
  }
  if (process.platform !== "win32") return commandOutput(command, ["--version"], 3000, env);
  return commandOutput("cmd.exe", ["/d", "/s", "/c", `${command}.cmd --version`], 3000, env);
}

async function w2Version(w2Home: string): Promise<string> {
  try {
    const pkg = JSON.parse(await readFile(path.join(w2Home, "package.json"), "utf8")) as { version?: unknown };
    return typeof pkg.version === "string" ? pkg.version : "unknown";
  } catch { return "unknown"; }
}

async function gitStatus(cwd: string, env?: NodeJS.ProcessEnv): Promise<{ repository: boolean; head?: string; workingTree?: string }> {
  try {
    const top = await commandOutput("git", ["-C", cwd, "rev-parse", "--show-toplevel"], 3000, env);
    if (!top) return { repository: false };
    const head = await commandOutput("git", ["-C", cwd, "rev-parse", "HEAD"], 3000, env);
    let dirty = "";
    try {
      const result = await execFileAsync("git", ["-C", cwd, "status", "--porcelain=v1", "--untracked-files=all"], { encoding: "utf8", windowsHide: true, timeout: 3000, maxBuffer: 2 * 1024 * 1024, ...(env ? { env } : {}) });
      dirty = result.stdout.trim();
    } catch { return { repository: true, ...(head ? { head } : {}), workingTree: "unavailable" }; }
    return { repository: true, ...(head ? { head } : {}), workingTree: dirty ? `dirty (${dirty.split(/\r?\n/).length} path(s))` : "clean" };
  } catch { return { repository: false }; }
}

async function latestReceipt(w2Home: string, cwd: string): Promise<{ id: string; outcome: string } | undefined> {
  const root = getInteractiveRuntimeRoot(w2Home);
  const files: Array<{ file: string; modified: number }> = [];
  const collectReceipts = async (directory: string): Promise<void> => {
    for (const receipt of await readdir(directory, { withFileTypes: true }).catch(() => [])) {
      if (!receipt.isFile() || !receipt.name.endsWith(".json")) continue;
      const receiptPath = path.join(directory, receipt.name);
      const info = await stat(receiptPath).catch(() => undefined);
      if (info) files.push({ file: receiptPath, modified: info.mtimeMs });
    }
  };
  const walk = async (directory: string): Promise<void> => {
    let entries;
    try { entries = await readdir(directory, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "receipts") {
          await collectReceipts(file);
        } else await walk(file);
      }
    }
  };
  await walk(root);
  await collectReceipts(path.join(cwd, ".w2", "receipts"));
  const latest = files.sort((left, right) => right.modified - left.modified)[0];
  if (!latest) return undefined;
  try {
    const receipt = JSON.parse(await readFile(latest.file, "utf8")) as { run_id?: unknown; outcome?: unknown };
    if (typeof receipt.run_id === "string" && typeof receipt.outcome === "string") return { id: receipt.run_id, outcome: receipt.outcome };
  } catch { /* corrupt runtime receipts are not doctor evidence */ }
  return undefined;
}

export interface DoctorOptions {
  env?: NodeJS.ProcessEnv;
  cwd?: string;
}

export async function renderDoctor(w2HomeValue?: string, options: DoctorOptions = {}): Promise<string> {
  const sourceHome = path.dirname(fileURLToPath(import.meta.url));
  let discoveredHome = sourceHome;
  for (let depth = 0; depth < 5; depth += 1) {
    try { await access(path.join(discoveredHome, "package.json"), constants.R_OK); break; }
    catch { discoveredHome = path.dirname(discoveredHome); }
  }
  const w2Home = path.resolve(w2HomeValue ?? process.env.W2_HOME ?? discoveredHome);
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const env = options.env ?? process.env;
  const [version, nodeVersion, npmVersion, gitVersion, codexVersion, git, latest] = await Promise.all([
    w2Version(w2Home),
    Promise.resolve(process.version),
    shellCommand("npm", env),
    commandOutput("git", ["--version"], 3000, env),
    shellCommand("codex", env),
    gitStatus(cwd, env),
    latestReceipt(w2Home, cwd),
  ]);
  const buildFiles = ["dist/src/cli.js", "dist/src/core/interactive.js", "dist/src/core/brainw2.js"];
  const buildAvailable = (await Promise.all(buildFiles.map(async (file) => {
    try { await access(path.join(w2Home, file), constants.R_OK); return true; } catch { return false; }
  }))).every(Boolean);
  const vault = resolveBrainw2Vault(env, env.HOME ?? env.USERPROFILE ?? os.homedir());
  let mapping = false;
  let writable = false;
  if (vault.enabled && vault.path) {
    try { mapping = Boolean(await resolveProjectMapping(cwd, { env, home: env.HOME ?? env.USERPROFILE ?? os.homedir(), create: false })); } catch { mapping = false; }
    writable = await brainw2Writable(vault.path);
  }
  const lines = [
    `W2 version: ${version}`,
    `W2 home: ${w2Home}`,
    `Node: ${nodeVersion}`,
    `npm: ${npmVersion ?? "unavailable"}`,
    `Git: ${gitVersion ?? "unavailable"}`,
    `Codex CLI: ${codexVersion ?? "unavailable"}`,
    `Current directory: ${cwd}`,
    `Git repository: ${git.repository ? "yes" : "no"}`,
    `HEAD: ${git.head ?? "unavailable"}`,
    `Working tree: ${git.workingTree ?? "not applicable"}`,
    `W2 build: ${buildAvailable ? "available" : "unavailable"}`,
    `Interactive runtime: ${getInteractiveRuntimeRoot(w2Home)}`,
    `Latest receipt: ${latest ? `${latest.id} (${latest.outcome})` : "none"}`,
    `brainw2: ${vault.enabled ? "enabled" : "disabled"}`,
    `brainw2 vault: ${vault.path ?? "unavailable"}`,
    `brainw2 project mapping: ${vault.enabled ? mapping ? "found" : "not found" : "not applicable"}`,
    `brainw2 writable: ${vault.enabled ? writable ? "yes" : "unavailable" : "not applicable"}`,
    `Native hook events: ${configuredHookEvents.join(", ")}`,
    "TRUST STATUS: CHECK WITH /hooks",
    `Platform support: ${process.platform === "win32" ? "Windows supported; other platforms unverified" : "not independently verified"}`,
  ];
  return lines.join("\n");
}
