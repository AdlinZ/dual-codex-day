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
assert(/Get-CodexDayStatus/.test(tray) && /\/healthz/.test(tray), 'tray must monitor the local health endpoint');
assert(/codex-day\.ico/.test(tray) && existsSync(iconPath), 'tray must use the generated codex-day icon');
assert(/codex-day-tray\.ps1/.test(launcher) && /-WindowStyle Hidden/.test(launcher), 'double-click launcher must start hidden tray mode');
assert(labels.open && labels.restart && labels.startup && labels.exit, 'tray labels must include all primary actions');

if (process.platform === 'win32') {
  const escapedPath = trayPath.replaceAll("'", "''");
  const command = `$tokens=$null; $errors=$null; [System.Management.Automation.Language.Parser]::ParseFile('${escapedPath}', [ref]$tokens, [ref]$errors) | Out-Null; if($errors.Count){ $errors | Out-String | Write-Error; exit 1 }`;
  const parsed = spawnSync('powershell.exe', ['-NoProfile', '-Command', command], { encoding: 'utf8' });
  assert(parsed.status === 0, `PowerShell tray syntax failed:\n${parsed.stderr || parsed.stdout}`);
}

console.log('Tray checks passed: single instance, owned process, startup toggle, health monitor, and launcher.');
