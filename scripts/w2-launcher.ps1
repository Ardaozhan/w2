$global:W2_INSTALL_PATH = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path

function global:w2 {
    $project = (Get-Location).ProviderPath
    $w2Home = $global:W2_INSTALL_PATH
    $packagePath = Join-Path $w2Home "package.json"
    if (!(Test-Path -LiteralPath $packagePath)) {
        Write-Host "W2 installation is not available at $w2Home" -ForegroundColor Red
        return
    }
    $codexCommand = Get-Command codex -ErrorAction SilentlyContinue
    if (!$codexCommand) {
        Write-Host "Codex CLI was not found on PATH." -ForegroundColor Red
        return
    }
    if (!(Get-Command node -ErrorAction SilentlyContinue)) {
        Write-Host "Node.js was not found on PATH." -ForegroundColor Red
        return
    }

    $cliPath = Join-Path $w2Home "dist\src\cli.js"
    $launchModulePath = Join-Path $w2Home "dist\src\core\codex-launch.js"
    if (!(Test-Path -LiteralPath $cliPath) -or !(Test-Path -LiteralPath $launchModulePath)) {
        if (!(Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
            Write-Host "W2 is not built and npm.cmd was not found. Run npm ci and npm run build in $w2Home." -ForegroundColor Red
            return
        }
        Write-Host "Building W2 in $w2Home..." -ForegroundColor DarkCyan
        Push-Location $w2Home
        try {
            & npm.cmd run build
            if ($LASTEXITCODE -ne 0) {
                Write-Host "W2 build failed with exit code $LASTEXITCODE." -ForegroundColor Red
                return
            }
        }
        finally {
            Pop-Location
        }
    }

    $launcherPath = Join-Path $w2Home "scripts\codex-tui-launcher.mjs"
    if (!(Test-Path -LiteralPath $launcherPath)) {
        Write-Host "W2's Codex launcher is missing at $launcherPath" -ForegroundColor Red
        return
    }
    $codexExecutable = if ($codexCommand.CommandType -eq "Application" -and $codexCommand.Source) { $codexCommand.Source } else { "codex" }

    $names = @("W2_HOME", "W2_ACTIVE", "W2_PROJECT")
    $previous = @{}
    foreach ($name in $names) {
        $item = Get-Item -LiteralPath "Env:$name" -ErrorAction SilentlyContinue
        $previous[$name] = if ($null -eq $item) { $null } else { $item.Value }
    }
    $env:W2_HOME = $w2Home
    $env:W2_ACTIVE = "1"
    $env:W2_PROJECT = $project

    Write-Host "W2 Codex" -ForegroundColor Cyan
    Write-Host "Project: $project"

    try {
        $forwardArgs = @($args)
        & node $launcherPath --w2-home $w2Home --codex $codexExecutable --forward-count $forwardArgs.Count @forwardArgs
    }
    finally {
        foreach ($name in $names) {
            if ($null -eq $previous[$name]) {
                Remove-Item -LiteralPath "Env:$name" -ErrorAction SilentlyContinue
            }
            else {
                Set-Item -LiteralPath "Env:$name" -Value $previous[$name]
            }
        }
    }
}
