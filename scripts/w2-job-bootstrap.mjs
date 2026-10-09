import { spawn } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";

const [payloadBase64, readyPath, gatePath] = process.argv.slice(2);
if (!payloadBase64 || !readyPath || !gatePath) {
  process.stderr.write("W2 job bootstrap received an incomplete launch contract.\n");
  process.exit(1);
}

const payload = JSON.parse(Buffer.from(payloadBase64, "base64").toString("utf8"));
writeFileSync(readyPath, "ready", { flag: "wx" });

while (!existsSync(gatePath)) {
  if (Date.now() >= payload.deadlineEpochMs) {
    process.stderr.write("W2_JOB_TIMED_OUT\n");
    process.exit(124);
  }
  await delay(10);
}

const environment = Object.fromEntries(payload.environment.map((entry) => {
  const separator = entry.indexOf("=");
  return [entry.slice(0, separator), entry.slice(separator + 1)];
}));

const child = spawn(payload.file, payload.args, {
  cwd: payload.cwd,
  env: environment,
  stdio: "inherit",
  windowsHide: true,
});

child.once("error", (error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
child.once("close", (code) => {
  process.exitCode = code ?? 1;
});
