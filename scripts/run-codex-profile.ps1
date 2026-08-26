[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$CodexHome,
    [Parameter(Mandatory = $true)][string]$SqliteHome,
    [Parameter(Mandatory = $true)][string]$CodexExecutable,
    [Parameter(Mandatory = $true)][string]$WorkingDirectory,
    [Parameter(Mandatory = $true)][string]$ProfileName,
    [string]$PidFile = ''
)

$ErrorActionPreference = 'Stop'
$Host.UI.RawUI.WindowTitle = 'Codex - {0}' -f $ProfileName
$env:CODEX_HOME = $CodexHome
$env:CODEX_SQLITE_HOME = $SqliteHome
Remove-Item Env:CODEX_ACCESS_TOKEN -ErrorAction SilentlyContinue
Remove-Item Env:CODEX_API_KEY -ErrorAction SilentlyContinue
Remove-Item Env:OPENAI_API_KEY -ErrorAction SilentlyContinue
Remove-Item Env:TERM -ErrorAction SilentlyContinue
if ($PidFile) { Set-Content -LiteralPath $PidFile -Value $PID -Encoding ascii }
Set-Location -LiteralPath $WorkingDirectory
& $CodexExecutable
