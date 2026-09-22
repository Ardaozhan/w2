import fs from "node:fs";
import path from "node:path";
import type { ContextEntry, ContextManifest, TaskDefinition } from "./types.js";

const ignoredDirectories = new Set([".git", "node_modules", "dist", ".w2"]);

function walk(root: string, current = root): string[] {
  const entries = fs.readdirSync(current, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.name.startsWith(".") && entry.name !== ".env.example") continue;
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const full = path.join(current, entry.name);
    if (entry.isDirectory()) files.push(...walk(root, full));
    else if (entry.isFile()) files.push(path.relative(root, full));
  }
  return files.sort();
}

function entry(workspace: string, relativePath: string, included: boolean, reason: string): ContextEntry {
  const sourcePath = path.join(workspace, relativePath);
  const bytes = fs.statSync(sourcePath).size;
  return {
    path: relativePath,
    source_path: sourcePath,
    included,
    selection_reason: reason,
    sections: included ? ["full-file"] : [],
    bytes,
    approximate_tokens: Math.ceil(bytes / 4),
  };
}

export function buildContextManifest(task: TaskDefinition, workspace: string): ContextManifest {
  const candidates = walk(workspace);
  const allowed = task.allowed_paths.map((value) => value.replaceAll("\\", "/").replace(/^\.\//, ""));
  const files = candidates.map((candidate) => {
    const normalized = candidate.replaceAll("\\", "/");
    const explicitlyAllowed = allowed.some((prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`));
    const relevant = explicitlyAllowed || /(^|\/)(src|test|tests|fixtures|package\.json|tsconfig\.json|README)/i.test(normalized);
    return entry(workspace, candidate, relevant, explicitlyAllowed ? "allowed_paths" : relevant ? "task-relevant source or configuration" : "not selected by task scope");
  });
  const included = files.filter((file) => file.included);
  const excluded = files.filter((file) => !file.included);
  const totalBytes = included.reduce((sum, file) => sum + file.bytes, 0);
  return {
    workspace,
    generated_at: new Date().toISOString(),
    task_id: task.task_id,
    files_considered: files,
    files_included: included,
    excluded_candidates: excluded,
    total_bytes: totalBytes,
    approximate_tokens: Math.ceil(totalBytes / 4),
  };
}
