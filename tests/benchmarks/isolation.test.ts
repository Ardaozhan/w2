import { describe, expect, it } from "vitest";
import { assertModelPromptIsolation, assertNoUserHomeLeak, classifyProfileReference, sanitizeRunValue } from "../../benchmarks/codex-isolation.mjs";

describe("benchmark context isolation helpers", () => {
  it("rejects user-profile and global Codex-home paths without exposing the path", () => {
    expect(() => assertNoUserHomeLeak("C:\\Users\\test-user\\.codex\\memories\\note.md", "C:\\Users\\test-user")).toThrow(/global user profile/);
    expect(() => assertNoUserHomeLeak("/home/test-user/.codex/prompts/custom.md", "C:\\Users\\test-user")).toThrow(/global Codex home/);
    expect(() => assertNoUserHomeLeak("<CODEX_RUNTIME>\\codex.exe", "C:\\Users\\test-user")).not.toThrow();
  });

  it("sanitizes normal and JSON-escaped machine paths", () => {
    const machinePath = "C:\\w2-benchmark-isolation\\workspaces\\raw\\fixture";
    const value = { path: machinePath, event: `{"cwd":"${machinePath.replace(/\\/g, "\\\\")}"}` };
    const sanitized = sanitizeRunValue(value, [[machinePath, "<WORKSPACE>"]]);
    expect(sanitized).toEqual({ path: "<WORKSPACE>", event: '{"cwd":"<WORKSPACE>"}' });
  });

  it("classifies profile references without returning path contents", () => {
    expect(classifyProfileReference("C:\\Users\\test-user\\.codex\\memories\\entry.md", "C:\\Users\\test-user")).toBe("GLOBAL_CODEX_HOME");
    expect(classifyProfileReference("C:\\Users\\test-user\\AppData\\Local\\Programs\\OpenAI\\Codex\\bin\\codex.exe", "C:\\Users\\test-user")).toBe("CODEX_RUNTIME_PATH");
    expect(classifyProfileReference("<CODEX_RUNTIME>\\codex.exe", "C:\\Users\\test-user")).toBe("NONE");
  });

  it("validates the actual model-visible prompt against user skills and host repository context", () => {
    expect(assertModelPromptIsolation("Task: implement a rate limiter", "C:\\Users\\test-user", "C:\\Users\\test-user\\w2")).toMatchObject({
      status: "PASS",
      global_profile_references: 0,
      host_repository_references: 0,
    });
    expect(() => assertModelPromptIsolation("Loaded skill from C:\\Users\\test-user\\.agents\\skills\\private\\SKILL.md", "C:\\Users\\test-user", "C:\\Users\\test-user\\w2")).toThrow(/USER_PROFILE_PATH/);
    expect(() => assertModelPromptIsolation("Host path C:\\Users\\benchmark-host\\w2\\README.md", "C:\\Users\\test-user", "C:\\Users\\benchmark-host\\w2")).toThrow(/host repository/);
  });
});
