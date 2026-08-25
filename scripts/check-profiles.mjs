import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { parse as parseToml } from 'smol-toml';
import {
  buildLaunchPlan,
  createProfile,
  findProfile,
  importProfileConfig,
  launchProfile,
  listProfileLaunches,
  listProfiles,
  loadProfileRegistry,
  PROFILE_PROVIDER_ENV_KEY,
  profileEnvironment,
  providerConfigPreview,
  updateProfileProvider,
  updateProfileUsageSource
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
  assert(first.usageSource === 'profile', 'new profiles must default to isolated usage data');
  const defaultUsageFirst = updateProfileUsageSource(profileRoot, first.id, 'default');
  assert(defaultUsageFirst.usageSource === 'default' && findProfile(profileRoot, first.id).usageSource === 'default', 'Profile usage source must persist independently');
  assertThrows(() => updateProfileUsageSource(profileRoot, first.id, 'shared'), /Unsupported Profile usage source/, 'unsupported Profile usage sources must be rejected');
  assertThrows(() => createProfile(profileRoot, 'work ACCOUNT'), /already exists/, 'duplicate display names must be rejected');
  assertThrows(() => createProfile(profileRoot, '   '), /1 to 40/, 'blank display names must be rejected');

  for (const directory of Object.values(first.paths)) {
    assert(existsSync(directory), `profile directory must exist: ${directory}`);
  }
  const config = readFileSync(path.join(first.paths.codexHome, 'config.toml'), 'utf8');
  assert(/cli_auth_credentials_store\s*=\s*"file"/.test(config), 'profile config must keep credentials inside CODEX_HOME');
  assert(!config.includes('token') && !config.includes('key ='), 'profile config must not contain credentials');

  const customProvider = {
    type: 'custom',
    name: 'Relay A',
    note: 'Development relay',
    baseUrl: 'https://relay.example.test/v1/',
    model: 'gpt-test',
    providerId: 'custom',
    authMode: 'environment',
    reasoningEffort: 'high',
    personality: 'pragmatic',
    disableResponseStorage: true
  };
  writeFileSync(path.join(first.paths.codexHome, 'config.toml'), `${config}\n[features]\nmemories = true\n\n[desktop]\nsansFontSize = 14\n`, 'utf8');
  const updatedFirst = updateProfileProvider(profileRoot, first.id, customProvider);
  const customConfig = readFileSync(path.join(first.paths.codexHome, 'config.toml'), 'utf8');
  const parsedConfig = parseToml(customConfig);
  assert(updatedFirst.provider.type === 'custom' && updatedFirst.provider.baseUrl === 'https://relay.example.test/v1', 'custom provider settings must persist per profile');
  assert(parsedConfig.model_provider === 'custom' && parsedConfig.model_providers.custom.wire_api === 'responses', 'custom provider TOML must select the requested Responses API provider id');
  assert(parsedConfig.model_providers.custom.env_key === PROFILE_PROVIDER_ENV_KEY && parsedConfig.model_providers.custom.requires_openai_auth === false, 'environment authentication must use only the dedicated launch variable');
  assert(parsedConfig.model_reasoning_effort === 'high' && parsedConfig.personality === 'pragmatic' && parsedConfig.disable_response_storage === true, 'advanced model settings must persist in generated TOML');
  assert(parsedConfig.features.memories === true && parsedConfig.desktop.sansFontSize === 14, 'provider updates must preserve existing common Profile settings');
  assert(!customConfig.includes('secret-provider-key'), 'generated TOML must never contain API key material');
  assert(!JSON.stringify(loadProfileRegistry(profileRoot)).includes('secret-provider-key'), 'profile registry must never contain API key material');
  assert(/cli_auth_credentials_store/.test(providerConfigPreview({ type: 'official' })), 'official provider preview must retain file credential isolation');

  const openAiAuthConfig = parseToml(providerConfigPreview({ ...customProvider, authMode: 'openai' }));
  assert(openAiAuthConfig.model_providers.custom.requires_openai_auth === true && !openAiAuthConfig.model_providers.custom.env_key, 'OpenAI authentication must not emit env_key');
  const noAuthConfig = parseToml(providerConfigPreview({ ...customProvider, authMode: 'none' }));
  assert(noAuthConfig.model_providers.custom.requires_openai_auth === false && !noAuthConfig.model_providers.custom.env_key, 'no-auth providers must not require a key');
  const openAiAuthProfile = { ...updatedFirst, provider: { ...updatedFirst.provider, authMode: 'openai', envKey: '', requiresOpenAIAuth: true } };
  const openAiAuthEnvironment = profileEnvironment(openAiAuthProfile, fakeEnvironment);
  assert(!openAiAuthEnvironment[PROFILE_PROVIDER_ENV_KEY], 'OpenAI-auth providers must launch without the CDC provider key');

  importProfileConfig(profileRoot, first.id, `
model_provider = "legacy"
model = "legacy-model"
notify = ["notify.exe", "turn-ended"]

[model_providers.legacy]
name = "Old relay"
base_url = "https://old.example.test/v1"
wire_api = "responses"

[features]
js_repl = false

[mcp_servers.figma]
command = "figma-bridge"
`);
  const importedConfig = parseToml(readFileSync(path.join(first.paths.codexHome, 'config.toml'), 'utf8'));
  assert(importedConfig.model_provider === 'custom' && importedConfig.model === 'gpt-test', 'config import must keep the destination Profile provider active');
  assert(!importedConfig.model_providers.legacy && importedConfig.model_providers.custom, 'config import must remove the source active provider definition');
  assert(importedConfig.features.js_repl === false && importedConfig.mcp_servers.figma.command === 'figma-bridge', 'config import must preserve common feature and MCP settings');
  assert(importedConfig.notify[1] === 'turn-ended', 'config import must preserve notification configuration');

  assertThrows(() => profileEnvironment(updatedFirst, fakeEnvironment), /API key is missing/, 'custom profiles must reject launches without a profile key');
  const environment = profileEnvironment(updatedFirst, fakeEnvironment, { providerApiKey: 'secret-provider-key' });
  assert(environment.CODEX_HOME === first.paths.codexHome, 'child process must receive the selected CODEX_HOME');
  assert(environment.CODEX_SQLITE_HOME === first.paths.sqliteHome, 'child process must receive isolated SQLite state');
  assert(environment[PROFILE_PROVIDER_ENV_KEY] === 'secret-provider-key', 'custom provider key must be injected only into the selected child environment');
  assert(!Object.keys(environment).some(key => ['CODEX_ACCESS_TOKEN', 'CODEX_API_KEY', 'OPENAI_API_KEY'].includes(key.toUpperCase())), 'inherited credential variables must be removed case-insensitively');
  const officialEnvironment = profileEnvironment(second, fakeEnvironment);
  assert(!officialEnvironment[PROFILE_PROVIDER_ENV_KEY], 'official profiles must not inherit a custom provider key');

  const providerOptions = { targets: fakeTargets, environment: fakeEnvironment, workingDirectory: root, providerApiKey: 'secret-provider-key' };
  const cliPlan = buildLaunchPlan(updatedFirst, 'cli', providerOptions);
  const vscodePlan = buildLaunchPlan(updatedFirst, 'vscode', providerOptions);
  const desktopPlan = buildLaunchPlan(updatedFirst, 'desktop', providerOptions);
  assert(cliPlan.args.includes(first.paths.codexHome) && cliPlan.args.includes(first.paths.sqliteHome), 'CLI runner must receive both isolated state paths');
  assert(vscodePlan.args.includes('--user-data-dir') && vscodePlan.args.includes(first.paths.vscodeData), 'VS Code must receive an isolated user data directory');
  assert(desktopPlan.args.includes(`--user-data-dir=${first.paths.desktopData}`), 'desktop app must receive an isolated Electron data directory');
  assert(desktopPlan.experimental === true && vscodePlan.experimental === false, 'only desktop multi-instance support should be marked experimental');
  assert(!vscodePlan.args.some(argument => argument.includes(first.name)), 'display names must not be used as filesystem arguments');

  const spawned = [];
  const spawnProcess = (command, args, options) => {
    const child = { pid: 41000 + spawned.length, unref() {} };
    spawned.push({ command, args, options, child });
    return child;
  };
  const firstLaunch = launchProfile(profileRoot, first.id, 'desktop', {
    targets: fakeTargets,
    environment: fakeEnvironment,
    workingDirectory: root,
    providerApiKey: 'secret-provider-key',
    spawnProcess
  });
  const secondLaunch = launchProfile(profileRoot, second.id, 'desktop', {
    targets: fakeTargets,
    environment: fakeEnvironment,
    workingDirectory: root,
    spawnProcess
  });
  const launches = listProfileLaunches(profileRoot, { limit: 8, isProcessAlive: pid => spawned.some(item => item.child.pid === pid) });
  assert(spawned.length === 2 && firstLaunch.pid !== secondLaunch.pid, 'two profiles must start as separate desktop processes');
  assert(launches.length === 2 && launches.every(launch => launch.active), 'launch history must retain both active profile instances');
  assert(new Set(launches.map(launch => launch.profileId)).size === 2, 'active instances must remain associated with distinct profiles');
  assert(spawned.every(item => item.options.detached === true && item.options.stdio === 'ignore'), 'profile clients must remain detached from the launcher');

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

  console.log('Profile checks passed: isolated state, two-profile desktop launches, persistent runtime status, CLI, and Windows UI.');
} finally {
  const resolved = path.resolve(temporaryRoot);
  if (resolved.startsWith(path.resolve(os.tmpdir())) && path.basename(resolved).startsWith('codex-day-profiles-test-')) {
    rmSync(resolved, { recursive: true, force: true });
  }
}
