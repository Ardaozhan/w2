import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type { TaskDefinition } from "./types.js";

const verificationCommandInputSchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().min(1),
  command: z.string().min(1),
  category: z.enum(["test", "lint", "typecheck", "build", "custom"]),
});
const acceptanceCriterionInputSchema = z.union([
  z.string().min(1),
  z.object({
    id: z.string().min(1),
    statement: z.string().min(1),
    required: z.boolean(),
    verification_refs: z.array(z.string().min(1)),
  }).strict(),
]);
const runtimeBudgetSchema = z.object({
  max_steps: z.number().int().positive().optional(), max_tool_calls: z.number().int().positive().optional(),
  max_runtime_ms: z.number().int().positive().optional(), max_output_bytes: z.number().int().positive().optional(), max_context_size: z.number().int().positive().optional(),
}).strict();

export const taskSchema = z.object({
  task_id: z.string().min(1),
  title: z.string().min(1),
  goal: z.string().min(1),
  constraints: z.array(z.string().min(1)),
  allowed_paths: z.array(z.string().min(1)),
  acceptance_criteria: z.array(acceptanceCriterionInputSchema).min(1),
  verification_commands: z.array(verificationCommandInputSchema).min(1),
  workspace: z.string().min(1).optional(),
  model: z.string().min(1).optional(),
  timeout_ms: z.number().int().positive().max(30 * 60 * 1000).optional(),
  capabilities: z.array(z.enum(["fs.read", "fs.write", "fs.delete", "shell.execute", "git.read", "git.write", "network.read", "network.write", "secret.read", "external.write"])).optional(),
  runtime_budget: runtimeBudgetSchema.optional(),
}).strict().superRefine((task, context) => {
  const verifierIds = task.verification_commands.map((item) => item.id ?? item.name);
  const seenVerifiers = new Set<string>();
  for (const [index, id] of verifierIds.entries()) {
    if (seenVerifiers.has(id)) context.addIssue({ code: "custom", path: ["verification_commands", index, "id"], message: `Duplicate verifier ID: ${id}` });
    seenVerifiers.add(id);
  }
  const criterionIds = task.acceptance_criteria.map((item, index) => typeof item === "string" ? `AC-${String(index + 1).padStart(2, "0")}` : item.id);
  const seenCriteria = new Set<string>();
  for (const [index, item] of task.acceptance_criteria.entries()) {
    const id = criterionIds[index]!;
    if (seenCriteria.has(id)) context.addIssue({ code: "custom", path: ["acceptance_criteria", index, "id"], message: `Duplicate criterion ID: ${id}` });
    seenCriteria.add(id);
    if (typeof item !== "string") {
      for (const [refIndex, ref] of item.verification_refs.entries()) {
        if (!verifierIds.includes(ref)) context.addIssue({ code: "custom", path: ["acceptance_criteria", index, "verification_refs", refIndex], message: `Unknown verifier ID: ${ref}` });
      }
    }
  }
}).transform((task) => ({
  ...task,
  acceptance_criteria: task.acceptance_criteria.map((item, index) => typeof item === "string"
    ? { id: `AC-${String(index + 1).padStart(2, "0")}`, statement: item, required: true, verification_refs: [] }
    : item),
  verification_commands: task.verification_commands.map((item) => ({ ...item, id: item.id ?? item.name })),
}));

export function parseTask(value: unknown): TaskDefinition {
  return taskSchema.parse(value);
}

export async function loadTask(taskPath: string, cwd = process.cwd()): Promise<TaskDefinition> {
  const absolutePath = path.resolve(cwd, taskPath);
  let contents: string;
  try {
    contents = await readFile(absolutePath, "utf8");
  } catch (error) {
    throw new Error(`Task file could not be read: ${absolutePath}`, { cause: error });
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(contents);
  } catch (error) {
    throw new Error(`Task file is not valid JSON: ${absolutePath}`, { cause: error });
  }
  const task = parseTask(parsed);
  return {
    ...task,
    workspace: task.workspace ? path.resolve(path.dirname(absolutePath), task.workspace) : cwd,
  };
}
