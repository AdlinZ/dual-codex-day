[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$sourcePath = Join-Path $repoRoot 'windows\CodexProfilesLauncher.cs'
$outputDirectory = Join-Path $repoRoot 'dist'
$outputPath = Join-Path $outputDirectory 'dual-codex-day.exe'
$iconPath = Join-Path $repoRoot 'assets\codex-day.ico'
$compilerCandidates = @(
    'C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe',
    'C:\Windows\Microsoft.NET\Framework\v4.0.30319\csc.exe'
)
$compiler = $compilerCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (-not $compiler) { throw '.NET Framework C# compiler was not found.' }

$inputPaths = @($sourcePath, $PSCommandPath, $iconPath)
if (Test-Path -LiteralPath $outputPath) {
    $outputTime = (Get-Item -LiteralPath $outputPath).LastWriteTimeUtc
    $latestInputTime = ($inputPaths | ForEach-Object { (Get-Item -LiteralPath $_).LastWriteTimeUtc } | Sort-Object -Descending | Select-Object -First 1)
    if ($outputTime -ge $latestInputTime) {
        Write-Output $outputPath
        exit 0
    }
}

New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null
$arguments = @(
    '/nologo',
    '/target:winexe',
    '/optimize+',
    ('/out:{0}' -f $outputPath),
    ('/win32icon:{0}' -f $iconPath),
    '/reference:System.dll',
    '/reference:System.Drawing.dll',
    '/reference:System.Windows.Forms.dll',
    '/reference:System.Web.Extensions.dll',
    $sourcePath
)
& $compiler @arguments
if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $outputPath)) { throw 'Native launcher compilation failed.' }
Write-Output $outputPath
