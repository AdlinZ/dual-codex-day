import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import {
  buildLaunchPlan,
  createProfile,
  findProfile,
  listProfiles,
  loadProfileRegistry,
  profileEnvironment
} from './lib/profile-store.mjs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertThrows(callback, pattern, message) {
  try { callback(); }
  catch (error) {
    assert(pattern.test(error.message), message);
    return;
  }
  throw new Error(message);
}

const root = path.resolve('.');
const temporaryRoot = mkdtempSync(path.join(os.tmpdir(), 'codex-day-profiles-test-'));
const profileRoot = path.join(temporaryRoot, 'profiles');
const fakeTargets = {
  cli: { available: true, executable: process.execPath },
  vscode: { available: true, executable: process.execPath },
  desktop: { available: true, executable: process.execPath, experimental: true }
};
const fakeEnvironment = {
  ...process.env,
  PATH: process.env.PATH,
  CODEX_ACCESS_TOKEN: 'must-not-leak',
  CODEX_API_KEY: 'must-not-leak',
  OPENAI_API_KEY: 'must-not-leak'
};
fakeEnvironment.OpenAi_Api_Key = 'must-not-leak-with-different-case';

try {
  assert(loadProfileRegistry(profileRoot).profiles.length === 0, 'missing registry should behave as an empty profile list');
  const first = createProfile(profileRoot, 'Work account');
  const second = createProfile(profileRoot, 'Personal account');
  assert(first.id !== second.id, 'profiles must have distinct opaque ids');
  assert(listProfiles(profileRoot).length === 2, 'created profiles must persist in the registry');
  assert(findProfile(profileRoot, first.id).name === 'Work account', 'profile lookup by id should work');
  assert(findProfile(profileRoot, 'personal account').id === second.id, 'profile lookup by name should be case insensitive');
  assertThrows(() => createProfile(profileRoot, 'work ACCOUNT'), /already exists/, 'duplicate display names must be rejected');
  assertThrows(() => createProfile(profileRoot, '   '), /1 to 40/, 'blank display names must be rejected');

  for (const directory of Object.values(first.paths)) {
    assert(existsSync(directory), `profile directory must exist: ${directory}`);
  }
  const config = readFileSync(path.join(first.paths.codexHome, 'config.toml'), 'utf8');
  assert(/cli_auth_credentials_store\s*=\s*"file"/.test(config), 'profile config must keep credentials inside CODEX_HOME');
  assert(!config.includes('token') && !config.includes('key ='), 'profile config must not contain credentials');

  const environment = profileEnvironment(first, fakeEnvironment);
  assert(environment.CODEX_HOME === first.paths.codexHome, 'child process must receive the selected CODEX_HOME');
  assert(environment.CODEX_SQLITE_HOME === first.paths.sqliteHome, 'child process must receive isolated SQLite state');
  assert(!Object.keys(environment).some(key => ['CODEX_ACCESS_TOKEN', 'CODEX_API_KEY', 'OPENAI_API_KEY'].includes(key.toUpperCase())), 'inherited credential variables must be removed case-insensitively');

  const cliPlan = buildLaunchPlan(first, 'cli', { targets: fakeTargets, environment: fakeEnvironment, workingDirectory: root });
  const vscodePlan = buildLaunchPlan(first, 'vscode', { targets: fakeTargets, environment: fakeEnvironment, workingDirectory: root });
  const desktopPlan = buildLaunchPlan(first, 'desktop', { targets: fakeTargets, environment: fakeEnvironment, workingDirectory: root });
  assert(cliPlan.args.includes(first.paths.codexHome) && cliPlan.args.includes(first.paths.sqliteHome), 'CLI runner must receive both isolated state paths');
  assert(vscodePlan.args.includes('--user-data-dir') && vscodePlan.args.includes(first.paths.vscodeData), 'VS Code must receive an isolated user data directory');
  assert(desktopPlan.args.includes(`--user-data-dir=${first.paths.desktopData}`), 'desktop app must receive an isolated Electron data directory');
  assert(desktopPlan.experimental === true && vscodePlan.experimental === false, 'only desktop multi-instance support should be marked experimental');
  assert(!vscodePlan.args.some(argument => argument.includes(first.name)), 'display names must not be used as filesystem arguments');

  const cli = spawnSync(process.execPath, ['scripts/codex-profiles.mjs', 'list', '--root', profileRoot, '--json'], { cwd: root, encoding: 'utf8' });
  assert(cli.status === 0, `profile CLI list failed: ${cli.stderr}`);
  const payload = JSON.parse(cli.stdout);
  assert(payload.schemaVersion === 1 && payload.profiles.length === 2, 'profile CLI must return the persisted registry');

  const uiPath = path.join(root, 'scripts', 'codex-profiles-ui.ps1');
  const ui = readFileSync(uiPath, 'utf8');
  const launcher = readFileSync(path.join(root, 'scripts', 'open-profiles.cmd'), 'utf8');
  const nativeSource = readFileSync(path.join(root, 'windows', 'CodexProfilesLauncher.cs'), 'utf8');
  const nativeBuild = readFileSync(path.join(root, 'scripts', 'build-profiles-launcher.ps1'), 'utf8');
  assert(/codex-profiles\.mjs/.test(ui) && /launch/.test(ui), 'Windows UI must use the shared profile core');
  assert(/dual-codex-day\.exe/.test(launcher) && /build-profiles-launcher\.ps1/.test(launcher), 'one-click launcher must prefer the branded native executable');
  assert(/codex-profiles-ui\.ps1/.test(launcher) && /WindowStyle Hidden/.test(launcher), 'one-click launcher must retain a hidden PowerShell fallback');
  assert(/namespace DualCodexDay\.Profiles/.test(nativeSource) && /codex-profiles\.mjs/.test(nativeSource), 'native launcher must use the shared profile core');
  assert(/target:winexe/.test(nativeBuild) && /System\.Web\.Extensions/.test(nativeBuild), 'native launcher build must produce a windowed executable with JSON support');
  assert(!/Get-Content[^\n]*auth\.json/i.test(ui), 'Windows UI must never read auth.json');
  assert(!/auth\.json/i.test(nativeSource), 'native UI must never reference auth.json');

  if (process.platform === 'win32') {
    const escapedPath = uiPath.replaceAll("'", "''");
    const parseCommand = `$tokens=$null; $errors=$null; [System.Management.Automation.Language.Parser]::ParseFile('${escapedPath}', [ref]$tokens, [ref]$errors) | Out-Null; if($errors.Count){ $errors | Out-String | Write-Error; exit 1 }`;
    const parsed = spawnSync('powershell.exe', ['-NoProfile', '-Command', parseCommand], { encoding: 'utf8' });
    assert(parsed.status === 0, `PowerShell profile UI syntax failed:\n${parsed.stderr || parsed.stdout}`);
    const built = spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(root, 'scripts', 'build-profiles-launcher.ps1')], { cwd: root, encoding: 'utf8' });
    assert(built.status === 0 && existsSync(path.join(root, 'dist', 'dual-codex-day.exe')), `native profile launcher build failed:\n${built.stderr || built.stdout}`);
  }

  console.log('Profile checks passed: isolated state, file credentials, safe names, target launch plans, CLI, and Windows UI.');
} finally {
  const resolved = path.resolve(temporaryRoot);
  if (resolved.startsWith(path.resolve(os.tmpdir())) && path.basename(resolved).startsWith('codex-day-profiles-test-')) {
    rmSync(resolved, { recursive: true, force: true });
  }
}
