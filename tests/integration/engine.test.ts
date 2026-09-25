import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { AgentAdapter, AgentStartInput } from "../../src/core/agent.js";
import { RunEngine } from "../../src/core/engine.js";
import { buildRunReceipt } from "../../src/core/evidence.js";
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
    task_id: `task-${Math.random()}`, title: "test", goal: "change fixture", constraints: [], allowed_paths: ["."], acceptance_criteria: [{ id: "AC-01", statement: "works", required: true, verification_refs: ["V1"] }],
    verification_commands: [{ id: "V1", name: "custom", category: "custom", command }], workspace,
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

  it("classifies a Codex timeout as infrastructure ERROR", async () => {
    const workspace = gitWorkspace();
    class TimeoutAdapter extends FakeAdapter {
      async startRun(): Promise<AgentRunResult> { return { exit_code: 124, outputs: [], tool_calls: [], error: "timed out", infrastructure_failure: true }; }
    }
    const adapter: AgentAdapter = new TimeoutAdapter();
    const engine = new RunEngine({ databasePath: path.join(workspace, "run.sqlite"), adapter });
    const result = await engine.run(task(workspace));
    expect(result.status).toBe("ERROR");
    expect(result.error).toContain("timed out");
    engine.close();
    rmSync(workspace, { recursive: true, force: true });
  });

  it("excludes W2 SQLite runtime files from the product diff", async () => {
    const workspace = gitWorkspace();
    const database = path.join(workspace, "w2-run.sqlite");
    const engine = new RunEngine({ databasePath: database, adapter: new FakeAdapter() });
    const result = await engine.run(task(workspace));
    expect(result.diff?.changed_files).toContain("changed.txt");
    expect(result.diff?.changed_files.some((file) => file.startsWith("w2-run.sqlite"))).toBe(false);
    engine.close();
    rmSync(workspace, { recursive: true, force: true });
  });

  it("runs the product path and automatically maps passing verifier evidence to PASS", async () => {
    const workspace = gitWorkspace();
    const engine = new RunEngine({ databasePath: path.join(workspace, "run.sqlite"), adapter: new FakeAdapter() });
    const run = await engine.run(task(workspace));
    const receipt = buildRunReceipt(engine.store, run.run_id);
    expect(receipt.acceptance).toMatchObject([{ criterion_id: "AC-01", status: "PASS", evidence_ids: [expect.any(String)] }]);
    expect(receipt.outcome).toBe("PASS");
    expect(receipt.verification.results[0]?.verifier_id).toBe("V1");
    engine.close();
    rmSync(workspace, { recursive: true, force: true });
  });

  it("returns UNPROVEN when one criterion has no verifier mapping", async () => {
    const workspace = gitWorkspace();
    const engine = new RunEngine({ databasePath: path.join(workspace, "run.sqlite"), adapter: new FakeAdapter() });
    const definition = task(workspace);
    definition.acceptance_criteria.push({ id: "AC-02", statement: "also works", required: true, verification_refs: [] });
    const run = await engine.run(definition);
    const receipt = buildRunReceipt(engine.store, run.run_id);
    expect(receipt.acceptance.map(({ criterion_id, status }) => [criterion_id, status])).toEqual([["AC-01", "PASS"], ["AC-02", "UNPROVEN"]]);
    expect(receipt.outcome).toBe("UNPROVEN");
    engine.close();
    rmSync(workspace, { recursive: true, force: true });
  });

  it("returns FAIL when a mapped deterministic verifier fails", async () => {
    const workspace = gitWorkspace();
    const engine = new RunEngine({ databasePath: path.join(workspace, "run.sqlite"), adapter: new FakeAdapter() });
    const run = await engine.run(task(workspace, "exit /b 4"));
    const receipt = buildRunReceipt(engine.store, run.run_id);
    expect(receipt.acceptance[0]?.status).toBe("FAIL");
    expect(receipt.outcome).toBe("FAIL");
    engine.close();
    rmSync(workspace, { recursive: true, force: true });
  });

  it("requires every referenced verifier to pass", async () => {
    const workspace = gitWorkspace();
    const engine = new RunEngine({ databasePath: path.join(workspace, "run.sqlite"), adapter: new FakeAdapter() });
    const definition = task(workspace);
    definition.acceptance_criteria[0]!.verification_refs = ["V1", "V2"];
    definition.verification_commands.push({ id: "V2", name: "second", category: "custom", command: "exit /b 0" });
    const run = await engine.run(definition);
    expect(buildRunReceipt(engine.store, run.run_id).outcome).toBe("PASS");
    engine.close();

    const failing = new RunEngine({ databasePath: path.join(workspace, "failed.sqlite"), adapter: new FakeAdapter() });
    definition.task_id = "multi-fail";
    definition.verification_commands[1]!.command = "exit /b 4";
    const failedRun = await failing.run(definition);
    const failedReceipt = buildRunReceipt(failing.store, failedRun.run_id);
    expect(failedReceipt.acceptance[0]?.status).toBe("FAIL");
    expect(failedReceipt.outcome).toBe("FAIL");
    failing.close();
    rmSync(workspace, { recursive: true, force: true });
  }, 15_000);

  it("does not turn an agent completion claim into evidence", async () => {
    const workspace = gitWorkspace();
    const engine = new RunEngine({ databasePath: path.join(workspace, "run.sqlite"), adapter: new FakeAdapter() });
    const definition = task(workspace);
    definition.acceptance_criteria[0]!.verification_refs = [];
    const run = await engine.run(definition);
    const receipt = buildRunReceipt(engine.store, run.run_id);
    expect(receipt.acceptance[0]?.status).toBe("UNPROVEN");
    expect(receipt.outcome).toBe("UNPROVEN");
    engine.close();
    rmSync(workspace, { recursive: true, force: true });
  }, 15_000);
});
