import { describe, expect, it } from "vitest";
import { hasCompletionClaim, assistantMessagesFromCodexEvents, isCompletionClaim } from "../../benchmarks/completion-claim.mjs";

describe("benchmark completion claim parser", () => {
  it("ignores item.completed lifecycle events without an assistant message", () => {
    expect(hasCompletionClaim('{"type":"item.completed"}')).toBe(false);
  });

  it("recognizes affirmative completion text from an actual assistant message", () => {
    expect(hasCompletionClaim('{"type":"item.completed","item":{"type":"agent_message","text":"Task completed successfully."}}')).toBe(true);
  });

  it("ignores tool and lifecycle text even if it contains completed", () => {
    const events = [
      { type: "item.completed", item: { type: "command_execution", aggregated_output: "task completed successfully" } },
      { type: "turn.completed", status: "completed" },
    ];
    expect(assistantMessagesFromCodexEvents(events)).toEqual([]);
    expect(hasCompletionClaim(events)).toBe(false);
  });

  it("does not count negated completion wording", () => {
    expect(isCompletionClaim("I could not complete the task.")).toBe(false);
  });

  it("recognizes completed implementation with explicit successful verification", () => {
    expect(isCompletionClaim("Implemented slugify(text) in src/slug.js. node verify.mjs passed." )).toBe(true);
    expect(isCompletionClaim("Updated src/math.js. Verification: node verify.mjs — PASS." )).toBe(true);
    expect(isCompletionClaim("Tamamlandı. Doğrulama: node verify.mjs — PASS." )).toBe(true);
    expect(isCompletionClaim("multiply fonksiyonunu düzelttim. node verify.mjs başarıyla çalıştı: PASS." )).toBe(true);
  });

  it("does not mistake an in-progress implementation update for completion", () => {
    expect(isCompletionClaim("Updated the parser. I will run the verifier next." )).toBe(false);
  });

  it("recognizes a Turkish assistant completion backed by its verifier", () => {
    expect(isCompletionClaim("`isoDate` art\u0131k Date girdisini UTC ISO bi\u00E7iminde d\u00F6nd\u00FCr\u00FCyor. `node verify.mjs` ba\u015Far\u0131yla tamamland\u0131: `PASS`." )).toBe(true);
  });

  it("handles persisted W2 adapter output through its original structured event", () => {
    expect(hasCompletionClaim([{ raw: { type: "item.completed", item: { type: "agent_message", text: "The task is complete." } } }])).toBe(true);
  });
});
