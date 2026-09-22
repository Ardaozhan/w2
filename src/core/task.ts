import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type { TaskDefinition } from "./types.js";

const verificationCommandSchema = z.object({
  name: z.string().min(1),
  command: z.string().min(1),
  category: z.enum(["test", "lint", "typecheck", "build", "custom"]),
});

export const taskSchema = z.object({
  task_id: z.string().min(1),
  title: z.string().min(1),
  goal: z.string().min(1),
  constraints: z.array(z.string().min(1)),
  allowed_paths: z.array(z.string().min(1)),
  acceptance_criteria: z.array(z.string().min(1)).min(1),
  verification_commands: z.array(verificationCommandSchema).min(1),
  workspace: z.string().min(1).optional(),
  model: z.string().min(1).optional(),
  timeout_ms: z.number().int().positive().max(30 * 60 * 1000).optional(),
}).strict();

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
