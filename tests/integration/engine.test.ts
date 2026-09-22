import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { AgentAdapter, AgentStartInput } from "../../src/core/agent.js";
import { RunEngine } from "../../src/core/engine.js";
import type { AgentOutput, AgentRunResult, TaskDefinition } from "../../src/core/types.js";

class FakeAdapter implements AgentAdapter {
  readonly provider = "codex" as const;
  constructor(private readonly fail = false) {}
  sendTask(task: TaskDefinition): string { return task.goal; }
  receiveAction(): undefined { return undefined; }
  receiveOutput(raw: unknown): AgentOutput { return { kind: "fake", raw }; }
  cancel(): void {}
  async startRun(input: AgentStartInput): Promise<AgentRunResult> {
    if (this.fail) return { exit_code: 2, outputs: [], tool_calls: [], error: "agent failed" };
    writeFileSync(path.join(input.workspace, "changed.txt"), "changed", "utf8");
    return { exit_code: 0, outputs: [{ kind: "message", text: "done", raw: { done: true } }], tool_calls: [] };
  }
}

function task(workspace: string, command = "exit /b 0"): TaskDefinition {
  return {
    task_id: `task-${Math.random()}`, title: "test", goal: "change fixture", constraints: [], allowed_paths: ["."], acceptance_criteria: ["works"],
    verification_commands: [{ name: "custom", category: "custom", command }], workspace,
  };
}

function gitWorkspace(): string {
  const directory = mkdtempSync(path.join(os.tmpdir(), "w2-engine-"));
  execFileSync("git", ["init"], { cwd: directory, stdio: "ignore" });
  writeFileSync(path.join(directory, "baseline.txt"), "baseline", "utf8");
  execFileSync("git", ["add", "."], { cwd: directory, stdio: "ignore" });
  execFileSync("git", ["-c", "user.name=W2", "-c", "user.email=w2@example.invalid", "commit", "-m", "baseline"], { cwd: directory, stdio: "ignore" });
  return directory;
}

describe("run engine", () => {
  it("persists a complete run and diff", async () => {
    const workspace = gitWorkspace();
    const database = path.join(workspace, "run.sqlite");
    const engine = new RunEngine({ databasePath: database, adapter: new FakeAdapter() });
    const result = await engine.run(task(workspace));
    expect(result.status).toBe("COMPLETED");
    expect(result.diff?.changed_files).toContain("changed.txt");
    expect(engine.store.getEvents(result.run_id).map((event) => event.sequence)).toEqual(expect.arrayContaining([1, 2, 3]));
    engine.close();
    rmSync(workspace, { recursive: true, force: true });
  });

  it("cannot represent agent or verification failure as success", async () => {
    const workspace = gitWorkspace();
    const database = path.join(workspace, "run.sqlite");
    const failedAgent = new RunEngine({ databasePath: database, adapter: new FakeAdapter(true) });
    expect((await failedAgent.run(task(workspace))).status).toBe("FAILED");
    failedAgent.close();
    const failedVerification = new RunEngine({ databasePath: database, adapter: new FakeAdapter() });
    const result = await failedVerification.run(task(workspace, "exit /b 4"));
    expect(result.status).toBe("FAILED");
    expect(result.verification_results[0]?.exit_code).toBe(4);
    failedVerification.close();
    rmSync(workspace, { recursive: true, force: true });
  });
});
