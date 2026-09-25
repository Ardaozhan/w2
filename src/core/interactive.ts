import { createHash, randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { appendFile, lstat, mkdir, mkdtemp, open, readFile, readlink, readdir, rename, rm, rmdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { appendBrainw2DevLog, loadBrainw2ReferenceContext, resolveProjectMapping, type Brainw2ProjectMapping, type Brainw2ReferenceMetadata } from "./brainw2.js";
import type { AgentAdapter, AgentStartInput } from "./agent.js";
import { runTaskAndPersistReceipt } from "./cli-run.js";
import { recordSessionReceipt } from "./session.js";
import type { AgentOutput, AgentRunResult, RunReceipt, TaskDefinition, ToolCallRecord, VerificationCommand } from "./types.js";

const execFileAsync = promisify(execFile);
const SNAPSHOT_VERSION = 1;
const TASK_TIMEOUT_MS = 5 * 60 * 1000;
const verificationCategories = [
  { script: "test", id: "V-PROJECT-TEST", name: "Project tests", category: "test" as const },
  { script: "typecheck", id: "V-PROJECT-TYPECHECK", name: "Project typecheck", category: "typecheck" as const },
  { script: "lint", id: "V-PROJECT-LINT", name: "Project lint", category: "lint" as const },
  { script: "build", id: "V-PROJECT-BUILD", name: "Project build", category: "build" as const },
];
const browserCommandPattern = /\b(?:playwright|cypress|puppeteer|selenium|webdriver|browser|e2e|ui-smoke|screenshot|visual-regression|storybook)\b/i;

export interface ProjectSnapshotEntry {
  path: string;
  status: string;
  fingerprint: string;
}

export interface ProjectSnapshot {
  version: typeof SNAPSHOT_VERSION;
  workspace: string;
  captured_at: string;
  entries: ProjectSnapshotEntry[];
}

interface GitTurnSnapshot {
  head: string | null;
  index_tree: string;
  working_tree: string;
}

interface InteractiveTurnState {
  version: typeof SNAPSHOT_VERSION;
  session_id: string;
  turn_id: string;
  workspace: string;
  submitted_at: string;
  prompt: string;
  model?: string;
  before_snapshot: ProjectSnapshot | null;
  git_baseline?: GitTurnSnapshot;
  snapshot_error?: string;
  changed_paths?: string[];
  last_assistant_message?: string | null;
  tool_calls?: ToolCallRecord[];
  brainw2_reference?: Brainw2ReferenceMetadata;
}

export interface CodexHookEvent {
  hook_event_name?: string;
  session_id?: string;
  turn_id?: string;
  cwd?: string;
  transcript_path?: string | null;
  prompt?: string;
  tool_name?: string;
  tool_use_id?: string;
  tool_input?: unknown;
  tool_response?: unknown;
  model?: string;
  permission_mode?: "default" | "acceptEdits" | "plan" | "dontAsk" | "bypassPermissions";
  stop_hook_active?: boolean;
  last_assistant_message?: string | null;
  reason?: string;
}

export interface InteractiveHookResult {
  systemMessage?: string;
  additionalContext?: string;
}

export interface InteractiveHookOptions {
  adapterFactory?: (event: CodexHookEvent, toolCalls?: ToolCallRecord[]) => AgentAdapter;
  onRun?: (receipt: RunReceipt) => void;
  brainw2Env?: NodeJS.ProcessEnv;
  brainw2Home?: string;
}

export class InteractiveHookAdapter implements AgentAdapter {
  readonly provider = "codex" as const;
  readonly executionMode = "CODEX_TUI_HOOK" as const;

  constructor(private readonly event: CodexHookEvent, private readonly toolCalls: ToolCallRecord[] = []) {}

  sendTask(task: TaskDefinition): string {
    return task.goal;
  }

  receiveAction(): undefined {
    return undefined;
  }

  receiveOutput(raw: unknown): AgentOutput {
    const text = typeof (raw as { last_assistant_message?: unknown } | null)?.last_assistant_message === "string"
      ? (raw as { last_assistant_message: string }).last_assistant_message
      : undefined;
    return { kind: "codex_tui_stop_hook", ...(text ? { text } : {}), raw };
  }

  cancel(): void {}

  async startRun(_input: AgentStartInput): Promise<AgentRunResult> {
    const raw = {
      hook_event: "Stop",
      session_id: this.event.session_id,
      turn_id: this.event.turn_id,
      last_assistant_message: this.event.last_assistant_message ?? null,
      note: "The final message is recorded for context only; it is not verification evidence.",
    };
    return {
      exit_code: 0,
      outputs: [this.receiveOutput(raw)],
      tool_calls: this.toolCalls,
    };
  }
}

export function isMeaningfulEngineeringPrompt(prompt: string, env: NodeJS.ProcessEnv = process.env): boolean {
  const normalized = prompt.trim().replace(/\s+/g, " ");
  if (!normalized || normalized.startsWith("/")) return false;
  const override = env.W2_CAPTURE?.trim().toLocaleLowerCase("en-US");
  if (override === "off") return false;
  if (override === "always") return true;
  if (override && override !== "auto") return false;

  if (/^(?:(?:please|kindly)\s+)?(?:(?:create|write|build|make|draft)\s+)?(?:an?\s+)?(?:implementation plan|plan|approach|proposal|strategy|roadmap|summary|overview|explanation)\b|^(?:plan|planning|brainstorm|discuss|outline|summari[sz]e|explain|describe|review)\b/i.test(normalized)) return false;
  const turkishCodeNouns = /\b(?:test(?:ler(?:i)?)?|kod(?:u)?|fonksiyon(?:u)?|s\u0131n\u0131f(?:\u0131)?|mod\u00fcl(?:\u00fc)?|betik(?:i)?|script(?:i)?|readme)\b/i;
  if (/\bwrite\b/i.test(normalized) && !/\bwrite\s+(?:(?:a|the)\s+)?(?:(?:unit|integration|regression|node:test)\s+)?(?:tests?|test cases?|code|source code|function|class|module|script|config(?:uration)? file|documentation|docs|readme)\b/i.test(normalized)) return false;
  if (/\byaz(?:ar|abilir)?\b/i.test(normalized) && !turkishCodeNouns.test(normalized)) return false;

  const englishVerb = "implement|fix|refactor|add|create|update|change|modify|remove|delete|migrate|build|write|optimi[sz]e|improve|replace|integrate|introduce|generate|convert|port|upgrade|secure|validate|apply";
  const direct = new RegExp(`^(?:(?:please|kindly)\\s+)?(?:${englishVerb})\\b`, "i");
  const polite = new RegExp(`^(?:(?:please|kindly)\\s+)?(?:can|could|would|will)\\s+you\\s+(?:(?:please)\\s+)?(?:${englishVerb})\\b`, "i");
  const personal = new RegExp(`^(?:(?:please|kindly)\\s+)?(?:i need you to|i want you to|help me to|help me|please)\\s+(?:${englishVerb})\\b`, "i");
  const collaborative = new RegExp(`^(?:let us|let's)\\s+(?:${englishVerb})\\b`, "i");
  if (direct.test(normalized) || polite.test(normalized) || personal.test(normalized) || collaborative.test(normalized)) return true;

  if (/^(?:security fix|security vulnerability fix|fix the security issue|fix the vulnerability)\b/i.test(normalized)) return true;
  if (/^(?:how|what|why|explain|describe|summari[sz]e|review|discuss|plan|brainstorm|nasıl|neden|ne|nedir|açıkla|anlat|özetle|incele|tartış|planla)\b/i.test(normalized)) return false;
  if (/\b(?:how|what|why|nasıl|neden|ne)\b[^.!;]*\?\s*$/i.test(normalized)) return false;

  // Turkish direct imperatives are deliberately enumerated to avoid treating explanatory questions as work.
  const turkishImperative = /^(?:(?:lütfen|rica etsem)\s+)?(?:(?:şu|bu|bunu|şunu|buradaki|ilgili)\s+)*(?:düzelt|uygula|ekle|oluştur|değiştir|güncelle|kaldır|taşı|yeniden yaz|entegre et|geliştir|iyileştir|kur|sil|yaz|test ekle|test yaz)(?:\b|\s)/i;
  const turkishPolite = /^(?:(?:şu|bu|bunu|şunu|buradaki|ilgili)\s+)*(?:.+\s)?(?:düzelt|uygula|ekle|oluştur|değiştir|güncelle|kaldır|taşı|yeniden yaz|entegre et|geliştir|iyileştir|kur|sil|yaz)(?:ir misin|ebilir misin|er misin|ar mısın)\s*\??$/i;
  const turkishObjectImperative = /^(?!.*\b(?:nasıl|neden|ne|nedir|açıkla|anlat|özetle|incele|tartış|planla)\b)[^?]*\b(?:düzelt|uygula|ekle|oluştur|değiştir|güncelle|kaldır|taşı|yeniden yaz|entegre et|geliştir|iyileştir|kur|sil|yaz)\b[.!]?$/i;
  if (turkishImperative.test(normalized) || turkishPolite.test(normalized) || turkishObjectImperative.test(normalized)) return true;

  return false;
}

export async function captureProjectSnapshot(workspace: string): Promise<ProjectSnapshot> {
  const absoluteWorkspace = path.resolve(workspace);
  const result = await execFileAsync("git", ["status", "--porcelain=v1", "--untracked-files=all", "-z"], {
    cwd: absoluteWorkspace,
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 32 * 1024 * 1024,
    timeout: 30_000,
  });
  const tokens = result.stdout.split("\0").filter(Boolean);
  const entries: ProjectSnapshotEntry[] = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const record = tokens[index]!;
    if (record.length < 4) continue;
    const status = record.slice(0, 2);
    const relativePath = record.slice(3);
    const absolutePath = path.resolve(absoluteWorkspace, relativePath);
    const relativeCheck = path.relative(absoluteWorkspace, absolutePath);
    if (relativeCheck === ".." || relativeCheck.startsWith(`..${path.sep}`) || path.isAbsolute(relativeCheck)) {
      throw new Error(`Git returned a path outside the project workspace: ${relativePath}`);
    }
    const contentFingerprint = await fingerprintWorkingPath(absolutePath);
    const fingerprint = createHash("sha256").update(`${status}\0${contentFingerprint}`).digest("hex");
    entries.push({ path: relativePath, status, fingerprint });

    // Porcelain v1 -z stores the old name as a separate token for rename/copy records.
    if ((status.includes("R") || status.includes("C")) && index + 1 < tokens.length) index += 1;
  }
  entries.sort((left, right) => left.path.localeCompare(right.path));
  return { version: SNAPSHOT_VERSION, workspace: absoluteWorkspace, captured_at: new Date().toISOString(), entries };
}

interface GitCommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

async function runGit(workspace: string, args: string[], env: NodeJS.ProcessEnv = process.env): Promise<GitCommandResult> {
  try {
    const result = await execFileAsync("git", args, {
      cwd: workspace,
      env,
      encoding: "utf8",
      windowsHide: true,
      maxBuffer: 64 * 1024 * 1024,
      timeout: 30_000,
    });
    return { exitCode: 0, stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    const failure = error as { code?: number | string; stdout?: string; stderr?: string; message?: string };
    return {
      exitCode: typeof failure.code === "number" ? failure.code : -1,
      stdout: failure.stdout ?? "",
      stderr: failure.stderr ?? failure.message ?? String(error),
    };
  }
}

async function requireGit(workspace: string, args: string[], description: string, env?: NodeJS.ProcessEnv): Promise<string> {
  const result = await runGit(workspace, args, env);
  if (result.exitCode !== 0) throw new Error(`${description}: ${result.stderr.trim() || `git exited ${result.exitCode}`}`);
  return result.stdout;
}

async function captureGitHead(workspace: string): Promise<string | null> {
  const result = await runGit(workspace, ["rev-parse", "--verify", "--quiet", "HEAD"]);
  if (result.exitCode === 0) return result.stdout.trim();
  if (result.exitCode === 1) return null;
  throw new Error(`Git HEAD capture failed: ${result.stderr.trim() || `git exited ${result.exitCode}`}`);
}

async function captureWorkingTreeTree(workspace: string, indexTree: string): Promise<string> {
  const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "w2-git-snapshot-"));
  const temporaryIndex = path.join(temporaryDirectory, "index");
  const env = { ...process.env, GIT_INDEX_FILE: temporaryIndex };
  try {
    await requireGit(workspace, ["read-tree", indexTree], "Git temporary index initialization failed", env);
    await requireGit(workspace, ["add", "--all", "--", "."], "Git working-tree snapshot failed", env);
    return (await requireGit(workspace, ["write-tree"], "Git working-tree tree capture failed", env)).trim();
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}

async function captureGitTurnSnapshot(workspace: string): Promise<GitTurnSnapshot> {
  const [head, indexTreeOutput] = await Promise.all([
    captureGitHead(workspace),
    requireGit(workspace, ["write-tree"], "Git index tree capture failed"),
  ]);
  const indexTree = indexTreeOutput.trim();
  const workingTree = await captureWorkingTreeTree(workspace, indexTree);
  return { head, index_tree: indexTree, working_tree: workingTree };
}

async function gitTreeChangedPaths(workspace: string, fromTree: string, toTree: string): Promise<string[]> {
  const output = await requireGit(workspace, [
    "--literal-pathspecs", "diff", "--no-ext-diff", "--no-renames", "--name-only", "-z", "--relative", fromTree, toTree, "--",
  ], "Git tree comparison failed");
  return [...new Set(output.split("\0").filter(Boolean))].sort();
}

async function gitTreeDiff(workspace: string, fromTree: string, toTree: string, paths?: string[]): Promise<{ diff: string; numstat: string }> {
  if (paths && paths.length === 0) return { diff: "", numstat: "" };
  const scope = paths ? ["--", ...paths] : ["--"];
  const [diff, numstat] = await Promise.all([
    requireGit(workspace, ["--literal-pathspecs", "diff", "--no-ext-diff", "--no-renames", "--binary", "--relative", fromTree, toTree, ...scope], "Git diff capture failed"),
    requireGit(workspace, ["--literal-pathspecs", "diff", "--no-ext-diff", "--no-renames", "--numstat", "--relative", fromTree, toTree, ...scope], "Git diff statistics capture failed"),
  ]);
  return { diff, numstat };
}

interface InteractiveGitDelta {
  changedPaths: string[];
  statusBefore: string;
  statusAfter: string;
  diff: string;
  numstat: string;
}

async function captureInteractiveGitDelta(
  workspace: string,
  beforeSnapshot: ProjectSnapshot,
  beforeGit: GitTurnSnapshot,
  afterSnapshot: ProjectSnapshot,
  afterGit: GitTurnSnapshot,
): Promise<InteractiveGitDelta> {
  const emptyTree = beforeGit.head ?? beforeGit.working_tree;
  const stopCommit = afterGit.head ?? afterGit.index_tree;
  const [commitRangePaths, indexDeltaPaths, worktreeDeltaPaths, indexFromWorkingTreePaths, headFromIndexPaths, headFromWorkingTreePaths] = await Promise.all([
    gitTreeChangedPaths(workspace, emptyTree, stopCommit),
    gitTreeChangedPaths(workspace, beforeGit.index_tree, afterGit.index_tree),
    gitTreeChangedPaths(workspace, beforeGit.working_tree, afterGit.working_tree),
    gitTreeChangedPaths(workspace, beforeGit.working_tree, afterGit.index_tree),
    gitTreeChangedPaths(workspace, beforeGit.index_tree, stopCommit),
    gitTreeChangedPaths(workspace, beforeGit.working_tree, stopCommit),
  ]);
  const preExistingDirty = new Set(beforeSnapshot.entries.map((entry) => entry.path));
  const indexDelta = new Set(indexDeltaPaths);
  const workingTreeDelta = new Set(worktreeDeltaPaths);
  const indexFromWorkingTree = new Set(indexFromWorkingTreePaths);
  const headFromIndex = new Set(headFromIndexPaths);
  const headFromWorkingTree = new Set(headFromWorkingTreePaths);
  const candidates = new Set([
    ...commitRangePaths,
    ...afterSnapshot.entries.map((entry) => entry.path),
    ...indexDeltaPaths,
    ...worktreeDeltaPaths,
  ]);
  const changedPaths = [...candidates].filter((file) => {
    if (!preExistingDirty.has(file)) return true;
    if (workingTreeDelta.has(file)) return true;
    const newIndexContent = indexDelta.has(file) && indexFromWorkingTree.has(file);
    const newCommittedContent = commitRangePaths.includes(file) && headFromIndex.has(file) && headFromWorkingTree.has(file);
    return newIndexContent || newCommittedContent;
  }).sort();

  const fullWorkingTreeDiff = await gitTreeDiff(workspace, beforeGit.working_tree, afterGit.working_tree);
  const workingTreePaths = new Set(worktreeDeltaPaths);
  const indexOnlyPaths = changedPaths.filter((file) => !workingTreePaths.has(file) && (indexDelta.has(file) || commitRangePaths.includes(file)));
  const indexOnlyDiff = await gitTreeDiff(workspace, beforeGit.index_tree, afterGit.index_tree, indexOnlyPaths);
  return {
    changedPaths,
    statusBefore: statusForPaths(beforeSnapshot, changedPaths),
    statusAfter: statusForPaths(afterSnapshot, changedPaths),
    diff: [fullWorkingTreeDiff.diff, indexOnlyDiff.diff].filter(Boolean).join("\n"),
    numstat: [fullWorkingTreeDiff.numstat, indexOnlyDiff.numstat].filter(Boolean).join("\n"),
  };
}

async function fingerprintWorkingPath(absolutePath: string): Promise<string> {
  try {
    const info = await lstat(absolutePath);
    if (info.isSymbolicLink()) return `symlink:${await readlink(absolutePath)}`;
    if (!info.isFile()) return `non-file:${info.mode}:${info.size}`;
    const contents = await readFile(absolutePath);
    return createHash("sha256").update(contents).digest("hex");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return "missing";
    throw error;
  }
}

export function getChangedPaths(before: ProjectSnapshot, after: ProjectSnapshot): string[] {
  if (path.resolve(before.workspace) !== path.resolve(after.workspace)) throw new Error("Interactive turn snapshots target different workspaces");
  const beforeEntries = new Map(before.entries.map((entry) => [entry.path, entry.fingerprint]));
  const afterEntries = new Map(after.entries.map((entry) => [entry.path, entry.fingerprint]));
  const allPaths = new Set([...beforeEntries.keys(), ...afterEntries.keys()]);
  return [...allPaths].filter((file) => beforeEntries.get(file) !== afterEntries.get(file)).sort();
}

function statusForPaths(snapshot: ProjectSnapshot | null, paths: string[]): string {
  if (!snapshot) return "";
  const selected = new Set(paths);
  return snapshot.entries
    .filter((entry) => selected.has(entry.path))
    .map((entry) => `${entry.status} ${entry.path}`)
    .join("\n");
}

function pathHash(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 32);
}

