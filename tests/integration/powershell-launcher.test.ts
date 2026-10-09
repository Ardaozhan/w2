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
      writeFileSync(path.join(w2Home, "dist", "src", "core", "self-update.js"), "// updater test stub\n", "utf8");
      writeFileSync(path.join(w2Home, "dist", "src", "core", "codex-launch.js"), "// test stub\n", "utf8");
      for (const module of ["doctor.js", "brainw2.js", "session.js"]) writeFileSync(path.join(w2Home, "dist", "src", "core", module), "// test stub\n", "utf8");
      cpSync(path.join(repositoryRoot, "scripts", "w2-launcher.ps1"), path.join(scripts, "w2-launcher.ps1"));
      cpSync(path.join(repositoryRoot, "scripts", "install-w2-launcher.ps1"), path.join(scripts, "install-w2-launcher.ps1"));
      cpSync(path.join(repositoryRoot, "scripts", "codex-tui-launcher.mjs"), path.join(scripts, "codex-tui-launcher.mjs"));

      const powershell = String.raw`
$ErrorActionPreference = 'Stop'
$w2Install = $env:W2_TEST_HOME
$testRoot = Split-Path -Parent $w2Install
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
$project = Join-Path $testRoot ("w2 target project with spaces " + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $project -Force | Out-Null
function global:codex {
    $global:CODEX_CALLED = $true
    if ($args.Count -gt 0 -and $args[0] -eq '--version') { "codex-cli $global:W2_INSTALLED_VERSION"; $global:LASTEXITCODE = 0 }
}
function global:pwsh { $global:W2_PWSH_CAPTURE = @($args); $global:W2_INSTALLED_VERSION = $global:W2_LATEST_VERSION; $global:LASTEXITCODE = 0 }
function global:Invoke-RestMethod { param($Uri, $TimeoutSec) [PSCustomObject]@{ tag_name = "rust-v$global:W2_LATEST_VERSION" } }
function global:Read-Host { $global:W2_UPDATE_ANSWER }
function global:node {
    if ($args.Count -gt 0 -and $args[0] -match 'self-update\.js$') {
        $global:W2_UPDATER_CAPTURE = @($args)
        $global:LASTEXITCODE = 0
        return
    }
    $global:W2_CAPTURE = [PSCustomObject]@{ cwd = (Get-Location).ProviderPath; args = @($args); home = $env:W2_HOME; target = $env:W2_PROJECT; active = $env:W2_ACTIVE }
}
$global:W2_INSTALLED_VERSION = '1.2.0'
$global:W2_LATEST_VERSION = '1.2.0'
Push-Location $project
try { $project = (Get-Location).ProviderPath; w2 --version } finally { Pop-Location }
if (!(Test-Path -LiteralPath (Join-Path $project '.git'))) { throw 'W2 did not initialize Git for a new project folder.' }
$newProjectGitRoot = (& git -C $project rev-parse --show-toplevel).Trim()
if ($LASTEXITCODE -ne 0 -or [System.IO.Path]::GetFullPath($newProjectGitRoot) -ne [System.IO.Path]::GetFullPath($project)) { throw "W2 initialized the wrong Git root: [$newProjectGitRoot]" }
& git -C $project rev-parse --verify --quiet HEAD 2>$null
if ($LASTEXITCODE -eq 0) { throw 'W2 should initialize Git without creating a commit.' }
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
$existingParent = Join-Path $testRoot ("w2 existing repository parent " + [guid]::NewGuid().ToString('N'))
$nestedProject = Join-Path $existingParent 'nested project'
New-Item -ItemType Directory -Path $nestedProject -Force | Out-Null
& git -C $existingParent init | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'The test could not initialize its existing parent repository.' }
Push-Location $nestedProject
try { $nestedProject = (Get-Location).ProviderPath; w2 --version } finally { Pop-Location }
if (Test-Path -LiteralPath (Join-Path $nestedProject '.git')) { throw 'W2 created a nested Git repository inside an existing project.' }
$parentGitRoot = (& git -C $nestedProject rev-parse --show-toplevel).Trim()
if ($LASTEXITCODE -ne 0 -or [System.IO.Path]::GetFullPath($parentGitRoot) -ne [System.IO.Path]::GetFullPath($existingParent)) { throw "W2 changed the existing Git root: [$parentGitRoot]" }
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
Test-W2ManualRoute @('trust-checks', 'status')
Test-W2ManualRoute @('doctor')
Test-W2ManualRoute @('version')
Test-W2ManualRoute @('session', 'latest')
w2 update --check
if ($global:W2_UPDATER_CAPTURE[-1] -ne '--check') { throw 'Manual W2 update check was not routed to the release updater.' }
w2 update
if ($global:W2_UPDATER_CAPTURE -contains '--automatic') { throw 'Manual W2 update unexpectedly used the automatic check mode.' }
$global:W2_UPDATER_CAPTURE = @()
Push-Location $project
try { w2 } finally { Pop-Location }
if ($global:W2_UPDATER_CAPTURE[-1] -ne '--automatic') { throw 'Opening the normal W2 TUI did not check for a W2 release.' }
if ($global:W2_CAPTURE.args[0] -ne (Join-Path $w2Install 'scripts\codex-tui-launcher.mjs')) { throw 'Automatic W2 updates changed the Codex TUI launch path.' }
w2 update-codex
if ($global:W2_PWSH_CAPTURE[0] -ne '-NoLogo' -or $global:W2_PWSH_CAPTURE[1] -ne '-NoProfile' -or $global:W2_PWSH_CAPTURE[2] -ne '-NonInteractive' -or $global:W2_PWSH_CAPTURE[3] -ne '-Command') { throw "Codex update did not use an isolated PowerShell 7 process: $($global:W2_PWSH_CAPTURE -join '|')" }
if (!$global:W2_PWSH_CAPTURE[4].Contains('CODEX_NON_INTERACTIVE') -or !$global:W2_PWSH_CAPTURE[4].Contains('https://chatgpt.com/codex/install.ps1')) { throw 'Codex update did not use the official non-interactive installer.' }
$global:W2_INSTALLED_VERSION = '1.2.0'
$global:W2_LATEST_VERSION = '1.3.0'
$global:W2_UPDATE_ANSWER = 'Y'
$global:W2_PWSH_CAPTURE = @()
Push-Location $project
try { w2 --model test-model } finally { Pop-Location }
if ($global:W2_INSTALLED_VERSION -ne $global:W2_LATEST_VERSION) { throw 'W2 did not update Codex through PowerShell 7 before starting the TUI.' }
if (!$global:W2_PWSH_CAPTURE[4].Contains('https://chatgpt.com/codex/install.ps1')) { throw 'The prelaunch update prompt did not invoke the official Codex installer.' }
if ($global:W2_CAPTURE.args[-1] -ne 'test-model') { throw 'Codex arguments were not forwarded after the prelaunch update.' }
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
        env: { ...process.env, W2_TEST_HOME: w2Home, GIT_CEILING_DIRECTORIES: tempRoot },
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
