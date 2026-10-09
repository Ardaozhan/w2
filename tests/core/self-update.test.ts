import { describe, expect, it } from "vitest";
import { compareStableVersions, isOfficialRepository, parseStableRelease } from "../../src/core/self-update.js";

describe("W2 stable self-updater contract", () => {
  it("compares numeric semantic version components", () => {
    expect(compareStableVersions("0.10.0", "0.9.9")).toBeGreaterThan(0);
    expect(compareStableVersions("1.2.3", "1.2.3")).toBe(0);
    expect(compareStableVersions("1.2.2", "1.2.3")).toBeLessThan(0);
    expect(() => compareStableVersions("1.2", "1.2.0")).toThrow("stable semantic version");
  });

  it("accepts only the official repository's HTTPS and SSH remotes", () => {
    expect(isOfficialRepository("https://github.com/Ardaozhan/w2.git")).toBe(true);
    expect(isOfficialRepository(["git", "@github.com:Ardaozhan/w2.git"].join(""))).toBe(true);
    expect(isOfficialRepository(["ssh://git", "@github.com/Ardaozhan/w2.git"].join(""))).toBe(true);
    expect(isOfficialRepository("https://github.com/attacker/w2.git")).toBe(false);
    expect(isOfficialRepository("https://github.com.evil.example/Ardaozhan/w2.git")).toBe(false);
    expect(isOfficialRepository(["https://user:secret", "@github.com/Ardaozhan/w2.git"].join(""))).toBe(false);
  });

  it("accepts stable release tags and rejects draft, prerelease, or unversioned releases", () => {
    expect(parseStableRelease({ tag_name: "v0.2.2", draft: false, prerelease: false })).toEqual({ tag: "v0.2.2", version: "0.2.2" });
    expect(() => parseStableRelease({ tag_name: "v0.2.2-rc.1", prerelease: true })).toThrow("not a stable W2 release");
    expect(() => parseStableRelease({ tag_name: "v0.2.2", draft: true })).toThrow("not a stable W2 release");
    expect(() => parseStableRelease({ tag_name: "main" })).toThrow("Unsupported W2 release tag");
  });
});
