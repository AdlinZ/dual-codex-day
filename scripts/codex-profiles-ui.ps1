[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$cliPath = Join-Path $PSScriptRoot 'codex-profiles.mjs'
$labelsPath = Join-Path $repoRoot 'config\profiles.zh-CN.json'
$iconPath = Join-Path $repoRoot 'assets\codex-day.ico'
$nodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
if (-not $nodeCommand) { throw 'Node.js 22.5 or newer is required.' }

[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
$OutputEncoding = New-Object System.Text.UTF8Encoding($false)
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()
$labels = Get-Content -LiteralPath $labelsPath -Raw -Encoding UTF8 | ConvertFrom-Json

function Invoke-ProfilesCore([string[]]$Arguments) {
    $output = & $nodeCommand.Source $cliPath @Arguments 2>&1
    if ($LASTEXITCODE -ne 0) { throw (($output | Out-String).Trim()) }
    return (($output | Out-String) | ConvertFrom-Json)
}

$doctor = Invoke-ProfilesCore @('doctor', '--json')
$script:profiles = @()

$form = New-Object System.Windows.Forms.Form
$form.Text = $labels.title
$form.StartPosition = 'CenterScreen'
$form.ClientSize = New-Object System.Drawing.Size(760, 540)
$form.MinimumSize = New-Object System.Drawing.Size(776, 579)
$form.Font = New-Object System.Drawing.Font('Microsoft YaHei UI', 9)
if (Test-Path -LiteralPath $iconPath) { $form.Icon = New-Object System.Drawing.Icon($iconPath) }

$titleLabel = New-Object System.Windows.Forms.Label
$titleLabel.Text = $labels.title
$titleLabel.Font = New-Object System.Drawing.Font('Microsoft YaHei UI', 17, [System.Drawing.FontStyle]::Bold)
$titleLabel.Location = New-Object System.Drawing.Point(24, 20)
$titleLabel.AutoSize = $true
$form.Controls.Add($titleLabel)

$subtitleLabel = New-Object System.Windows.Forms.Label
$subtitleLabel.Text = $labels.subtitle
$subtitleLabel.ForeColor = [System.Drawing.Color]::FromArgb(80, 86, 94)
$subtitleLabel.Location = New-Object System.Drawing.Point(27, 59)
$subtitleLabel.AutoSize = $true
$form.Controls.Add($subtitleLabel)

$profileGroup = New-Object System.Windows.Forms.GroupBox
$profileGroup.Text = $labels.profiles
$profileGroup.Location = New-Object System.Drawing.Point(24, 92)
$profileGroup.Size = New-Object System.Drawing.Size(712, 242)
$profileGroup.Anchor = 'Top,Left,Right'
$form.Controls.Add($profileGroup)

$profileList = New-Object System.Windows.Forms.ListBox
$profileList.Location = New-Object System.Drawing.Point(16, 28)
$profileList.Size = New-Object System.Drawing.Size(680, 142)
$profileList.Anchor = 'Top,Left,Right'
$profileList.DisplayMember = 'name'
$profileGroup.Controls.Add($profileList)

$nameBox = New-Object System.Windows.Forms.TextBox
$nameBox.Location = New-Object System.Drawing.Point(16, 190)
$nameBox.Size = New-Object System.Drawing.Size(430, 28)
$nameBox.Anchor = 'Bottom,Left,Right'
$profileGroup.Controls.Add($nameBox)

$createButton = New-Object System.Windows.Forms.Button
$createButton.Text = $labels.create
$createButton.Location = New-Object System.Drawing.Point(462, 188)
$createButton.Size = New-Object System.Drawing.Size(234, 32)
$createButton.Anchor = 'Bottom,Right'
$profileGroup.Controls.Add($createButton)

$workspaceLabel = New-Object System.Windows.Forms.Label
$workspaceLabel.Text = $labels.workspace
$workspaceLabel.Location = New-Object System.Drawing.Point(27, 352)
$workspaceLabel.AutoSize = $true
$form.Controls.Add($workspaceLabel)

$workspaceBox = New-Object System.Windows.Forms.TextBox
$workspaceBox.Text = $repoRoot
$workspaceBox.Location = New-Object System.Drawing.Point(24, 376)
$workspaceBox.Size = New-Object System.Drawing.Size(585, 28)
$workspaceBox.Anchor = 'Top,Left,Right'
$form.Controls.Add($workspaceBox)

$browseButton = New-Object System.Windows.Forms.Button
$browseButton.Text = $labels.browse
$browseButton.Location = New-Object System.Drawing.Point(621, 374)
$browseButton.Size = New-Object System.Drawing.Size(115, 32)
$browseButton.Anchor = 'Top,Right'
$form.Controls.Add($browseButton)

$cliButton = New-Object System.Windows.Forms.Button
$cliButton.Text = $labels.launchCli
$cliButton.Location = New-Object System.Drawing.Point(24, 424)
$cliButton.Size = New-Object System.Drawing.Size(150, 38)
$form.Controls.Add($cliButton)

$vscodeButton = New-Object System.Windows.Forms.Button
$vscodeButton.Text = $labels.launchVscode
$vscodeButton.Location = New-Object System.Drawing.Point(184, 424)
$vscodeButton.Size = New-Object System.Drawing.Size(165, 38)
$form.Controls.Add($vscodeButton)

$desktopButton = New-Object System.Windows.Forms.Button
$desktopButton.Text = $labels.launchDesktop
$desktopButton.Location = New-Object System.Drawing.Point(359, 424)
$desktopButton.Size = New-Object System.Drawing.Size(228, 38)
$desktopButton.Enabled = [bool]$doctor.targets.desktop.available
$form.Controls.Add($desktopButton)

$folderButton = New-Object System.Windows.Forms.Button
$folderButton.Text = $labels.openFolder
$folderButton.Location = New-Object System.Drawing.Point(597, 424)
$folderButton.Size = New-Object System.Drawing.Size(139, 38)
$folderButton.Anchor = 'Top,Right'
$form.Controls.Add($folderButton)

$statusLabel = New-Object System.Windows.Forms.Label
$statusLabel.Text = $labels.ready
$statusLabel.Location = New-Object System.Drawing.Point(27, 478)
$statusLabel.Size = New-Object System.Drawing.Size(700, 22)
$statusLabel.Anchor = 'Left,Right,Bottom'
$form.Controls.Add($statusLabel)

$privacyLabel = New-Object System.Windows.Forms.Label
$privacyLabel.Text = $labels.privacy
$privacyLabel.ForeColor = [System.Drawing.Color]::FromArgb(80, 86, 94)
$privacyLabel.Location = New-Object System.Drawing.Point(27, 505)
$privacyLabel.Size = New-Object System.Drawing.Size(700, 22)
$privacyLabel.Anchor = 'Left,Right,Bottom'
$form.Controls.Add($privacyLabel)

$toolTip = New-Object System.Windows.Forms.ToolTip
$toolTip.SetToolTip($desktopButton, $labels.desktopWarning)
if (-not $doctor.targets.desktop.available) { $toolTip.SetToolTip($desktopButton, $labels.desktopUnavailable) }

function Set-Status([string]$Text, [bool]$Failed) {
    $statusLabel.Text = $Text
    $statusLabel.ForeColor = if ($Failed) { [System.Drawing.Color]::Firebrick } else { [System.Drawing.Color]::FromArgb(35, 92, 63) }
}

function Refresh-Profiles([string]$SelectId) {
    $payload = Invoke-ProfilesCore @('list', '--json')
    $script:profiles = @($payload.profiles)
    $profileList.Items.Clear()
    $selectedIndex = -1
    for ($index = 0; $index -lt $script:profiles.Count; $index++) {
        [void]$profileList.Items.Add($script:profiles[$index])
        if ($script:profiles[$index].id -eq $SelectId) { $selectedIndex = $index }
    }
    if ($selectedIndex -ge 0) { $profileList.SelectedIndex = $selectedIndex }
    elseif ($script:profiles.Count -gt 0) { $profileList.SelectedIndex = 0 }
    else { Set-Status $labels.empty $false }
}

function Get-SelectedProfile {
    if ($profileList.SelectedIndex -lt 0) {
        Set-Status $labels.selectProfile $true
        return $null
    }
    return $script:profiles[$profileList.SelectedIndex]
}

function Start-SelectedProfile([string]$Target, [string]$TargetLabel) {
    $profile = Get-SelectedProfile
    if (-not $profile) { return }
    try {
        $workspace = [System.IO.Path]::GetFullPath($workspaceBox.Text)
        $result = Invoke-ProfilesCore @('launch', [string]$profile.id, '--target', $Target, '--workspace', $workspace, '--json')
        Set-Status ($labels.launched -f $profile.name, $TargetLabel) $false
    }
    catch { Set-Status ($labels.failed -f $_.Exception.Message) $true }
}

$createButton.Add_Click({
    try {
        $result = Invoke-ProfilesCore @('create', $nameBox.Text, '--json')
        $nameBox.Clear()
        Refresh-Profiles ([string]$result.profile.id)
        Set-Status ($labels.created -f $result.profile.name) $false
    }
    catch { Set-Status ($labels.failed -f $_.Exception.Message) $true }
})
$nameBox.Add_KeyDown({ if ($_.KeyCode -eq [System.Windows.Forms.Keys]::Enter) { $createButton.PerformClick() } })
$browseButton.Add_Click({
    $dialog = New-Object System.Windows.Forms.FolderBrowserDialog
    $dialog.Description = $labels.selectWorkspace
    $dialog.SelectedPath = $workspaceBox.Text
    if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { $workspaceBox.Text = $dialog.SelectedPath }
    $dialog.Dispose()
})
$cliButton.Add_Click({ Start-SelectedProfile 'cli' 'CLI' })
$vscodeButton.Add_Click({ Start-SelectedProfile 'vscode' 'VS Code' })
$desktopButton.Add_Click({ Start-SelectedProfile 'desktop' $labels.launchDesktop })
$folderButton.Add_Click({
    $profile = Get-SelectedProfile
    if ($profile) { Start-Process explorer.exe -ArgumentList ('"{0}"' -f $profile.paths.root) }
})
$profileList.Add_DoubleClick({ Start-SelectedProfile 'vscode' 'VS Code' })
$form.Add_Shown({ Refresh-Profiles '' })

try { [void]$form.ShowDialog() }
finally {
    $toolTip.Dispose()
    if ($form.Icon) { $form.Icon.Dispose() }
    $form.Dispose()
}
