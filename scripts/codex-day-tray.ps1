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
$summaryDatePath = Join-Path $stateDirectory 'daily-summary-date.txt'
$labelsPath = Join-Path $repoRoot 'config\tray.zh-CN.json'
$iconPath = Join-Path $repoRoot 'assets\codex-day.ico'
$dashboardUrl = 'http://127.0.0.1:8765/?live=1'
$healthUrl = 'http://127.0.0.1:8765/api/status'
$summaryUrl = 'http://127.0.0.1:8765/api/summary'
$startupRegistryPath = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'
$startupRegistryName = 'CodexDay'
$summaryRegistryName = 'CodexDayDailySummary'
$summaryHourRegistryName = 'CodexDayDailySummaryHour'
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

function Test-DailySummaryEnabled {
    try {
        return [int](Get-ItemPropertyValue -Path $startupRegistryPath -Name $summaryRegistryName -ErrorAction Stop) -eq 1
    }
    catch {
        return $false
    }
}

function Set-DailySummaryEnabled([bool]$Enabled) {
    New-Item -Path $startupRegistryPath -Force | Out-Null
    if ($Enabled) {
        Set-ItemProperty -Path $startupRegistryPath -Name $summaryRegistryName -Value 1 -Type DWord
    }
    else {
        Remove-ItemProperty -Path $startupRegistryPath -Name $summaryRegistryName -ErrorAction SilentlyContinue
    }
}

function Get-DailySummaryHour {
    try {
        $value = [int](Get-ItemPropertyValue -Path $startupRegistryPath -Name $summaryHourRegistryName -ErrorAction Stop)
        if ($value -in @(17, 18, 20, 22)) { return $value }
    }
    catch {}
    return 18
}

function Set-DailySummaryHour([int]$Hour) {
    if ($Hour -notin @(17, 18, 20, 22)) { throw 'Unsupported daily summary hour.' }
    New-Item -Path $startupRegistryPath -Force | Out-Null
    Set-ItemProperty -Path $startupRegistryPath -Name $summaryHourRegistryName -Value $Hour -Type DWord
}

$trayIcon = [System.Drawing.SystemIcons]::Information
$ownsTrayIcon = $false
if (Test-Path -LiteralPath $iconPath) {
    $trayIcon = New-Object System.Drawing.Icon -ArgumentList $iconPath
    $ownsTrayIcon = $true
}

$notifyIcon = New-Object System.Windows.Forms.NotifyIcon
$notifyIcon.Icon = $trayIcon
$notifyIcon.Text = 'Dual Codex Day'
$notifyIcon.Visible = $true

$menu = New-Object System.Windows.Forms.ContextMenuStrip
$statusItem = $menu.Items.Add($labels.starting)
$statusItem.Enabled = $false
$menu.Items.Add((New-Object System.Windows.Forms.ToolStripSeparator)) | Out-Null
$openItem = $menu.Items.Add($labels.open)
$restartItem = $menu.Items.Add($labels.restart)
$logsItem = $menu.Items.Add($labels.logs)
$summaryItem = $menu.Items.Add($labels.dailySummary)
$summaryNotificationsItem = New-Object System.Windows.Forms.ToolStripMenuItem -ArgumentList ([string]$labels.dailySummaryNotifications)
$summaryNotificationsItem.Checked = Test-DailySummaryEnabled
$menu.Items.Add($summaryNotificationsItem) | Out-Null
$summaryTimeItem = New-Object System.Windows.Forms.ToolStripMenuItem -ArgumentList ([string]$labels.dailySummaryTime)
foreach ($summaryHour in @(17, 18, 20, 22)) {
    $summaryHourItem = New-Object System.Windows.Forms.ToolStripMenuItem -ArgumentList ('{0:D2}:00' -f $summaryHour)
    $summaryHourItem.Tag = $summaryHour
    $summaryHourItem.Checked = (Get-DailySummaryHour) -eq $summaryHour
    $summaryHourItem.Add_Click({
        param($sender, $eventArgs)
        Set-DailySummaryHour ([int]$sender.Tag)
        foreach ($item in $summaryTimeItem.DropDownItems) { $item.Checked = [int]$item.Tag -eq (Get-DailySummaryHour) }
    })
    $summaryTimeItem.DropDownItems.Add($summaryHourItem) | Out-Null
}
$menu.Items.Add($summaryTimeItem) | Out-Null
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

function Show-DailySummary([bool]$MarkNotified) {
    try {
        $response = Invoke-RestMethod -Uri $summaryUrl -TimeoutSec 3
        if (-not $response.ok) { return $false }
        $summary = $response.summary
        $message = if ([int]$summary.calls -gt 0) {
            $labels.summaryBody -f ('{0:N0}' -f [double]$summary.tokens.total), [int]$summary.calls, [int]$summary.tasks
        } else {
            $labels.summaryEmptyBody
        }
        Show-Notification $labels.summaryTitle $message ([System.Windows.Forms.ToolTipIcon]::Info)
        if ($MarkNotified) {
            New-Item -ItemType Directory -Force -Path $stateDirectory | Out-Null
            [IO.File]::WriteAllText($summaryDatePath, [DateTime]::Now.ToString('yyyy-MM-dd'))
        }
        return $true
    }
    catch {
        return $false
    }
}

function Update-DailySummaryNotification {
    if (-not (Test-DailySummaryEnabled) -or [DateTime]::Now.Hour -lt (Get-DailySummaryHour)) { return }
    $today = [DateTime]::Now.ToString('yyyy-MM-dd')
    $lastDate = if (Test-Path -LiteralPath $summaryDatePath) { (Get-Content -LiteralPath $summaryDatePath -Raw).Trim() } else { '' }
    if ($lastDate -ne $today) { Show-DailySummary $true | Out-Null }
}

function Update-TrayStatus {
    $status = Get-CodexDayStatus
    if (-not $status -and ([DateTime]::Now - $script:lastRestartAttempt).TotalSeconds -ge 15) {
        $script:lastRestartAttempt = [DateTime]::Now
        try { $status = Start-CodexDayService } catch { $status = $null }
    }

    if ($status) {
        $statusItem.Text = $labels.online -f [int]$status.diagnostics.counts.events, [int]$status.diagnostics.counts.sessions
        $notifyIcon.Text = 'Dual Codex Day - running'
        $notifyIcon.Icon = $trayIcon
        if ($script:lastHealthy -eq $false) {
            Show-Notification $labels.recoveredTitle $labels.recoveredBody ([System.Windows.Forms.ToolTipIcon]::Info)
        }
        $script:lastHealthy = $true
        Update-DailySummaryNotification
    }
    else {
        $statusItem.Text = $labels.offline
        $notifyIcon.Text = 'Dual Codex Day - offline'
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
$summaryItem.Add_Click({ Show-DailySummary $false | Out-Null })
$summaryNotificationsItem.Add_Click({
    $enabled = -not (Test-DailySummaryEnabled)
    Set-DailySummaryEnabled $enabled
    $summaryNotificationsItem.Checked = Test-DailySummaryEnabled
    if ($enabled) { Update-DailySummaryNotification }
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
