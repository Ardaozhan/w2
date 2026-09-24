import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateReceipt } from "../dist/src/core/evidence.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "fixtures", "rate-limit-demo");
const expected = { pass: "PASS", fail: "FAIL", unproven: "UNPROVEN" };
for (const [variant, outcome] of Object.entries(expected)) {
  const receipt = JSON.parse(fs.readFileSync(path.join(root, variant, "run-receipt.json"), "utf8"));
  const rawEvidence = JSON.parse(fs.readFileSync(path.join(root, variant, "raw-evidence.json"), "utf8"));
  validateReceipt(receipt);
  if (receipt.outcome !== outcome) throw new Error(`${variant} expected ${outcome}, got ${receipt.outcome}`);
  if (receipt.agent.execution_mode !== "FAKE_ADAPTER") throw new Error(`${variant} is a synthetic test fixture, not a REAL_CODEX run`);
  if (JSON.stringify(rawEvidence.evidence) !== JSON.stringify(receipt.evidence) || JSON.stringify(rawEvidence.acceptance) !== JSON.stringify(receipt.acceptance)) throw new Error(`${variant} raw evidence differs from its Run Receipt`);
}
console.log("Run Receipt fixture integrity: PASS (synthetic PASS, FAIL, UNPROVEN; excluded from REAL_CODEX evidence)");
