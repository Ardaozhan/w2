import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { getInteractiveRunStorage, handleInteractiveHook, isMeaningfulEngineeringPrompt, type CodexHookEvent, type InteractiveHookOptions, type InteractiveHookResult } from "./interactive.js";

type ClaudeHookName = "UserPromptSubmit" | "PreToolUse" | "PostToolUse" | "PostToolUseFailure" | "PermissionRequest" | "Stop" | "SessionEnd";

interface ClaudeHookInput extends Record<string, unknown> {
  hook_event_name?: unknown;
  session_id?: unknown;
  cwd?: unknown;
  prompt?: unknown;
  reason?: unknown;
  tool_name?: unknown;
  tool_use_id?: unknown;
  tool_input?: unknown;
  tool_response?: unknown;
  stop_hook_active?: unknown;
  last_assistant_message?: unknown;
  permission_mode?: unknown;
  agent_id?: unknown;
  model?: unknown;
}

interface ActiveClaudeTurn {
  version: 1;
  provider: "claude-code";
  session_id: string;
  turn_id: string;
  cwd: string;
}

const supportedEvents = new Set<ClaudeHookName>([
  "UserPromptSubmit", "PreToolUse", "PostToolUse", "PostToolUseFailure", "PermissionRequest", "Stop", "SessionEnd",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function safeId(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 && value.length <= 256 ? value : undefined;
}

function activeTurnPath(w2Home: string, cwd: string, sessionId: string): string {
  const runtimeDirectory = getInteractiveRunStorage(w2Home, path.resolve(cwd)).runtimeDirectory;
  const hash = createHash("sha256").update(sessionId).digest("hex");
  return path.join(runtimeDirectory, "claude-active-turns", `${hash}.json`);
}

async function saveActiveTurn(filePath: string, turn: ActiveClaudeTurn): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporaryPath, `${JSON.stringify(turn)}\n`, { encoding: "utf8", mode: 0o600, flag: "wx" });
    await rename(temporaryPath, filePath);
  } finally {
    await rm(temporaryPath, { force: true }).catch(() => undefined);
  }
}

async function readActiveTurn(filePath: string, sessionId: string, cwd: string): Promise<ActiveClaudeTurn | undefined> {
  try {
    const value: unknown = JSON.parse(await readFile(filePath, "utf8"));
    if (!isRecord(value) || value.version !== 1 || value.provider !== "claude-code" || value.session_id !== sessionId || value.cwd !== path.resolve(cwd)) return undefined;
    const turnId = safeId(value.turn_id);
    return turnId ? { version: 1, provider: "claude-code", session_id: sessionId, turn_id: turnId, cwd: path.resolve(cwd) } : undefined;
  } catch {
    return undefined;
  }
}

function permissionMode(value: unknown): NonNullable<CodexHookEvent["permission_mode"]> {
  return value === "acceptEdits" || value === "plan" || value === "dontAsk" || value === "bypassPermissions" || value === "default"
    ? value
    : "default";
}

function baseEvent(input: ClaudeHookInput, hookName: ClaudeHookName, turnId?: string): CodexHookEvent {
  const sessionId = safeId(input.session_id);
  const cwd = typeof input.cwd === "string" && input.cwd.length > 0 ? input.cwd : undefined;
  if (!sessionId || !cwd) throw new TypeError("Claude Code hook payload is missing its session_id or cwd field");
  const toolResponse = hookName === "PostToolUseFailure"
    ? { is_error: true, error: input.error ?? input.tool_response }
    : input.tool_response;
  return {
    provider: "claude-code",
    hook_event_name: hookName === "PostToolUseFailure" ? "PostToolUse" : hookName,
    session_id: sessionId,
    ...(turnId ? { turn_id: turnId } : {}),
    cwd,
    ...(typeof input.prompt === "string" ? { prompt: input.prompt } : {}),
    ...(typeof input.tool_name === "string" ? { tool_name: input.tool_name } : {}),
    ...(safeId(input.tool_use_id) ? { tool_use_id: input.tool_use_id as string } : {}),
    ...(input.tool_input !== undefined ? { tool_input: input.tool_input } : {}),
    ...(toolResponse !== undefined ? { tool_response: toolResponse } : {}),
    ...(typeof input.last_assistant_message === "string" ? { last_assistant_message: input.last_assistant_message } : {}),
    ...(typeof input.reason === "string" ? { reason: input.reason } : {}),
    ...(typeof input.model === "string" ? { model: input.model } : {}),
    permission_mode: permissionMode(input.permission_mode),
    ...(hookName === "Stop" ? { stop_hook_active: input.stop_hook_active === true } : {}),
  };
}

/** Translate Claude Code's native hook contract into W2's shared interactive receipt pipeline. */
export async function handleClaudeCodeHook(w2Home: string, raw: unknown, options: InteractiveHookOptions = {}): Promise<InteractiveHookResult | undefined> {
  if (!isRecord(raw)) throw new TypeError("Claude Code hook payload must be a JSON object");
  const input = raw as ClaudeHookInput;
  const hookName = input.hook_event_name;
  if (typeof hookName !== "string" || !supportedEvents.has(hookName as ClaudeHookName)) return undefined;
  const name = hookName as ClaudeHookName;

  // Claude Code fires several lifecycle events for subagents. The current receipt model is one main-session turn.
  if (typeof input.agent_id === "string" && input.agent_id.length > 0) return undefined;

  const sessionId = safeId(input.session_id);
  const cwd = typeof input.cwd === "string" && input.cwd.length > 0 ? path.resolve(input.cwd) : undefined;
  if (!sessionId || !cwd) throw new TypeError("Claude Code hook payload is missing its session_id or cwd field");
  const pointerPath = activeTurnPath(w2Home, cwd, sessionId);

  if (name === "UserPromptSubmit") {
    if (typeof input.prompt !== "string") throw new TypeError("Claude Code UserPromptSubmit payload is missing prompt");
    const turnId = randomUUID();
    const tracked = isMeaningfulEngineeringPrompt(input.prompt, options.brainw2Env ?? process.env);
    if (tracked) await saveActiveTurn(pointerPath, { version: 1, provider: "claude-code", session_id: sessionId, turn_id: turnId, cwd });
    else await rm(pointerPath, { force: true }).catch(() => undefined);
    try {
      return await handleInteractiveHook(w2Home, baseEvent(input, name, turnId), options);
    } catch (error) {
      if (tracked) await rm(pointerPath, { force: true }).catch(() => undefined);
      throw error;
    }
  }

  if (name === "SessionEnd") {
    const active = await readActiveTurn(pointerPath, sessionId, cwd);
    const event = baseEvent(input, name, active?.turn_id);
    try { return await handleInteractiveHook(w2Home, event, options); }
    finally { await rm(pointerPath, { force: true }).catch(() => undefined); }
  }

  const active = await readActiveTurn(pointerPath, sessionId, cwd);
  if (!active) return undefined;
  if (name === "Stop" && input.stop_hook_active === true) return undefined;
  const result = await handleInteractiveHook(w2Home, baseEvent(input, name, active.turn_id), options);
  if (name === "Stop") await rm(pointerPath, { force: true }).catch(() => undefined);
  return result;
}
