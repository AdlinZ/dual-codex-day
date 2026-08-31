import { existsSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { app, BrowserWindow, dialog, ipcMain, nativeImage, safeStorage, shell } from 'electron';
import {
  applyProfileTransfer,
  createProfile,
  defaultProfilesRoot,
  detectProfileTargets,
  exportProfileTransfer,
  findProfile,
  importProfileConfig,
  isProcessAlive,
  launchProfile,
  listProfileLaunches,
  listProfiles,
  normalizeProfileProvider,
  PROFILE_TARGETS,
  previewProfileTransfer,
  providerConfigPreview,
  readProfileLoginStatus,
  removeProfile,
  renameProfile,
  stopProfileLaunch,
  updateProfileProvider,
  updateProfileRuntimeSource,
  updateProfileUsageSource
} from '../scripts/lib/profile-store.mjs';
import { getIndexDiagnostics, openIndex, readDailySummary, readIndexedEvents, refreshIndex } from '../scripts/lib/session-index.mjs';
import { readCcSwitchAudit } from '../scripts/lib/cc-switch-audit.mjs';
import { discoverProjectSkillRoots, removeManagedSkill, scanSkills, setSkillEnabled, shareSkill, skillRoots, syncSkill } from '../scripts/lib/skill-store.mjs';
import { installPlugin, listPluginMarketplaces, removePlugin, scanPluginSkills, setPluginEnabled } from '../scripts/lib/plugin-store.mjs';

const electronDirectory = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.dirname(electronDirectory);
const asarMarker = `${path.sep}app.asar`;
const externalRepoRoot = repoRoot.endsWith(asarMarker)
  ? `${repoRoot}.unpacked`
  : repoRoot.includes(`${asarMarker}${path.sep}`)
    ? repoRoot.replace(`${asarMarker}${path.sep}`, `${asarMarker}.unpacked${path.sep}`)
    : repoRoot;
const packageMetadata = JSON.parse(readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
const usageDataRoot = path.resolve(process.env.CODEX_USAGE_DATA_ROOT
  || (app.isPackaged ? path.join(app.getPath('userData'), 'usage') : path.join(repoRoot, '.codex-day')));
const defaultCodexRoot = path.resolve(process.env.CODEX_USAGE_ROOT || process.env.CODEX_HOME || path.join(os.homedir(), '.codex'));
const defaultCcSwitchDatabase = path.resolve(process.env.CC_SWITCH_DATABASE || path.join(os.homedir(), '.cc-switch', 'cc-switch.db'));
const profilesRoot = defaultProfilesRoot();

let mainWindow = null;
let currentWorkspace = process.env.DUAL_CODEX_DAY_SCREENSHOT_WORKSPACE
  ? path.resolve(process.env.DUAL_CODEX_DAY_SCREENSHOT_WORKSPACE)
  : app.isPackaged ? os.homedir() : repoRoot;
let targetCache = null;
let projectSkillRootsCache = null;
const loginStatusCache = new Map();
const pendingProfileTransfers = new Map();
const PROFILE_TRANSFER_MAX_BYTES = 2 * 1024 * 1024;
const PROFILE_TRANSFER_TTL_MS = 10 * 60 * 1000;

function serializableTargets(targets) {
  return Object.fromEntries(Object.entries(targets).map(([key, value]) => [key, {
    available: Boolean(value.available),
    experimental: Boolean(value.experimental)
  }]));
}

function detectedTargets() {
  const now = Date.now();
  if (targetCache && now - targetCache.at < 15_000) return targetCache.value;
  const value = detectProfileTargets();
  targetCache = { at: now, value };
  return value;
}

function readTargets() {
  return serializableTargets(detectedTargets());
}

function loginStatus(profile, hasProviderCredential) {
  const cacheKey = `${profile.id}:${profile.updatedAt}:${profile.runtimeSource}:${hasProviderCredential}`;
  const cached = loginStatusCache.get(cacheKey);
  if (cached && Date.now() - cached.at < 15_000) return cached.value;
  const value = readProfileLoginStatus(profile, {
    hasProviderCredential,
    targets: detectedTargets(),
    defaultCodexHome: defaultCodexRoot,
    defaultSqliteHome: process.env.CODEX_SQLITE_HOME || defaultCodexRoot,
    workingDirectory: currentWorkspace
  });
  loginStatusCache.set(cacheKey, { at: Date.now(), value });
  return value;
}

function publicProfile(profile) {
  const encryptedSecretPath = path.join(profile.paths.root, 'provider-key.bin');
  const hasProviderCredential = profile.provider.type === 'custom'
    && profile.provider.authMode === 'environment'
    && existsSync(encryptedSecretPath);
  return {
    id: profile.id,
    name: profile.name,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
    root: profile.paths.root,
    codexHome: profile.paths.codexHome,
    runtimeRoot: profile.runtimeSource === 'default' ? defaultCodexRoot : profile.paths.codexHome,
    runtimeSource: profile.runtimeSource,
    usageSource: profile.usageSource,
    provider: profile.provider,
    hasProviderCredential,
    loginStatus: loginStatus(profile, hasProviderCredential)
  };
}

function usageSources() {
  const profiles = listProfiles(profilesRoot);
  const profileSources = profiles.map(profile => ({
    id: `profile:${profile.id}`,
    name: profile.name,
    detail: profile.usageSource === 'default' ? '当前默认 Codex' : profile.provider?.name || 'OpenAI 官方',
    kind: 'profile',
    roots: [profile.usageSource === 'default' ? defaultCodexRoot : profile.paths.codexHome]
  }));
  const defaultSource = {
    id: 'default',
    name: '默认账号',
    detail: '系统 CODEX_HOME',
    kind: 'default',
    roots: [defaultCodexRoot]
  };
  const allRoots = new Map();
  for (const root of [defaultCodexRoot, ...profileSources.flatMap(source => source.roots)]) {
    const resolved = path.resolve(root);
    allRoots.set(process.platform === 'win32' ? resolved.toLowerCase() : resolved, resolved);
  }
  return [
    {
      id: 'all',
      name: '全部账号',
      detail: `${allRoots.size} 个独立数据源`,
      kind: 'all',
      roots: [...allRoots.values()]
    },
    defaultSource,
    ...profileSources
  ];
}

function usageSource(sourceId = 'all') {
  const source = usageSources().find(candidate => candidate.id === String(sourceId || 'all'));
  if (!source) throw new Error('所选用量数据源不存在，请刷新后重试。');
  return source;
}

function publicUsageSources() {
  return usageSources().map(({ roots: _roots, ...source }) => source);
}

function usageStoragePaths(sourceId) {
  if (sourceId === 'default') {
    return { databasePath: path.join(usageDataRoot, 'codex-day.sqlite') };
  }
  const slug = sourceId.replace(/[^a-z0-9-]/gi, '-').toLowerCase();
  return { databasePath: path.join(usageDataRoot, `codex-day-${slug}.sqlite`) };
}

function providerSecretPath(profile) {
  return path.join(profile.paths.root, 'provider-key.bin');
}

function secureProviderStorageAvailable() {
  if (!safeStorage.isEncryptionAvailable()) return false;
  if (process.platform !== 'linux') return true;
  return safeStorage.getSelectedStorageBackend() !== 'basic_text';
}

function saveProviderSecret(profile, apiKey) {
  if (!secureProviderStorageAvailable()) {
    throw new Error('当前系统没有可用的安全凭据存储，API Key 未保存。');
  }
  const encrypted = safeStorage.encryptString(apiKey);
  const target = providerSecretPath(profile);
  const temporary = `${target}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(temporary, encrypted, { mode: 0o600 });
  renameSync(temporary, target);
}

function normalizeProviderApiKey(value) {
  const apiKey = String(value || '').trim();
  if (!apiKey || apiKey.length > 1000) throw new Error('API Key 长度必须为 1 到 1000 个字符。');
  if (/[\u0000-\u001f\u007f]/.test(apiKey)) throw new Error('API Key 不能包含控制字符。');
  return apiKey;
}

function readProviderSecret(profile) {
  const target = providerSecretPath(profile);
  if (!existsSync(target)) throw new Error('该 Profile 尚未保存中转站 API Key。');
  if (!secureProviderStorageAvailable()) throw new Error('当前系统无法解密该 Profile 的 API Key。');
  try {
    return safeStorage.decryptString(readFileSync(target));
  } catch {
    throw new Error('无法解密该 Profile 的 API Key，请重新保存供应商配置。');
  }
}

function emptySummary() {
  return {
    date: new Date().toLocaleDateString('en-CA'),
    calls: 0,
    turns: 0,
    tasks: 0,
    tokens: {
      input: 0,
      cachedInput: 0,
      cacheWriteInput: 0,
      uncachedInput: 0,
      output: 0,
      reasoningOutput: 0,
      unclassified: 0,
      total: 0
    },
    cacheRate: 0,
    averageTokens: 0,
    topModel: null
  };
}

function readUsage(sourceId = 'default') {
  const source = usageSource(sourceId);
  const { databasePath } = usageStoragePaths(sourceId);
  let database;
  try {
    database = openIndex(databasePath);
    const indexResult = refreshIndex(database, source.roots);
    const summary = readDailySummary(database);
    const diagnostics = getIndexDiagnostics(database, { indexResult });
    return {
      available: true,
      source: { id: source.id, name: source.name, detail: source.detail, kind: source.kind },
      summary,
      status: diagnostics.status,
      updatedAt: diagnostics.lastRefreshAt || new Date().toISOString()
    };
  } catch {
    return {
      available: false,
      source: { id: source.id, name: source.name, detail: source.detail, kind: source.kind },
      summary: emptySummary(),
      status: 'error',
      updatedAt: null
    };
  } finally {
    database?.close();
  }
}

function getSnapshot(profileId) {
  const profiles = listProfiles(profilesRoot);
  const selectedProfile = profiles.find(profile => profile.id === String(profileId || '')) || profiles[0] || null;
  const launcherUsageSourceId = selectedProfile ? `profile:${selectedProfile.id}` : 'default';
  const recentLaunches = listProfileLaunches(profilesRoot, { limit: 10 });
  return {
    version: packageMetadata.version,
    workspace: currentWorkspace,
    profilesRoot,
    profiles: profiles.map(publicProfile),
    usageSources: publicUsageSources(),
    security: { providerSecretsEncrypted: secureProviderStorageAvailable() },
    targets: readTargets(),
    usage: readUsage(launcherUsageSourceId),
    activeInstanceCount: recentLaunches.filter(launch => launch.active).length,
    recentLaunches
  };
}

function discoveredProjectSkillRoots(refresh = false) {
  if (!refresh && projectSkillRootsCache) return projectSkillRootsCache;
  projectSkillRootsCache = discoverProjectSkillRoots([app.getPath('documents')]);
  return projectSkillRootsCache;
}

function skillContext({ refreshProjects = false } = {}) {
  const profiles = listProfiles(profilesRoot).map(profile => ({
    id: profile.id,
    name: profile.name,
    codexHome: profile.runtimeSource === 'default' ? defaultCodexRoot : profile.paths.codexHome,
    runtimeSource: profile.runtimeSource
  }));
  return { profiles, workspace: currentWorkspace, projectSkillRoots: discoveredProjectSkillRoots(refreshProjects), defaultCodexHome: defaultCodexRoot };
}

function skillInventory({ refreshProjects = false } = {}) {
  const context = skillContext({ refreshProjects });
  const environments = [
    { id: 'default', label: '默认 Codex', codexHome: defaultCodexRoot },
    ...context.profiles.map(profile => ({ id: `profile:${profile.id}`, label: profile.name, codexHome: profile.codexHome }))
  ];
  const codexExecutable = detectedTargets().cli?.executable || 'codex';
  return { ...scanSkills(context), pluginData: scanPluginSkills({ environments, codexExecutable }) };
}

function profileTransferAvailability() {
  const inventory = skillInventory();
  const skills = [];
  const skillIds = new Set();
  for (const skill of inventory.skills) {
    for (const location of skill.locations) {
      const id = String(location.directory || path.basename(location.path));
      if (skillIds.has(id) || location.scope === 'system' || location.readOnly) continue;
      skillIds.add(id);
      skills.push({ id, path: path.join(location.path, 'SKILL.md') });
    }
  }
  const plugins = inventory.pluginData.plugins.map(plugin => ({ id: plugin.pluginId }));
  return { skills, plugins, inventory };
}

function profilePlugins(profile, inventory) {
  const codexHome = path.resolve(profile.paths.codexHome).toLowerCase();
  return inventory.pluginData.plugins.flatMap(plugin => {
    const location = plugin.locations.find(item => path.resolve(item.codexHome).toLowerCase() === codexHome);
    return location ? [{ id: plugin.pluginId, enabled: location.enabled !== false }] : [];
  });
}

function prunePendingProfileTransfers() {
  const cutoff = Date.now() - PROFILE_TRANSFER_TTL_MS;
  for (const [token, pending] of pendingProfileTransfers) {
    if (pending.createdAt < cutoff) pendingProfileTransfers.delete(token);
  }
}

function knownSkill(skillPath, { writable = false } = {}) {
  const target = path.resolve(String(skillPath || ''));
  const entry = skillInventory().skills.flatMap(skill => skill.locations).find(item => path.resolve(item.path).toLowerCase() === target.toLowerCase());
  if (!entry || (writable && (!entry.managed || entry.readOnly))) throw new Error('该 Skill 不在可管理范围内。');
  return entry;
}

function knownSkillRoot(rootPath) {
  const target = path.resolve(String(rootPath || ''));
  const root = skillRoots(skillContext()).find(item => path.resolve(item.path).toLowerCase() === target.toLowerCase() && item.managed && !item.readOnly);
  if (!root) throw new Error('目标 Skill 目录不在可管理范围内。');
  return root;
}

function knownCodexHome(codexHome) {
  const target = path.resolve(String(codexHome || ''));
  const allowed = [defaultCodexRoot, ...listProfiles(profilesRoot).filter(profile => profile.runtimeSource !== 'default').map(profile => profile.paths.codexHome)];
  if (!allowed.some(item => path.resolve(item).toLowerCase() === target.toLowerCase())) throw new Error('该 Codex 配置目录不在可管理范围内。');
  return target;
}

function knownPlugin(pluginId, codexHome = null) {
  const pluginData = skillInventory().pluginData;
  const plugin = [...pluginData.plugins, ...(pluginData.availablePlugins || [])].find(item => item.pluginId === String(pluginId || ''));
  if (!plugin) throw new Error('该插件不在已安装或可安装清单中。');
  if (codexHome && !(plugin.locations || []).some(item => path.resolve(item.codexHome).toLowerCase() === path.resolve(codexHome).toLowerCase())) throw new Error('该环境没有安装此插件。');
  return plugin;
}

function readUsageData(sourceId) {
  const source = usageSource(sourceId);
  const { databasePath } = usageStoragePaths(source.id);
  const database = openIndex(databasePath);
  try {
    const indexResult = refreshIndex(database, source.roots);
    return {
      generatedAt: new Date().toISOString(),
      source: { id: source.id, name: source.name, detail: source.detail, kind: source.kind },
      events: readIndexedEvents(database),
      diagnostics: getIndexDiagnostics(database, { indexResult }),
      pricing: JSON.parse(readFileSync(path.join(externalRepoRoot, 'config', 'pricing.json'), 'utf8'))
    };
  } finally {
    database.close();
  }
}

function readUsageComparison() {
  return {
    generatedAt: new Date().toISOString(),
    sources: usageSources().filter(source => source.kind !== 'all').map(source => {
      try {
        return readUsageData(source.id);
      } catch (error) {
        return {
          source: { id: source.id, name: source.name, detail: source.detail, kind: source.kind },
          events: [],
          error: error?.message || String(error)
        };
      }
    })
  };
}

async function confirmLaunch(result) {
  await new Promise(resolve => setTimeout(resolve, 900));
  if (!isProcessAlive(result.pid)) {
    throw new Error('客户端启动后立即退出，请刷新入口状态并重试。');
  }
  return result;
}

function registerIpc() {
  ipcMain.handle('app:get-snapshot', (_event, profileId) => getSnapshot(profileId));
  ipcMain.handle('profiles:create', (_event, requestedName) => {
    const profile = createProfile(profilesRoot, requestedName);
    return publicProfile(profile);
  });
  ipcMain.handle('profiles:rename', (_event, payload) => {
    return publicProfile(renameProfile(profilesRoot, String(payload?.profileId || ''), payload?.name));
  });
  ipcMain.handle('profiles:delete', async (_event, profileId) => {
    const profile = findProfile(profilesRoot, String(profileId || ''));
    if (listProfileLaunches(profilesRoot, { limit: 24 }).some(launch => launch.profileId === profile.id && launch.active)) {
      throw new Error('请先关闭该账号正在运行的客户端，再删除配置。');
    }
    if (existsSync(profile.paths.root)) await shell.trashItem(profile.paths.root);
    removeProfile(profilesRoot, profile.id);
    loginStatusCache.clear();
    return true;
  });
  ipcMain.handle('profiles:provider-preview', (_event, payload) => {
    const profile = findProfile(profilesRoot, String(payload?.profileId || ''));
    const configPath = path.join(profile.paths.codexHome, 'config.toml');
    const existingConfig = existsSync(configPath) ? readFileSync(configPath, 'utf8') : '';
    return providerConfigPreview(payload?.provider, existingConfig, profile.provider);
  });
  ipcMain.handle('profiles:save-provider', (_event, payload) => {
    const profile = findProfile(profilesRoot, String(payload?.profileId || ''));
    const provider = normalizeProfileProvider(payload?.provider);
    const requestedApiKey = String(payload?.apiKey || '');
    const usesManagedKey = provider.type === 'custom' && provider.authMode === 'environment';
    if (usesManagedKey && requestedApiKey.trim()) {
      saveProviderSecret(profile, normalizeProviderApiKey(requestedApiKey));
    }
    if (usesManagedKey && !requestedApiKey.trim() && !existsSync(providerSecretPath(profile))) {
      throw new Error('请填写中转站 API Key。');
    }
    if (!usesManagedKey && existsSync(providerSecretPath(profile))) {
      unlinkSync(providerSecretPath(profile));
    }
    return publicProfile(updateProfileProvider(profilesRoot, profile.id, provider));
  });
  ipcMain.handle('profiles:set-usage-source', (_event, payload) => {
    const profile = updateProfileUsageSource(
      profilesRoot,
      String(payload?.profileId || ''),
      String(payload?.source || '')
    );
    return publicProfile(profile);
  });
  ipcMain.handle('profiles:set-runtime-source', (_event, payload) => {
    const profile = updateProfileRuntimeSource(
      profilesRoot,
      String(payload?.profileId || ''),
      String(payload?.source || '')
    );
    loginStatusCache.clear();
    return publicProfile(profile);
  });
  ipcMain.handle('profiles:import-config', async (_event, profileId) => {
    const profile = findProfile(profilesRoot, String(profileId || ''));
    const defaultCodexHome = process.env.CODEX_HOME || path.join(os.homedir(), '.codex');
    const result = await dialog.showOpenDialog(mainWindow, {
      title: `为“${profile.name}”导入 config.toml`,
      defaultPath: path.join(defaultCodexHome, 'config.toml'),
      properties: ['openFile'],
      filters: [{ name: 'Codex config.toml', extensions: ['toml'] }]
    });
    if (result.canceled || !result.filePaths[0]) return null;
    const sourcePath = result.filePaths[0];
    if (statSync(sourcePath).size > 2 * 1024 * 1024) throw new Error('config.toml 不能超过 2 MB。');
    return publicProfile(importProfileConfig(profilesRoot, profile.id, readFileSync(sourcePath, 'utf8')));
  });
  ipcMain.handle('profiles:export-transfer', async (_event, payload) => {
    const profile = findProfile(profilesRoot, String(payload?.profileId || ''));
    const availability = profileTransferAvailability();
    const transfer = exportProfileTransfer(profilesRoot, profile.id, {
      appVersion: packageMetadata.version,
      plugins: profilePlugins(profile, availability.inventory),
      preferences: payload?.preferences
    });
    const safeName = profile.name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').slice(0, 60) || 'profile';
    const result = await dialog.showSaveDialog(mainWindow, {
      title: `导出“${profile.name}”`,
      defaultPath: path.join(app.getPath('downloads'), `dual-codex-day-${safeName}.json`),
      filters: [{ name: 'Dual Codex Day Profile', extensions: ['json'] }]
    });
    if (result.canceled || !result.filePath) return null;
    writeFileSync(result.filePath, `${JSON.stringify(transfer, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
    return { filePath: path.resolve(result.filePath), profileName: profile.name };
  });
  ipcMain.handle('profiles:choose-transfer', async event => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: '导入 Profile 配置',
      defaultPath: app.getPath('downloads'),
      properties: ['openFile'],
      filters: [{ name: 'Dual Codex Day Profile', extensions: ['json'] }]
    });
    if (result.canceled || !result.filePaths[0]) return null;
    const sourcePath = result.filePaths[0];
    if (statSync(sourcePath).size > PROFILE_TRANSFER_MAX_BYTES) throw new Error('Profile 迁移文件不能超过 2 MB。');
    const availability = profileTransferAvailability();
    const selected = previewProfileTransfer(profilesRoot, readFileSync(sourcePath, 'utf8'), { available: availability });
    prunePendingProfileTransfers();
    const token = randomUUID();
    pendingProfileTransfers.set(token, {
      createdAt: Date.now(),
      webContentsId: event.sender.id,
      transfer: selected.transfer
    });
    return { token, preview: selected.preview };
  });
  ipcMain.handle('profiles:apply-transfer', (event, token) => {
    prunePendingProfileTransfers();
    const key = String(token || '');
    const pending = pendingProfileTransfers.get(key);
    if (!pending || pending.webContentsId !== event.sender.id) throw new Error('导入预览已失效，请重新选择迁移文件。');
    pendingProfileTransfers.delete(key);
    const availability = profileTransferAvailability();
    const applied = applyProfileTransfer(profilesRoot, pending.transfer, { available: availability });
    if (applied.preview.credentialRequired) {
      const secretPath = providerSecretPath(applied.profile);
      if (existsSync(secretPath)) unlinkSync(secretPath);
    }
    loginStatusCache.clear();
    return {
      profile: publicProfile(applied.profile),
      preferences: applied.preferences,
      preview: applied.preview,
      backupPath: applied.backupPath
    };
  });
  ipcMain.handle('profiles:discard-transfer', (event, token) => {
    const key = String(token || '');
    const pending = pendingProfileTransfers.get(key);
    if (pending?.webContentsId === event.sender.id) pendingProfileTransfers.delete(key);
    return true;
  });
  ipcMain.handle('profiles:launch', async (_event, payload) => {
    const profileId = String(payload?.profileId || '');
    const target = String(payload?.target || '');
    if (!PROFILE_TARGETS.includes(target)) throw new Error('不支持的启动目标。');
    const profile = findProfile(profilesRoot, profileId);
    const providerApiKey = profile.provider.type === 'custom' && profile.provider.authMode === 'environment'
      ? readProviderSecret(profile)
      : undefined;
    const result = launchProfile(profilesRoot, profile.id, target, {
      workingDirectory: currentWorkspace,
      providerApiKey,
      targets: detectedTargets(),
      defaultCodexHome: defaultCodexRoot,
      defaultSqliteHome: process.env.CODEX_SQLITE_HOME || defaultCodexRoot
    });
    return confirmLaunch(result);
  });
  ipcMain.handle('profiles:stop', async (_event, launchId) => {
    const launch = listProfileLaunches(profilesRoot, { limit: 24 })
      .find(candidate => candidate.id === String(launchId || ''));
    if (!launch) throw new Error('找不到这条启动记录，请刷新后重试。');
    if (!launch.active) return { ...launch, canceled: false, alreadyStopped: true };

    const targetLabel = {
      cli: 'Codex CLI',
      vscode: 'VS Code',
      desktop: 'Codex 桌面端'
    }[launch.target] || 'Codex 客户端';
    const defaultRuntimeWarning = launch.runtimeSource === 'default'
      ? '\n\n这是系统默认运行环境。若客户端复用了已有窗口，关闭可能影响你在该窗口中的其他工作。'
      : '';
    const confirmation = await dialog.showMessageBox(mainWindow, {
      type: 'warning',
      buttons: ['取消', '关闭实例'],
      defaultId: 0,
      cancelId: 0,
      noLink: true,
      title: '关闭实例',
      message: `关闭“${launch.profileName}”的 ${targetLabel}？`,
      detail: `DCD 会先请求正常关闭，客户端没有响应时再强制结束该实例。${defaultRuntimeWarning}`
    });
    if (confirmation.response !== 1) return { ...launch, canceled: true };

    try {
      return { ...await stopProfileLaunch(profilesRoot, launch.id), canceled: false };
    } catch (error) {
      if (/Cannot verify/.test(error.message)) {
        throw new Error('无法确认这个进程仍属于该启动记录。为避免误关其他程序，DCD 已取消操作。');
      }
      if (/did not exit/.test(error.message)) throw new Error('客户端未能关闭，请在对应窗口中手动退出。');
      throw error;
    }
  });
  ipcMain.handle('profiles:open-folder', async (_event, profileId) => {
    const profile = findProfile(profilesRoot, String(profileId || ''));
    const target = profile.runtimeSource === 'default' ? defaultCodexRoot : profile.paths.root;
    const error = await shell.openPath(target);
    if (error) throw new Error(error);
    return true;
  });
  ipcMain.handle('workspace:choose', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: '选择启动目录',
      defaultPath: currentWorkspace,
      properties: ['openDirectory', 'createDirectory']
    });
    if (result.canceled || !result.filePaths[0]) return currentWorkspace;
    currentWorkspace = path.resolve(result.filePaths[0]);
    return currentWorkspace;
  });
  ipcMain.handle('usage:get-data', (_event, sourceId) => readUsageData(sourceId));
  ipcMain.handle('usage:get-comparison', () => readUsageComparison());
  ipcMain.handle('usage:cc-switch-audit', (_event, databasePath) => readCcSwitchAudit(databasePath || defaultCcSwitchDatabase));
  ipcMain.handle('usage:choose-cc-switch-db', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: '选择 CC Switch 数据库',
      defaultPath: existsSync(defaultCcSwitchDatabase) ? defaultCcSwitchDatabase : os.homedir(),
      properties: ['openFile'],
      filters: [{ name: 'SQLite 数据库', extensions: ['db', 'sqlite', 'sqlite3'] }]
    });
    if (result.canceled || !result.filePaths[0]) return null;
    return path.resolve(result.filePaths[0]);
  });
  ipcMain.handle('skills:get', () => skillInventory({ refreshProjects: true }));
  ipcMain.handle('skills:share', (_event, payload) => {
    const source = knownSkill(payload?.source).path;
    return { path: shareSkill(source, { overwrite: payload?.overwrite === true }), skills: skillInventory() };
  });
  ipcMain.handle('skills:sync', (_event, payload) => {
    const source = knownSkill(payload?.source).path;
    const targetRoot = knownSkillRoot(payload?.targetRoot).path;
    return { path: syncSkill(source, targetRoot, { overwrite: payload?.overwrite === true }), skills: skillInventory() };
  });
  ipcMain.handle('skills:set-enabled', (_event, payload) => {
    const codexHome = knownCodexHome(payload?.codexHome);
    const skillPath = path.join(knownSkill(payload?.skillPath).path, 'SKILL.md');
    return { ...setSkillEnabled(codexHome, skillPath, payload?.enabled === true), skills: skillInventory() };
  });
  ipcMain.handle('skills:remove', async (_event, payload) => {
    const roots = skillRoots(skillContext()).filter(root => root.managed && !root.readOnly).map(root => root.path);
    const target = knownSkill(payload?.path, { writable: true }).path;
    await removeManagedSkill(target, roots, item => shell.trashItem(item));
    return skillInventory();
  });
  ipcMain.handle('plugins:install', (_event, payload) => {
    const plugin = knownPlugin(payload?.pluginId);
    const targetCodexHome = knownCodexHome(payload?.targetCodexHome);
    const source = plugin.locations?.[0] || plugin.sources?.[0];
    if (!source) throw new Error('找不到该插件的 Marketplace 来源。');
    const codexExecutable = detectedTargets().cli?.executable || 'codex';
    const marketplaces = listPluginMarketplaces(targetCodexHome, codexExecutable);
    installPlugin({ codexExecutable, targetCodexHome, pluginId: plugin.pluginId, marketplaceRoot: source.marketplaceRoot, marketplacePresent: marketplaces.some(item => item.name === plugin.marketplaceName) });
    return skillInventory();
  });
  ipcMain.handle('plugins:set-enabled', (_event, payload) => {
    const codexHome = knownCodexHome(payload?.codexHome);
    const plugin = knownPlugin(payload?.pluginId, codexHome);
    setPluginEnabled(codexHome, plugin.pluginId, payload?.enabled === true);
    return skillInventory();
  });
  ipcMain.handle('plugins:remove', (_event, payload) => {
    const codexHome = knownCodexHome(payload?.codexHome);
    const plugin = knownPlugin(payload?.pluginId, codexHome);
    const codexExecutable = detectedTargets().cli?.executable || 'codex';
    removePlugin({ codexExecutable, codexHome, pluginId: plugin.pluginId });
    return skillInventory();
  });
}

