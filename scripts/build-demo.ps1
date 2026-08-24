[CmdletBinding()]
param(
    [string]$SampleDataPath,
    [string]$PricingPath,
    [string]$OutputPath,
    [switch]$Open
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$templatePath = Join-Path $repoRoot 'src\index.template.html'

if ([string]::IsNullOrWhiteSpace($SampleDataPath)) {
    $SampleDataPath = Join-Path $repoRoot 'demo\sample-data.json'
}
if ([string]::IsNullOrWhiteSpace($OutputPath)) {
    $OutputPath = Join-Path $repoRoot 'demo\index.html'
}
if ([string]::IsNullOrWhiteSpace($PricingPath)) {
    $PricingPath = Join-Path $repoRoot 'config\pricing.json'
}

$payload = [IO.File]::ReadAllText($SampleDataPath) | ConvertFrom-Json
$payload.demo = $true
$json = $payload | ConvertTo-Json -Depth 12 -Compress
$pricing = [IO.File]::ReadAllText($PricingPath) | ConvertFrom-Json
$pricingJson = $pricing | ConvertTo-Json -Depth 12 -Compress
$html = [IO.File]::ReadAllText($templatePath)
$replacement = '<script id="token-data">window.__TOKEN_DATA__ = ' + $json + ';</script>'
$pattern = '(?s)<script id="token-data">.*?</script>'
$pricingReplacement = '<script id="pricing-data">window.__PRICING_DATA__ = ' + $pricingJson + ';</script>'
$pricingPattern = '(?s)<script id="pricing-data">.*?</script>'

if (-not [Text.RegularExpressions.Regex]::IsMatch($html, $pattern)) {
    throw 'The token-data marker is missing from the dashboard template.'
}
if (-not [Text.RegularExpressions.Regex]::IsMatch($html, $pricingPattern)) {
    throw 'The pricing-data marker is missing from the dashboard template.'
}

$html = [Text.RegularExpressions.Regex]::Replace($html, $pattern, [Text.RegularExpressions.MatchEvaluator]{ param($match) $replacement }, 1)
$html = [Text.RegularExpressions.Regex]::Replace($html, $pricingPattern, [Text.RegularExpressions.MatchEvaluator]{ param($match) $pricingReplacement }, 1)
$html = $html.Replace('href="token-dashboard.css"', 'href="../src/token-dashboard.css"')
[IO.File]::WriteAllText($OutputPath, $html, [Text.UTF8Encoding]::new($false))
Write-Host ('Demo: {0}' -f $OutputPath)

if ($Open) {
    Start-Process -FilePath $OutputPath
}
