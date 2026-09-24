import { createHash, randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { appendFile, lstat, mkdir, mkdtemp, readFile, readlink, rename, rm, rmdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import type { AgentAdapter, AgentStartInput } from "./agent.js";
import { runTaskAndPersistReceipt } from "./cli-run.js";
import type { AgentOutput, AgentRunResult, RunReceipt, TaskDefinition, VerificationCommand } from "./types.js";

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
const actionWords = "implement|fix|refactor|add|create|update|change|modify|remove|delete|migrate|build|write|optimi[sz]e|improve|replace|integrate|introduce|generate|convert|port|upgrade|secure|validate|düzelt\\w*|uygula\\w*|ekle\\w*|oluştur\\w*|değiştir\\w*|güncelle\\w*|kaldır\\w*|taşı\\w*|yeniden yaz|entegre\\w*|geliştir\\w*|iyileştir\\w*|kur\\w*|sil\\w*";

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
}

export interface CodexHookEvent {
  hook_event_name?: string;
  session_id?: string;
  turn_id?: string;
  cwd?: string;
  transcript_path?: string | null;
  prompt?: string;
  model?: string;
  permission_mode?: "default" | "acceptEdits" | "plan" | "dontAsk" | "bypassPermissions";
  stop_hook_active?: boolean;
  last_assistant_message?: string | null;
  reason?: string;
}

export interface InteractiveHookResult {
  systemMessage?: string;
}

export interface InteractiveHookOptions {
  adapterFactory?: (event: CodexHookEvent) => AgentAdapter;
  onRun?: (receipt: RunReceipt) => void;
}

export class InteractiveHookAdapter implements AgentAdapter {
  readonly provider = "codex" as const;
  readonly executionMode = "CODEX_TUI_HOOK" as const;

  constructor(private readonly event: CodexHookEvent) {}

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
      tool_calls: [],
    };
  }
}

