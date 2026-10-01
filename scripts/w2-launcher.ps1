$global:W2_INSTALL_PATH = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path

function global:w2 {
    $project = (Get-Location).ProviderPath
    $w2Home = $global:W2_INSTALL_PATH
    $packagePath = Join-Path $w2Home "package.json"
    if (!(Test-Path -LiteralPath $packagePath)) {
        Write-Host "W2 installation is not available at $w2Home" -ForegroundColor Red
        return
    }
    $cliPath = Join-Path $w2Home "dist\src\cli.js"
    $launchModulePath = Join-Path $w2Home "dist\src\core\codex-launch.js"
    $requiredBuildFiles = @(
        $cliPath,
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

    $requestedCommand = if ($args.Count -gt 0) { [string]$args[0] } else { "" }
    if ($requestedCommand -in @("run", "receipt", "doctor", "version", "session")) {
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
