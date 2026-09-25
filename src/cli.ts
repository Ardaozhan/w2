#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs/promises";
import { loadTask } from "./core/task.js";
import { runTaskAndPersistReceipt } from "./core/cli-run.js";
import { buildRunReceipt, renderReceiptMarkdown } from "./core/evidence.js";
import { handleInteractiveHook, type CodexHookEvent } from "./core/interactive.js";
import { renderDoctor } from "./core/doctor.js";
import { findLatestSessionSummary } from "./core/session.js";
import { RunStore } from "./core/store.js";

function usage(): never {
  console.error("Usage: w2 run <task.json> [--db <path>] | w2 receipt <run-id> [--db <path>] [--out <dir>] | w2 doctor | w2 version | w2 session latest [<session-id>] | w2 hook --home <W2 path>");
  process.exit(2);
}

function getW2Home(): string {
  return path.resolve(process.env.W2_HOME ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.."));
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}

function optionValue(args: string[], option: string): string | undefined {
  const index = args.indexOf(option);
  return index >= 0 ? args[index + 1] : undefined;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args[0] === "version") {
    const packageJson = JSON.parse(await fs.readFile(path.join(getW2Home(), "package.json"), "utf8")) as { version?: unknown };
    console.log(`w2 ${typeof packageJson.version === "string" ? packageJson.version : "unknown"}`);
    return;
  }
  if (args[0] === "doctor") {
    console.log(await renderDoctor(getW2Home()));
    return;
  }
  if (args[0] === "session") {
    if (args[1] !== "latest" || args.length > 3) usage();
    const summary = await findLatestSessionSummary(getW2Home(), args[2]);
    console.log(JSON.stringify(summary ?? { message: "No W2 sessions are available." }, null, 2));
    return;
  }
  if (args[0] === "hook") {
    const w2Home = optionValue(args.slice(1), "--home");
    if (!w2Home) usage();
    let input: CodexHookEvent | undefined;
    try {
      input = JSON.parse(await readStdin()) as CodexHookEvent;
      const result = await handleInteractiveHook(path.resolve(w2Home), input);
      if (result?.systemMessage && input.hook_event_name === "SessionEnd") {
        console.error(result.systemMessage);
        process.exitCode = 1;
      }
      else if (input.hook_event_name === "UserPromptSubmit" && result?.additionalContext) {
        console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: "UserPromptSubmit", additionalContext: result.additionalContext } }));
      }
      else if ((input.hook_event_name === "PreToolUse" || input.hook_event_name === "PostToolUse" || input.hook_event_name === "Stop") && result?.systemMessage) {
        console.log(JSON.stringify({ systemMessage: result.systemMessage }));
      }
      else if (input.hook_event_name === "Stop") console.log("{}");
    } catch (error) {
      const errorClass = error instanceof SyntaxError ? "SyntaxError" : error instanceof TypeError ? "TypeError" : "Error";
      if (input?.hook_event_name === "SessionEnd") {
        console.error(`W2 SessionEnd hook failed (${errorClass}).`);
        process.exitCode = 1;
      } else if (input?.hook_event_name !== "Interrupt" && input?.hook_event_name !== "PermissionRequest") {
        console.log(JSON.stringify({ systemMessage: `W2 RECEIPT\nERROR\nW2 could not process this Codex lifecycle event (${errorClass}).` }));
      }
    }
    return;
  }
  if (!args[0] || !args[1] || !["run", "receipt"].includes(args[0])) usage();
  if (args[0] === "receipt") {
    let databasePath: string | undefined;
    let outputDir: string | undefined;
    for (let index = 2; index < args.length; index += 1) {
      if (args[index] === "--db" && args[index + 1]) databasePath = path.resolve(args[++index]);
      else if (args[index] === "--out" && args[index + 1]) outputDir = path.resolve(args[++index]);
      else usage();
    }
    let receiptFile: string | undefined;
    if (!databasePath && /^[A-Za-z0-9_-]{1,128}$/.test(args[1])) {
      const runtimeRoot = path.join(getW2Home(), ".w2", "interactive");
      const walk = async (directory: string): Promise<void> => {
        if (receiptFile) return;
        let entries;
        try { entries = await fs.readdir(directory, { withFileTypes: true }); } catch { return; }
        for (const entry of entries) {
          if (entry.isSymbolicLink()) continue;
          const fullPath = path.join(directory, entry.name);
          if (entry.isDirectory()) {
            if (entry.name === "receipts") {
              const candidate = path.join(fullPath, `${args[1]}.json`);
              try { await fs.access(candidate); receiptFile = candidate; return; } catch { /* continue searching */ }
            } else await walk(fullPath);
          }
        }
      };
      await walk(runtimeRoot);
      if (receiptFile) databasePath = path.resolve(path.dirname(path.dirname(receiptFile)), "runs.sqlite");
    }
    databasePath ??= path.resolve(".w2", "runs.sqlite");
    const store = new RunStore(databasePath);
    try {
      const receipt = buildRunReceipt(store, args[1]);
      const markdown = renderReceiptMarkdown(receipt);
      if (outputDir) {
        await fs.mkdir(outputDir, { recursive: true });
        await fs.writeFile(path.join(outputDir, `${args[1]}.json`), `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
        await fs.writeFile(path.join(outputDir, `${args[1]}.md`), markdown, "utf8");
      }
      console.log(JSON.stringify(receipt, null, 2));
    } finally {
      store.close();
    }
    return;
  }
  const taskPath = path.resolve(args[1]);
  let databasePath = path.resolve(".w2", "runs.sqlite");
  for (let index = 2; index < args.length; index += 1) {
    if (args[index] === "--db" && args[index + 1]) databasePath = path.resolve(args[++index]);
    else usage();
  }
  let task;
  try {
    task = await loadTask(taskPath);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
    return;
  }
  const outputDir = path.resolve(path.dirname(databasePath), "receipts");
  const result = await runTaskAndPersistReceipt({ task, databasePath, receiptDirectory: outputDir });
  console.log(JSON.stringify({ run_id: result.run.run_id, status: result.run.status, outcome: result.receipt.outcome, receipt_json: result.jsonPath, receipt_markdown: result.markdownPath, database: databasePath }, null, 2));
  if (result.receipt.outcome !== "PASS") process.exitCode = 1;
}

void main();
