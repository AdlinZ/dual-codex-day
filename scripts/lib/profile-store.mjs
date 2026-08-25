import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseToml, stringify as stringifyToml } from 'smol-toml';

export const PROFILE_SCHEMA_VERSION = 1;
export const PROFILE_TARGETS = Object.freeze(['cli', 'vscode', 'desktop']);
export const PROFILE_PROVIDER_TYPES = Object.freeze(['official', 'custom']);
export const PROFILE_PROVIDER_AUTH_MODES = Object.freeze(['environment', 'openai', 'none']);
export const PROFILE_USAGE_SOURCES = Object.freeze(['profile', 'default']);
export const PROFILE_RUNTIME_SOURCES = Object.freeze(['profile', 'default']);
export const PROFILE_PROVIDER_ENV_KEY = 'DUAL_CODEX_DAY_PROVIDER_API_KEY';
const PROFILE_REASONING_EFFORTS = new Set(['minimal', 'low', 'medium', 'high', 'xhigh']);
const PROFILE_PERSONALITIES = new Set(['none', 'friendly', 'pragmatic']);
const RESERVED_PROVIDER_IDS = new Set(['openai', 'ollama', 'lmstudio']);
const LAUNCH_HISTORY_SCHEMA_VERSION = 1;
const MAX_LAUNCH_HISTORY = 24;

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
const scriptsDirectory = path.dirname(moduleDirectory);
const inheritedCredentialVariables = [
  'CODEX_ACCESS_TOKEN',
  'CODEX_API_KEY',
  'OPENAI_API_KEY'
];
const inheritedCredentialVariableSet = new Set(inheritedCredentialVariables);

function localDataRoot() {
  if (process.platform === 'win32') {
    return process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
  }
  return process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share');
}

export function defaultProfilesRoot() {
  return path.resolve(process.env.CODEX_PROFILES_ROOT || path.join(localDataRoot(), 'dual-codex-day', 'profiles'));
}

function emptyRegistry() {
  return { schemaVersion: PROFILE_SCHEMA_VERSION, profiles: [] };
}

function registryPath(root) {
  return path.join(root, 'profiles.json');
}

function launchHistoryPath(root) {
  return path.join(root, 'launches.json');
}

export function defaultProfileProvider() {
  return { type: 'official', name: 'OpenAI 官方' };
}

export function normalizeProfileUsageSource(value) {
  const source = String(value || 'profile').trim().toLowerCase();
  if (!PROFILE_USAGE_SOURCES.includes(source)) throw new Error(`Unsupported Profile usage source: ${source}`);
  return source;
}

export function normalizeProfileRuntimeSource(value) {
  const source = String(value || 'profile').trim().toLowerCase();
  if (!PROFILE_RUNTIME_SOURCES.includes(source)) throw new Error(`Unsupported Profile runtime source: ${source}`);
  return source;
}

function normalizeProviderText(value, label, maximumLength) {
  if (typeof value !== 'string') throw new Error(`${label} must be text.`);
  const normalized = value.trim();
  if (!normalized || normalized.length > maximumLength) throw new Error(`${label} must contain 1 to ${maximumLength} characters.`);
  if (/[\u0000-\u001f\u007f]/.test(normalized)) throw new Error(`${label} cannot contain control characters.`);
  return normalized;
}

function normalizeOptionalProviderText(value, label, maximumLength) {
  const normalized = String(value || '').trim();
  if (normalized.length > maximumLength) throw new Error(`${label} must contain at most ${maximumLength} characters.`);
  if (/[\x00-\x1f\x7f]/.test(normalized)) throw new Error(`${label} cannot contain control characters.`);
  return normalized;
}

function normalizeProviderEnum(value, allowedValues, label) {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized && !allowedValues.has(normalized)) throw new Error(`Unsupported ${label}: ${normalized}`);
  return normalized;
}

