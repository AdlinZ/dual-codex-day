[CmdletBinding()]
param(
    [string]$CodexRoot,
    [string]$DashboardPath,
    [ValidateRange(2, 60)]
    [int]$IntervalSeconds = 4,
    [switch]$Open
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$refreshScript = Join-Path $PSScriptRoot 'refresh-dashboard.ps1'

if ([string]::IsNullOrWhiteSpace($CodexRoot)) {
    $CodexRoot = Join-Path $env:USERPROFILE '.codex'
}
if ([string]::IsNullOrWhiteSpace($DashboardPath)) {
    $DashboardPath = Join-Path $repoRoot 'dist\index.html'
}

$sourceRoots = @(
    (Join-Path $CodexRoot 'sessions'),
    (Join-Path $CodexRoot 'archived_sessions')
) | Where-Object { Test-Path -LiteralPath $_ }

if (-not $sourceRoots.Count) {
    throw "No Codex session directories were found under: $CodexRoot"
}

function Get-LogSignature {
    $files = @(
        foreach ($sourceRoot in $sourceRoots) {
            Get-ChildItem -LiteralPath $sourceRoot -Filter '*.jsonl' -File -Recurse
        }
    )
    $latestTicks = 0L
    $totalBytes = 0L
    foreach ($file in $files) {
        $totalBytes += [int64]$file.Length
        if ($file.LastWriteTimeUtc.Ticks -gt $latestTicks) {
            $latestTicks = $file.LastWriteTimeUtc.Ticks
        }
    }
    return '{0}|{1}|{2}' -f $files.Count, $latestTicks, $totalBytes
}

function Update-Dashboard {
    & $refreshScript -CodexRoot $CodexRoot -DashboardPath $DashboardPath
}

Update-Dashboard
$lastSignature = Get-LogSignature

if ($Open) {
    $resolvedDashboard = (Resolve-Path -LiteralPath $DashboardPath).Path
    $dashboardUri = ([Uri]$resolvedDashboard).AbsoluteUri + '?live=1'
    Start-Process $dashboardUri
}

Write-Host ('Live refresh is active every {0} seconds. Close this window or press Ctrl+C to stop.' -f $IntervalSeconds)

while ($true) {
    Start-Sleep -Seconds $IntervalSeconds
    $signature = Get-LogSignature
    if ($signature -eq $lastSignature) {
        continue
    }

    try {
        Update-Dashboard
        $lastSignature = $signature
    }
    catch {
        Write-Warning ('Refresh failed; retrying after the next file change: {0}' -f $_.Exception.Message)
    }
}
