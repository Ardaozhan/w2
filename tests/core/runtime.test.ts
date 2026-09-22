import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ToolRuntime } from "../../src/core/runtime.js";

describe("tool runtime", () => {
  it("records filesystem and shell failures centrally", async () => {
    const directory = mkdtempSync(path.join(os.tmpdir(), "w2-runtime-"));
    const runtime = new ToolRuntime(directory);
    await runtime.writeFile("sample.txt", "ok");
    await expect(runtime.readFile("../outside.txt")).rejects.toThrow(/escapes workspace/);
    const result = await runtime.shell(process.platform === "win32" ? "cmd.exe" : "/bin/sh", process.platform === "win32" ? ["/c", "exit 7"] : ["-c", "exit 7"]);
    expect(result.exitCode).toBe(7);
    expect(runtime.calls.some((call) => call.error)).toBe(true);
    rmSync(directory, { recursive: true, force: true });
  });
});
