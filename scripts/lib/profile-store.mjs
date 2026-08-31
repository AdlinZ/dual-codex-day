import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseToml, stringify as stringifyToml } from 'smol-toml';
import { createProfileTransfer, parseProfileTransfer, transferDiff } from './profile-transfer.mjs';

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
const PROCESS_IDENTITY_TOLERANCE_MS = 30_000;

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

function processStartTime(pid, options = {}) {
  const spawnSyncProcess = options.spawnSyncProcess || spawnSync;
  if (process.platform === 'win32') {
    const powershell = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
    const command = `$item = Get-CimInstance Win32_Process -Filter 'ProcessId = ${pid}' -ErrorAction SilentlyContinue; if ($null -eq $item) { exit 3 }; ([DateTimeOffset]$item.CreationDate).ToUnixTimeMilliseconds()`;
    const result = spawnSyncProcess(powershell, ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', command], {
      encoding: 'utf8',
      timeout: 5_000,
      windowsHide: true
    });
    if (result.status !== 0) return null;
    const startedAt = Number(String(result.stdout || '').trim());
    return Number.isFinite(startedAt) ? startedAt : null;
  }

  const result = spawnSyncProcess('ps', ['-p', String(pid), '-o', 'lstart='], {
    encoding: 'utf8',
    timeout: 5_000,
    windowsHide: true
  });
  if (result.status !== 0) return null;
  const startedAt = Date.parse(String(result.stdout || '').trim());
  return Number.isFinite(startedAt) ? startedAt : null;
}

export function verifyLaunchProcessIdentity(launch, options = {}) {
  const launchedAt = Date.parse(String(launch?.launchedAt || ''));
  if (!Number.isFinite(launchedAt)) return false;
  const startedAt = processStartTime(launch.pid, options);
  if (!Number.isFinite(startedAt)) return false;
  return Math.abs(startedAt - launchedAt) <= PROCESS_IDENTITY_TOLERANCE_MS;
}

function terminateProcessTree(pid, force = false, options = {}) {
  if (process.platform === 'win32') {
    const spawnSyncProcess = options.spawnSyncProcess || spawnSync;
    const taskkill = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'taskkill.exe');
    const args = ['/PID', String(pid), '/T'];
    if (force) args.push('/F');
    const result = spawnSyncProcess(taskkill, args, {
      encoding: 'utf8',
      timeout: 5_000,
      windowsHide: true
    });
    return result.status === 0;
  }

  const signal = force ? 'SIGKILL' : 'SIGTERM';
  try {
    process.kill(-pid, signal);
  } catch (error) {
    if (error?.code === 'ESRCH') return true;
    process.kill(pid, signal);
  }
  return true;
}

async function waitForProcessExit(pid, checkProcess, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!checkProcess(pid)) return true;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  return !checkProcess(pid);
}