function projectRuntimeDirectory(w2Home: string, workspace: string): string {
  const absoluteWorkspace = path.resolve(workspace);
  const normalizedWorkspace = process.platform === "win32" ? absoluteWorkspace.toLocaleLowerCase("en-US") : absoluteWorkspace;
  return path.join(getInteractiveRuntimeRoot(w2Home), pathHash(normalizedWorkspace));
}

export function getInteractiveRuntimeRoot(w2Home: string): string {
  return path.join(path.resolve(w2Home), ".w2", "interactive");
}

function turnStatePath(w2Home: string, workspace: string, sessionId: string, turnId: string): string {
  return path.join(projectRuntimeDirectory(w2Home, workspace), "pending", pathHash(sessionId), `${pathHash(turnId)}.json`);
}

export function getInteractiveRunStorage(w2Home: string, workspace: string): { databasePath: string; receiptDirectory: string; runtimeDirectory: string } {
  const runtimeDirectory = projectRuntimeDirectory(w2Home, workspace);
  return {
    runtimeDirectory,
    databasePath: path.join(runtimeDirectory, "runs.sqlite"),
    receiptDirectory: path.join(runtimeDirectory, "receipts"),
  };
}

type HookOutcomeClass = RunReceipt["outcome"] | "PENDING" | "ABORTED" | "CLEANED" | "IGNORED" | "NO_PENDING";