export function normalizeProfileProvider(value) {
  const type = String(value?.type || 'official').trim().toLowerCase();
  if (!PROFILE_PROVIDER_TYPES.includes(type)) throw new Error(`Unsupported provider type: ${type}`);
  if (type === 'official') return defaultProfileProvider();

  const name = normalizeProviderText(value?.name, 'Provider name', 60);
  const note = normalizeOptionalProviderText(value?.note, 'Provider note', 120);
  const model = normalizeProviderText(value?.model, 'Model name', 100);
  const providerId = normalizeProviderText(value?.providerId || 'custom', 'Provider id', 40).toLowerCase();
  if (!/^[a-z0-9_-]+$/.test(providerId) || RESERVED_PROVIDER_IDS.has(providerId)) {
    throw new Error('Provider id must use letters, numbers, underscores, or hyphens and cannot use a reserved id.');
  }
  const legacyAuthMode = value?.requiresOpenAIAuth === true ? 'openai' : 'environment';
  const authMode = String(value?.authMode || legacyAuthMode).trim().toLowerCase();
  if (!PROFILE_PROVIDER_AUTH_MODES.includes(authMode)) throw new Error(`Unsupported provider auth mode: ${authMode}`);
  const reasoningEffort = normalizeProviderEnum(value?.reasoningEffort, PROFILE_REASONING_EFFORTS, 'reasoning effort');
  const personality = normalizeProviderEnum(value?.personality, PROFILE_PERSONALITIES, 'personality');
  const rawBaseUrl = normalizeProviderText(value?.baseUrl, 'Base URL', 500);
  let parsedUrl;
  try {
    parsedUrl = new URL(rawBaseUrl);
  } catch {
    throw new Error('Base URL must be a valid HTTP or HTTPS URL.');
  }
  if (!['http:', 'https:'].includes(parsedUrl.protocol) || parsedUrl.username || parsedUrl.password || parsedUrl.search || parsedUrl.hash) {
    throw new Error('Base URL must be a valid HTTP or HTTPS URL without credentials, query parameters, or a fragment.');
  }
  const baseUrl = parsedUrl.toString().replace(/\/$/, '');
  return {
    type,
    name,
    note,
    baseUrl,
    model,
    providerId,
    authMode,
    reasoningEffort,
    personality,
    disableResponseStorage: value?.disableResponseStorage === true,
    wireApi: 'responses',
    envKey: authMode === 'environment' ? PROFILE_PROVIDER_ENV_KEY : '',
    requiresOpenAIAuth: authMode === 'openai'
  };
}

function parseProfileConfig(configText) {
  const source = String(configText || '').trim();
  if (!source) return {};
  try {
    return parseToml(source);
  } catch (error) {
    throw new Error(`Existing config.toml is invalid: ${error.message}`);
  }
}

function removePreviousProviderConfig(config, previousProvider) {
  if (previousProvider?.type !== 'custom') return;
  const previous = normalizeProfileProvider(previousProvider);
  if (config.model_provider === previous.providerId) delete config.model_provider;
  if (config.model === previous.model) delete config.model;
  if (previous.reasoningEffort && config.model_reasoning_effort === previous.reasoningEffort) delete config.model_reasoning_effort;
  if (previous.personality && config.personality === previous.personality) delete config.personality;
  if (previous.disableResponseStorage && config.disable_response_storage === true) delete config.disable_response_storage;
  if (config.model_providers && typeof config.model_providers === 'object') {
    delete config.model_providers[previous.providerId];
    if (!Object.keys(config.model_providers).length) delete config.model_providers;
  }
}

