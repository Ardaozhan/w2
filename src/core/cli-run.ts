import fs from "node:fs/promises";
import path from "node:path";
import type { AgentAdapter } from "./agent.js";
import { loadBrainw2ReferenceContext, syncBrainw2Receipt, type Brainw2SyncOptions } from "./brainw2.js";
import { buildRunReceipt, renderReceiptMarkdown } from "./evidence.js";
import { RunEngine, type RunEngineOptions } from "./engine.js";
import type { TaskDefinition } from "./types.js";

export async function runTaskAndPersistReceipt(input: {
  task: TaskDefinition;
  databasePath: string;
  receiptDirectory: string;
  adapter?: AgentAdapter;
  runtime?: RunEngineOptions["runtime"];
  workspaceBaseline?: RunEngineOptions["workspaceBaseline"];
  referenceContext?: RunEngineOptions["referenceContext"];
  referenceContextText?: string;
  interrupted?: boolean;
  brainw2?: Brainw2SyncOptions;
}) {
  let referenceContext = input.referenceContext;
  let referenceContextText = input.referenceContextText;
  const brainw2Options: Brainw2SyncOptions | undefined = input.brainw2
    ? { ...input.brainw2, mappingCache: new Map() }
    : undefined;
  if (!referenceContext && brainw2Options) {
    try {
      const context = await loadBrainw2ReferenceContext(path.resolve(input.task.workspace ?? process.cwd()), brainw2Options);
      if (context) {
        referenceContext = context.metadata;
        referenceContextText = context.text;
      }
    } catch { /* optional BrainW2 context must not change the W2 run */ }
  }
  const engine = new RunEngine({ databasePath: input.databasePath, adapter: input.adapter, runtime: input.runtime, workspaceBaseline: input.workspaceBaseline, referenceContext, referenceContextText, interrupted: input.interrupted });
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
    const brainw2Writeback = brainw2Options
      ? await syncBrainw2Receipt(path.resolve(input.task.workspace ?? process.cwd()), receipt, brainw2Options)
      : undefined;
    return { run, receipt, events: engine.store.getEvents(run.run_id), receiptDirectory, jsonPath, markdownPath, brainw2Writeback };
  } finally {
    engine.close();
  }
}
