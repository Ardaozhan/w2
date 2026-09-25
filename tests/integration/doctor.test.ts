import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { renderDoctor } from "../../src/core/doctor.js";

const roots: string[] = [];
function temp(prefix: string): string {
  const root = mkdtempSync(path.join(os.tmpdir(), prefix));
  roots.push(root);
  return root;
}

function gitProject(root: string): void {
  execFileSync("git", ["init", "--quiet"], { cwd: root, stdio: "ignore" });
  writeFileSync(path.join(root, "README.md"), "doctor fixture\n", "utf8");
  execFileSync("git", ["add", "."], { cwd: root, stdio: "ignore" });
  execFileSync("git", ["-c", "user.name=W2", "-c", "user.email=w2@example.invalid", "commit", "--quiet", "-m", "baseline"], { cwd: root, stdio: "ignore" });
}

afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

describe("w2 doctor", () => {
  it("reports a concise read-only diagnostic without exposing receipt prompts or note contents", async () => {
    const root = temp("w2-doctor-");
    const w2Home = path.join(root, "w2-home");
    const workspace = path.join(root, "project");
    const vault = path.join(root, "brainw2");
    mkdirSync(path.join(w2Home, "dist", "src", "core"), { recursive: true });
    mkdirSync(path.join(workspace), { recursive: true });
    mkdirSync(path.join(vault, "01 Projects", "doctor-project"), { recursive: true });
    writeFileSync(path.join(w2Home, "package.json"), '{"version":"0.2.0-rc.1"}\n', "utf8");
    for (const file of ["dist/src/cli.js", "dist/src/core/interactive.js", "dist/src/core/brainw2.js"]) writeFileSync(path.join(w2Home, file), "// built\n", "utf8");
    gitProject(workspace);
    writeFileSync(path.join(vault, "01 Projects", "doctor-project", "W2.md"), `---\ntype: project\nrepo: ${JSON.stringify(workspace)}\nw2_context: true\n---\n# doctor-project\n\n## Goal\nPRIVATE_NOTE_BODY\n`, "utf8");
    const receiptDirectory = path.join(w2Home, ".w2", "interactive", "project-hash", "receipts");
    mkdirSync(receiptDirectory, { recursive: true });
    writeFileSync(path.join(receiptDirectory, "receipt-doctor.json"), JSON.stringify({ run_id: "receipt-doctor", outcome: "UNPROVEN", task: { goal: "PRIVATE_RECEIPT_PROMPT" } }), "utf8");
    const beforeVault = readFileSync(path.join(vault, "01 Projects", "doctor-project", "W2.md"), "utf8");
    const output = await renderDoctor(w2Home, { cwd: workspace, env: { BRAINW2_VAULT: vault, HOME: root, USERPROFILE: root } });
    expect(output).toContain("W2 version: 0.2.0-rc.1");
    expect(output).toContain(`W2 home: ${w2Home}`);
    expect(output).toContain("Git repository: yes");
    expect(output).toContain("Working tree: clean");
    expect(output).toContain("W2 build: available");
    expect(output).toContain("Latest receipt: receipt-doctor (UNPROVEN)");
    expect(output).toContain("brainw2: enabled");
    expect(output).toContain("brainw2 project mapping: found");
    expect(output).toContain("brainw2 writable: yes");
    expect(output).toContain("PreToolUse");
    expect(output).toContain("PostToolUse");
    expect(output).toContain("TRUST STATUS: CHECK WITH /hooks");
    expect(output).not.toContain("PRIVATE_NOTE_BODY");
    expect(output).not.toContain("PRIVATE_RECEIPT_PROMPT");
    expect(readFileSync(path.join(vault, "01 Projects", "doctor-project", "W2.md"), "utf8")).toBe(beforeVault);
    expect(execFileSync("git", ["status", "--porcelain=v1"], { cwd: workspace, encoding: "utf8" })).toBe("");
  });

  it("reports brainw2 disabled when no valid vault exists", async () => {
    const root = temp("w2-doctor-disabled-");
    const workspace = path.join(root, "outside-git");
    mkdirSync(workspace, { recursive: true });
    writeFileSync(path.join(root, "package.json"), '{"version":"test"}\n', "utf8");
    const output = await renderDoctor(root, { cwd: workspace, env: { BRAINW2_VAULT: path.join(root, "missing"), HOME: root, USERPROFILE: root } });
    expect(output).toContain("brainw2: disabled");
    expect(output).toContain("brainw2 vault: unavailable");
    expect(output).toContain("Git repository: no");
    expect(output).toContain("TRUST STATUS: CHECK WITH /hooks");
  });

  it("finds the latest manual task receipt in the current project's local W2 directory", async () => {
    const root = temp("w2-doctor-manual-receipt-");
    const workspace = path.join(root, "project");
    mkdirSync(workspace, { recursive: true });
    gitProject(workspace);
    const receiptDirectory = path.join(workspace, ".w2", "receipts");
    mkdirSync(receiptDirectory, { recursive: true });
    writeFileSync(path.join(receiptDirectory, "manual-receipt.json"), JSON.stringify({ run_id: "manual-receipt", outcome: "PASS", task: { goal: "DO_NOT_DISPLAY_PROMPT" } }), "utf8");
    const output = await renderDoctor(root, { cwd: workspace, env: { BRAINW2_VAULT: path.join(root, "missing"), HOME: root, USERPROFILE: root } });
    expect(output).toContain("Latest receipt: manual-receipt (PASS)");
    expect(output).not.toContain("DO_NOT_DISPLAY_PROMPT");
  });
});