function buildProviderConfig(value, configText = '', previousProvider = null) {
  const provider = normalizeProfileProvider(value);
  const config = parseProfileConfig(configText);
  removePreviousProviderConfig(config, previousProvider);
  config.cli_auth_credentials_store = 'file';
  if (provider.type === 'custom') {
    config.model = provider.model;
    config.model_provider = provider.providerId;
    if (provider.reasoningEffort) config.model_reasoning_effort = provider.reasoningEffort;
    else delete config.model_reasoning_effort;
    if (provider.personality) config.personality = provider.personality;
    else delete config.personality;
    if (provider.disableResponseStorage) config.disable_response_storage = true;
    else delete config.disable_response_storage;
    config.model_providers ||= {};
    const providerConfig = {
      name: provider.name,
      base_url: provider.baseUrl,
      wire_api: 'responses'
    };
    if (provider.authMode === 'environment') {
      providerConfig.env_key = PROFILE_PROVIDER_ENV_KEY;
      providerConfig.requires_openai_auth = false;
    } else if (provider.authMode === 'openai') {
      providerConfig.requires_openai_auth = true;
    } else {
      providerConfig.requires_openai_auth = false;
    }
    config.model_providers[provider.providerId] = providerConfig;
  }
  return config;
}

export function providerConfigPreview(value, configText = '', previousProvider = null) {
  const config = buildProviderConfig(value, configText, previousProvider);
  return [
    '# Provider settings managed by Dual Codex Day.',
    '# Existing Profile settings are preserved; CDC never writes API keys here.',
    stringifyToml(config).trimEnd(),
    ''
  ].join('\n');
}

function validateRegistry(registry) {
  if (!registry || registry.schemaVersion !== PROFILE_SCHEMA_VERSION || !Array.isArray(registry.profiles)) {
    throw new Error(`Unsupported or invalid profile registry. Expected schema ${PROFILE_SCHEMA_VERSION}.`);
  }
  const ids = new Set();
  for (const profile of registry.profiles) {
    if (!profile || typeof profile.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(profile.id)) {
      throw new Error('Profile registry contains an invalid profile id.');
    }
    if (ids.has(profile.id)) throw new Error('Profile registry contains a duplicate profile id.');
    ids.add(profile.id);
    normalizeProfileName(profile.name);
    if (profile.provider) normalizeProfileProvider(profile.provider);
    normalizeProfileUsageSource(profile.usageSource);
    normalizeProfileRuntimeSource(profile.runtimeSource || profile.usageSource);
  }
  return registry;
}

export function loadProfileRegistry(root = defaultProfilesRoot()) {
  const resolvedRoot = path.resolve(root);
  const filePath = registryPath(resolvedRoot);
  if (!existsSync(filePath)) return emptyRegistry();
  try {
    return validateRegistry(JSON.parse(readFileSync(filePath, 'utf8')));
  } catch (error) {
    throw new Error(`Cannot read profile registry: ${error.message}`);
  }
}

function saveProfileRegistry(root, registry) {
  const resolvedRoot = path.resolve(root);
  mkdirSync(resolvedRoot, { recursive: true });
  validateRegistry(registry);
  const target = registryPath(resolvedRoot);
  const temporary = `${target}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(registry, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  renameSync(temporary, target);
}

function writeJsonAtomically(target, value) {
  mkdirSync(path.dirname(target), { recursive: true });
  const temporary = `${target}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  renameSync(temporary, target);
}

