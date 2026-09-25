import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { RunReceipt } from "./types.js";

export interface SessionTurnIndexEntry {
  turn_id: string;
  receipt_id: string;
  timestamp: string;
  outcome: RunReceipt["outcome"];
}

export interface SessionIndex {
  version: 1;
  session_id: string;
  updated_at: string;
  turns: SessionTurnIndexEntry[];
}

export interface SessionSummary {
  session_id: string;
  turn_count: number;
  receipt_ids: string[];
  outcome_sequence: RunReceipt["outcome"][];
  latest_receipt: string;
  updated_at: string;
}

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 32);
}

function indexPath(w2Home: string, sessionId: string): string {
  return path.join(path.resolve(w2Home), ".w2", "interactive", "sessions", `${hash(sessionId)}.json`);
}

export async function recordSessionReceipt(w2Home: string, sessionId: string, turnId: string, receipt: RunReceipt): Promise<void> {
  const directory = path.dirname(indexPath(w2Home, sessionId));
  const filePath = indexPath(w2Home, sessionId);
  await mkdir(directory, { recursive: true });
  let index: SessionIndex = { version: 1, session_id: sessionId, updated_at: receipt.generated_at, turns: [] };
  try {
    const parsed = JSON.parse(await readFile(filePath, "utf8")) as Partial<SessionIndex>;
    if (parsed.version === 1 && parsed.session_id === sessionId && Array.isArray(parsed.turns)) index = parsed as SessionIndex;
  } catch { /* a missing or malformed index is rebuilt from this receipt only */ }
  if (!index.turns.some((turn) => turn.receipt_id === receipt.run_id)) {
    index.turns.push({ turn_id: turnId, receipt_id: receipt.run_id, timestamp: receipt.generated_at, outcome: receipt.outcome });
  }
  index.turns.sort((left, right) => left.timestamp.localeCompare(right.timestamp) || left.turn_id.localeCompare(right.turn_id));
  index.updated_at = receipt.generated_at;
  const temporary = `${filePath}.${randomUUID()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(index, null, 2)}\n`, "utf8");
  await rename(temporary, filePath);
}

async function findIndexFiles(root: string): Promise<string[]> {
  const files: string[] = [];
  const walk = async (directory: string): Promise<void> => {
    let entries;
    try { entries = await readdir(directory, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) await walk(fullPath);
      else if (entry.isFile() && entry.name.endsWith(".json") && path.basename(directory) === "sessions") files.push(fullPath);
    }
  };
  await walk(root);
  return files;
}

function summarize(index: SessionIndex): SessionSummary | undefined {
  const validTurns = index.turns.filter((turn) => typeof turn.turn_id === "string" && typeof turn.receipt_id === "string"
    && typeof turn.timestamp === "string" && ["PASS", "FAIL", "UNPROVEN", "ABORTED", "ERROR"].includes(turn.outcome));
  const latest = validTurns.at(-1);
  if (!latest) return undefined;
  return {
    session_id: index.session_id,
    turn_count: validTurns.length,
    receipt_ids: validTurns.map((turn) => turn.receipt_id),
    outcome_sequence: validTurns.map((turn) => turn.outcome),
    latest_receipt: latest.receipt_id,
    updated_at: index.updated_at,
  };
}

export async function findLatestSessionSummary(w2Home: string, sessionId?: string): Promise<SessionSummary | undefined> {
  const root = path.join(path.resolve(w2Home), ".w2", "interactive");
  const candidates: SessionSummary[] = [];
  for (const filePath of await findIndexFiles(root)) {
    try {
      const index = JSON.parse(await readFile(filePath, "utf8")) as SessionIndex;
      if (index.version !== 1 || typeof index.session_id !== "string" || (sessionId && index.session_id !== sessionId) || !Array.isArray(index.turns)) continue;
      const summary = summarize(index);
      if (summary) candidates.push(summary);
    } catch { /* ignore malformed session indexes */ }
  }
  return candidates.sort((left, right) => right.updated_at.localeCompare(left.updated_at))[0];
}