async function writeHookDiagnostic(input: {
  w2Home: string;
  event: CodexHookEvent;
  handler: "started" | "completed";
  outcome?: HookOutcomeClass;
  errorClass?: string;
  receiptId?: string;
}): Promise<void> {
  const filePath = path.join(getInteractiveRuntimeRoot(input.w2Home), "hook-diagnostics.jsonl");
  const errorClass = ["SyntaxError", "TypeError", "RangeError", "Error"].includes(input.errorClass ?? "") ? input.errorClass : undefined;
  const record = {
    timestamp: new Date().toISOString(),
    event: typeof input.event.hook_event_name === "string" ? input.event.hook_event_name : "Unknown",
    session_id: typeof input.event.session_id === "string" ? input.event.session_id.slice(0, 256) : null,
    turn_id: typeof input.event.turn_id === "string" ? input.event.turn_id.slice(0, 256) : null,
    project_cwd: typeof input.event.cwd === "string" ? path.resolve(input.event.cwd) : null,
    ...(input.event.hook_event_name === "PreToolUse" || input.event.hook_event_name === "PostToolUse" || input.event.hook_event_name === "PermissionRequest"
      ? { tool_name: safeToolName(input.event.tool_name), ...(safeToolUseId(input.event.tool_use_id) ? { tool_use_id: safeToolUseId(input.event.tool_use_id) } : {}) }
      : {}),
    handler: input.handler,
    ...(input.outcome ? { outcome: input.outcome } : {}),
    ...(errorClass ? { error_class: errorClass } : {}),
    ...(input.receiptId ? { receipt_id: input.receiptId } : {}),
  };
  try {
    await mkdir(path.dirname(filePath), { recursive: true });
    await appendFile(filePath, `${JSON.stringify(record)}\n`, "utf8");
  } catch {
    process.stderr.write("W2 interactive hook diagnostic could not be written.\n");
  }
}