function writeTextAtomically(target, value) {
  mkdirSync(path.dirname(target), { recursive: true });
  const temporary = `${target}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(temporary, value, { encoding: 'utf8', mode: 0o600 });
  renameSync(temporary, target);
}

function loadLaunchHistory(root) {
  const target = launchHistoryPath(path.resolve(root));
  if (!existsSync(target)) return { schemaVersion: LAUNCH_HISTORY_SCHEMA_VERSION, launches: [] };
  try {
    const history = JSON.parse(readFileSync(target, 'utf8'));
    if (history?.schemaVersion !== LAUNCH_HISTORY_SCHEMA_VERSION || !Array.isArray(history.launches)) {
      throw new Error(`expected schema ${LAUNCH_HISTORY_SCHEMA_VERSION}`);
    }
    return history;
  } catch (error) {
    throw new Error(`Cannot read launch history: ${error.message}`);
  }
}

function rememberLaunch(root, launch) {
  const history = loadLaunchHistory(root);
  history.launches.unshift(launch);
  history.launches = history.launches.slice(0, MAX_LAUNCH_HISTORY);
  writeJsonAtomically(launchHistoryPath(path.resolve(root)), history);
}

export function isProcessAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === 'EPERM';
  }
}

export function listProfileLaunches(root = defaultProfilesRoot(), options = {}) {
  const limit = Math.max(1, Math.min(Number(options.limit) || 8, MAX_LAUNCH_HISTORY));
  const checkProcess = options.isProcessAlive || isProcessAlive;
  return loadLaunchHistory(root).launches.slice(0, limit).map(launch => ({
    ...launch,
    active: checkProcess(launch.pid)
  }));
}

export function normalizeProfileName(value) {
  if (typeof value !== 'string') throw new Error('Profile name must be text.');
  const name = value.trim();
  if (name.length < 1 || name.length > 40) throw new Error('Profile name must contain 1 to 40 characters.');
  if (/[\u0000-\u001f\u007f]/.test(name)) throw new Error('Profile name cannot contain control characters.');
  return name;
}

export function profilePaths(root, profileId) {
  const profileRoot = path.join(path.resolve(root), 'data', profileId);
  const codexHome = path.join(profileRoot, 'codex-home');
  return {
    root: profileRoot,
    codexHome,
    sqliteHome: path.join(codexHome, 'sqlite'),
    desktopData: path.join(profileRoot, 'desktop-data'),
    vscodeData: path.join(profileRoot, 'vscode-data')
  };
}

function ensureProfileDirectories(paths, provider = defaultProfileProvider()) {
  for (const directory of Object.values(paths)) mkdirSync(directory, { recursive: true });
  const configPath = path.join(paths.codexHome, 'config.toml');
  if (!existsSync(configPath)) {
    writeTextAtomically(configPath, providerConfigPreview(provider));
  }
}

function externalResourcePath(filePath) {
  const marker = `${path.sep}app.asar${path.sep}`;
  if (!filePath.includes(marker)) return filePath;
  const unpacked = filePath.replace(marker, `${path.sep}app.asar.unpacked${path.sep}`);
  return existsSync(unpacked) ? unpacked : filePath;
}

function enrichProfile(root, profile) {
  return {
    ...profile,
    provider: normalizeProfileProvider(profile.provider || defaultProfileProvider()),
    usageSource: normalizeProfileUsageSource(profile.usageSource),
    runtimeSource: normalizeProfileRuntimeSource(profile.runtimeSource || profile.usageSource),
    paths: profilePaths(root, profile.id)
  };
}

export function listProfiles(root = defaultProfilesRoot()) {
  return loadProfileRegistry(root).profiles.map(profile => enrichProfile(root, profile));
}

export function createProfile(root = defaultProfilesRoot(), requestedName) {
  const name = normalizeProfileName(requestedName);
  const registry = loadProfileRegistry(root);
  if (registry.profiles.some(profile => profile.name.localeCompare(name, undefined, { sensitivity: 'accent' }) === 0)) {
    throw new Error(`A profile named "${name}" already exists.`);
  }
  const timestamp = new Date().toISOString();
  const profile = {
    id: randomUUID(),
    name,
    provider: defaultProfileProvider(),
    usageSource: 'profile',
    runtimeSource: 'profile',
    createdAt: timestamp,
    updatedAt: timestamp
  };
  const paths = profilePaths(root, profile.id);
  ensureProfileDirectories(paths, profile.provider);
  registry.profiles.push(profile);
  saveProfileRegistry(root, registry);
  return enrichProfile(root, profile);
}

export function findProfile(root = defaultProfilesRoot(), reference) {
  const query = String(reference || '').trim();
  if (!query) throw new Error('A profile id or name is required.');
  const profiles = listProfiles(root);
  const exactId = profiles.find(profile => profile.id === query);
  if (exactId) return exactId;
  const byName = profiles.filter(profile => profile.name.localeCompare(query, undefined, { sensitivity: 'accent' }) === 0);
  if (byName.length === 1) return byName[0];
  throw new Error(`Profile not found: ${query}`);
}

export function updateProfileProvider(root = defaultProfilesRoot(), reference, requestedProvider) {
  const registry = loadProfileRegistry(root);
  const query = String(reference || '').trim();
  const index = registry.profiles.findIndex(profile => profile.id === query
    || profile.name.localeCompare(query, undefined, { sensitivity: 'accent' }) === 0);
  if (index < 0) throw new Error(`Profile not found: ${query}`);
  const provider = normalizeProfileProvider(requestedProvider);
  const profile = registry.profiles[index];
  const paths = profilePaths(root, profile.id);
  const configPath = path.join(paths.codexHome, 'config.toml');
  const existingConfig = existsSync(configPath) ? readFileSync(configPath, 'utf8') : '';
  writeTextAtomically(configPath, providerConfigPreview(provider, existingConfig, profile.provider));
  profile.provider = provider;
  if (provider.type === 'custom') profile.runtimeSource = 'profile';
  profile.updatedAt = new Date().toISOString();
  saveProfileRegistry(root, registry);
  return enrichProfile(root, profile);
}

export function renameProfile(root = defaultProfilesRoot(), reference, requestedName) {
  const registry = loadProfileRegistry(root);
  const query = String(reference || '').trim();
  const index = registry.profiles.findIndex(profile => profile.id === query
    || profile.name.localeCompare(query, undefined, { sensitivity: 'accent' }) === 0);
  if (index < 0) throw new Error(`Profile not found: ${query}`);
  const name = normalizeProfileName(requestedName);
  if (registry.profiles.some((profile, profileIndex) => profileIndex !== index
    && profile.name.localeCompare(name, undefined, { sensitivity: 'accent' }) === 0)) {
    throw new Error(`A profile named "${name}" already exists.`);
  }
  registry.profiles[index].name = name;
  registry.profiles[index].updatedAt = new Date().toISOString();
  saveProfileRegistry(root, registry);
  return enrichProfile(root, registry.profiles[index]);
}

export function removeProfile(root = defaultProfilesRoot(), reference) {
  const registry = loadProfileRegistry(root);
  const query = String(reference || '').trim();
  const index = registry.profiles.findIndex(profile => profile.id === query
    || profile.name.localeCompare(query, undefined, { sensitivity: 'accent' }) === 0);
  if (index < 0) throw new Error(`Profile not found: ${query}`);
  const [removed] = registry.profiles.splice(index, 1);
  saveProfileRegistry(root, registry);
  return enrichProfile(root, removed);
}

export function updateProfileUsageSource(root = defaultProfilesRoot(), reference, requestedSource) {
  const registry = loadProfileRegistry(root);
  const query = String(reference || '').trim();
  const index = registry.profiles.findIndex(profile => profile.id === query
    || profile.name.localeCompare(query, undefined, { sensitivity: 'accent' }) === 0);
  if (index < 0) throw new Error(`Profile not found: ${query}`);
  registry.profiles[index].usageSource = normalizeProfileUsageSource(requestedSource);
  registry.profiles[index].updatedAt = new Date().toISOString();
  saveProfileRegistry(root, registry);
  return enrichProfile(root, registry.profiles[index]);
}

export function updateProfileRuntimeSource(root = defaultProfilesRoot(), reference, requestedSource) {
  const registry = loadProfileRegistry(root);
  const query = String(reference || '').trim();
  const index = registry.profiles.findIndex(profile => profile.id === query
    || profile.name.localeCompare(query, undefined, { sensitivity: 'accent' }) === 0);
  if (index < 0) throw new Error(`Profile not found: ${query}`);
  const source = normalizeProfileRuntimeSource(requestedSource);
  const provider = normalizeProfileProvider(registry.profiles[index].provider || defaultProfileProvider());
  if (source === 'default' && provider.type !== 'official') {
    throw new Error('Custom providers require an isolated Profile runtime.');
  }
  registry.profiles[index].runtimeSource = source;
  registry.profiles[index].updatedAt = new Date().toISOString();
  saveProfileRegistry(root, registry);
  return enrichProfile(root, registry.profiles[index]);
}

export function importProfileConfig(root = defaultProfilesRoot(), reference, sourceText) {
  const profile = findProfile(root, reference);
  const imported = parseProfileConfig(sourceText);
  const importedProviderId = typeof imported.model_provider === 'string' ? imported.model_provider : '';
  delete imported.model;
  delete imported.model_provider;
  delete imported.model_reasoning_effort;
  delete imported.personality;
  delete imported.disable_response_storage;
  if (importedProviderId && imported.model_providers && typeof imported.model_providers === 'object') {
    delete imported.model_providers[importedProviderId];
    if (!Object.keys(imported.model_providers).length) delete imported.model_providers;
  }
  const configPath = path.join(profile.paths.codexHome, 'config.toml');
  writeTextAtomically(configPath, providerConfigPreview(profile.provider, stringifyToml(imported), null));
  return findProfile(root, profile.id);
}

function executableFromPath(names, environment = process.env) {
  const searchPath = environment.PATH || environment.Path || '';
  const extensions = process.platform === 'win32'
    ? (environment.PATHEXT || '.EXE;.CMD;.BAT;.COM').split(';')
    : [''];
  for (const directory of searchPath.split(path.delimiter).filter(Boolean)) {
    for (const name of names) {
      const candidates = path.extname(name) ? [name] : extensions.map(extension => `${name}${extension.toLowerCase()}`);
      for (const candidate of candidates) {
        const filePath = path.join(directory.replace(/^"|"$/g, ''), candidate);
        if (existsSync(filePath)) return filePath;
      }
    }
  }
  return null;
}

function detectCodeExecutable(environment = process.env) {
  if (environment.CODEX_PROFILES_VSCODE_EXE && existsSync(environment.CODEX_PROFILES_VSCODE_EXE)) {
    return path.resolve(environment.CODEX_PROFILES_VSCODE_EXE);
  }
  const candidates = process.platform === 'win32' ? [
    path.join(environment.LOCALAPPDATA || '', 'Programs', 'Microsoft VS Code', 'Code.exe'),
    path.join(environment.ProgramFiles || '', 'Microsoft VS Code', 'Code.exe')
  ] : [];
  return candidates.find(candidate => candidate && existsSync(candidate)) || executableFromPath(['code'], environment);
}

function detectDesktopExecutable(environment = process.env) {
  if (environment.CODEX_DESKTOP_EXE && existsSync(environment.CODEX_DESKTOP_EXE)) {
    return path.resolve(environment.CODEX_DESKTOP_EXE);
  }
  if (process.platform !== 'win32') return null;
  const powershell = executableFromPath(['powershell.exe', 'pwsh.exe'], environment);
  if (!powershell) return null;
  const command = "$p=Get-AppxPackage OpenAI.Codex -ErrorAction SilentlyContinue | Select-Object -First 1; if($p){ Join-Path $p.InstallLocation 'app\\ChatGPT.exe' }";
  const result = spawnSync(powershell, ['-NoProfile', '-Command', command], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 5000
  });
  const candidate = String(result.stdout || '').trim();
  return result.status === 0 && candidate && existsSync(candidate) ? candidate : null;
}

function detectUserCodexExecutable(environment = process.env) {
  for (const variable of ['CODEX_PROFILES_CODEX_EXE', 'CODEX_CLI_PATH']) {
    if (environment[variable] && existsSync(environment[variable])) return path.resolve(environment[variable]);
  }
  if (process.platform !== 'win32') return null;
  const binRoot = path.join(environment.LOCALAPPDATA || '', 'OpenAI', 'Codex', 'bin');
  if (!existsSync(binRoot)) return null;
  return readdirSync(binRoot, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => path.join(binRoot, entry.name, 'codex.exe'))
    .filter(existsSync)
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0] || null;
}

export function detectProfileTargets(environment = process.env) {
  const codex = detectUserCodexExecutable(environment) || executableFromPath(['codex.exe', 'codex'], environment);
  const vscode = detectCodeExecutable(environment);
  const desktop = detectDesktopExecutable(environment);
  return {
    cli: { available: Boolean(codex), executable: codex },
    vscode: { available: Boolean(vscode), executable: vscode },
    desktop: { available: Boolean(desktop), executable: desktop, experimental: true }
  };
}

export function readProfileLoginStatus(profile, options = {}) {
  const provider = normalizeProfileProvider(profile.provider || defaultProfileProvider());
  if (provider.type === 'custom' && provider.authMode === 'environment') {
    return { state: options.hasProviderCredential ? 'ready' : 'missing', method: 'provider-key' };
  }
  if (provider.type === 'custom' && provider.authMode === 'none') {
    return { state: 'ready', method: 'none' };
  }
  const environment = options.environment || process.env;
  const targets = options.targets || detectProfileTargets(environment);
  if (!targets.cli?.available || !targets.cli.executable) return { state: 'unknown', method: 'unknown' };
  const runtimeEnvironment = profileEnvironment(profile, environment, {
    runtimeSource: profile.runtimeSource || profile.usageSource,
    defaultCodexHome: options.defaultCodexHome,
    defaultSqliteHome: options.defaultSqliteHome
  });
  const result = spawnSync(targets.cli.executable, ['login', 'status'], {
    cwd: options.workingDirectory || process.cwd(),
    env: runtimeEnvironment,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 5000
  });
  const output = `${result.stdout || ''}\n${result.stderr || ''}`;
  if (/Logged in using ChatGPT/i.test(output)) return { state: 'authenticated', method: 'chatgpt' };
  if (/Logged in using an API key/i.test(output)) return { state: 'authenticated', method: 'api-key' };
  if (/Not logged in/i.test(output)) return { state: 'signed-out', method: 'none' };
  return { state: 'unknown', method: 'unknown' };
}

export function profileEnvironment(profile, baseEnvironment = process.env, options = {}) {
  const environment = { ...baseEnvironment };
  const runtimeSource = normalizeProfileRuntimeSource(options.runtimeSource || profile.runtimeSource || profile.usageSource);
  if (runtimeSource === 'profile') {
    for (const variable of Object.keys(environment)) {
      if (inheritedCredentialVariableSet.has(variable.toUpperCase())) delete environment[variable];
    }
  }
  environment.CODEX_HOME = runtimeSource === 'default'
    ? path.resolve(options.defaultCodexHome || baseEnvironment.CODEX_HOME || path.join(os.homedir(), '.codex'))
    : profile.paths.codexHome;
  environment.CODEX_SQLITE_HOME = runtimeSource === 'default'
    ? path.resolve(options.defaultSqliteHome || baseEnvironment.CODEX_SQLITE_HOME || environment.CODEX_HOME)
    : profile.paths.sqliteHome;
  environment.CODEX_PROFILE_ID = profile.id;
  environment.CODEX_PROFILE_NAME = profile.name;
  const provider = normalizeProfileProvider(profile.provider || defaultProfileProvider());
  if (provider.type === 'custom' && provider.authMode === 'environment') {
    const apiKey = String(options.providerApiKey || environment[PROFILE_PROVIDER_ENV_KEY] || '');
    if (!apiKey) throw new Error('Custom provider API key is missing for this profile.');
    environment[PROFILE_PROVIDER_ENV_KEY] = apiKey;
  } else {
    delete environment[PROFILE_PROVIDER_ENV_KEY];
  }
  return environment;
}

function validateWorkingDirectory(value) {
  const directory = path.resolve(value || process.cwd());
  if (!existsSync(directory)) throw new Error(`Working directory does not exist: ${directory}`);
  return directory;
}

export function buildLaunchPlan(profile, target, options = {}) {
  if (!PROFILE_TARGETS.includes(target)) throw new Error(`Unsupported target: ${target}`);
  ensureProfileDirectories(profile.paths, profile.provider);
  const workingDirectory = validateWorkingDirectory(options.workingDirectory);
  const targets = options.targets || detectProfileTargets(options.environment || process.env);
  const detected = targets[target];
  if (!detected?.available || !detected.executable) throw new Error(`${target} is not installed or could not be located.`);
  const runtimeSource = normalizeProfileRuntimeSource(profile.runtimeSource || profile.usageSource);
  const environment = profileEnvironment(profile, options.environment || process.env, {
    providerApiKey: options.providerApiKey,
    runtimeSource,
    defaultCodexHome: options.defaultCodexHome,
    defaultSqliteHome: options.defaultSqliteHome
  });
  const codexHome = runtimeSource === 'default' ? environment.CODEX_HOME : profile.paths.codexHome;
  const sqliteHome = runtimeSource === 'default' ? environment.CODEX_SQLITE_HOME : profile.paths.sqliteHome;

  if (target === 'cli') {
    const powershell = executableFromPath(['powershell.exe', 'pwsh.exe'], options.environment || process.env);
    if (!powershell) throw new Error('PowerShell is required to open an interactive Codex terminal.');
    const runner = externalResourcePath(path.join(scriptsDirectory, 'run-codex-profile.ps1'));
    return {
      target,
      command: powershell,
      args: [
        '-NoLogo', '-NoExit', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', runner,
        '-CodexHome', codexHome,
        '-SqliteHome', sqliteHome,
        '-CodexExecutable', detected.executable,
        '-WorkingDirectory', workingDirectory,
        '-ProfileName', profile.name
      ],
      cwd: workingDirectory,
      environment,
      experimental: false
    };
  }

  if (target === 'vscode') {
    return {
      target,
      command: detected.executable,
      args: runtimeSource === 'default'
        ? ['--new-window', workingDirectory]
        : ['--new-window', '--user-data-dir', profile.paths.vscodeData, workingDirectory],
      cwd: workingDirectory,
      environment,
      experimental: false
    };
  }

  return {
    target,
    command: detected.executable,
    args: runtimeSource === 'default' ? [] : [`--user-data-dir=${profile.paths.desktopData}`],
    cwd: workingDirectory,
    environment,
    experimental: true
  };
}

export function launchProfile(root, reference, target, options = {}) {
  const profile = findProfile(root, reference);
  const plan = buildLaunchPlan(profile, target, options);
  const spawnProcess = options.spawnProcess || spawn;
  const child = spawnProcess(plan.command, plan.args, {
    cwd: plan.cwd,
    env: plan.environment,
    detached: true,
    stdio: 'ignore',
    windowsHide: false
  });
  child.unref();
  const result = {
    id: randomUUID(),
    profile: { id: profile.id, name: profile.name },
    target: plan.target,
    runtimeSource: normalizeProfileRuntimeSource(profile.runtimeSource || profile.usageSource),
    experimental: plan.experimental,
    pid: child.pid,
    launchedAt: new Date().toISOString()
  };
  rememberLaunch(root, {
    id: result.id,
    profileId: result.profile.id,
    profileName: result.profile.name,
    target: result.target,
    runtimeSource: result.runtimeSource,
    pid: result.pid,
    launchedAt: result.launchedAt
  });
  return result;
}
