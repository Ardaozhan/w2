import { spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RELEASE_URL = "https://api.github.com/repos/Ardaozhan/w2/releases/latest";
const OFFICIAL_REPOSITORY_PATH = "Ardaozhan/w2";
const AUTOMATIC_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
const FAILED_CHECK_INTERVAL_MS = 60 * 60 * 1000;
const COMMAND_TIMEOUT_MS = 10 * 60 * 1000;

interface StableRelease {
  tag: string;
  version: string;
}

interface UpdateState {
  schema: 1;
  lastCheckAt: number;
  checkIntervalMs: number;
}

export function compareStableVersions(left: string, right: string): number {
  const leftParts = parseVersion(left);
  const rightParts = parseVersion(right);
  for (let index = 0; index < 3; index += 1) {
    if (leftParts[index]! !== rightParts[index]!) return leftParts[index]! > rightParts[index]! ? 1 : -1;
  }
  return 0;
}

export function isOfficialRepository(remote: string): boolean {
  const value = remote.trim();
  let repositoryPath: string;
  if (/^git@github\.com:/i.test(value)) repositoryPath = value.replace(/^git@github\.com:/i, "");
  else if (/^ssh:\/\/git@github\.com\//i.test(value)) repositoryPath = value.replace(/^ssh:\/\/git@github\.com\//i, "");
  else {
    try {
      const url = new URL(value);
      if (url.protocol !== "https:" || url.hostname.toLowerCase() !== "github.com" || url.username || url.password) return false;
      repositoryPath = url.pathname.replace(/^\//, "");
    } catch {
      return false;
    }
  }
  return repositoryPath.replace(/\.git$/i, "").replace(/\/$/, "").toLowerCase() === OFFICIAL_REPOSITORY_PATH.toLowerCase();
}

export function parseStableRelease(value: unknown): StableRelease {
  if (!value || typeof value !== "object") throw new Error("GitHub returned invalid release metadata.");
  const metadata = value as { tag_name?: unknown; draft?: unknown; prerelease?: unknown };
  if (metadata.draft === true || metadata.prerelease === true || typeof metadata.tag_name !== "string") {
    throw new Error("GitHub's latest release is not a stable W2 release.");
  }
  const match = /^v(\d+\.\d+\.\d+)$/.exec(metadata.tag_name);
  if (!match) throw new Error(`Unsupported W2 release tag: ${metadata.tag_name}`);
  return { tag: metadata.tag_name, version: match[1]! };
}

function parseVersion(version: string): [number, number, number] {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!match) throw new Error(`Expected a stable semantic version, received: ${version}`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

async function latestStableRelease(): Promise<StableRelease> {
  const response = await fetch(RELEASE_URL, {
    headers: { Accept: "application/vnd.github+json", "User-Agent": "W2-Self-Updater" },
    signal: AbortSignal.timeout(7_000),
  });
  if (!response.ok) throw new Error(`GitHub release check failed with HTTP ${response.status}.`);
  return parseStableRelease(await response.json());
}

function run(command: string, args: string[], cwd: string): string {
  const windowsNpm = process.platform === "win32" && command === "npm.cmd";
  const executable = windowsNpm ? (process.env.ComSpec || "cmd.exe") : command;
  let commandArgs = args;
  if (windowsNpm) {
    const npmCommand = args.join(" ");
    if (npmCommand !== "ci" && npmCommand !== "run build") throw new Error("The updater received an unsupported npm command.");
    commandArgs = ["/d", "/s", "/c", `npm.cmd ${npmCommand}`];
  }
  const result = spawnSync(executable, commandArgs, {
    cwd,
    encoding: "utf8",
    windowsHide: true,
    timeout: COMMAND_TIMEOUT_MS,
    maxBuffer: 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const details = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
    throw new Error(`${command} ${args.join(" ")} failed${result.status === null ? "" : ` (exit ${result.status})`}.${details ? ` ${details}` : ""}`);
  }
  return result.stdout.trim();
}

async function readPackageVersion(w2Home: string): Promise<string> {
  const manifest = JSON.parse(await readFile(path.join(w2Home, "package.json"), "utf8")) as { version?: unknown };
  if (typeof manifest.version !== "string") throw new Error("W2 package.json has no version.");
  parseVersion(manifest.version);
  return manifest.version;
}

async function writeCheckState(w2Home: string, checkedAt: number, checkIntervalMs = AUTOMATIC_CHECK_INTERVAL_MS): Promise<void> {
  const statePath = path.join(w2Home, ".w2", "update-check.json");
  await mkdir(path.dirname(statePath), { recursive: true });
  await writeFile(statePath, `${JSON.stringify({ schema: 1, lastCheckAt: checkedAt, checkIntervalMs } satisfies UpdateState)}\n`, "utf8");
}

async function automaticCheckDue(w2Home: string, now = Date.now()): Promise<boolean> {
  try {
    const state = JSON.parse(await readFile(path.join(w2Home, ".w2", "update-check.json"), "utf8")) as Partial<UpdateState>;
    const interval = typeof state.checkIntervalMs === "number" && state.checkIntervalMs > 0 ? state.checkIntervalMs : AUTOMATIC_CHECK_INTERVAL_MS;
    return state.schema !== 1 || typeof state.lastCheckAt !== "number" || now - state.lastCheckAt >= interval || state.lastCheckAt > now;
  } catch {
    return true;
  }
}

async function requireCleanOfficialInstall(w2Home: string): Promise<void> {
  const repositoryRoot = path.resolve(run("git", ["rev-parse", "--show-toplevel"], w2Home));
  if (repositoryRoot.toLowerCase() !== path.resolve(w2Home).toLowerCase()) {
    throw new Error("The W2 installation path is not the root of its Git repository.");
  }
  const remote = run("git", ["config", "--get", "remote.origin.url"], w2Home);
  if (!isOfficialRepository(remote)) throw new Error("Self-update is restricted to the official Ardaozhan/w2 GitHub repository.");
  const status = run("git", ["status", "--porcelain", "--untracked-files=normal"], w2Home);
  if (status) throw new Error("The W2 installation has local changes. Self-update stopped to preserve them; clean or back up the W2 checkout first.");
}

async function installRelease(w2Home: string, release: StableRelease): Promise<void> {
  await requireCleanOfficialInstall(w2Home);
  const oldHead = run("git", ["rev-parse", "HEAD"], w2Home);
  run("git", ["fetch", "--quiet", "origin", `refs/tags/${release.tag}`], w2Home);
  const newHead = run("git", ["rev-parse", "--verify", "FETCH_HEAD^{commit}"], w2Home);
  const packageJson = run("git", ["show", `FETCH_HEAD:package.json`], w2Home);
  const fetchedVersion = (JSON.parse(packageJson) as { version?: unknown }).version;
  if (fetchedVersion !== release.version) throw new Error(`Release tag ${release.tag} points to package version ${String(fetchedVersion)}.`);
  await requireCleanOfficialInstall(w2Home);
  if (run("git", ["rev-parse", "HEAD"], w2Home) !== oldHead) throw new Error("The W2 checkout changed during update preparation; no files were switched.");

  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  try {
    run("git", ["checkout", "--detach", newHead], w2Home);
    run(npm, ["ci"], w2Home);
    run(npm, ["run", "build"], w2Home);
    const installedVersion = await readPackageVersion(w2Home);
    if (installedVersion !== release.version) throw new Error(`Built W2 version ${installedVersion} does not match release ${release.version}.`);
  } catch (error) {
    try {
      run("git", ["checkout", "--detach", oldHead], w2Home);
      run(npm, ["ci"], w2Home);
      run(npm, ["run", "build"], w2Home);
    } catch (rollbackError) {
      throw new Error(`W2 update failed and rollback also failed. Update error: ${error instanceof Error ? error.message : String(error)} Rollback error: ${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`);
    }
    throw new Error(`W2 update failed; the previous Git revision was restored. ${error instanceof Error ? error.message : String(error)}`);
  }
}

interface Options {
  w2Home: string;
  automatic: boolean;
  checkOnly: boolean;
}

async function update(options: Options): Promise<void> {
  const currentVersion = await readPackageVersion(options.w2Home);
  if (options.automatic && !(await automaticCheckDue(options.w2Home))) return;

  let checkedAt = Date.now();
  let release: StableRelease;
  try {
    release = await latestStableRelease();
  } catch (error) {
    await writeCheckState(options.w2Home, checkedAt, FAILED_CHECK_INTERVAL_MS).catch(() => undefined);
    if (options.automatic) {
      console.warn(`W2 update check skipped: ${error instanceof Error ? error.message : String(error)}`);
      return;
    }
    throw error;
  }

  await writeCheckState(options.w2Home, checkedAt);
  if (compareStableVersions(release.version, currentVersion) <= 0) {
    if (!options.automatic) console.log(`W2 ${currentVersion} is up to date (latest stable: ${release.tag}).`);
    return;
  }
  if (options.checkOnly) {
    console.log(`W2 update available: ${currentVersion} -> ${release.version} (${release.tag}).`);
    return;
  }

  console.log(`Updating W2 ${currentVersion} -> ${release.version} from the official stable release...`);
  try {
    await installRelease(options.w2Home, release);
    checkedAt = Date.now();
    await writeCheckState(options.w2Home, checkedAt);
    console.log(`W2 updated to ${release.version}.`);
  } catch (error) {
    if (options.automatic && !/rollback also failed/i.test(error instanceof Error ? error.message : String(error))) {
      console.warn(`W2 update skipped: ${error instanceof Error ? error.message : String(error)}`);
      return;
    }
    throw error;
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const homeIndex = args.indexOf("--w2-home");
  const w2Home = homeIndex >= 0 ? args[homeIndex + 1] : undefined;
  if (!w2Home || args.filter((argument) => argument === "--w2-home").length !== 1 || (args.includes("--automatic") && args.includes("--check"))) {
    console.error("Usage: w2 updater --w2-home <installation-path> [--automatic | --check]");
    process.exitCode = 2;
    return;
  }

  try {
    await update({ w2Home: path.resolve(w2Home), automatic: args.includes("--automatic"), checkOnly: args.includes("--check") });
  } catch (error) {
    console.error(`W2 update failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = error instanceof Error && /rollback also failed/i.test(error.message) ? 2 : 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) void main();
