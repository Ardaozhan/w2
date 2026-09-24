[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [switch]$Uninstall,
    [string]$ProfilePath = $PROFILE
)

$startMarker = "# >>> W2 LAUNCHER >>>"
$endMarker = "# <<< W2 LAUNCHER <<<"
$launcherPath = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "w2-launcher.ps1")).Path
$escapedLauncherPath = $launcherPath.Replace("'", "''")
$block = @(
    $startMarker
    ". '$escapedLauncherPath'"
    $endMarker
) -join "`r`n"

if (!(Test-Path -LiteralPath $ProfilePath) -and $Uninstall) {
    Write-Host "No PowerShell profile exists at $ProfilePath."
    return
}

$content = if (Test-Path -LiteralPath $ProfilePath) { [System.IO.File]::ReadAllText($ProfilePath) } else { "" }
$startIndex = $content.IndexOf($startMarker, [System.StringComparison]::Ordinal)
$endIndex = $content.IndexOf($endMarker, [System.StringComparison]::Ordinal)

if (($startIndex -ge 0) -xor ($endIndex -ge 0)) {
    throw "The W2 launcher marker block in $ProfilePath is incomplete; no profile changes were made."
}
if ($startIndex -ge 0 -and $endIndex -lt $startIndex) {
    throw "The W2 launcher markers in $ProfilePath are out of order; no profile changes were made."
}

if ($Uninstall) {
    if ($startIndex -lt 0) {
        Write-Host "W2 launcher is not installed in $ProfilePath."
        return
    }
    $endAfterMarker = $endIndex + $endMarker.Length
    if ($endAfterMarker -lt $content.Length -and $content.Substring($endAfterMarker, 2) -eq "`r`n") { $endAfterMarker += 2 }
    elseif ($endAfterMarker -lt $content.Length -and $content.Substring($endAfterMarker, 1) -eq "`n") { $endAfterMarker += 1 }
    $updated = $content.Substring(0, $startIndex) + $content.Substring($endAfterMarker)
}
else {
    if ($startIndex -ge 0) {
        $endAfterMarker = $endIndex + $endMarker.Length
        if ($endAfterMarker -lt $content.Length -and $content.Substring($endAfterMarker, 2) -eq "`r`n") { $endAfterMarker += 2 }
        elseif ($endAfterMarker -lt $content.Length -and $content.Substring($endAfterMarker, 1) -eq "`n") { $endAfterMarker += 1 }
        $updated = $content.Substring(0, $startIndex) + $block + "`r`n" + $content.Substring($endAfterMarker)
    }
    else {
        $separator = if ($content.Length -eq 0 -or $content.EndsWith("`n")) { "" } else { "`r`n" }
        $updated = $content + $separator + $block + "`r`n"
    }
}

if ($updated -ceq $content) {
    Write-Host "W2 launcher is already current in $ProfilePath."
}
elseif ($PSCmdlet.ShouldProcess($ProfilePath, $(if ($Uninstall) { "remove the W2 launcher block" } else { "install or update the W2 launcher block" }))) {
    $profileDirectory = Split-Path -Parent $ProfilePath
    if ($profileDirectory -and !(Test-Path -LiteralPath $profileDirectory)) { New-Item -ItemType Directory -Path $profileDirectory -Force | Out-Null }
    [System.IO.File]::WriteAllText($ProfilePath, $updated, [System.Text.UTF8Encoding]::new($false))
    if ($Uninstall) {
        Remove-Item Function:\w2 -ErrorAction SilentlyContinue
        Write-Host "Removed the W2 launcher block from $ProfilePath."
    }
    else {
        . $launcherPath
        Write-Host "Installed or updated the W2 launcher in $ProfilePath."
    }
}