function discoverPackageManager(packageJson: Record<string, unknown>, workspace: string): string {
  const declared = typeof packageJson.packageManager === "string" ? packageJson.packageManager.split("@")[0] : undefined;
  if (declared && ["npm", "pnpm", "yarn", "bun"].includes(declared)) return declared;
  if (existsSync(path.join(workspace, "pnpm-lock.yaml"))) return "pnpm";
  if (existsSync(path.join(workspace, "yarn.lock"))) return "yarn";
  if (existsSync(path.join(workspace, "bun.lock")) || existsSync(path.join(workspace, "bun.lockb"))) return "bun";
  return "npm";
}

function referencesBrowserAutomation(scriptName: string, scripts: Record<string, string>, active = new Set<string>()): boolean {
  if (active.has(scriptName)) return false;
  active.add(scriptName);
  const content = [scripts[`pre${scriptName}`], scripts[scriptName], scripts[`post${scriptName}`]].filter(Boolean).join("\n");
  if (browserCommandPattern.test(`${scriptName}\n${content}`)) return true;
  const references = content.matchAll(/\b(?:npm(?:\.cmd)?|pnpm|yarn|bun)\s+(?:run\s+)?([A-Za-z0-9][A-Za-z0-9:._-]*)/gi);
  for (const reference of references) {
    const nested = reference[1];
    if (nested && scripts[nested] && referencesBrowserAutomation(nested, scripts, active)) return true;
  }
  return false;
}

function parseExplicitAcceptanceCriteria(prompt: string): string[] {
  const criteria: string[] = [];
  let inAcceptanceSection = false;
  const add = (value: string) => {
    const statement = value.trim().replace(/^(?:AC|ACCEPTANCE)-\d+\s*[:.)-]\s*/i, "");
    if (statement && criteria.length < 50) criteria.push(statement);
    else if (statement && criteria.length === 50) criteria.push("Additional acceptance criteria were not individually parsed because the 50-criterion limit was reached.");
  };

  for (const line of prompt.replace(/\r\n?/g, "\n").split("\n")) {
    const heading = line.match(/^\s*(?:#{1,6}\s*)?(?:acceptance criteria|acceptance requirements|definition of done|kabul kriterleri|kabul ko[sş]ulları)\s*:?[ \t]*(.*)$/i);
    if (heading) {
      inAcceptanceSection = true;
      const inline = heading[1]?.trim();
      if (inline && !/^(?:are|are as follows|include)\s*:?$/i.test(inline)) {
        const inlineBullet = inline.match(/^(?:[-*+]|\d+[.)])\s+(.+)$/);
        add(inlineBullet?.[1] ?? inline);
      }
      continue;
    }
    if (!inAcceptanceSection) continue;

    const bullet = line.match(/^\s*(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s*)?(.+?)\s*$/);
    if (bullet?.[1]) {
      add(bullet[1]);
      continue;
    }
    if (!line.trim()) continue;
    if (/^\s*#{1,6}\s/.test(line)) {
      inAcceptanceSection = false;
      continue;
    }
    inAcceptanceSection = false;
  }

  return criteria;
}

