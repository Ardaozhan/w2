import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(testDirectory, "..", "..");

describe.runIf(process.platform === "win32")("PowerShell W2 launcher", () => {
  it("opens Codex from an external project and keeps W2 storage separate", () => {
    const tempRoot = mkdtempSync(path.join(os.tmpdir(), "w2-launcher-test-"));
    try {
      const w2Home = path.join(tempRoot, "w2 install with spaces");
      const project = path.join(tempRoot, "some project outside w2");
      const scripts = path.join(w2Home, "scripts");
      mkdirSync(scripts, { recursive: true });
      mkdirSync(path.join(w2Home, "dist", "src"), { recursive: true });
      mkdirSync(path.join(w2Home, "dist", "src", "core"), { recursive: true });
      mkdirSync(project, { recursive: true });
      writeFileSync(path.join(w2Home, "package.json"), JSON.stringify({ name: "w2-test" }), "utf8");
      writeFileSync(path.join(w2Home, "dist", "src", "cli.js"), "// test stub\n", "utf8");
      writeFileSync(path.join(w2Home, "dist", "src", "core", "codex-launch.js"), "// test stub\n", "utf8");
      for (const module of ["doctor.js", "brainw2.js", "session.js"]) writeFileSync(path.join(w2Home, "dist", "src", "core", module), "// test stub\n", "utf8");
      cpSync(path.join(repositoryRoot, "scripts", "w2-launcher.ps1"), path.join(scripts, "w2-launcher.ps1"));
      cpSync(path.join(repositoryRoot, "scripts", "install-w2-launcher.ps1"), path.join(scripts, "install-w2-launcher.ps1"));
      cpSync(path.join(repositoryRoot, "scripts", "codex-tui-launcher.mjs"), path.join(scripts, "codex-tui-launcher.mjs"));

      const powershell = String.raw`
$ErrorActionPreference = 'Stop'
$w2Install = $env:W2_TEST_HOME
$profilePath = Join-Path $env:TEMP 'w2-launcher-profile-test.ps1'
$capturePath = Join-Path $env:TEMP 'w2-launcher-capture-test.json'
$whatIfProfile = Join-Path $env:TEMP 'w2-launcher-whatif\profile.ps1'
[System.IO.File]::WriteAllText($profilePath, ("function unrelated { }" + [Environment]::NewLine), [System.Text.UTF8Encoding]::new($false))
$installer = Join-Path $w2Install 'scripts\install-w2-launcher.ps1'
& $installer -ProfilePath $whatIfProfile -WhatIf
if (Test-Path -LiteralPath $whatIfProfile) { throw 'WhatIf created a PowerShell profile.' }
& $installer -ProfilePath $profilePath
$w2Install = $global:W2_INSTALL_PATH
& $installer -ProfilePath $profilePath
$profileContents = [System.IO.File]::ReadAllText($profilePath)
if ([regex]::Matches($profileContents, [regex]::Escape('# >>> W2 LAUNCHER >>>')).Count -ne 1) { throw 'W2 profile installation was not idempotent.' }
if (!$profileContents.Contains('function unrelated')) { throw 'Unrelated profile content was changed.' }
$project = Join-Path $env:TEMP 'w2 target project with spaces'
New-Item -ItemType Directory -Path $project -Force | Out-Null
function global:codex { $global:CODEX_CALLED = $true }
function global:node { $global:W2_CAPTURE = [PSCustomObject]@{ cwd = (Get-Location).ProviderPath; args = @($args); home = $env:W2_HOME; target = $env:W2_PROJECT; active = $env:W2_ACTIVE } }
Push-Location $project
try { $project = (Get-Location).ProviderPath; w2 --version } finally { Pop-Location }
if ($global:W2_CAPTURE.cwd -ne $project) { throw 'Codex was not launched from the target project.' }
if ($global:W2_CAPTURE.target -ne $project) { throw 'W2 target path did not remain the target project.' }
if ($global:W2_CAPTURE.home -ne $w2Install) { throw 'W2 install path was mixed with the target project.' }
if ($global:W2_CAPTURE.active -ne '1') { throw 'W2 mode was not enabled for the launch.' }
if ($global:W2_CAPTURE.args[0] -ne (Join-Path $w2Install 'scripts\codex-tui-launcher.mjs')) { throw 'W2 did not hand off to its minimal Codex process adapter.' }
$homeIndex = [Array]::IndexOf($global:W2_CAPTURE.args, '--w2-home')
if ($homeIndex -lt 0 -or $global:W2_CAPTURE.args[$homeIndex + 1] -ne $w2Install) { throw 'W2 installation path was not passed to the adapter.' }
$forwardIndex = [Array]::IndexOf($global:W2_CAPTURE.args, '--forward-count')
if ($forwardIndex -lt 0 -or $global:W2_CAPTURE.args[$forwardIndex + 1] -ne '1' -or $global:W2_CAPTURE.args[$forwardIndex + 2] -ne '--version') { throw "Normal Codex arguments were not forwarded: $($global:W2_CAPTURE.args -join '|')" }
if (Test-Path -LiteralPath (Join-Path $project '.w2')) { throw 'The launcher wrote W2 runtime state into the target project.' }
function Test-W2ManualRoute([string[]]$manual) {
    Push-Location $project
    try { w2 @manual } finally { Pop-Location }
    if ($global:W2_CAPTURE.cwd -ne $project) { throw "Manual W2 CLI routing changed the current directory: expected=[$project] actual=[$($global:W2_CAPTURE.cwd)]" }
    if ($global:W2_CAPTURE.home -ne $w2Install) { throw 'Manual W2 routing did not set W2_HOME.' }
    if ($global:W2_CAPTURE.args[0] -ne (Join-Path $w2Install 'dist\src\cli.js')) { throw 'Manual W2 command did not run the W2 CLI.' }
    if (($global:W2_CAPTURE.args[1..($global:W2_CAPTURE.args.Length - 1)] -join '|') -ne ($manual -join '|')) { throw "Manual W2 arguments were not preserved: $($global:W2_CAPTURE.args -join '|')" }
}
Test-W2ManualRoute @('run', 'task.json')
Test-W2ManualRoute @('receipt', 'receipt-id')
Test-W2ManualRoute @('doctor')
Test-W2ManualRoute @('version')
Test-W2ManualRoute @('session', 'latest')
codex --version
if (!$global:CODEX_CALLED) { throw 'The normal codex command was changed by the W2 launcher.' }
[System.IO.File]::WriteAllText($capturePath, ($global:W2_CAPTURE | ConvertTo-Json -Depth 5), [System.Text.UTF8Encoding]::new($false))
& $installer -ProfilePath $profilePath -Uninstall
if ([System.IO.File]::ReadAllText($profilePath).Contains('# >>> W2 LAUNCHER >>>')) { throw 'W2 uninstall did not remove only its marked block.' }
if (![System.IO.File]::ReadAllText($profilePath).Contains('function unrelated')) { throw 'W2 uninstall removed unrelated profile content.' }
Remove-Item $profilePath, $capturePath, $project -Recurse -Force
`;
      const result = spawnSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", powershell], {
        encoding: "utf8",
        env: { ...process.env, W2_TEST_HOME: w2Home },
        windowsHide: true,
      });
      expect(result.error?.message).toBeUndefined();
      expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
      expect(existsSync(path.join(project, ".w2"))).toBe(false);
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});