export function isMeaningfulEngineeringPrompt(prompt: string): boolean {
  let normalized = prompt.trim().replace(/\s+/g, " ");
  if (!normalized || normalized.startsWith("/")) return false;

  const courtesyPrefix = /^(?:please|kindly|can you|could you|would you|will you|i need you to|i want you to|need you to|help me to|let us|let's|lütfen|rica etsem)[\s,:-]+/i;
  while (courtesyPrefix.test(normalized)) normalized = normalized.replace(courtesyPrefix, "");

  const action = new RegExp(`\\b(?:${actionWords})\\b`, "i");
  if (!action.test(normalized)) return false;

  // A direct command, a polite command, or a later imperative clause counts.
  const directAction = new RegExp(`^(?:${actionWords})\\b`, "i");
  const politeAction = new RegExp(`\\b(?:please|can you|could you|would you|lütfen)\\s+(?:${actionWords})\\b`, "i");
  const laterAction = new RegExp(`(?:[.!?;,:]\\s*|\\b(?:then|and also|also)\\s+)(?:please\\s+)?(?:${actionWords})\\b`, "i");
  if (directAction.test(normalized) || politeAction.test(normalized) || laterAction.test(normalized)) return true;
  const turkishAction = /\b(?:düzelt\w*|uygula\w*|ekle\w*|oluştur\w*|değiştir\w*|güncelle\w*|kaldır\w*|taşı\w*|entegre\w*|geliştir\w*|iyileştir\w*|kur\w*|sil\w*)\b/i;
  const turkishQuestion = /^(?:nasıl|neden|ne|nedir|açıkla|anlat|tartış|oku|incele|özetle|planla)\b/i;
  return turkishAction.test(normalized) && !turkishQuestion.test(normalized);
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
  return state as InteractiveTurnState;
}

async function writeState(statePath: string, state: InteractiveTurnState): Promise<void> {
  await mkdir(path.dirname(statePath), { recursive: true });
  const temporaryPath = `${statePath}.${randomUUID()}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  await rename(temporaryPath, statePath);
}

async function capturePrompt(w2Home: string, event: CodexHookEvent): Promise<InteractiveHookResult | undefined> {
  const prompt = event.prompt?.trim();
  if (!prompt || !isMeaningfulEngineeringPrompt(prompt)) return undefined;
  if (!event.session_id || !event.turn_id || !event.cwd) return { systemMessage: "W2 could not capture this engineering turn, so it cannot create a receipt." };
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
  };
  await writeState(statePath, state);
  return undefined;
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

async function finishTurn(w2Home: string, event: CodexHookEvent, options: InteractiveHookOptions): Promise<InteractiveHookResult | undefined> {
  if (event.stop_hook_active || !event.session_id || !event.turn_id || !event.cwd) return undefined;
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
    let snapshotError = state.snapshot_error;
    if (!snapshotError && state.before_snapshot) {
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
      last_assistant_message: event.last_assistant_message ?? null,
      ...(snapshotError ? { snapshot_error: snapshotError } : {}),
    };
    await writeState(statePath, completedState);
    const projectVerifiers = await discoverProjectVerifiers(workspace);
    const task = buildInteractiveTask(completedState, changedPaths, projectVerifiers);
    const storage = getInteractiveRunStorage(w2Home, workspace);
    const statusBefore = gitDelta?.statusBefore ?? statusForPaths(state.before_snapshot, changedPaths);
    const adapter = options.adapterFactory?.(event) ?? new InteractiveHookAdapter(event);
    const result = await runTaskAndPersistReceipt({
      task,
      databasePath: storage.databasePath,
      receiptDirectory: storage.receiptDirectory,
      adapter,
      workspaceBaseline: {
        statusBefore,
        changedPaths,
        ...(snapshotError ? { captureError: snapshotError } : {}),
        ...(gitDelta ? { diffCapture: { statusAfter: gitDelta.statusAfter, diff: gitDelta.diff, numstat: gitDelta.numstat } } : {}),
      },
    });
    options.onRun?.(result.receipt);
    return { systemMessage: formatReceiptResult(result.receipt, result.markdownPath) };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { systemMessage: `W2 RECEIPT\nERROR\nVerification infrastructure failed before a receipt could be completed.\n${message}` };
  } finally {
    await rm(statePath, { force: true }).catch(() => undefined);
  }
}

async function abortPendingTurn(w2Home: string, event: CodexHookEvent): Promise<boolean> {
  if (!event.session_id || !event.turn_id || !event.cwd) throw new TypeError("Interrupt hook payload is missing its session, turn, or cwd field");
  const statePath = turnStatePath(w2Home, path.resolve(event.cwd), event.session_id, event.turn_id);
  const existed = existsSync(statePath);
  await rm(statePath, { force: true });
  await rmdir(path.dirname(statePath)).catch(() => undefined);
  return existed;
}

async function cleanSessionPendingState(w2Home: string, event: CodexHookEvent): Promise<boolean> {
  if (!event.session_id || !event.cwd) throw new TypeError("SessionEnd hook payload is missing its session or cwd field");
  const pendingRoot = path.join(projectRuntimeDirectory(w2Home, path.resolve(event.cwd)), "pending");
  const sessionDirectory = path.join(pendingRoot, pathHash(event.session_id));
  const normalizedRoot = path.resolve(pendingRoot);
  const normalizedSession = path.resolve(sessionDirectory);
  if (!normalizedSession.startsWith(`${normalizedRoot}${path.sep}`)) throw new Error("SessionEnd pending state resolved outside the interactive runtime");
  const existed = existsSync(sessionDirectory);
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
        result = await capturePrompt(w2Home, event);
        outcome = result ? "ERROR" : isMeaningfulEngineeringPrompt(event.prompt) ? "PENDING" : "IGNORED";
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
        outcome = await abortPendingTurn(w2Home, event) ? "ABORTED" : "NO_PENDING";
        break;
      }
      case "SessionEnd": {
        if (typeof event.reason !== "string") throw new TypeError("SessionEnd hook payload is missing its reason field");
        outcome = await cleanSessionPendingState(w2Home, event) ? "CLEANED" : "NO_PENDING";
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
