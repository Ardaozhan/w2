import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { assertModelPromptIsolation, assertNoAncestorContext, assertNoUserHomeLeak, classifyProfileReference, sanitizeRunValue } from "../../benchmarks/codex-isolation.mjs";

function profileFixture(username: string): string {
  const root = path.parse(os.tmpdir()).root;
  const profileRoot = process.platform === "win32" || process.platform === "darwin" ? "Users" : "home";
  return path.join(root, profileRoot, username);
}

describe("benchmark context isolation helpers", () => {
  const profile = profileFixture("w2-test-user");
  const unrelatedProfile = profileFixture("w2-other-user");

  it("detects native profile paths and leaves unrelated paths excluded", () => {
    const profileSkill = path.join(profile, ".agents", "skills", "private", "SKILL.md");
    const globalCodexMemory = path.join(unrelatedProfile, ".codex", "memories", "note.md");
    const unrelatedPath = path.join(os.tmpdir(), "w2-unrelated", "settings.json");

    expect(() => assertNoUserHomeLeak(profileSkill, profile)).toThrow(/global user profile/);
    expect(() => assertNoUserHomeLeak(globalCodexMemory, profile)).toThrow(/global Codex home/);
    expect(() => assertNoUserHomeLeak(unrelatedPath, profile)).not.toThrow();
    expect(() => assertNoUserHomeLeak("<CODEX_RUNTIME>\\codex.exe", profile)).not.toThrow();
    expect(classifyProfileReference(path.join(profile, ".codex", "memories", "entry.md"), profile)).toBe("GLOBAL_CODEX_HOME");
    expect(classifyProfileReference(path.join(profile, "AppData", "Local", "Programs", "OpenAI", "Codex", "bin", "codex.exe"), profile)).toBe("CODEX_RUNTIME_PATH");
    expect(classifyProfileReference(unrelatedPath, profile)).toBe("NONE");
    expect(classifyProfileReference("<CODEX_RUNTIME>\\codex.exe", profile)).toBe("NONE");
  });

  it("sanitizes normal and JSON-escaped native machine paths", () => {
    const machinePath = path.join(os.tmpdir(), "w2-benchmark-isolation", "workspaces", "raw", "fixture");
    const value = { path: machinePath, event: `{"cwd":"${machinePath.replace(/\\/g, "\\\\")}"}` };
    const sanitized = sanitizeRunValue(value, [[machinePath, "<WORKSPACE>"]]);
    expect(sanitized).toEqual({ path: "<WORKSPACE>", event: '{"cwd":"<WORKSPACE>"}' });
  });

  it("detects profile and host repository paths in the model-visible prompt", () => {
    const repositoryRoot = path.join(profile, "w2");
    expect(assertModelPromptIsolation("Task: implement a rate limiter", profile, repositoryRoot)).toMatchObject({
      status: "PASS",
      global_profile_references: 0,
      host_repository_references: 0,
    });
    expect(() => assertModelPromptIsolation(`Loaded skill from ${path.join(profile, ".agents", "skills", "private", "SKILL.md")}`, profile, repositoryRoot)).toThrow(/USER_PROFILE_PATH/);
    expect(() => assertModelPromptIsolation(`Host path ${path.join(unrelatedProfile, "w2", "README.md")}`, profile, path.join(unrelatedProfile, "w2"))).toThrow(/host repository/);
  });

  it("accepts an isolated workspace and rejects inherited ancestor instructions", () => {
    const tempParent = process.platform === "win32"
      ? process.env.PUBLIC ?? path.join(path.parse(os.tmpdir()).root, "Users", "Public")
      : os.tmpdir();
    const root = mkdtempSync(path.join(tempParent, "w2-isolation-ancestry-"));
    const workspace = path.join(root, "nested", "workspace");
    mkdirSync(workspace, { recursive: true });
    try {
      expect(() => assertNoAncestorContext(workspace)).not.toThrow();
      writeFileSync(path.join(root, "AGENTS.md"), "inherited instructions", "utf8");
      expect(() => assertNoAncestorContext(workspace)).toThrow(/inherited instruction\/config context/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
