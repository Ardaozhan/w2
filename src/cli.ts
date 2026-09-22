#!/usr/bin/env node
import path from "node:path";
import { loadTask } from "./core/task.js";
import { RunEngine } from "./core/engine.js";
import { buildRunReceipt, renderReceiptMarkdown } from "./core/evidence.js";
import { RunStore } from "./core/store.js";

function usage(): never {
  console.error("Usage: w2 run <task.json> [--db <path>] | w2 receipt <run-id> [--db <path>] [--out <dir>]");
  process.exit(2);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (!args[0] || !args[1] || !["run", "receipt"].includes(args[0])) usage();
  if (args[0] === "receipt") {
    let databasePath = path.resolve(".w2", "runs.sqlite");
    let outputDir: string | undefined;
    for (let index = 2; index < args.length; index += 1) {
      if (args[index] === "--db" && args[index + 1]) databasePath = path.resolve(args[++index]);
      else if (args[index] === "--out" && args[index + 1]) outputDir = path.resolve(args[++index]);
      else usage();
    }
    const store = new RunStore(databasePath);
    try {
      const receipt = buildRunReceipt(store, args[1]);
      const markdown = renderReceiptMarkdown(receipt);
      if (outputDir) {
        const fs = await import("node:fs/promises");
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
  const engine = new RunEngine({ databasePath });
  try {
    const result = await engine.run(task);
    console.log(JSON.stringify({ run_id: result.run_id, status: result.status, database: databasePath }, null, 2));
    if (!["COMPLETED"].includes(result.status)) process.exitCode = 1;
  } finally {
    engine.close();
  }
}

void main();