function directlyNamesPassingVerifier(statement: string, verifier: VerificationCommand): boolean {
  // Only an assertion about the named check itself can use its result; a green generic suite is not semantic evidence.
  const command = verifier.command.match(/^(npm|pnpm|yarn|bun)\s+run\s+([A-Za-z0-9][A-Za-z0-9:._-]*)$/i);
  if (!command) return false;
  const manager = command[1]!;
  const script = command[2]!;
  const commandNames = [verifier.command];
  if (script === "test") commandNames.push(`${manager} test`);
  const normalized = statement.replace(/[\u0060"“”]/g, "").replace(/[.!?]+$/, "").replace(/\s+/g, " ").trim();

  return commandNames.some((commandName) => {
    const escaped = commandName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const success = new RegExp(`^(?:the )?${escaped}(?: (?:must|should|needs to|has to))? (?:pass(?:es)?|succeed(?:s)?|be (?:green|successful))$`, "i");
    const explicitRun = new RegExp(`^run ${escaped} and (?:ensure|verify) it (?:passes|succeeds)$`, "i");
    return success.test(normalized) || explicitRun.test(normalized);
  });
}

async function discoverProjectVerifiers(workspace: string): Promise<VerificationCommand[]> {
  let packageJson: Record<string, unknown>;
  try {
    const packageContents = await readFile(path.join(workspace, "package.json"), "utf8");
    const parsed: unknown = JSON.parse(packageContents.charCodeAt(0) === 0xfeff ? packageContents.slice(1) : packageContents);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return [];
    packageJson = parsed as Record<string, unknown>;
  } catch {
    return [];
  }
  const scripts = packageJson.scripts && typeof packageJson.scripts === "object" && !Array.isArray(packageJson.scripts)
    ? Object.fromEntries(Object.entries(packageJson.scripts).filter((entry): entry is [string, string] => typeof entry[1] === "string"))
    : {};
  const manager = discoverPackageManager(packageJson, workspace);
  return verificationCategories.flatMap((verification) => {
    if (!scripts[verification.script] || referencesBrowserAutomation(verification.script, scripts)) return [];
    const command = manager === "npm" ? `npm run ${verification.script}` : `${manager} run ${verification.script}`;
    return [{ id: verification.id, name: verification.name, command, category: verification.category }];
  });
}

function buildInteractiveTask(state: InteractiveTurnState, changedPaths: string[], projectVerifiers: VerificationCommand[]): TaskDefinition {
  const diffVerifier: VerificationCommand = {
    id: "V-W2-TURN-DIFF",
    name: "W2 turn diff",
    command: "w2:turn-diff",
    category: "custom",
  };
  const checkRefs = projectVerifiers.map((command) => command.id);
  const discoveredNames = verificationCategories.filter((candidate) => checkRefs.includes(candidate.id)).map((candidate) => candidate.script);
  const checkStatement = discoveredNames.length
    ? `All discovered project checks pass: ${discoveredNames.join(", ")}.`
    : "Task-specific behavior has a detectable project verifier.";
  const explicitCriteria = parseExplicitAcceptanceCriteria(state.prompt);
  const acceptanceCriteria = [
    { id: "AC-01", statement: "At least one project file changed during this Codex turn.", required: true, verification_refs: [diffVerifier.id] },
    { id: "AC-02", statement: checkStatement, required: true, verification_refs: checkRefs },
    ...(explicitCriteria.length
      ? explicitCriteria.map((statement, index) => ({
          id: `AC-${String(index + 3).padStart(2, "0")}`,
          statement,
          required: true,
          verification_refs: projectVerifiers.filter((verifier) => directlyNamesPassingVerifier(statement, verifier)).map((verifier) => verifier.id),
        }))
      : [{ id: "AC-03", statement: "The prompt's task-specific semantic requirements have direct deterministic verifier evidence.", required: true, verification_refs: [] }]),
  ];
  return {
    task_id: `interactive-${randomUUID()}`,
    title: `Codex: ${state.prompt.trim().replace(/\s+/g, " ").slice(0, 112)}`,
    goal: state.prompt,
    constraints: [
      "This task was captured from a trusted Codex Stop hook after a meaningful engineering prompt.",
      "W2 records only project paths whose Git state changed between this prompt and its Stop event.",
      "Passing declared project checks proves only those commands passed; it is not a general correctness guarantee.",
    ],
    allowed_paths: changedPaths.length ? changedPaths : ["."],
    acceptance_criteria: acceptanceCriteria,
    verification_commands: [diffVerifier, ...projectVerifiers],
    workspace: state.workspace,
    ...(state.model ? { model: state.model } : {}),
    timeout_ms: TASK_TIMEOUT_MS,
  };
}

function safeToolCall(value: unknown, workspace: string): ToolCallRecord | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const candidate = value as Partial<ToolCallRecord>;
  const statuses = ["RETURNED", "FAILED", "INCOMPLETE", "INTERRUPTED"] as const;
  if (typeof candidate.started_at !== "string" || typeof candidate.finished_at !== "string"
    || !statuses.includes(candidate.status as typeof statuses[number])) return undefined;
  const inputCandidate = candidate.input && typeof candidate.input === "object" && !Array.isArray(candidate.input)
    ? candidate.input as Record<string, unknown> : undefined;
  if (!inputCandidate || !Array.isArray(inputCandidate.field_names) || !Array.isArray(inputCandidate.relative_paths)
    || !Number.isSafeInteger(inputCandidate.input_bytes) || typeof inputCandidate.input_sha256 !== "string"
    || !/^[a-f0-9]{64}$/i.test(inputCandidate.input_sha256)) return undefined;
  const fieldNames = inputCandidate.field_names.filter((item): item is string => typeof item === "string" && /^[A-Za-z0-9_.-]{1,64}$/.test(item)).slice(0, 40);
  const relativePaths = [...new Set(inputCandidate.relative_paths.filter((item): item is string => typeof item === "string")
    .map((item) => safeRelativeToolPath(item, workspace)).filter((item): item is string => Boolean(item)))].slice(0, 50);
  const categories = new Set(["npm test", "npm typecheck", "npm lint", "npm build", "pnpm test", "pnpm typecheck", "pnpm lint", "pnpm build", "yarn test", "yarn typecheck", "yarn lint", "yarn build", "bun test", "bun typecheck", "bun lint", "bun build", "git status", "git diff", "git add", "git commit", "git log", "git show", "powershell", "node", "python", "other-command"]);
  const input: Record<string, unknown> = {
    field_names: fieldNames,
    relative_paths: relativePaths,
    input_bytes: Math.max(0, Math.min(Number(inputCandidate.input_bytes), 64 * 1024 * 1024)),
    input_sha256: inputCandidate.input_sha256.toLocaleLowerCase("en-US"),
    ...(typeof inputCandidate.command_category === "string" && categories.has(inputCandidate.command_category) ? { command_category: inputCandidate.command_category } : {}),
  };
  const resultCandidate = candidate.result && typeof candidate.result === "object" && !Array.isArray(candidate.result)
    ? candidate.result as Record<string, unknown> : undefined;
  let result: ToolCallRecord["result"];
  if (resultCandidate) {
    const phase = resultCandidate.phase;
    const status = resultCandidate.status;
    if (!(phase === "pre" || phase === "post" || phase === "incomplete") || !statuses.includes(status as typeof statuses[number])) return undefined;
    result = {
      phase,
      status,
      ...(Number.isSafeInteger(resultCandidate.response_bytes) && Number(resultCandidate.response_bytes) >= 0 ? { response_bytes: Math.min(Number(resultCandidate.response_bytes), 64 * 1024 * 1024) } : {}),
      ...(typeof resultCandidate.response_sha256 === "string" && /^[a-f0-9]{64}$/i.test(resultCandidate.response_sha256) ? { response_sha256: resultCandidate.response_sha256.toLocaleLowerCase("en-US") } : {}),
      ...(Number.isSafeInteger(resultCandidate.exit_code) ? { exit_code: Number(resultCandidate.exit_code) } : {}),
    };
  }
  const error = candidate.status === "FAILED" ? "Structured tool response reported failure."
    : candidate.status === "INCOMPLETE" ? "No matching PostToolUse event was observed."
      : candidate.status === "INTERRUPTED" ? "Turn ended before PostToolUse was observed." : undefined;
  return {
    tool_name: safeToolName(candidate.tool_name),
    ...(safeToolUseId(candidate.tool_use_id) ? { tool_use_id: safeToolUseId(candidate.tool_use_id) } : {}),
    status: candidate.status,
    input,
    started_at: candidate.started_at,
    finished_at: candidate.finished_at,
    ...(result ? { result } : {}),
    ...(error ? { error } : {}),
  };
}

function safeParseState(value: unknown): InteractiveTurnState | undefined {
  if (!value || typeof value !== "object") return undefined;
  const state = value as Partial<InteractiveTurnState>;
  if (state.version !== SNAPSHOT_VERSION || typeof state.session_id !== "string" || typeof state.turn_id !== "string"
    || typeof state.workspace !== "string" || typeof state.prompt !== "string" || !state.prompt.trim()) return undefined;
  if (state.git_baseline !== undefined) {
    const baseline = state.git_baseline as Partial<GitTurnSnapshot> | null;
    const validObjectId = (candidate: unknown) => typeof candidate === "string" && /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i.test(candidate);
    if (!baseline || (baseline.head !== null && !validObjectId(baseline.head))
      || !validObjectId(baseline.index_tree) || !validObjectId(baseline.working_tree)) return undefined;
  }
  const toolCalls = Array.isArray(state.tool_calls)
    ? state.tool_calls.map((call) => safeToolCall(call, state.workspace!)).filter((call): call is ToolCallRecord => Boolean(call))
    : [];
  const reference = state.brainw2_reference;
  const safeReference = reference && typeof reference.logical_source === "string" && reference.logical_source.length <= 512
    && typeof reference.content_sha256 === "string" && /^[a-f0-9]{64}$/i.test(reference.content_sha256)
    && Number.isSafeInteger(reference.byte_count) && reference.byte_count >= 0 && reference.byte_count <= 10 * 1024
    && typeof reference.mapping_id === "string" && /^[a-f0-9]{20}$/i.test(reference.mapping_id)
    ? reference : undefined;
  return { ...(state as InteractiveTurnState), tool_calls: toolCalls, ...(safeReference ? { brainw2_reference: safeReference } : { brainw2_reference: undefined }) };
}

async function writeState(statePath: string, state: InteractiveTurnState): Promise<void> {
  await mkdir(path.dirname(statePath), { recursive: true });
  const temporaryPath = `${statePath}.${randomUUID()}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  await rename(temporaryPath, statePath);
}

function serialized(value: unknown): string {
  try { return JSON.stringify(value) ?? "null"; } catch { return "[unserializable]"; }
}

function safeRelativeToolPath(value: string, workspace: string): string | undefined {
  if (value.includes("\0")) return undefined;
  const absolute = path.isAbsolute(value) ? path.resolve(value) : path.resolve(workspace, value);
  const relative = path.relative(path.resolve(workspace), absolute);
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) return undefined;
  const normalized = relative.replaceAll("\\", "/");
  return normalized && normalized !== "." ? normalized.slice(0, 240) : undefined;
}

function collectToolPaths(value: unknown, workspace: string): string[] {
  const found = new Set<string>();
  const visit = (current: unknown, depth: number) => {
    if (depth > 5 || !current || typeof current !== "object") return;
    for (const [key, child] of Object.entries(current as Record<string, unknown>).slice(0, 100)) {
      if (/^(?:path|file|file_path|filename|target_path|relative_path)$/i.test(key) && typeof child === "string") {
        const relative = safeRelativeToolPath(child, workspace);
        if (relative) found.add(relative);
      } else if (child && typeof child === "object") visit(child, depth + 1);
    }
  };
  visit(value, 0);
  return [...found].sort().slice(0, 50);
}

function commandCategory(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const command = value.trim().replace(/^['"]|['"]$/g, "");
  const packageCommand = command.match(/^(npm(?:\.cmd)?|pnpm|yarn|bun)\s+(?:run\s+)?(test|typecheck|lint|build)\b/i);
  if (packageCommand) return `${packageCommand[1]!.toLocaleLowerCase("en-US")} ${packageCommand[2]!.toLocaleLowerCase("en-US")}`;
  const gitCommand = command.match(/^git\s+(status|diff|add|commit|log|show)\b/i);
  if (gitCommand) return `git ${gitCommand[1]!.toLocaleLowerCase("en-US")}`;
  if (/^\s*(?:pwsh|powershell)(?:\.exe)?\b/i.test(command)) return "powershell";
  if (/^\s*(?:node|node\.exe)\b/i.test(command)) return "node";
  if (/^\s*(?:python|python3|py)\b/i.test(command)) return "python";
  return "other-command";
}

function safeToolInput(input: unknown, workspace: string): Record<string, unknown> {
  const text = serialized(input);
  const record = input && typeof input === "object" && !Array.isArray(input) ? input as Record<string, unknown> : undefined;
  const fieldNames = record ? Object.keys(record).filter((key) => /^[A-Za-z0-9_.-]{1,64}$/.test(key)).sort().slice(0, 40) : [];
  const safePaths = collectToolPaths(input, workspace);
  const command = record?.command;
  return {
    field_names: fieldNames,
    relative_paths: safePaths,
    input_bytes: Buffer.byteLength(text, "utf8"),
    input_sha256: createHash("sha256").update(text).digest("hex"),
    ...(commandCategory(command) ? { command_category: commandCategory(command) } : {}),
  };
}

function responseStatus(response: unknown): { status: "RETURNED" | "FAILED"; exitCode?: number; responseBytes: number; responseSha256: string } {
  const text = serialized(response);
  let exitCode: number | undefined;
  let failed = false;
  const visit = (current: unknown, depth: number) => {
    if (depth > 4 || !current || typeof current !== "object") return;
    const record = current as Record<string, unknown>;
    if (typeof record.exit_code === "number") exitCode = record.exit_code;
    if (typeof record.exitCode === "number") exitCode = record.exitCode;
    if (record.success === false || record.is_error === true || record.isError === true) failed = true;
    for (const child of Object.values(record).slice(0, 50)) if (child && typeof child === "object") visit(child, depth + 1);
  };
  visit(response, 0);
  if (exitCode !== undefined && exitCode !== 0) failed = true;
  return {
    status: failed ? "FAILED" : "RETURNED",
    ...(exitCode !== undefined ? { exitCode } : {}),
    responseBytes: Buffer.byteLength(text, "utf8"),
    responseSha256: createHash("sha256").update(text).digest("hex"),
  };
}

function safeToolName(value: unknown): string {
  return typeof value === "string" && /^[A-Za-z0-9_.:-]{1,120}$/.test(value) ? value : "unknown-tool";
}

function safeToolUseId(value: unknown): string | undefined {
  return typeof value === "string" && /^[A-Za-z0-9_.:-]{1,256}$/.test(value) ? value : undefined;
}

async function readTurnState(statePath: string, event: CodexHookEvent): Promise<InteractiveTurnState | undefined> {
  try {
    const state = safeParseState(JSON.parse(await readFile(statePath, "utf8")));
    if (!state || state.session_id !== event.session_id || state.turn_id !== event.turn_id) return undefined;
    return state;
  } catch { return undefined; }
}

async function recordToolEvent(w2Home: string, event: CodexHookEvent, phase: "pre" | "post"): Promise<void> {
  if (!event.session_id || !event.turn_id || !event.cwd || !event.tool_use_id || !event.tool_name) return;
  const workspace = path.resolve(event.cwd);
  const statePath = turnStatePath(w2Home, workspace, event.session_id, event.turn_id);
  const toolUseId = safeToolUseId(event.tool_use_id);
  if (!toolUseId) return;
  await mkdir(path.dirname(statePath), { recursive: true });
  const lockPath = `${statePath}.lock`;
  let lock;
  const deadline = Date.now() + 3000;
  while (!lock) {
    try { lock = await open(lockPath, "wx"); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST" || Date.now() >= deadline) return;
      await new Promise((resolve) => setTimeout(resolve, 15));
    }
  }
  try {
  const state = await readTurnState(statePath, event);
  if (!state) return;
  const calls = [...(state.tool_calls ?? [])];
  const timestamp = new Date().toISOString();
  const existingIndex = calls.findIndex((call) => call.tool_use_id === toolUseId);
  if (phase === "pre") {
    if (existingIndex >= 0) return;
    const startedAt = timestamp;
    calls.push({
      tool_name: safeToolName(event.tool_name),
      tool_use_id: toolUseId,
      status: "INCOMPLETE",
      input: safeToolInput(event.tool_input, workspace),
      started_at: startedAt,
      finished_at: startedAt,
      result: { phase: "pre", status: "INCOMPLETE" },
      error: "No matching PostToolUse event was observed.",
    });
  } else {
    const details = responseStatus(event.tool_response);
    if (existingIndex < 0) {
      calls.push({
        tool_name: safeToolName(event.tool_name), tool_use_id: toolUseId, status: details.status,
        input: safeToolInput(event.tool_input, workspace), started_at: timestamp, finished_at: timestamp,
        result: { phase: "post", status: details.status, response_bytes: details.responseBytes, response_sha256: details.responseSha256, ...(details.exitCode !== undefined ? { exit_code: details.exitCode } : {}) },
      });
    } else {
      const previous = calls[existingIndex]!;
      calls[existingIndex] = {
        ...previous,
        tool_name: safeToolName(event.tool_name || previous.tool_name),
        status: details.status,
        finished_at: timestamp,
        result: { phase: "post", status: details.status, response_bytes: details.responseBytes, response_sha256: details.responseSha256, ...(details.exitCode !== undefined ? { exit_code: details.exitCode } : {}) },
        ...(details.status === "FAILED" ? { error: "Structured tool response reported failure." } : { error: undefined }),
      };
    }
  }
  await writeState(statePath, { ...state, tool_calls: calls });
  } finally {
    await lock.close().catch(() => undefined);
    await rm(lockPath, { force: true }).catch(() => undefined);
  }
}

function interruptToolCalls(calls: ToolCallRecord[] | undefined): ToolCallRecord[] {
  return (calls ?? []).map((call) => call.status === "INCOMPLETE" ? {
    ...call,
    status: "INTERRUPTED",
    result: { phase: "incomplete", status: "INTERRUPTED" },
    error: "Turn ended before PostToolUse was observed.",
  } : call);
}

async function capturePrompt(w2Home: string, event: CodexHookEvent, options: InteractiveHookOptions): Promise<InteractiveHookResult | undefined> {
  const prompt = event.prompt?.trim();
  if (!event.session_id || !event.turn_id || !event.cwd) return { systemMessage: "W2 could not capture this engineering turn, so it cannot create a receipt." };
  let referenceContext;
  try { referenceContext = await loadBrainw2ReferenceContext(event.cwd, { env: options.brainw2Env, home: options.brainw2Home }); }
  catch { process.stderr.write("W2 brainw2 sync skipped.\n"); }
  const capture = typeof prompt === "string" && isMeaningfulEngineeringPrompt(prompt, options.brainw2Env ?? process.env);
  if (!capture) return referenceContext ? { additionalContext: referenceContext.text } : undefined;
  if (!prompt) return undefined;
  const workspace = path.resolve(event.cwd);
  const statePath = turnStatePath(w2Home, workspace, event.session_id, event.turn_id);
  let beforeSnapshot: ProjectSnapshot | null = null;
  let gitBaseline: GitTurnSnapshot | undefined;
  let snapshotError: string | undefined;
  try {
    beforeSnapshot = await captureProjectSnapshot(workspace);
    gitBaseline = await captureGitTurnSnapshot(workspace);
  } catch (error) {
    snapshotError = error instanceof Error ? error.message : String(error);
  }
  const state: InteractiveTurnState = {
    version: SNAPSHOT_VERSION,
    session_id: event.session_id,
    turn_id: event.turn_id,
    workspace,
    submitted_at: new Date().toISOString(),
    prompt,
    ...(event.model ? { model: event.model } : {}),
    before_snapshot: beforeSnapshot,
    ...(gitBaseline ? { git_baseline: gitBaseline } : {}),
    ...(snapshotError ? { snapshot_error: snapshotError } : {}),
    tool_calls: [],
    ...(referenceContext ? { brainw2_reference: referenceContext.metadata } : {}),
  };
  await writeState(statePath, state);
  return referenceContext ? { additionalContext: referenceContext.text } : undefined;
}

function formatReceiptResult(receipt: RunReceipt, receiptPath: string): string {
  const required = receipt.acceptance.filter((criterion) => criterion.required);
  const proven = required.filter((criterion) => criterion.status === "PASS").length;
  const lines = ["W2 RECEIPT", receipt.outcome, `Criteria: ${proven}/${required.length} proven`];
  const checks = receipt.verification.results;
  for (const category of ["test", "typecheck", "lint", "build"] as const) {
    const categoryResults = checks.filter((item) => item.category === category);
    if (categoryResults.length) lines.push(`${category[0]!.toUpperCase()}${category.slice(1)}: ${categoryResults.every((item) => item.status === "PASSED") ? "PASS" : categoryResults.some((item) => item.status === "ERROR") ? "ERROR" : "FAIL"}`);
  }
  if (receipt.changes.changed_files.length) lines.push(`Diff: ${receipt.changes.changed_files.length} file${receipt.changes.changed_files.length === 1 ? "" : "s"}`);
  const failedVerifiers = checks.filter((item) => item.status === "FAILED");
  const missing = required.filter((criterion) => criterion.status === "UNPROVEN");
  const erroredVerifiers = checks.filter((item) => item.status === "ERROR");
  if (failedVerifiers.length) lines.push("Failed checks:\n" + failedVerifiers.map((item) => `- ${item.name}`).join("\n"));
  if (missing.length) lines.push("Missing evidence:\n" + missing.map((item) => `- ${item.description}`).join("\n"));
  if (erroredVerifiers.length) lines.push("Verification infrastructure failed:\n" + erroredVerifiers.map((item) => `- ${item.name}`).join("\n"));
  if (receipt.agent.error && receipt.outcome === "ERROR") lines.push(`Error: ${receipt.agent.error}`);
  lines.push("", "Receipt:", receiptPath);
  return lines.join("\n");
}

async function finishTurn(w2Home: string, event: CodexHookEvent, options: InteractiveHookOptions, interrupted = false): Promise<InteractiveHookResult | undefined> {
  if ((!interrupted && event.stop_hook_active) || !event.session_id || !event.turn_id || !event.cwd) return undefined;
  const workspace = path.resolve(event.cwd);
  const statePath = turnStatePath(w2Home, workspace, event.session_id, event.turn_id);
  let state: InteractiveTurnState | undefined;
  let serializedState: string;
  try {
    serializedState = await readFile(statePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    const message = error instanceof Error ? error.message : String(error);
    return { systemMessage: `W2 RECEIPT\nERROR\nW2 could not read the pending turn record.\n${message}` };
  }
  try {
    state = safeParseState(JSON.parse(serializedState));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { systemMessage: `W2 RECEIPT\nERROR\nW2 could not parse the pending turn record.\n${message}` };
  }
  const normalizedStateWorkspace = state?.workspace && process.platform === "win32"
    ? path.resolve(state.workspace).toLocaleLowerCase("en-US")
    : state?.workspace ? path.resolve(state.workspace) : undefined;
  const normalizedWorkspace = process.platform === "win32" ? workspace.toLocaleLowerCase("en-US") : workspace;
  if (!state || state.session_id !== event.session_id || state.turn_id !== event.turn_id || normalizedStateWorkspace !== normalizedWorkspace) {
    await rm(statePath, { force: true }).catch(() => undefined);
    return { systemMessage: "W2 RECEIPT\nERROR\nThe pending turn record is missing required fields or targets a different project." };
  }

  try {
    let afterSnapshot: ProjectSnapshot | null = null;
    let changedPaths: string[] = [];
    let gitDelta: InteractiveGitDelta | undefined;
    let snapshotError = interrupted ? undefined : state.snapshot_error;
    if (!interrupted && !snapshotError && state.before_snapshot) {
      try {
        afterSnapshot = await captureProjectSnapshot(workspace);
        if (state.git_baseline) {
          const afterGit = await captureGitTurnSnapshot(workspace);
          gitDelta = await captureInteractiveGitDelta(workspace, state.before_snapshot, state.git_baseline, afterSnapshot, afterGit);
          changedPaths = gitDelta.changedPaths;
        } else {
          // Pending records created by earlier W2 versions keep their original snapshot behavior.
          changedPaths = getChangedPaths(state.before_snapshot, afterSnapshot);
        }
      } catch (error) {
        snapshotError = error instanceof Error ? error.message : String(error);
      }
    }
    const completedState = {
      ...state,
      changed_paths: changedPaths,
      last_assistant_message: interrupted ? null : event.last_assistant_message ?? null,
      tool_calls: interrupted ? interruptToolCalls(state.tool_calls) : state.tool_calls ?? [],
      ...(snapshotError ? { snapshot_error: snapshotError } : {}),
    };
    await writeState(statePath, completedState);
    const projectVerifiers = interrupted ? [] : await discoverProjectVerifiers(workspace);
    const task = buildInteractiveTask(completedState, changedPaths, projectVerifiers);
    const storage = getInteractiveRunStorage(w2Home, workspace);
    const statusBefore = gitDelta?.statusBefore ?? statusForPaths(state.before_snapshot, changedPaths);
    const adapter = options.adapterFactory?.(event, completedState.tool_calls) ?? new InteractiveHookAdapter(event, completedState.tool_calls);
    const result = await runTaskAndPersistReceipt({
      task,
      databasePath: storage.databasePath,
      receiptDirectory: storage.receiptDirectory,
      adapter,
      workspaceBaseline: {
        statusBefore: interrupted ? "" : statusBefore,
        changedPaths,
        ...(snapshotError ? { captureError: snapshotError } : {}),
        ...(interrupted ? { diffCapture: { statusAfter: "", diff: "", numstat: "" } } : {}),
        ...(!interrupted && gitDelta ? { diffCapture: { statusAfter: gitDelta.statusAfter, diff: gitDelta.diff, numstat: gitDelta.numstat } } : {}),
      },
      ...(state.brainw2_reference ? { referenceContext: state.brainw2_reference } : {}),
      ...(interrupted ? { interrupted: true } : {}),
    });
    options.onRun?.(result.receipt);
    try { await recordSessionReceipt(w2Home, event.session_id, event.turn_id, result.receipt); }
    catch { process.stderr.write("W2 session index update skipped.\n"); }
    try {
      const mapping: Brainw2ProjectMapping | undefined = await resolveProjectMapping(workspace, { env: options.brainw2Env, home: options.brainw2Home, create: false });
      if (mapping) await appendBrainw2DevLog(mapping, result.receipt);
    } catch { process.stderr.write("W2 brainw2 sync skipped.\n"); }
    return { systemMessage: formatReceiptResult(result.receipt, result.markdownPath) };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { systemMessage: `W2 RECEIPT\nERROR\nVerification infrastructure failed before a receipt could be completed.\n${message}` };
  } finally {
    await rm(statePath, { force: true }).catch(() => undefined);
  }
}

async function cleanSessionPendingState(w2Home: string, event: CodexHookEvent, options: InteractiveHookOptions): Promise<boolean> {
  if (!event.session_id || !event.cwd) throw new TypeError("SessionEnd hook payload is missing its session or cwd field");
  const pendingRoot = path.join(projectRuntimeDirectory(w2Home, path.resolve(event.cwd)), "pending");
  const sessionDirectory = path.join(pendingRoot, pathHash(event.session_id));
  const normalizedRoot = path.resolve(pendingRoot);
  const normalizedSession = path.resolve(sessionDirectory);
  if (!normalizedSession.startsWith(`${normalizedRoot}${path.sep}`)) throw new Error("SessionEnd pending state resolved outside the interactive runtime");
  const existed = existsSync(sessionDirectory);
  let files: string[] = [];
  try { files = (await readdir(sessionDirectory)).filter((name) => name.endsWith(".json")); } catch { /* no pending state */ }
  for (const file of files) {
    const statePath = path.join(sessionDirectory, file);
    let stored: InteractiveTurnState | undefined;
    try { stored = safeParseState(JSON.parse(await readFile(statePath, "utf8"))); } catch { stored = undefined; }
    if (!stored || stored.session_id !== event.session_id || path.resolve(stored.workspace) !== path.resolve(event.cwd)) continue;
    const interruptedEvent: CodexHookEvent = { ...event, hook_event_name: "Interrupt", turn_id: stored.turn_id };
    await finishTurn(w2Home, interruptedEvent, options, true);
  }
  await rm(normalizedSession, { recursive: true, force: true });
  return existed;
}

function hookErrorClass(error: unknown): string {
  if (error instanceof SyntaxError) return "SyntaxError";
  if (error instanceof TypeError) return "TypeError";
  if (error instanceof RangeError) return "RangeError";
  return "Error";
}

function outcomeFromMessage(result: InteractiveHookResult | undefined): HookOutcomeClass | undefined {
  const match = result?.systemMessage?.match(/^W2 RECEIPT\n(PASS|FAIL|UNPROVEN|ERROR|ABORTED)\b/);
  return match?.[1] as HookOutcomeClass | undefined;
}

function validPermissionMode(value: unknown): value is NonNullable<CodexHookEvent["permission_mode"]> {
  return value === "default" || value === "acceptEdits" || value === "plan" || value === "dontAsk" || value === "bypassPermissions";
}

export async function handleInteractiveHook(w2Home: string, event: CodexHookEvent, options: InteractiveHookOptions = {}): Promise<InteractiveHookResult | undefined> {
  let outcome: HookOutcomeClass = "IGNORED";
  let errorClass: string | undefined;
  let receiptId: string | undefined;
  let result: InteractiveHookResult | undefined;
  await writeHookDiagnostic({ w2Home, event, handler: "started" });
  try {
    switch (event.hook_event_name) {
      case "UserPromptSubmit": {
        if (!event.session_id || !event.turn_id || !event.cwd || typeof event.prompt !== "string" || !validPermissionMode(event.permission_mode)) {
          throw new TypeError("UserPromptSubmit hook payload is missing a required Codex field");
        }
        result = await capturePrompt(w2Home, event, options);
        outcome = result?.systemMessage ? "ERROR" : isMeaningfulEngineeringPrompt(event.prompt, options.brainw2Env ?? process.env) ? "PENDING" : "IGNORED";
        break;
      }
      case "PreToolUse": {
        await recordToolEvent(w2Home, event, "pre");
        outcome = "PENDING";
        break;
      }
      case "PostToolUse": {
        await recordToolEvent(w2Home, event, "post");
        outcome = "PENDING";
        break;
      }
      case "PermissionRequest": {
        // Returning no decision preserves Codex's ordinary permission prompt.
        outcome = "IGNORED";
        break;
      }
      case "Stop": {
        if (event.stop_hook_active === true) break;
        if (!event.session_id || !event.turn_id || !event.cwd || typeof event.stop_hook_active !== "boolean" || !validPermissionMode(event.permission_mode)) {
          throw new TypeError("Stop hook payload is missing a required Codex field");
        }
        const trackedOptions: InteractiveHookOptions = {
          ...options,
          onRun: (receipt) => {
            receiptId = receipt.run_id;
            outcome = receipt.outcome;
            options.onRun?.(receipt);
          },
        };
        result = await finishTurn(w2Home, event, trackedOptions);
        outcome = receiptId ? outcome : outcomeFromMessage(result) ?? (result ? "ERROR" : "NO_PENDING");
        break;
      }
      case "Interrupt": {
        if (!validPermissionMode(event.permission_mode)) throw new TypeError("Interrupt hook payload is missing permission_mode");
        const trackedOptions: InteractiveHookOptions = {
          ...options,
          onRun: (receipt) => {
            receiptId = receipt.run_id;
            outcome = receipt.outcome;
            options.onRun?.(receipt);
          },
        };
        result = await finishTurn(w2Home, event, trackedOptions, true);
        outcome = receiptId ? "ABORTED" : result?.systemMessage ? "ERROR" : "NO_PENDING";
        break;
      }
      case "SessionEnd": {
        if (typeof event.reason !== "string") throw new TypeError("SessionEnd hook payload is missing its reason field");
        outcome = await cleanSessionPendingState(w2Home, event, options) ? "CLEANED" : "NO_PENDING";
        break;
      }
      default:
        break;
    }
  } catch (error) {
    outcome = "ERROR";
    errorClass = hookErrorClass(error);
    if (event.hook_event_name === "SessionEnd") {
      result = { systemMessage: "W2 could not finish SessionEnd cleanup." };
    } else {
      result = { systemMessage: `W2 RECEIPT\nERROR\nW2 could not process this Codex lifecycle event (${errorClass}).` };
    }
  } finally {
    await writeHookDiagnostic({ w2Home, event, handler: "completed", outcome, ...(errorClass ? { errorClass } : {}), ...(receiptId ? { receiptId } : {}) });
  }
  return result;
}