export async function stopProfileLaunch(root = defaultProfilesRoot(), launchId, options = {}) {
  const id = String(launchId || '').trim();
  if (!id) throw new Error('Launch id is required.');
  const launch = loadLaunchHistory(path.resolve(root)).launches.find(item => item.id === id);
  if (!launch) throw new Error('Launch record was not found.');

  const checkProcess = options.isProcessAlive || isProcessAlive;
  if (!checkProcess(launch.pid)) {
    return { ...launch, active: false, alreadyStopped: true, forced: false };
  }

  const verifyProcess = options.verifyProcessIdentity || verifyLaunchProcessIdentity;
  if (!await verifyProcess(launch)) {
    throw new Error('Cannot verify that the running process still belongs to this launch record.');
  }

  const terminate = options.terminateProcessTree || terminateProcessTree;
  const waitForExit = options.waitForExit || waitForProcessExit;
  const gracefulAccepted = await terminate(launch.pid, false);
  if (!checkProcess(launch.pid) || (gracefulAccepted !== false && await waitForExit(launch.pid, checkProcess, 8_000))) {
    return { ...launch, active: false, alreadyStopped: false, forced: false };
  }

  await terminate(launch.pid, true);
  if (!await waitForExit(launch.pid, checkProcess, 3_000)) {
    throw new Error('The client process did not exit after a forced stop.');
  }
  return { ...launch, active: false, alreadyStopped: false, forced: true };
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

function installedProfileSkills(profile) {
  const root = path.join(profile.paths.codexHome, 'skills');
  if (!existsSync(root) || !statSync(root).isDirectory()) return [];
  const configPath = path.join(profile.paths.codexHome, 'config.toml');
  const config = existsSync(configPath) ? parseProfileConfig(readFileSync(configPath, 'utf8')) : {};
  const enabledByPath = new Map((Array.isArray(config.skills?.config) ? config.skills.config : [])
    .map(item => [path.resolve(String(item?.path || '')).toLowerCase(), item?.enabled !== false]));
  return readdirSync(root, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && entry.name !== '.system')
    .map(entry => {
      const skillFile = path.join(root, entry.name, 'SKILL.md');
      return { id: entry.name, enabled: enabledByPath.get(path.resolve(skillFile).toLowerCase()) !== false };
    });
}

export function exportProfileTransfer(root = defaultProfilesRoot(), reference, options = {}) {
  const profile = findProfile(root, reference);
  const configPath = path.join(profile.paths.codexHome, 'config.toml');
  const configText = existsSync(configPath) ? readFileSync(configPath, 'utf8') : '';
  return createProfileTransfer({
    appVersion: options.appVersion,
    profile,
    configText,
    skills: options.skills || installedProfileSkills(profile),
    plugins: options.plugins || [],
    preferences: options.preferences,
    exportedAt: options.exportedAt
  });
}

function normalizedTransfer(transferValue) {
  const transfer = parseProfileTransfer(transferValue);
  transfer.profile = {
    name: normalizeProfileName(transfer.profile.name),
    provider: normalizeProfileProvider(transfer.profile.provider),
    usageSource: normalizeProfileUsageSource(transfer.profile.usageSource),
    runtimeSource: normalizeProfileRuntimeSource(transfer.profile.runtimeSource)
  };
  if (transfer.profile.provider.type === 'custom' && transfer.profile.runtimeSource === 'default') {
    throw new Error('Custom providers require an isolated Profile runtime.');
  }
  return transfer;
}

export function previewProfileTransfer(root = defaultProfilesRoot(), transferValue, options = {}) {
  const transfer = normalizedTransfer(transferValue);
  const target = listProfiles(root).find(profile => profile.name.localeCompare(transfer.profile.name, undefined, { sensitivity: 'accent' }) === 0) || null;
  return { transfer, preview: transferDiff(transfer, target, options.available || {}) };
}

function transferConfigText(transfer, provider, available = {}) {
  const config = structuredClone(transfer.commonConfig);
  const skillPaths = new Map((available.skills || [])
    .filter(item => item && typeof item === 'object' && item.path)
    .map(item => [String(item.id), path.resolve(String(item.path))]));
  const skills = transfer.inventory.skills
    .filter(item => skillPaths.has(item.id))
    .map(item => ({ path: skillPaths.get(item.id), enabled: item.enabled }));
  if (skills.length) config.skills = { ...(config.skills || {}), config: skills };
  else delete config.skills;

  const pluginIds = new Set((available.plugins || []).map(item => String(item && typeof item === 'object' ? item.id : item)));
  const plugins = Object.fromEntries(transfer.inventory.plugins
    .filter(item => pluginIds.has(item.id))
    .map(item => [item.id, { enabled: item.enabled }]));
  if (Object.keys(plugins).length) config.plugins = plugins;
  else delete config.plugins;
  return providerConfigPreview(provider, stringifyToml(config), null);
}

function createTransferBackup(root, target, action) {
  const backupRoot = path.join(path.resolve(root), 'backups', `profile-transfer-${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID()}`);
  mkdirSync(backupRoot, { recursive: true });
  const registry = registryPath(path.resolve(root));
  const config = target ? path.join(target.paths.codexHome, 'config.toml') : null;
  if (existsSync(registry)) copyFileSync(registry, path.join(backupRoot, 'profiles.json'));
  if (config && existsSync(config)) copyFileSync(config, path.join(backupRoot, 'config.toml'));
  writeJsonAtomically(path.join(backupRoot, 'backup.json'), {
    schemaVersion: 1,
    createdAt: new Date().toISOString(),
    action,
    targetProfileId: target?.id || null,
    registryExisted: existsSync(registry),
    configExisted: Boolean(config && existsSync(config))
  });
  return backupRoot;
}

function restoreTransferBackup(root, backupRoot, target, createdProfile) {
  const metadata = JSON.parse(readFileSync(path.join(backupRoot, 'backup.json'), 'utf8'));
  const registry = registryPath(path.resolve(root));
  const registryBackup = path.join(backupRoot, 'profiles.json');
  if (metadata.registryExisted) copyFileSync(registryBackup, registry);
  else if (existsSync(registry)) rmSync(registry);

  if (target) {
    const config = path.join(target.paths.codexHome, 'config.toml');
    const configBackup = path.join(backupRoot, 'config.toml');
    if (metadata.configExisted) copyFileSync(configBackup, config);
    else if (existsSync(config)) rmSync(config);
  }
  if (createdProfile && existsSync(createdProfile.paths.root)) {
    renameSync(createdProfile.paths.root, path.join(backupRoot, 'failed-profile-data'));
  }
}

export function applyProfileTransfer(root = defaultProfilesRoot(), transferValue, options = {}) {
  const { transfer, preview } = previewProfileTransfer(root, transferValue, options);
  const target = preview.targetProfileId ? findProfile(root, preview.targetProfileId) : null;
  const backupPath = createTransferBackup(root, target, preview.action);
  let createdProfile = null;
  try {
    const registry = loadProfileRegistry(root);
    const now = new Date().toISOString();
    let profile;
    if (target) {
      const index = registry.profiles.findIndex(item => item.id === target.id);
      profile = registry.profiles[index];
      profile.name = transfer.profile.name;
      profile.provider = transfer.profile.provider;
      profile.usageSource = transfer.profile.usageSource;
      profile.runtimeSource = transfer.profile.runtimeSource;
      profile.updatedAt = now;
    } else {
      profile = {
        id: randomUUID(),
        name: transfer.profile.name,
        provider: transfer.profile.provider,
        usageSource: transfer.profile.usageSource,
        runtimeSource: transfer.profile.runtimeSource,
        createdAt: now,
        updatedAt: now
      };
      registry.profiles.push(profile);
      createdProfile = enrichProfile(root, profile);
    }
    const paths = profilePaths(root, profile.id);
    ensureProfileDirectories(paths, profile.provider);
    writeTextAtomically(path.join(paths.codexHome, 'config.toml'), transferConfigText(transfer, profile.provider, options.available));
    options.afterConfigWrite?.({ profile: enrichProfile(root, profile), backupPath });
    saveProfileRegistry(root, registry);
    const backupMetadataPath = path.join(backupPath, 'backup.json');
    const backupMetadata = JSON.parse(readFileSync(backupMetadataPath, 'utf8'));
    writeJsonAtomically(backupMetadataPath, { ...backupMetadata, targetProfileId: profile.id, completedAt: new Date().toISOString() });
    return {
      profile: enrichProfile(root, profile),
      preferences: transfer.preferences,
      preview,
      backupPath
    };
  } catch (error) {
    try { restoreTransferBackup(root, backupPath, target, createdProfile); }
    catch (rollbackError) { throw new AggregateError([error, rollbackError], 'Profile transfer failed and rollback could not be completed.'); }
    throw error;
  }
}

function executableFromPath(names, environment = process.env) {
  const searchPath = environment.PATH || environment.Path || '';
  const extensions = process.platform === 'win32'
    ? (environment.PATHEXT || '.EXE;.CMD;.BAT;.COM').split(';')
    : [''];
  for (const name of names) {
    for (const directory of searchPath.split(path.delimiter).filter(Boolean)) {
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

function detectWindowsTerminal(environment = process.env) {
  if (process.platform !== 'win32') return null;
  const candidates = [
    path.join(environment.LOCALAPPDATA || '', 'Microsoft', 'WindowsApps', 'wt.exe'),
    executableFromPath(['wt.exe'], environment)
  ];
  const regularExecutable = candidates.find(candidate => candidate && existsSync(candidate));
  if (regularExecutable) return regularExecutable;
  const whereExecutable = path.join(environment.SystemRoot || environment.SYSTEMROOT || 'C:\\Windows', 'System32', 'where.exe');
  const result = spawnSync(whereExecutable, ['wt.exe'], {
    env: environment,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 5_000
  });
  if (result.status !== 0) return null;
  return String(result.stdout || '').split(/\r?\n/).map(value => value.trim()).find(Boolean) || null;
}

export function detectProfileTargets(environment = process.env) {
  const codex = detectUserCodexExecutable(environment) || executableFromPath(['codex.exe', 'codex'], environment);
  const vscode = detectCodeExecutable(environment);
  const desktop = detectDesktopExecutable(environment);
  const terminal = detectWindowsTerminal(environment);
  return {
    cli: { available: Boolean(codex) && (process.platform !== 'win32' || Boolean(terminal)), executable: codex, terminal },
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
    const runnerArgs = [
      '-NoLogo', '-NoExit', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', runner,
      '-CodexHome', codexHome,
      '-SqliteHome', sqliteHome,
      '-CodexExecutable', detected.executable,
      '-WorkingDirectory', workingDirectory,
      '-ProfileName', profile.name
    ];
    if (process.platform === 'win32' && detected.terminal) {
      const runtimeDirectory = path.join(profile.paths.root, 'runtime');
      mkdirSync(runtimeDirectory, { recursive: true });
      const pidFile = path.join(runtimeDirectory, `cli-${randomUUID()}.pid`);
      return {
        target,
        command: detected.terminal,
        args: ['-w', 'new', 'nt', '--title', `Codex - ${profile.name}`, powershell, ...runnerArgs, '-PidFile', pidFile],
        cwd: workingDirectory,
        environment,
        experimental: false,
        pidFile
      };
    }
    return {
      target,
      command: powershell,
      args: runnerArgs,
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

function waitForReportedPid(pidFile, timeoutMs = 5_000) {
  const waitBuffer = new Int32Array(new SharedArrayBuffer(4));
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (existsSync(pidFile)) {
      try {
        const pid = Number(readFileSync(pidFile, 'utf8').trim());
        if (Number.isInteger(pid) && pid > 0) {
          unlinkSync(pidFile);
          return pid;
        }
      } catch {}
    }
    Atomics.wait(waitBuffer, 0, 0, 50);
  }
  if (existsSync(pidFile)) unlinkSync(pidFile);
  throw new Error('Interactive terminal did not report a valid process id.');
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
  const launchedPid = plan.pidFile ? waitForReportedPid(plan.pidFile) : child.pid;
  const result = {
    id: randomUUID(),
    profile: { id: profile.id, name: profile.name },
    target: plan.target,
    runtimeSource: normalizeProfileRuntimeSource(profile.runtimeSource || profile.usageSource),
    experimental: plan.experimental,
    pid: launchedPid,
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
