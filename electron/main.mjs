import { existsSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { app, BrowserWindow, dialog, ipcMain, safeStorage, shell } from 'electron';
import {
  createProfile,
  defaultProfilesRoot,
  detectProfileTargets,
  findProfile,
  importProfileConfig,
  isProcessAlive,
  launchProfile,
  listProfileLaunches,
  listProfiles,
  normalizeProfileProvider,
  PROFILE_TARGETS,
  providerConfigPreview,
  updateProfileProvider
} from '../scripts/lib/profile-store.mjs';
import { getIndexDiagnostics, readDailySummary } from '../scripts/lib/session-index.mjs';

const electronDirectory = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.dirname(electronDirectory);
const asarMarker = `${path.sep}app.asar`;
const externalRepoRoot = repoRoot.endsWith(asarMarker)
  ? `${repoRoot}.unpacked`
  : repoRoot.includes(`${asarMarker}${path.sep}`)
    ? repoRoot.replace(`${asarMarker}${path.sep}`, `${asarMarker}.unpacked${path.sep}`)
    : repoRoot;
const packageMetadata = JSON.parse(readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
const dashboardUrl = 'http://127.0.0.1:8765/?live=1';
const dashboardHealthUrl = 'http://127.0.0.1:8765/healthz';
const usageDataRoot = app.isPackaged ? path.join(app.getPath('userData'), 'usage') : path.join(repoRoot, '.codex-day');
const databasePath = path.join(usageDataRoot, 'codex-day.sqlite');
const dashboardPath = path.join(usageDataRoot, 'index.html');
const profilesRoot = defaultProfilesRoot();

let mainWindow = null;
let dashboardWindow = null;
let ownedDashboardService = null;
let currentWorkspace = app.isPackaged ? os.homedir() : repoRoot;
let targetCache = null;

function serializableTargets(targets) {
  return Object.fromEntries(Object.entries(targets).map(([key, value]) => [key, {
    available: Boolean(value.available),
    experimental: Boolean(value.experimental)
  }]));
}

function readTargets() {
  const now = Date.now();
  if (targetCache && now - targetCache.at < 15_000) return targetCache.value;
  const value = serializableTargets(detectProfileTargets());
  targetCache = { at: now, value };
  return value;
}

function publicProfile(profile) {
  const encryptedSecretPath = path.join(profile.paths.root, 'provider-key.bin');
  return {
    id: profile.id,
    name: profile.name,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
    root: profile.paths.root,
    codexHome: profile.paths.codexHome,
    provider: profile.provider,
    hasProviderCredential: profile.provider.type === 'custom'
      && profile.provider.authMode === 'environment'
      && existsSync(encryptedSecretPath)
  };
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

function readUsage() {
  if (!existsSync(databasePath)) {
    return { available: false, summary: emptySummary(), status: 'new', updatedAt: null };
  }
  let database;
  try {
    database = new DatabaseSync(databasePath, { readOnly: true, timeout: 3000 });
    const summary = readDailySummary(database);
    const diagnostics = getIndexDiagnostics(database);
    return {
      available: true,
      summary,
      status: diagnostics.status,
      updatedAt: diagnostics.lastRefreshAt || statSync(databasePath).mtime.toISOString()
    };
  } catch {
    return { available: false, summary: emptySummary(), status: 'error', updatedAt: null };
  } finally {
    database?.close();
  }
}

function getSnapshot() {
  const recentLaunches = listProfileLaunches(profilesRoot, { limit: 10 });
  return {
    version: packageMetadata.version,
    workspace: currentWorkspace,
    profilesRoot,
    profiles: listProfiles(profilesRoot).map(publicProfile),
    security: { providerSecretsEncrypted: secureProviderStorageAvailable() },
    targets: readTargets(),
    usage: readUsage(),
    activeInstanceCount: recentLaunches.filter(launch => launch.active).length,
    recentLaunches
  };
}

function checkDashboardHealth(timeoutMs = 900) {
  return new Promise(resolve => {
    const request = http.get(dashboardHealthUrl, response => {
      response.resume();
      resolve(response.statusCode === 200);
    });
    request.setTimeout(timeoutMs, () => {
      request.destroy();
      resolve(false);
    });
    request.on('error', () => resolve(false));
  });
}

async function waitForDashboard() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (await checkDashboardHealth()) return true;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  return false;
}

async function ensureDashboardService() {
  if (await checkDashboardHealth()) return;
  if (!ownedDashboardService || ownedDashboardService.exitCode != null) {
    ownedDashboardService = spawn(process.execPath, [
      path.join(externalRepoRoot, 'scripts', 'codex-day.mjs'),
      '--database', databasePath,
      '--dashboard', dashboardPath,
      '--pid-file', path.join(usageDataRoot, 'service.pid')
    ], {
      cwd: externalRepoRoot,
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
      stdio: 'ignore',
      windowsHide: true
    });
    ownedDashboardService.once('exit', () => { ownedDashboardService = null; });
  }
  if (!await waitForDashboard()) throw new Error('本地用量服务启动失败，请先运行 npm start 查看诊断信息。');
}

async function openDashboardWindow() {
  await ensureDashboardService();
  if (dashboardWindow && !dashboardWindow.isDestroyed()) {
    dashboardWindow.show();
    dashboardWindow.focus();
    return;
  }
  dashboardWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 980,
    minHeight: 680,
    title: 'Dual Codex Day - 详细用量',
    backgroundColor: '#f5f6f3',
    icon: path.join(externalRepoRoot, 'assets', 'codex-day.ico'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  dashboardWindow.removeMenu();
  dashboardWindow.on('closed', () => { dashboardWindow = null; });
  await dashboardWindow.loadURL(dashboardUrl);
}

async function confirmLaunch(result) {
  await new Promise(resolve => setTimeout(resolve, 900));
  if (!isProcessAlive(result.pid)) {
    throw new Error('客户端启动后立即退出，请刷新入口状态并重试。');
  }
  return result;
}

function registerIpc() {
  ipcMain.handle('app:get-snapshot', () => getSnapshot());
  ipcMain.handle('profiles:create', (_event, requestedName) => {
    const profile = createProfile(profilesRoot, requestedName);
    return publicProfile(profile);
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
  ipcMain.handle('profiles:launch', async (_event, payload) => {
    const profileId = String(payload?.profileId || '');
    const target = String(payload?.target || '');
    if (!PROFILE_TARGETS.includes(target)) throw new Error('不支持的启动目标。');
    const profile = findProfile(profilesRoot, profileId);
    const providerApiKey = profile.provider.type === 'custom' && profile.provider.authMode === 'environment'
      ? readProviderSecret(profile)
      : undefined;
    const result = launchProfile(profilesRoot, profile.id, target, { workingDirectory: currentWorkspace, providerApiKey });
    return confirmLaunch(result);
  });
  ipcMain.handle('profiles:open-folder', async (_event, profileId) => {
    const profile = findProfile(profilesRoot, String(profileId || ''));
    const error = await shell.openPath(profile.paths.root);
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
  ipcMain.handle('dashboard:open', async () => {
    await openDashboardWindow();
    return true;
  });
}

async function captureRequestedScreenshot(window) {
  const target = process.env.DUAL_CODEX_DAY_SCREENSHOT;
  if (!target) return;
  await new Promise(resolve => setTimeout(resolve, 1200));
  const screenshotView = process.env.DUAL_CODEX_DAY_SCREENSHOT_VIEW || '';
  if (screenshotView.startsWith('provider')) {
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

app.on('before-quit', () => {
  if (ownedDashboardService && ownedDashboardService.exitCode == null) ownedDashboardService.kill();
});
