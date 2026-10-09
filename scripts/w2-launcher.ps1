$global:W2_INSTALL_PATH = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path

function global:w2 {
    $project = (Get-Location).ProviderPath
    $w2Home = $global:W2_INSTALL_PATH
    $requestedCommand = if ($args.Count -gt 0) { [string]$args[0] } else { "" }

    if ($requestedCommand -eq "update-codex") {
        $pwshCommand = Get-Command pwsh -ErrorAction SilentlyContinue
        if (!$pwshCommand) {
            Write-Host "PowerShell 7 (pwsh) was not found on PATH. Install PowerShell 7, then run 'w2 update-codex' again." -ForegroundColor Red
            return
        }

        $installerCommand = '$env:CODEX_NON_INTERACTIVE = ''1''; irm https://chatgpt.com/codex/install.ps1 | iex'
        $pwshExecutable = if ($pwshCommand.CommandType -eq "Application" -and $pwshCommand.Source) { $pwshCommand.Source } else { $pwshCommand.Name }
        Write-Host "Updating Codex with the official installer through PowerShell 7..." -ForegroundColor DarkCyan
        & $pwshExecutable -NoLogo -NoProfile -NonInteractive -Command $installerCommand
        if ($LASTEXITCODE -ne 0) {
            Write-Host "Codex update failed with exit code $LASTEXITCODE." -ForegroundColor Red
        }
        return
    }

    $packagePath = Join-Path $w2Home "package.json"
    if (!(Test-Path -LiteralPath $packagePath)) {
        Write-Host "W2 installation is not available at $w2Home" -ForegroundColor Red
        return
    }
    $cliPath = Join-Path $w2Home "dist\src\cli.js"
    $updaterPath = Join-Path $w2Home "dist\src\core\self-update.js"
    $launchModulePath = Join-Path $w2Home "dist\src\core\codex-launch.js"
    $requiredBuildFiles = @(
        $cliPath,
        $updaterPath,
        $launchModulePath,
        (Join-Path $w2Home "dist\src\core\doctor.js"),
        (Join-Path $w2Home "dist\src\core\brainw2.js"),
        (Join-Path $w2Home "dist\src\core\session.js")
    )
    $nodeCommand = Get-Command node -ErrorAction SilentlyContinue
    $needsBuild = $requiredBuildFiles.Where({ !(Test-Path -LiteralPath $_) }).Count -gt 0
    if ($needsBuild) {
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

    if (!$nodeCommand) {
        Write-Host "Node.js was not found on PATH." -ForegroundColor Red
        return
    }

    if ($requestedCommand -eq "update") {
        if ($args.Count -gt 2 -or ($args.Count -eq 2 -and $args[1] -ne "--check")) {
            Write-Host "Usage: w2 update [--check]" -ForegroundColor Red
            return
        }
        $updateArguments = @($updaterPath, "--w2-home", $w2Home)
        if ($args.Count -eq 2) { $updateArguments += "--check" }
        & node @updateArguments
        return
    }

    if ($args.Count -eq 0) {
        & node $updaterPath --w2-home $w2Home --automatic
        if ($LASTEXITCODE -eq 2) {
            Write-Host "W2 could not safely recover its installation; Codex was not started." -ForegroundColor Red
            return
        }
        if ($LASTEXITCODE -ne 0) {
            Write-Host "W2 automatic update check failed; continuing with the installed version." -ForegroundColor DarkYellow
        }
    }

    if ($requestedCommand -eq "claude") {
        $claudeBuildFiles = @(
            (Join-Path $w2Home "dist\src\core\claude-code.js"),
            (Join-Path $w2Home "dist\src\core\claude-launch.js")
        )
        if ($claudeBuildFiles.Where({ !(Test-Path -LiteralPath $_) }).Count -gt 0) {
            if (!(Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
                Write-Host "W2 Claude integration is not built and npm.cmd was not found. Run npm run build in $w2Home." -ForegroundColor Red
                return
            }
            Write-Host "Building W2 Claude integration in $w2Home..." -ForegroundColor DarkCyan
            Push-Location $w2Home
            try {
                & npm.cmd run build
                if ($LASTEXITCODE -ne 0) {
                    Write-Host "W2 Claude build failed with exit code $LASTEXITCODE." -ForegroundColor Red
                    return
                }
            }
            finally {
                Pop-Location
            }
        }
        $claudeCommand = Get-Command claude -ErrorAction SilentlyContinue
        if (!$claudeCommand) {
            Write-Host "Claude Code CLI was not found on PATH." -ForegroundColor Red
            return
        }
        $pluginManifest = Join-Path $w2Home ".claude-plugin\plugin.json"
        if (!(Test-Path -LiteralPath $pluginManifest)) {
            Write-Host "W2's Claude Code plugin manifest is missing at $pluginManifest" -ForegroundColor Red
            return
        }
        $forwardArgs = @($args | Select-Object -Skip 1)
        Write-Host "W2 Claude Code" -ForegroundColor Cyan
        Write-Host "Project: $project"
        & $claudeCommand.Source --plugin-dir $w2Home @forwardArgs
        return
    }
    if ($requestedCommand -in @("run", "receipt", "trust-checks", "doctor", "version", "session")) {
        $manualArgs = @($args)
        $previousHome = Get-Item -LiteralPath Env:W2_HOME -ErrorAction SilentlyContinue
        $env:W2_HOME = $w2Home
        try {
            & node $cliPath @manualArgs
        }
        finally {
            if ($null -eq $previousHome) { Remove-Item -LiteralPath Env:W2_HOME -ErrorAction SilentlyContinue }
            else { Set-Item -LiteralPath Env:W2_HOME -Value $previousHome.Value }
        }
        return
    }

    $codexCommand = Get-Command codex -ErrorAction SilentlyContinue
    if (!$codexCommand) {
        Write-Host "Codex CLI was not found on PATH." -ForegroundColor Red
        return
    }

    $codexExecutable = if ($codexCommand.CommandType -eq "Application" -and $codexCommand.Source) { $codexCommand.Source } else { "codex" }
    try {
        $installedVersionOutput = @(& $codexExecutable --version 2>$null) -join " "
        $installedVersionMatch = [regex]::Match($installedVersionOutput, '(?<!\d)(\d+\.\d+\.\d+)(?!\d)')
        if ($LASTEXITCODE -eq 0 -and $installedVersionMatch.Success) {
            $releaseMetadata = Invoke-RestMethod -Uri "https://releases.openai.com/codex/channels/latest" -TimeoutSec 10
            $latestVersionMatch = [regex]::Match([string]$releaseMetadata.tag_name, '(?<!\d)(\d+\.\d+\.\d+)(?!\d)')
            if ($latestVersionMatch.Success) {
                $installedVersion = [version]::Parse($installedVersionMatch.Groups[1].Value)
                $latestVersion = [version]::Parse($latestVersionMatch.Groups[1].Value)
                if ($latestVersion -gt $installedVersion) {
                    $answer = Read-Host "Codex update available ($installedVersion -> $latestVersion). Update before starting W2? [Y/n]"
                    if ($answer -notmatch '^(?i:n|no)$') {
                        $pwshCommand = Get-Command pwsh -ErrorAction SilentlyContinue
                        if (!$pwshCommand) {
                            Write-Host "PowerShell 7 (pwsh) was not found. Install it or run 'w2 update-codex' after it is available." -ForegroundColor Red
                            return
                        }

                        $installerCommand = '$env:CODEX_NON_INTERACTIVE = ''1''; irm https://chatgpt.com/codex/install.ps1 | iex'
                        $pwshExecutable = if ($pwshCommand.CommandType -eq "Application" -and $pwshCommand.Source) { $pwshCommand.Source } else { $pwshCommand.Name }
                        Write-Host "Updating Codex with the official installer through PowerShell 7..." -ForegroundColor DarkCyan
                        & $pwshExecutable -NoLogo -NoProfile -NonInteractive -Command $installerCommand
                        if ($LASTEXITCODE -ne 0) {
                            Write-Host "Codex update failed with exit code $LASTEXITCODE; W2 did not start the outdated CLI." -ForegroundColor Red
                            return
                        }

                        $updatedVersionOutput = @(& $codexExecutable --version 2>$null) -join " "
                        $updatedVersionMatch = [regex]::Match($updatedVersionOutput, '(?<!\d)(\d+\.\d+\.\d+)(?!\d)')
                        if ($LASTEXITCODE -ne 0 -or !$updatedVersionMatch.Success -or [version]::Parse($updatedVersionMatch.Groups[1].Value) -lt $latestVersion) {
                            Write-Host "Codex installer completed, but the selected Codex command is still below $latestVersion. Check PATH and the active Codex installation." -ForegroundColor Red
                            return
                        }
                    }
                }
            }
        }
    }
    catch {
        Write-Host "Codex update check could not reach release metadata; continuing without an update check." -ForegroundColor DarkYellow
    }

    $launcherPath = Join-Path $w2Home "scripts\codex-tui-launcher.mjs"
    if (!(Test-Path -LiteralPath $launcherPath)) {
        Write-Host "W2's Codex launcher is missing at $launcherPath" -ForegroundColor Red
        return
    }

    $gitCommand = Get-Command git -ErrorAction SilentlyContinue
    if (!$gitCommand) {
        Write-Host "Git was not found on PATH. W2 needs Git to capture project changes." -ForegroundColor Red
        return
    }

    $invokeW2Git = {
        param([string[]]$Arguments)
        $previousPreference = $ErrorActionPreference
        $output = @()
        $exitCode = 1
        try {
            $ErrorActionPreference = "Continue"
            $output = @(& git @Arguments 2>&1)
            $exitCode = $LASTEXITCODE
        }
        catch {
            $output += $_.Exception.Message
            if ($LASTEXITCODE -is [int] -and $LASTEXITCODE -ne 0) { $exitCode = $LASTEXITCODE }
        }
        finally {
            $ErrorActionPreference = $previousPreference
        }
        [PSCustomObject]@{ ExitCode = $exitCode; Output = @($output) }
    }

    $gitProbe = & $invokeW2Git -Arguments @("-C", $project, "rev-parse", "--show-toplevel")
    if ($gitProbe.ExitCode -eq 0) {
        $gitRoot = [System.IO.Path]::GetFullPath(($gitProbe.Output -join [Environment]::NewLine).Trim())
    }
    else {
        $cursor = Get-Item -LiteralPath $project
        $hasGitMarker = $false
        $gitCeilingDirectories = @()
        if ($env:GIT_CEILING_DIRECTORIES) {
            foreach ($candidate in $env:GIT_CEILING_DIRECTORIES.Split([System.IO.Path]::PathSeparator)) {
                if ([string]::IsNullOrWhiteSpace($candidate)) { continue }
                try { $gitCeilingDirectories += [System.IO.Path]::GetFullPath($candidate.Trim()).TrimEnd('\', '/') } catch { }
            }
        }
        while ($null -ne $cursor) {
            $cursorPath = [System.IO.Path]::GetFullPath($cursor.FullName).TrimEnd('\', '/')
            if ($gitCeilingDirectories -contains $cursorPath) { break }
            if (Test-Path -LiteralPath (Join-Path $cursor.FullName ".git")) {
                $hasGitMarker = $true
                break
            }
            $parent = $cursor.Parent
            if ($null -eq $parent -or $parent.FullName -eq $cursor.FullName) { break }
            $cursor = $parent
        }

        if ($hasGitMarker -or $env:GIT_DIR -or $env:GIT_WORK_TREE) {
            $details = ($gitProbe.Output -join [Environment]::NewLine).Trim()
            Write-Host "W2 found Git metadata but could not read the repository at $project. $details" -ForegroundColor Red
            return
        }

        Write-Host "No Git repository contains this folder; initializing one for W2 change tracking." -ForegroundColor DarkCyan
        $gitInit = & $invokeW2Git -Arguments @("-C", $project, "init")
        $gitInit.Output | ForEach-Object { Write-Host $_ }
        if ($gitInit.ExitCode -ne 0) {
            Write-Host "W2 could not initialize Git in $project; Codex was not started." -ForegroundColor Red
            return
        }

        $gitRootResult = & $invokeW2Git -Arguments @("-C", $project, "rev-parse", "--show-toplevel")
        if ($gitRootResult.ExitCode -ne 0) {
            $details = ($gitRootResult.Output -join [Environment]::NewLine).Trim()
            Write-Host "W2 initialized Git but could not verify the repository root. $details" -ForegroundColor Red
            return
        }
        $gitRoot = [System.IO.Path]::GetFullPath(($gitRootResult.Output -join [Environment]::NewLine).Trim())
    }

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
    Write-Host "Git root: $gitRoot"

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
