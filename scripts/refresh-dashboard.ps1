[CmdletBinding()]
param(
    [string]$CodexRoot,
    [string]$DashboardPath,
    [string]$TemplatePath,
    [string]$StylesheetPath,
    [switch]$Open
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot

if ([string]::IsNullOrWhiteSpace($DashboardPath)) {
    $DashboardPath = Join-Path $repoRoot 'dist\index.html'
}
if ([string]::IsNullOrWhiteSpace($TemplatePath)) {
    $TemplatePath = Join-Path $repoRoot 'src\index.template.html'
}
if ([string]::IsNullOrWhiteSpace($StylesheetPath)) {
    $StylesheetPath = Join-Path $repoRoot 'src\token-dashboard.css'
}
if ([string]::IsNullOrWhiteSpace($CodexRoot)) {
    $CodexRoot = Join-Path $env:USERPROFILE '.codex'
}

function Get-ProjectName {
    param([string]$Path)

    if ([string]::IsNullOrWhiteSpace($Path)) {
        return '(unassigned project)'
    }

    $trimmed = $Path.TrimEnd('\', '/')
    $leaf = Split-Path -Leaf $trimmed
    if ([string]::IsNullOrWhiteSpace($leaf)) {
        return $trimmed
    }
    return $leaf
}

function Get-StablePrivateId {
    param(
        [string]$Value,
        [string]$Prefix
    )

    $sha256 = [Security.Cryptography.SHA256]::Create()
    try {
        $bytes = [Text.Encoding]::UTF8.GetBytes([string]$Value)
        $hash = $sha256.ComputeHash($bytes)
    }
    finally {
        $sha256.Dispose()
    }
    $shortHash = [BitConverter]::ToString($hash).Replace('-', '').Substring(0, 12).ToLowerInvariant()
    return '{0}-{1}' -f $Prefix, $shortHash
}

function Convert-ToLocalTimestamp {
    param([string]$Timestamp)

    $styles = [Globalization.DateTimeStyles]::AssumeUniversal
    return [DateTimeOffset]::Parse(
        $Timestamp,
        [Globalization.CultureInfo]::InvariantCulture,
        $styles
    ).ToLocalTime()
}

function Get-SharedFileLines {
    param([string]$Path)

    $stream = [IO.File]::Open(
        $Path,
        [IO.FileMode]::Open,
        [IO.FileAccess]::Read,
        [IO.FileShare]::ReadWrite
    )
    $reader = [IO.StreamReader]::new($stream)
    try {
        while (-not $reader.EndOfStream) {
            $reader.ReadLine()
        }
    }
    finally {
        $reader.Dispose()
        $stream.Dispose()
    }
}

$sourceRoots = @(
    (Join-Path $CodexRoot 'sessions'),
    (Join-Path $CodexRoot 'archived_sessions')
) | Where-Object { Test-Path -LiteralPath $_ }

if (-not $sourceRoots.Count) {
    throw "No Codex session directories were found under: $CodexRoot"
}

$files = @(
    foreach ($sourceRoot in $sourceRoots) {
        Get-ChildItem -LiteralPath $sourceRoot -Filter '*.jsonl' -File -Recurse
    }
)

$events = [Collections.Generic.List[object]]::new()
$sessionIds = [Collections.Generic.HashSet[string]]::new()
$eventKeys = [Collections.Generic.HashSet[string]]::new()

foreach ($file in $files) {
    $model = '(unknown model)'
    $cwd = '(unassigned project)'
    $sessionId = $file.BaseName
    $fileLines = @(Get-SharedFileLines -Path $file.FullName)

    foreach ($line in $fileLines) {
        if ($line -notmatch '"type":"(session_meta|turn_context)"') {
            continue
        }
        try {
            $contextRow = $line | ConvertFrom-Json
        }
        catch {
            continue
        }
        if ($contextRow.type -eq 'session_meta') {
            if ($contextRow.payload.session_id) { $sessionId = [string]$contextRow.payload.session_id }
            if ($contextRow.payload.cwd) { $cwd = [string]$contextRow.payload.cwd }
        }
        if ($contextRow.type -eq 'turn_context') {
            if ($contextRow.payload.model) { $model = [string]$contextRow.payload.model }
            if ($contextRow.payload.cwd) { $cwd = [string]$contextRow.payload.cwd }
            break
        }
    }
    [void]$sessionIds.Add($sessionId)

    foreach ($line in $fileLines) {
        try {
            $row = $line | ConvertFrom-Json
        }
        catch {
            continue
        }

        if ($row.type -eq 'session_meta') {
            if ($row.payload.session_id) { $sessionId = [string]$row.payload.session_id }
            if ($row.payload.cwd) { $cwd = [string]$row.payload.cwd }
            [void]$sessionIds.Add($sessionId)
            continue
        }

        if ($row.type -eq 'turn_context') {
            if ($row.payload.model) { $model = [string]$row.payload.model }
            if ($row.payload.cwd) { $cwd = [string]$row.payload.cwd }
            continue
        }

        if ($row.type -ne 'event_msg' -or $row.payload.type -ne 'token_count') {
            continue
        }

        $usage = $row.payload.info.last_token_usage
        if ($null -eq $usage -or [int64]$usage.total_tokens -le 0) {
            continue
        }

        try {
            $localTime = Convert-ToLocalTimestamp -Timestamp ([string]$row.timestamp)
        }
        catch {
            continue
        }

        $inputTokens = [int64]$usage.input_tokens
        $cachedTokens = [int64]$usage.cached_input_tokens
        $cacheWriteTokens = [int64]$usage.cache_write_input_tokens
        $outputTokens = [int64]$usage.output_tokens
        $reasoningTokens = [int64]$usage.reasoning_output_tokens
        $totalTokens = [int64]$usage.total_tokens
        $eventKey = '{0}|{1}|{2}|{3}|{4}' -f $sessionId, $row.timestamp, $inputTokens, $outputTokens, $totalTokens
        if (-not $eventKeys.Add($eventKey)) {
            continue
        }

        $events.Add([ordered]@{
            timestamp = $localTime.ToString('yyyy-MM-ddTHH:mm:sszzz')
            date = $localTime.ToString('yyyy-MM-dd')
            sessionId = Get-StablePrivateId -Value $sessionId -Prefix 'task'
            model = $model
            project = Get-ProjectName -Path $cwd
            projectId = Get-StablePrivateId -Value $cwd -Prefix 'project'
            input = $inputTokens
            cachedInput = $cachedTokens
            cacheWriteInput = $cacheWriteTokens
            uncachedInput = [Math]::Max(0, $inputTokens - $cachedTokens)
            output = $outputTokens
            reasoningOutput = $reasoningTokens
            unclassified = [Math]::Max(0, $totalTokens - $inputTokens - $outputTokens)
            total = $totalTokens
            contextWindow = [int64]$row.payload.info.model_context_window
        })
    }
}

$payload = [ordered]@{
    generatedAt = [DateTimeOffset]::Now.ToString('yyyy-MM-ddTHH:mm:sszzz')
    timezone = [TimeZoneInfo]::Local.DisplayName
    filesScanned = $files.Count
    sessionsScanned = $sessionIds.Count
    events = @($events | Sort-Object { $_['timestamp'] })
}

if (-not (Test-Path -LiteralPath $TemplatePath)) {
    throw "Dashboard template not found: $TemplatePath"
}
if (-not (Test-Path -LiteralPath $StylesheetPath)) {
    throw "Dashboard stylesheet not found: $StylesheetPath"
}

$json = $payload | ConvertTo-Json -Depth 12 -Compress
$html = [IO.File]::ReadAllText($TemplatePath)
$replacement = '<script id="token-data">window.__TOKEN_DATA__ = ' + $json + ';</script>'
$pattern = '(?s)<script id="token-data">.*?</script>'

if (-not [Text.RegularExpressions.Regex]::IsMatch($html, $pattern)) {
    throw 'The token-data marker is missing from the dashboard.'
}

$updated = [Text.RegularExpressions.Regex]::Replace($html, $pattern, [Text.RegularExpressions.MatchEvaluator]{ param($match) $replacement }, 1)
$outputDirectory = Split-Path -Parent $DashboardPath
if (-not (Test-Path -LiteralPath $outputDirectory)) {
    [void](New-Item -ItemType Directory -Path $outputDirectory -Force)
}
[IO.File]::WriteAllText($DashboardPath, $updated, [Text.UTF8Encoding]::new($false))
Copy-Item -LiteralPath $StylesheetPath -Destination (Join-Path $outputDirectory 'token-dashboard.css') -Force

Write-Host ('Refreshed: {0} calls, {1} sessions, {2} log files' -f $events.Count, $sessionIds.Count, $files.Count)
Write-Host ('Dashboard: {0}' -f $DashboardPath)

if ($Open) {
    Start-Process -FilePath $DashboardPath
}
