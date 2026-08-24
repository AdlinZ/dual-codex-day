[CmdletBinding()]
param(
    [switch]$Open
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$stateDirectory = Join-Path $repoRoot '.codex-day'
$serviceScript = Join-Path $PSScriptRoot 'codex-day.mjs'
$servicePidPath = Join-Path $stateDirectory 'service.pid'
$stdoutPath = Join-Path $stateDirectory 'service-out.log'
$stderrPath = Join-Path $stateDirectory 'service-error.log'
$labelsPath = Join-Path $repoRoot 'config\tray.zh-CN.json'
$iconPath = Join-Path $repoRoot 'assets\codex-day.ico'
$dashboardUrl = 'http://127.0.0.1:8765/?live=1'
$healthUrl = 'http://127.0.0.1:8765/healthz'
$startupRegistryPath = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'
$startupRegistryName = 'CodexDay'
$startupCommand = 'powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy RemoteSigned -File "{0}"' -f $PSCommandPath

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$labels = Get-Content -LiteralPath $labelsPath -Raw -Encoding UTF8 | ConvertFrom-Json
$createdNew = $false
$mutex = [System.Threading.Mutex]::new($true, 'Local\CodexDayTray', [ref]$createdNew)
if (-not $createdNew) {
    Start-Process $dashboardUrl
    $mutex.Dispose()
    exit 0
}

function Get-CodexDayStatus {
    try {
        return Invoke-RestMethod -Uri $healthUrl -TimeoutSec 2
    }
    catch {
        return $null
    }
}

function Get-CodexDayPid {
    if (-not (Test-Path -LiteralPath $servicePidPath)) { return $null }
    $value = 0
    if (-not [int]::TryParse((Get-Content -LiteralPath $servicePidPath -Raw).Trim(), [ref]$value)) { return $null }
    return $value
}

function Test-OwnedServiceProcess([int]$ProcessId) {
    if ($ProcessId -le 0) { return $false }
    $process = Get-CimInstance Win32_Process -Filter ('ProcessId = {0}' -f $ProcessId) -ErrorAction SilentlyContinue
    if (-not $process) { return $false }
    return $process.Name -eq 'node.exe' -and $process.CommandLine -like '*codex-day.mjs*' -and $process.CommandLine -like '*--pid-file*'
}

function Start-CodexDayService {
    $status = Get-CodexDayStatus
    if ($status) { return $status }

    New-Item -ItemType Directory -Force -Path $stateDirectory | Out-Null
    $nodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
    if (-not $nodeCommand) { throw 'Node.js 22.5 or newer is required for tray mode.' }

    $arguments = @(
        ('"{0}"' -f $serviceScript),
        '--pid-file', ('"{0}"' -f $servicePidPath)
    )
    Start-Process -FilePath $nodeCommand.Source -ArgumentList $arguments -WorkingDirectory $repoRoot -WindowStyle Hidden `
        -RedirectStandardOutput $stdoutPath -RedirectStandardError $stderrPath | Out-Null

    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        Start-Sleep -Milliseconds 250
        $status = Get-CodexDayStatus
        if ($status) { return $status }
    }
    return $null
}

function Stop-CodexDayService {
    $servicePid = Get-CodexDayPid
    if (-not $servicePid -or -not (Test-OwnedServiceProcess $servicePid)) { return $false }
    Stop-Process -Id $servicePid -ErrorAction SilentlyContinue
    for ($attempt = 0; $attempt -lt 20; $attempt++) {
        if (-not (Get-Process -Id $servicePid -ErrorAction SilentlyContinue)) { break }
        Start-Sleep -Milliseconds 100
    }
    if (-not (Get-Process -Id $servicePid -ErrorAction SilentlyContinue)) {
        Remove-Item -LiteralPath $servicePidPath -Force -ErrorAction SilentlyContinue
    }
    return $true
}

function Restart-CodexDayService {
    Stop-CodexDayService | Out-Null
    return Start-CodexDayService
}

function Test-StartupEnabled {
    try {
        return (Get-ItemPropertyValue -Path $startupRegistryPath -Name $startupRegistryName -ErrorAction Stop) -eq $startupCommand
    }
    catch {
        return $false
    }
}

function Set-StartupEnabled([bool]$Enabled) {
    if ($Enabled) {
        New-Item -Path $startupRegistryPath -Force | Out-Null
        Set-ItemProperty -Path $startupRegistryPath -Name $startupRegistryName -Value $startupCommand
    }
    else {
        Remove-ItemProperty -Path $startupRegistryPath -Name $startupRegistryName -ErrorAction SilentlyContinue
    }
}

$trayIcon = [System.Drawing.SystemIcons]::Information
$ownsTrayIcon = $false
if (Test-Path -LiteralPath $iconPath) {
    $trayIcon = New-Object System.Drawing.Icon -ArgumentList $iconPath
    $ownsTrayIcon = $true
}

$notifyIcon = New-Object System.Windows.Forms.NotifyIcon
$notifyIcon.Icon = $trayIcon
$notifyIcon.Text = 'codex-day'
$notifyIcon.Visible = $true

$menu = New-Object System.Windows.Forms.ContextMenuStrip
$statusItem = $menu.Items.Add($labels.starting)
$statusItem.Enabled = $false
$menu.Items.Add((New-Object System.Windows.Forms.ToolStripSeparator)) | Out-Null
$openItem = $menu.Items.Add($labels.open)
$restartItem = $menu.Items.Add($labels.restart)
$logsItem = $menu.Items.Add($labels.logs)
$startupItem = New-Object System.Windows.Forms.ToolStripMenuItem -ArgumentList ([string]$labels.startup)
$startupItem.Checked = Test-StartupEnabled
$menu.Items.Add($startupItem) | Out-Null
$menu.Items.Add((New-Object System.Windows.Forms.ToolStripSeparator)) | Out-Null
$exitItem = $menu.Items.Add($labels.exit)
$notifyIcon.ContextMenuStrip = $menu

$script:lastHealthy = $null
$script:lastRestartAttempt = [DateTime]::MinValue

function Show-Notification([string]$Title, [string]$Message, [System.Windows.Forms.ToolTipIcon]$Icon) {
    $notifyIcon.BalloonTipTitle = $Title
    $notifyIcon.BalloonTipText = $Message
    $notifyIcon.BalloonTipIcon = $Icon
    $notifyIcon.ShowBalloonTip(3000)
}

function Update-TrayStatus {
    $status = Get-CodexDayStatus
    if (-not $status -and ([DateTime]::Now - $script:lastRestartAttempt).TotalSeconds -ge 15) {
        $script:lastRestartAttempt = [DateTime]::Now
        try { $status = Start-CodexDayService } catch { $status = $null }
    }

    if ($status) {
        $statusItem.Text = $labels.online -f [int]$status.events, [int]$status.sessions
        $notifyIcon.Text = 'codex-day - running'
        $notifyIcon.Icon = $trayIcon
        if ($script:lastHealthy -eq $false) {
            Show-Notification $labels.recoveredTitle $labels.recoveredBody ([System.Windows.Forms.ToolTipIcon]::Info)
        }
        $script:lastHealthy = $true
    }
    else {
        $statusItem.Text = $labels.offline
        $notifyIcon.Text = 'codex-day - offline'
        $notifyIcon.Icon = [System.Drawing.SystemIcons]::Error
        if ($script:lastHealthy -eq $true) {
            Show-Notification $labels.failedTitle $labels.failedBody ([System.Windows.Forms.ToolTipIcon]::Error)
        }
        $script:lastHealthy = $false
    }
}

$openAction = {
    if (Get-CodexDayStatus) { Start-Process $dashboardUrl }
}
$openItem.Add_Click($openAction)
$notifyIcon.Add_DoubleClick($openAction)
$logsItem.Add_Click({
    New-Item -ItemType Directory -Force -Path $stateDirectory | Out-Null
    Start-Process explorer.exe -ArgumentList ('"{0}"' -f $stateDirectory)
})
$startupItem.Add_Click({
    $enabled = -not (Test-StartupEnabled)
    Set-StartupEnabled $enabled
    $startupItem.Checked = Test-StartupEnabled
})
$restartItem.Add_Click({
    $restartItem.Enabled = $false
    $statusItem.Text = $labels.starting
    try { Restart-CodexDayService | Out-Null } catch {}
    Update-TrayStatus
    $restartItem.Enabled = $true
})
$exitItem.Add_Click({
    $timer.Stop()
    Stop-CodexDayService | Out-Null
    $notifyIcon.Visible = $false
    [System.Windows.Forms.Application]::Exit()
})

$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 5000
$timer.Add_Tick({ Update-TrayStatus })

try {
    $initialStatus = Start-CodexDayService
    Update-TrayStatus
    if ($initialStatus) {
        Show-Notification $labels.startedTitle $labels.startedBody ([System.Windows.Forms.ToolTipIcon]::Info)
        if ($Open) { Start-Process $dashboardUrl }
    }
    else {
        Show-Notification $labels.failedTitle $labels.failedBody ([System.Windows.Forms.ToolTipIcon]::Error)
    }
    $timer.Start()
    [System.Windows.Forms.Application]::Run()
}
finally {
    $timer.Stop()
    $timer.Dispose()
    $notifyIcon.Visible = $false
    $notifyIcon.Dispose()
    $menu.Dispose()
    if ($ownsTrayIcon) { $trayIcon.Dispose() }
    if ($createdNew) { $mutex.ReleaseMutex() }
    $mutex.Dispose()
}
