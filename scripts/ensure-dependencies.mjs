import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const required = [path.join(root, "node_modules", ".bin", process.platform === "win32" ? "vitest.cmd" : "vitest"), path.join(root, "node_modules", "typescript", "bin", "tsc")];
if (required.every((entry) => fs.existsSync(entry))) process.exit(0);
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const result = spawnSync(npm, ["ci", "--ignore-scripts", "--no-audit", "--no-fund"], { cwd: root, stdio: "inherit" });
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
