import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const trayPath = path.resolve('scripts', 'codex-day-tray.ps1');
const tray = readFileSync(trayPath, 'utf8');
const launcher = readFileSync('scripts/open-dashboard.cmd', 'utf8');
const labels = JSON.parse(readFileSync('config/tray.zh-CN.json', 'utf8'));
const iconPath = path.resolve('assets', 'codex-day.ico');

assert(/Local\\CodexDayTray/.test(tray), 'tray must enforce a single instance');
assert(/HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run/.test(tray), 'tray must use the current-user startup registry key');
assert(/Test-OwnedServiceProcess/.test(tray) && /--pid-file/.test(tray), 'tray must stop only its owned service process');
assert(/Get-CodexDayStatus/.test(tray) && /\/api\/status/.test(tray), 'tray must monitor the detailed local status endpoint');
assert(/Show-DailySummary/.test(tray) && /\/api\/summary/.test(tray), 'tray must expose the local daily summary');
assert(/CodexDayDailySummary/.test(tray) && /daily-summary-date\.txt/.test(tray), 'tray must persist the optional once-daily notification state');
assert(/CodexDayDailySummaryHour/.test(tray), 'tray must persist the configured daily-summary hour');
assert(/@\(17, 18, 20, 22\)/.test(tray), 'tray must expose all supported daily-summary hours');
assert(/codex-day\.ico/.test(tray) && existsSync(iconPath), 'tray must use the generated codex-day icon');
assert(/codex-day-tray\.ps1/.test(launcher) && /-WindowStyle Hidden/.test(launcher), 'double-click launcher must start hidden tray mode');
assert(labels.open && labels.restart && labels.dailySummary && labels.dailySummaryNotifications && labels.dailySummaryTime && labels.startup && labels.exit, 'tray labels must include all primary actions');

if (process.platform === 'win32') {
  const escapedPath = trayPath.replaceAll("'", "''");
  const command = `$tokens=$null; $errors=$null; [System.Management.Automation.Language.Parser]::ParseFile('${escapedPath}', [ref]$tokens, [ref]$errors) | Out-Null; if($errors.Count){ $errors | Out-String | Write-Error; exit 1 }`;
  const parsed = spawnSync('powershell.exe', ['-NoProfile', '-Command', command], { encoding: 'utf8' });
  assert(parsed.status === 0, `PowerShell tray syntax failed:\n${parsed.stderr || parsed.stdout}`);
}

console.log('Tray checks passed: single instance, owned process, configurable daily-summary time, status monitor, and launcher.');
