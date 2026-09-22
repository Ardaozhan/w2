import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateReceipt } from "../dist/src/core/evidence.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "fixtures", "rate-limit-demo");
const expected = { pass: "PASS", fail: "FAIL", unproven: "UNPROVEN" };
for (const [variant, outcome] of Object.entries(expected)) {
  const receipt = JSON.parse(fs.readFileSync(path.join(root, variant, "run-receipt.json"), "utf8"));
  validateReceipt(receipt);
  if (receipt.outcome !== outcome) throw new Error(`${variant} expected ${outcome}, got ${receipt.outcome}`);
  if (!fs.existsSync(path.join(root, variant, "raw-evidence.json"))) throw new Error(`${variant} raw evidence missing`);
}
console.log("Phase 02 fixture integrity: PASS (PASS, FAIL, UNPROVEN)");