async function captureRequestedScreenshot(window) {
  const target = process.env.DUAL_CODEX_DAY_SCREENSHOT;
  if (!target) return;
  await new Promise(resolve => setTimeout(resolve, 1200));
  const screenshotView = process.env.DUAL_CODEX_DAY_SCREENSHOT_VIEW || '';
  if (screenshotView === 'profile-transfer') {
    window.setSize(1400, 960);
    const transferOpened = await window.webContents.executeJavaScript(`(() => {
      const dialog = document.querySelector('#profile-transfer-dialog');
      const values = {
        '#profile-transfer-action': '更新现有 Profile',
        '#profile-transfer-name': '工作账号',
        '#profile-transfer-version': '来源版本 v0.17.0',
        '#profile-transfer-missing-skills-list': 'release-check',
        '#profile-transfer-missing-plugins-list': 'openai-docs@openai'
      };
      for (const [selector, value] of Object.entries(values)) {
        const node = document.querySelector(selector);
        if (node) node.textContent = value;
      }
      const changes = document.querySelector('#profile-transfer-changes');
      if (changes) changes.innerHTML = '<li>供应商设置</li><li>通用 config.toml</li><li>Skills 与插件状态</li><li>用量设置</li>';
      for (const selector of ['#profile-transfer-missing-skills', '#profile-transfer-missing-plugins', '#profile-transfer-credential']) {
        const node = document.querySelector(selector);
        if (node) node.hidden = false;
      }
      dialog?.showModal();
      return dialog?.open === true;
    })()`);
    if (!transferOpened) throw new Error('Profile transfer preview did not open for the screenshot check.');
    await new Promise(resolve => setTimeout(resolve, 350));
  } else if (screenshotView.startsWith('provider')) {
    const screenshotAuthMode = screenshotView === 'provider-openai' ? 'openai' : 'environment';
    window.setSize(1400, 960);
    const providerOpened = await window.webContents.executeJavaScript(`(async () => {
      const button = document.querySelector('#edit-provider-button');
      for (let attempt = 0; attempt < 80 && !document.querySelector('[data-profile-id]'); attempt += 1) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      button?.click();
      const dialog = document.querySelector('#provider-dialog');
      if (!dialog?.open) return false;
      document.querySelector('input[name=providerType][value=custom]')?.click();
      document.querySelector('input[name=providerAuthMode][value=${screenshotAuthMode}]')?.click();
      const values = {
        '#provider-name-input': '公司中转站',
        '#provider-note-input': '公司开发环境',
        '#provider-model-input': 'gpt-5.6-sol',
        '#provider-id-input': 'custom',
        '#provider-base-url-input': 'https://relay.example.com/v1'
      };
      for (const [selector, value] of Object.entries(values)) {
        const input = document.querySelector(selector);
        if (!input) continue;
        input.value = value;
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
      const selections = {
        '#provider-reasoning-input': 'high',
        '#provider-personality-input': 'pragmatic'
      };
      for (const [selector, value] of Object.entries(selections)) {
        const select = document.querySelector(selector);
        if (!select) continue;
        select.value = value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
      const disableStorage = document.querySelector('#provider-disable-storage-input');
      if (disableStorage) {
        disableStorage.checked = true;
        disableStorage.dispatchEvent(new Event('change', { bubbles: true }));
      }
      document.activeElement?.blur();
      return true;
    })()`);
    if (!providerOpened) throw new Error('Provider editor did not open for the screenshot check.');
    await new Promise(resolve => setTimeout(resolve, 450));
  } else if (screenshotView === 'usage-source') {
    window.setSize(1200, 820);
    const usageSourceOpened = await window.webContents.executeJavaScript(`(async () => {
      for (let attempt = 0; attempt < 160; attempt += 1) {
        const button = document.querySelector('#profile-usage-source-button');
        if (button && !button.disabled) {
          button.click();
          return document.querySelector('#profile-usage-source-dialog')?.open === true;
        }
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      return false;
    })()`);
    if (!usageSourceOpened) throw new Error('Profile usage-source dialog did not open for the screenshot check.');
    await new Promise(resolve => setTimeout(resolve, 350));
  } else if (screenshotView.startsWith('skills')) {
    window.setSize(screenshotView.includes('min') ? 980 : 1440, screenshotView.includes('min') ? 680 : 900);
    const skillsLoaded = await window.webContents.executeJavaScript(`(async () => {
      document.querySelector('[data-view="skills"]')?.click();
      for (let attempt = 0; attempt < 100; attempt += 1) {
        if (document.querySelectorAll('.skill-row').length >= 2) {
          return true;
        }
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      return false;
    })()`);
    if (!skillsLoaded) throw new Error('Skills matrix did not render for the screenshot check.');
    if (screenshotView.includes('available')) {
      await new Promise(resolve => setTimeout(resolve, 250));
      const availableLoaded = await window.webContents.executeJavaScript(`(async () => {
        document.querySelector('[data-skills-mode="available"]')?.click();
        await new Promise(resolve => setTimeout(resolve, 100));
        return document.querySelector('[data-skills-mode="available"]')?.classList.contains('is-active')
          && document.querySelectorAll('.available-plugin-row').length > 0;
      })()`);
      if (!availableLoaded) throw new Error('Available plugin Skills matrix did not render for the screenshot check.');
    } else if (screenshotView.includes('plugins')) {
      await new Promise(resolve => setTimeout(resolve, 250));
      const pluginsLoaded = await window.webContents.executeJavaScript(`(async () => {
        document.querySelector('[data-skills-mode="plugins"]')?.click();
        await new Promise(resolve => setTimeout(resolve, 100));
        return document.querySelector('[data-skills-mode="plugins"]')?.classList.contains('is-active')
          && document.querySelectorAll('.plugin-row').length > 0;
      })()`);
      if (!pluginsLoaded) throw new Error('Plugin Skills matrix did not render for the screenshot check.');
      if (screenshotView.includes('manage')) {
        const managerOpened = await window.webContents.executeJavaScript(`(() => {
          document.querySelector('[data-plugin-manage]')?.click();
          return document.querySelector('#plugin-manage-dialog')?.open === true;
        })()`);
        if (!managerOpened) throw new Error('Plugin manager did not open for the screenshot check.');
      }
    }
  } else if (screenshotView.startsWith('launcher')) {
    window.setSize(1440, 960);
    const launcherProfileIndex = screenshotView === 'launcher-empty' ? 1 : 0;
    const launcherLoaded = await window.webContents.executeJavaScript(`(async () => {
      for (let attempt = 0; attempt < 160; attempt += 1) {
        const profiles = Array.from(document.querySelectorAll('[data-profile-id]'));
        if (profiles.length >= 2 && document.querySelector('#metric-tokens')?.textContent !== '0') {
          if (${launcherProfileIndex} === 1) {
            profiles[${launcherProfileIndex}].click();
            for (let profileAttempt = 0; profileAttempt < 160; profileAttempt += 1) {
              const heading = document.querySelector('#usage-heading')?.textContent || '';
              const tokens = document.querySelector('#metric-tokens')?.textContent;
              const calls = document.querySelector('#metric-calls')?.textContent;
              if (heading.includes('个人账号') && tokens === '0' && calls === '0') return true;
              await new Promise(resolve => setTimeout(resolve, 50));
            }
            return false;
          }
          return (document.querySelector('#usage-heading')?.textContent || '').includes('工作账号');
        }
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      return false;
    })()`);
    if (!launcherLoaded) throw new Error('Profile-scoped launcher usage did not load for the screenshot check.');
    await new Promise(resolve => setTimeout(resolve, 350));
  } else if (screenshotView.startsWith('dashboard')) {
    window.setSize(screenshotView === 'dashboard-min' ? 980 : 1440, screenshotView === 'dashboard-min' ? 680 : 960);
    const dashboardLoaded = await window.webContents.executeJavaScript(`(async () => {
      const tab = document.querySelector('[data-view="dashboard"]');
      tab?.click();
      for (let attempt = 0; attempt < 160; attempt += 1) {
        const content = document.querySelector('#native-usage-content');
        if (content && !content.hidden
          && document.querySelector('#usage-kpi-total')?.textContent !== '0'
          && document.querySelectorAll('#usage-comparison .comparison-row').length >= 2) return { ready: true };
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      return {
        ready: false,
        hidden: document.querySelector('#native-usage-content')?.hidden ?? null,
        loading: document.querySelector('#dashboard-loading')?.hidden ?? null,
        error: document.querySelector('#dashboard-error-message')?.textContent || '',
        total: document.querySelector('#usage-kpi-total')?.textContent || '',
        subtitle: document.querySelector('#usage-subtitle')?.textContent || '',
        source: document.querySelector('#usage-source-select')?.value || '',
        taskCount: document.querySelector('#usage-task-count')?.textContent || '',
        comparison: document.querySelector('#usage-comparison')?.textContent?.replace(/\s+/g, ' ').trim() || ''
      };
    })()`);
    if (!dashboardLoaded?.ready) throw new Error(`Embedded dashboard did not load for the screenshot check: ${JSON.stringify(dashboardLoaded)}`);
    if (screenshotView === 'dashboard-profile') {
      const profileLoaded = await window.webContents.executeJavaScript(`(async () => {
        const select = document.querySelector('#usage-source-select');
        const profile = Array.from(select?.options || []).find(option => option.value.startsWith('profile:'));
        if (!select || !profile) return false;
        select.value = profile.value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
        for (let attempt = 0; attempt < 160; attempt += 1) {
          const content = document.querySelector('#native-usage-content');
          if (content && !content.hidden && select.value.startsWith('profile:') && document.querySelector('#usage-kpi-total')?.textContent !== '0') return true;
          await new Promise(resolve => setTimeout(resolve, 50));
        }
        return false;
      })()`);
      if (!profileLoaded) throw new Error('Isolated Profile dashboard did not load for the screenshot check.');
    }
    if (screenshotView === 'dashboard-task') {
      const taskOpened = await window.webContents.executeJavaScript(`(() => {
        document.querySelector('[data-task-id]')?.click();
        return document.querySelector('#task-detail-dialog')?.open === true
          && document.querySelectorAll('#task-detail-calls .task-call-row').length > 0;
      })()`);
      if (!taskOpened) throw new Error('Task drilldown did not open for the screenshot check.');
    }
    if (screenshotView === 'dashboard-report') {
      const reportVisible = await window.webContents.executeJavaScript(`(() => {
        const report = document.querySelector('.period-report');
        report?.scrollIntoView({ block: 'center' });
        return Boolean(report && document.querySelector('#report-metrics')?.children.length === 4);
      })()`);
      if (!reportVisible) throw new Error('Periodic report did not render for the screenshot check.');
    }
    if (screenshotView === 'dashboard-report-poster') {
      const reportPosterOpened = await window.webContents.executeJavaScript(`(async () => {
        document.querySelector('#report-poster-button')?.click();
        for (let attempt = 0; attempt < 80; attempt += 1) {
          const dialog = document.querySelector('#usage-poster-dialog');
          const preview = document.querySelector('#usage-poster-preview');
          if (dialog?.open && preview?.complete && preview.naturalWidth === 1200 && preview.naturalHeight === 1600) return true;
          await new Promise(resolve => setTimeout(resolve, 50));
        }
        return false;
      })()`);
      if (!reportPosterOpened) throw new Error('Periodic report poster did not render at 1200 by 1600 pixels.');
    }
    if (screenshotView === 'dashboard-poster' || screenshotView === 'dashboard-poster-save') {
      const posterOpened = await window.webContents.executeJavaScript(`(async () => {
        document.querySelector('#usage-poster-button')?.click();
        for (let attempt = 0; attempt < 80; attempt += 1) {
          const dialog = document.querySelector('#usage-poster-dialog');
          const preview = document.querySelector('#usage-poster-preview');
          if (dialog?.open && preview?.complete && preview.naturalWidth === 1200 && preview.naturalHeight === 1600) return true;
          await new Promise(resolve => setTimeout(resolve, 50));
        }
        return false;
      })()`);
      if (!posterOpened) throw new Error('Usage poster preview did not render at 1200 by 1600 pixels.');
      if (screenshotView === 'dashboard-poster-save') {
        const posterPath = `${path.resolve(target)}.poster.png`;
        const downloadCompleted = new Promise((resolve, reject) => {
          window.webContents.session.once('will-download', (_event, item) => {
            item.setSavePath(posterPath);
            item.once('done', (_doneEvent, state) => state === 'completed' ? resolve() : reject(new Error(`Poster download ended with state: ${state}`)));
          });
        });
        await window.webContents.executeJavaScript(`document.querySelector('#usage-poster-save')?.click()`);
        await downloadCompleted;
        const size = nativeImage.createFromPath(posterPath).getSize();
        if (size.width !== 1200 || size.height !== 1600) throw new Error('Saved usage poster has incorrect dimensions.');
      }
    }
    await new Promise(resolve => setTimeout(resolve, 700));
  }
  const pathReplacements = process.env.DUAL_CODEX_DAY_SCREENSHOT_PATH_REPLACEMENTS;
  if (pathReplacements) {
    const replacements = JSON.parse(pathReplacements);
    await window.webContents.executeJavaScript(`(() => {
      const replacements = ${JSON.stringify(replacements)};
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        let value = node.nodeValue;
        for (const [source, replacement] of replacements) value = value.replaceAll(source, replacement);
        node.nodeValue = value;
      }
    })()`);
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  const image = await window.webContents.capturePage();
  writeFileSync(path.resolve(target), image.toPNG());
  app.quit();
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 820,
    minWidth: 960,
    minHeight: 680,
    show: false,
    title: 'Dual Codex Day',
    backgroundColor: '#f5f6f3',
    icon: path.join(externalRepoRoot, 'assets', 'codex-day.ico'),
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#f5f6f3',
      symbolColor: '#1d2420',
      height: 48
    },
    webPreferences: {
      preload: path.join(electronDirectory, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  mainWindow.removeMenu();
  mainWindow.loadFile(path.join(electronDirectory, 'renderer', 'index.html'));
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    captureRequestedScreenshot(mainWindow).catch(error => {
      console.error(error);
      app.exit(1);
    });
  });
  mainWindow.on('closed', () => { mainWindow = null; });
}

const singleInstance = app.requestSingleInstanceLock();
if (!singleInstance) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });
  app.whenReady().then(() => {
    app.setAppUserModelId('io.github.adlinz.dual-codex-day');
    registerIpc();
    createMainWindow();
  });
}

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
