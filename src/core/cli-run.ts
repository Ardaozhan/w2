import fs from "node:fs/promises";
import path from "node:path";
import type { AgentAdapter } from "./agent.js";
import { buildRunReceipt, renderReceiptMarkdown } from "./evidence.js";
import { RunEngine, type RunEngineOptions } from "./engine.js";
import type { TaskDefinition } from "./types.js";

export async function runTaskAndPersistReceipt(input: {
  task: TaskDefinition;
  databasePath: string;
  receiptDirectory: string;
  adapter?: AgentAdapter;
  runtime?: RunEngineOptions["runtime"];
}) {
  const engine = new RunEngine({ databasePath: input.databasePath, adapter: input.adapter, runtime: input.runtime });
  try {
    const run = await engine.run(input.task);
    const receipt = buildRunReceipt(engine.store, run.run_id);
    const markdown = renderReceiptMarkdown(receipt);
    const receiptDirectory = path.resolve(input.receiptDirectory);
    const jsonPath = path.join(receiptDirectory, `${run.run_id}.json`);
    const markdownPath = path.join(receiptDirectory, `${run.run_id}.md`);
    await fs.mkdir(receiptDirectory, { recursive: true });
    await fs.writeFile(jsonPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
    await fs.writeFile(markdownPath, markdown, "utf8");
    return { run, receipt, events: engine.store.getEvents(run.run_id), receiptDirectory, jsonPath, markdownPath };
  } finally {
    engine.close();
  }
}
