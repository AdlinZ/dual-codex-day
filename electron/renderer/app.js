import createElement from '../../node_modules/lucide/dist/esm/createElement.mjs';
import RefreshCw from '../../node_modules/lucide/dist/esm/icons/refresh-cw.mjs';
import Plus from '../../node_modules/lucide/dist/esm/icons/plus.mjs';
import ShieldCheck from '../../node_modules/lucide/dist/esm/icons/shield-check.mjs';
import FolderOpen from '../../node_modules/lucide/dist/esm/icons/folder-open.mjs';
import FolderCog from '../../node_modules/lucide/dist/esm/icons/folder-cog.mjs';
import Ellipsis from '../../node_modules/lucide/dist/esm/icons/ellipsis.mjs';
import SquareTerminal from '../../node_modules/lucide/dist/esm/icons/square-terminal.mjs';
import PanelsTopLeft from '../../node_modules/lucide/dist/esm/icons/panels-top-left.mjs';
import MonitorUp from '../../node_modules/lucide/dist/esm/icons/monitor-up.mjs';
import ChartNoAxesCombined from '../../node_modules/lucide/dist/esm/icons/chart-no-axes-combined.mjs';
import UserRoundPlus from '../../node_modules/lucide/dist/esm/icons/user-round-plus.mjs';
import ChevronRight from '../../node_modules/lucide/dist/esm/icons/chevron-right.mjs';
import ServerCog from '../../node_modules/lucide/dist/esm/icons/server-cog.mjs';
import Settings2 from '../../node_modules/lucide/dist/esm/icons/settings-2.mjs';
import KeyRound from '../../node_modules/lucide/dist/esm/icons/key-round.mjs';
import SaveCheck from '../../node_modules/lucide/dist/esm/icons/save-check.mjs';
import SlidersHorizontal from '../../node_modules/lucide/dist/esm/icons/sliders-horizontal.mjs';
import Eye from '../../node_modules/lucide/dist/esm/icons/eye.mjs';
import EyeOff from '../../node_modules/lucide/dist/esm/icons/eye-off.mjs';
import FileInput from '../../node_modules/lucide/dist/esm/icons/file-input.mjs';
import Rocket from '../../node_modules/lucide/dist/esm/icons/rocket.mjs';
import CircleAlert from '../../node_modules/lucide/dist/esm/icons/circle-alert.mjs';
import Database from '../../node_modules/lucide/dist/esm/icons/database.mjs';
import Download from '../../node_modules/lucide/dist/esm/icons/download.mjs';
import ImageDown from '../../node_modules/lucide/dist/esm/icons/image-down.mjs';

const iconNodes = {
  'refresh-cw': RefreshCw,
  plus: Plus,
  'shield-check': ShieldCheck,
  'folder-open': FolderOpen,
  'folder-cog': FolderCog,
  ellipsis: Ellipsis,
  'terminal-square': SquareTerminal,
  'panels-top-left': PanelsTopLeft,
  'monitor-up': MonitorUp,
  'chart-no-axes-combined': ChartNoAxesCombined,
  'user-round-plus': UserRoundPlus,
  'chevron-right': ChevronRight,
  'server-cog': ServerCog,
  'settings-2': Settings2,
  'key-round': KeyRound,
  'save-check': SaveCheck,
  'sliders-horizontal': SlidersHorizontal,
  eye: Eye,
  'eye-off': EyeOff,
  'file-input': FileInput,
  rocket: Rocket,
  'circle-alert': CircleAlert,
  database: Database,
  download: Download,
  'image-down': ImageDown
};

const targetMetadata = {
  cli: { label: 'Codex CLI', detail: '独立 CODEX_HOME', icon: 'terminal-square' },
  vscode: { label: 'VS Code', detail: '独立用户数据目录', icon: 'panels-top-left' },
  desktop: { label: 'Codex 桌面端', detail: '独立客户端实例', icon: 'monitor-up' }
};

const state = {
  snapshot: null,
  selectedProfileId: null,
  busy: false,
  toastTimer: null,
  providerPreviewTimer: null,
  providerPreviewRequest: 0,
  activeView: 'launcher',
  selectedUsageSourceId: 'all',
  dashboardLoading: false,
  dashboardLoaded: false,
  usageData: null,
  usageRange: 'week',
  usageModel: '',
  usageProject: '',
  usageSettings: { relayMultiplier: 1, monthlyBudget: 0, costMode: 'standard' },
  posterCanvas: null
};

const elements = {
  version: document.querySelector('#version-label'),
  status: document.querySelector('#titlebar-status'),
  activeCount: document.querySelector('#active-instance-count'),
  refresh: document.querySelector('#refresh-button'),
  primaryTabs: document.querySelector('.primary-tabs'),
  launcherView: document.querySelector('#launcher-view'),
  dashboardView: document.querySelector('#dashboard-view'),
  dashboardLoading: document.querySelector('#dashboard-loading'),
  dashboardError: document.querySelector('#dashboard-error'),
  dashboardErrorMessage: document.querySelector('#dashboard-error-message'),
  dashboardRetry: document.querySelector('#dashboard-retry-button'),
  nativeUsageContent: document.querySelector('#native-usage-content'),
  usageSourceSelect: document.querySelector('#usage-source-select'),
  usageSourceMeta: document.querySelector('#usage-source-meta'),
  usageRange: document.querySelector('#usage-range'),
  usageModelFilter: document.querySelector('#usage-model-filter'),
  usageProjectFilter: document.querySelector('#usage-project-filter'),
  usageExport: document.querySelector('#usage-export-button'),
  usagePosterButton: document.querySelector('#usage-poster-button'),
  usagePosterDialog: document.querySelector('#usage-poster-dialog'),
  usagePosterPreview: document.querySelector('#usage-poster-preview'),
  usagePosterCancel: document.querySelector('#usage-poster-cancel'),
  usagePosterSave: document.querySelector('#usage-poster-save'),
  usageSettingsButton: document.querySelector('#usage-settings-button'),
  usageDiagnosticsButton: document.querySelector('#usage-diagnostics-button'),
  usageSettingsDialog: document.querySelector('#usage-settings-dialog'),
  usageSettingsForm: document.querySelector('#usage-settings-form'),
  usageSettingsCancel: document.querySelector('#usage-settings-cancel'),
  usageRelayMultiplier: document.querySelector('#usage-relay-multiplier'),
  usageMonthlyBudget: document.querySelector('#usage-monthly-budget'),
  usageCostMode: document.querySelector('#usage-cost-mode'),
  usageDiagnosticsDialog: document.querySelector('#usage-diagnostics-dialog'),
  usageDiagnosticsContent: document.querySelector('#usage-diagnostics-content'),
  usageDiagnosticsClose: document.querySelector('#usage-diagnostics-close'),
  addProfile: document.querySelector('#add-profile-button'),
  profileList: document.querySelector('#profile-list'),
  profileName: document.querySelector('#selected-profile-name'),
  profilePath: document.querySelector('#selected-profile-path'),
  profileRuntime: document.querySelector('#selected-profile-runtime'),
  openProfileFolder: document.querySelector('#open-profile-folder-button'),
  usageSourceButton: document.querySelector('#profile-usage-source-button'),
  usageSourceLabel: document.querySelector('#profile-usage-source-label'),
  usageSourceDialog: document.querySelector('#profile-usage-source-dialog'),
  usageSourceForm: document.querySelector('#profile-usage-source-form'),
  usageSourceCancel: document.querySelector('#profile-usage-source-cancel'),
  workspacePath: document.querySelector('#workspace-path'),
  chooseWorkspace: document.querySelector('#choose-workspace-button'),
  providerName: document.querySelector('#provider-name'),
  providerDetail: document.querySelector('#provider-detail'),
  providerState: document.querySelector('#provider-state'),
  editProvider: document.querySelector('#edit-provider-button'),
  launchActions: document.querySelector('#launch-actions'),
  openDashboard: document.querySelector('#open-dashboard-button'),
  usageHeading: document.querySelector('#usage-heading'),
  metricTokens: document.querySelector('#metric-tokens'),
  metricModel: document.querySelector('#metric-model'),
  metricCalls: document.querySelector('#metric-calls'),
  metricAverage: document.querySelector('#metric-average'),
  metricTasks: document.querySelector('#metric-tasks'),
  metricCache: document.querySelector('#metric-cache'),
  metricUpdated: document.querySelector('#metric-updated'),
  targetList: document.querySelector('#target-list'),
  recentList: document.querySelector('#recent-list'),
  dialog: document.querySelector('#create-profile-dialog'),
  createForm: document.querySelector('#create-profile-form'),
  nameInput: document.querySelector('#profile-name-input'),
  cancelProfile: document.querySelector('#cancel-profile-button'),
  providerDialog: document.querySelector('#provider-dialog'),
  providerForm: document.querySelector('#provider-form'),
  providerFields: document.querySelector('#custom-provider-fields'),
  providerNameInput: document.querySelector('#provider-name-input'),
  providerNoteInput: document.querySelector('#provider-note-input'),
  providerModelInput: document.querySelector('#provider-model-input'),
  providerBaseUrlInput: document.querySelector('#provider-base-url-input'),
  providerIdInput: document.querySelector('#provider-id-input'),
  providerAdvanced: document.querySelector('#provider-advanced'),
  providerAdvancedState: document.querySelector('#provider-advanced-state'),
  providerApiKeyField: document.querySelector('#provider-api-key-field'),
  providerApiKeyInput: document.querySelector('#provider-api-key-input'),
  toggleProviderKey: document.querySelector('#toggle-provider-key-button'),
  providerReasoningInput: document.querySelector('#provider-reasoning-input'),
  providerPersonalityInput: document.querySelector('#provider-personality-input'),
  providerDisableStorageInput: document.querySelector('#provider-disable-storage-input'),
  providerPreview: document.querySelector('#provider-config-preview'),
  providerProtocol: document.querySelector('#provider-protocol-label'),
  importProviderConfig: document.querySelector('#import-provider-config-button'),
  cancelProvider: document.querySelector('#cancel-provider-button'),
  saveProvider: document.querySelector('#save-provider-button'),
  toast: document.querySelector('#toast')
};

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function refreshIcons() {
  document.querySelectorAll('[data-lucide]').forEach(element => {
    if (element.tagName.toLowerCase() === 'svg') return;
    const name = element.getAttribute('data-lucide');
    const iconNode = iconNodes[name];
    if (!iconNode) return;
    const attributes = Object.fromEntries(Array.from(element.attributes).map(attribute => [attribute.name, attribute.value]));
    const svg = createElement(iconNode, {
      ...attributes,
      class: `lucide lucide-${name}${attributes.class ? ` ${attributes.class}` : ''}`,
      'data-lucide': name,
      'aria-hidden': 'true',
      'stroke-width': 1.8
    });
    element.replaceWith(svg);
  });
}

function selectedProfile() {
  return state.snapshot?.profiles.find(profile => profile.id === state.selectedProfileId) || null;
}

function activeLaunches(profileId = null) {
  return (state.snapshot?.recentLaunches || []).filter(launch => launch.active && (!profileId || launch.profileId === profileId));
}

function initials(name) {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (parts.length > 1) return parts.slice(0, 2).map(part => part[0]).join('').toUpperCase();
  return Array.from(parts[0] || 'D').slice(0, 2).join('').toUpperCase();
}

function formatTokens(value) {
  const amount = Number(value) || 0;
  if (amount >= 1_000_000_000) return `${(amount / 1_000_000_000).toFixed(amount >= 10_000_000_000 ? 0 : 1)}B`;
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(amount >= 10_000_000 ? 0 : 1)}M`;
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(amount >= 10_000 ? 0 : 1)}K`;
  return Math.round(amount).toLocaleString('zh-CN');
}

function formatTime(value) {
  if (!value) return '尚未刷新';
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return '尚未刷新';
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

function showToast(message, error = false) {
  clearTimeout(state.toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.toggle('is-error', error);
  elements.toast.classList.add('is-visible');
  state.toastTimer = setTimeout(() => elements.toast.classList.remove('is-visible'), 3200);
}

function friendlyProviderError(error) {
  const message = String(error?.message || error || '')
    .replace(/^Error invoking remote method '[^']+': Error:\s*/, '');
  if (/Provider name must contain/.test(message)) return '请填写供应商名称。';
  if (/Model name must contain/.test(message)) return '请填写模型名称。';
  if (/Provider id must/.test(message)) return 'Provider ID 只能使用字母、数字、下划线或连字符，且不能使用保留名称。';
  if (/Existing config\.toml is invalid/.test(message)) return '当前 Profile 的 config.toml 无法解析，请先修正文件内容。';
  if (/Base URL must be/.test(message)) return '请填写不含凭据、参数或片段的 HTTP(S) Base URL。';
  return message || '供应商配置无效。';
}

function setBusy(value) {
  state.busy = value;
  document.body.classList.toggle('is-busy', value);
  elements.refresh.disabled = value;
  elements.addProfile.disabled = value;
  elements.saveProvider.disabled = value;
  elements.importProviderConfig.disabled = value;
}

function renderProfiles() {
  const profiles = state.snapshot.profiles;
  if (!profiles.length) {
    elements.profileList.innerHTML = '<div class="empty-profiles">暂无账号配置</div>';
    return;
  }
  elements.profileList.innerHTML = profiles.map(profile => `
    <button class="profile-item${profile.id === state.selectedProfileId ? ' is-selected' : ''}${activeLaunches(profile.id).length ? ' is-running' : ''}" type="button" data-profile-id="${escapeHtml(profile.id)}">
      <span class="profile-avatar">${escapeHtml(initials(profile.name))}</span>
      <span class="profile-copy">
        <strong>${escapeHtml(profile.name)}</strong>
        <span>${activeLaunches(profile.id).length ? `${activeLaunches(profile.id).length} 个实例运行中` : escapeHtml(profile.provider?.name || 'OpenAI 官方')}</span>
      </span>
      <i data-lucide="chevron-right"></i>
    </button>
  `).join('');
}

function renderSelectedProfile() {
  const profile = selectedProfile();
  const launchButtons = elements.launchActions.querySelectorAll('[data-target]');
  if (!profile) {
    elements.profileName.textContent = '账号启动中心';
    elements.profilePath.textContent = '请选择一个账号配置';
    elements.profileRuntime.textContent = '未选择';
    elements.profileRuntime.classList.remove('is-active');
    elements.providerName.textContent = '未选择 Profile';
    elements.providerDetail.textContent = '请选择账号配置';
    elements.providerState.textContent = '未配置';
    elements.providerState.classList.remove('is-ready', 'is-error');
    elements.editProvider.disabled = true;
    elements.openProfileFolder.disabled = true;
    elements.usageSourceButton.disabled = true;
    launchButtons.forEach(button => { button.disabled = true; });
    return;
  }
  elements.profileName.textContent = profile.name;
  elements.profilePath.textContent = profile.codexHome;
  const running = activeLaunches(profile.id).length;
  elements.profileRuntime.textContent = running ? `${running} 个实例运行中` : '当前未运行';
  elements.profileRuntime.classList.toggle('is-active', running > 0);
  elements.usageSourceLabel.textContent = profile.usageSource === 'default' ? '默认 Codex 用量' : '独立用量';
  elements.usageSourceButton.disabled = state.busy;
  const provider = profile.provider || { type: 'official', name: 'OpenAI 官方' };
  const providerReady = provider.type === 'official'
    || provider.authMode !== 'environment'
    || profile.hasProviderCredential;
  elements.providerName.textContent = provider.name;
  elements.providerDetail.textContent = provider.type === 'custom'
    ? provider.note || `${provider.model} · ${provider.baseUrl}`
    : 'ChatGPT 官方登录';
  elements.providerState.textContent = provider.type === 'custom'
    ? provider.authMode === 'environment'
      ? profile.hasProviderCredential ? '密钥已保存' : '缺少密钥'
      : provider.authMode === 'openai' ? 'Codex 登录' : '无需认证'
    : '官方认证';
  elements.providerState.classList.toggle('is-ready', providerReady);
  elements.providerState.classList.toggle('is-error', !providerReady);
  elements.editProvider.disabled = state.busy;
  elements.openProfileFolder.disabled = state.busy;
  launchButtons.forEach(button => {
    const target = button.dataset.target;
    button.disabled = state.busy || !providerReady || !state.snapshot.targets[target]?.available;
  });
}

function selectedProviderType() {
  return elements.providerForm.querySelector('input[name="providerType"]:checked')?.value || 'official';
}

function selectedProviderAuthMode() {
  return elements.providerForm.querySelector('input[name="providerAuthMode"]:checked')?.value || 'environment';
}

function providerFromForm() {
  if (selectedProviderType() === 'official') return { type: 'official' };
  return {
    type: 'custom',
    name: elements.providerNameInput.value,
    note: elements.providerNoteInput.value,
    model: elements.providerModelInput.value,
    baseUrl: elements.providerBaseUrlInput.value,
    providerId: elements.providerIdInput.value,
    authMode: selectedProviderAuthMode(),
    reasoningEffort: elements.providerReasoningInput.value,
    personality: elements.providerPersonalityInput.value,
    disableResponseStorage: elements.providerDisableStorageInput.checked
  };
}

async function updateProviderPreview() {
  const request = ++state.providerPreviewRequest;
  try {
    const profile = selectedProfile();
    if (!profile) return;
    const preview = await window.dualCodexDay.previewProvider(profile.id, providerFromForm());
    if (request === state.providerPreviewRequest) {
      elements.providerPreview.textContent = preview;
      elements.providerPreview.classList.remove('is-error');
    }
  } catch (error) {
    if (request === state.providerPreviewRequest) {
      elements.providerPreview.textContent = `# ${friendlyProviderError(error)}`;
      elements.providerPreview.classList.add('is-error');
    }
  }
}

function renderProviderFormMode() {
  const custom = selectedProviderType() === 'custom';
  elements.providerFields.hidden = !custom;
  elements.providerAdvanced.open = custom;
  elements.providerNameInput.required = custom;
  elements.providerModelInput.required = custom;
  elements.providerBaseUrlInput.required = custom;
  elements.providerIdInput.required = custom;
  const authMode = selectedProviderAuthMode();
  const managedKey = custom && authMode === 'environment';
  elements.providerApiKeyField.hidden = !managedKey;
  elements.providerApiKeyInput.required = managedKey && !selectedProfile()?.hasProviderCredential;
  elements.providerAdvancedState.textContent = authMode === 'environment'
    ? 'Responses · env_key'
    : authMode === 'openai' ? 'Responses · OpenAI auth' : 'Responses · No auth';
  elements.providerProtocol.textContent = custom ? '保留 Profile 通用配置' : '官方登录';
  clearTimeout(state.providerPreviewTimer);
  state.providerPreviewTimer = setTimeout(updateProviderPreview, 100);
}

function openProviderEditor() {
  const profile = selectedProfile();
  if (!profile || state.busy) return;
  const provider = profile.provider || { type: 'official', name: 'OpenAI 官方' };
  const typeInput = elements.providerForm.querySelector(`input[name="providerType"][value="${provider.type}"]`);
  if (typeInput) typeInput.checked = true;
  elements.providerNameInput.value = provider.type === 'custom' ? provider.name : '';
  elements.providerNoteInput.value = provider.type === 'custom' ? provider.note || '' : '';
  elements.providerModelInput.value = provider.type === 'custom' ? provider.model : '';
  elements.providerBaseUrlInput.value = provider.type === 'custom' ? provider.baseUrl : '';
  elements.providerIdInput.value = provider.type === 'custom' ? provider.providerId || 'custom' : 'custom';
  const authInput = elements.providerForm.querySelector(`input[name="providerAuthMode"][value="${provider.authMode || 'environment'}"]`);
  if (authInput) authInput.checked = true;
  elements.providerReasoningInput.value = provider.type === 'custom' ? provider.reasoningEffort || '' : '';
  elements.providerPersonalityInput.value = provider.type === 'custom' ? provider.personality || '' : '';
  elements.providerDisableStorageInput.checked = provider.type === 'custom' && provider.disableResponseStorage === true;
  elements.providerApiKeyInput.value = '';
  elements.providerApiKeyInput.type = 'password';
  elements.toggleProviderKey.querySelector('[data-lucide="eye"]').hidden = false;
  elements.toggleProviderKey.querySelector('[data-lucide="eye-off"]').hidden = true;
  elements.providerApiKeyInput.placeholder = profile.hasProviderCredential ? '留空以保留已保存密钥' : '输入 API Key';
  renderProviderFormMode();
  elements.providerDialog.showModal();
}

function renderUsage() {
  const usage = state.snapshot.usage;
  const summary = usage.summary;
  elements.usageHeading.textContent = `${usage.source?.name || selectedProfile()?.name || '默认账号'}今日用量`;
  elements.metricTokens.textContent = formatTokens(summary.tokens.total);
  elements.metricModel.textContent = summary.topModel?.name || '暂无模型';
  elements.metricCalls.textContent = Number(summary.calls).toLocaleString('zh-CN');
  elements.metricAverage.textContent = `平均 ${formatTokens(summary.averageTokens)}`;
  elements.metricTasks.textContent = Number(summary.tasks).toLocaleString('zh-CN');
  elements.metricCache.textContent = `${(Number(summary.cacheRate || 0) * 100).toFixed(1)}%`;
  elements.metricUpdated.textContent = usage.available ? `${formatTime(usage.updatedAt)} 更新` : '等待首次索引';
  const statusText = state.activeView === 'dashboard'
    ? state.dashboardLoading ? '正在载入用量' : state.dashboardLoaded ? '用量分析' : '用量服务异常'
    : usage.status === 'error' ? '索引异常' : usage.available ? '本地就绪' : '等待索引';
  elements.status.querySelector('span:last-child').textContent = statusText;
  elements.status.classList.toggle('has-error', state.activeView === 'dashboard' ? !state.dashboardLoading && !state.dashboardLoaded : usage.status === 'error');
  const activeCount = Number(state.snapshot.activeInstanceCount) || 0;
  elements.activeCount.textContent = activeCount ? `${activeCount} 个客户端运行中` : '暂无运行实例';
  elements.activeCount.classList.toggle('is-active', activeCount > 0);
}

function renderTargets() {
  elements.targetList.innerHTML = Object.entries(targetMetadata).map(([key, metadata]) => {
    const target = state.snapshot.targets[key] || { available: false };
    return `
      <div class="target-row">
        <span class="target-icon"><i data-lucide="${metadata.icon}"></i></span>
        <span class="target-copy">
          <strong>${metadata.label}</strong>
          <span>${metadata.detail}</span>
        </span>
        <span class="availability${target.available ? '' : ' is-missing'}">${target.available ? '可用' : '未找到'}</span>
      </div>
    `;
  }).join('');
}

function renderRecent() {
  const recent = state.snapshot.recentLaunches;
  if (!recent.length) {
    elements.recentList.innerHTML = '<div class="list-empty">暂无启动记录</div>';
    return;
  }
  elements.recentList.innerHTML = recent.map(item => {
    const metadata = targetMetadata[item.target] || targetMetadata.cli;
    return `
      <div class="recent-row">
        <span class="recent-icon"><i data-lucide="${metadata.icon}"></i></span>
        <span class="recent-copy">
          <strong>${escapeHtml(item.profileName)}</strong>
          <span>${metadata.label}</span>
        </span>
        <span class="launch-state${item.active ? ' is-active' : ''}">${item.active ? '运行中' : formatTime(item.launchedAt)}</span>
      </div>
    `;
  }).join('');
}

function render() {
  if (!state.snapshot) return;
  elements.version.textContent = `v${state.snapshot.version}`;
  elements.workspacePath.textContent = state.snapshot.workspace;
  renderProfiles();
  renderSelectedProfile();
  renderUsage();
  renderTargets();
  renderRecent();
  renderUsageSources();
  refreshIcons();
}

function renderUsageSources() {
  const sources = state.snapshot?.usageSources || [];
  if (!sources.some(source => source.id === state.selectedUsageSourceId)) {
    state.selectedUsageSourceId = sources[0]?.id || 'all';
  }
  elements.usageSourceSelect.innerHTML = sources.map(source => `
    <option value="${escapeHtml(source.id)}">${escapeHtml(source.name)}</option>
  `).join('');
  elements.usageSourceSelect.value = state.selectedUsageSourceId;
  const selected = sources.find(source => source.id === state.selectedUsageSourceId);
  elements.usageSourceMeta.textContent = selected?.kind === 'all'
    ? `${selected.detail} · 汇总视图`
    : `${selected?.detail || '独立数据源'} · 独立索引`;
}

async function refreshSnapshot(preferredProfileId = state.selectedProfileId, quiet = false) {
  if (!quiet) setBusy(true);
  try {
    const snapshot = await window.dualCodexDay.getSnapshot(preferredProfileId);
    state.snapshot = snapshot;
    state.selectedProfileId = snapshot.profiles.some(profile => profile.id === preferredProfileId)
      ? preferredProfileId
      : snapshot.profiles[0]?.id || null;
    render();
  } catch (error) {
    showToast(error.message || '读取本地状态失败。', true);
  } finally {
    if (!quiet) setBusy(false);
    renderSelectedProfile();
  }
}

function renderDashboardState(errorMessage = '') {
  elements.dashboardLoading.hidden = !state.dashboardLoading;
  elements.dashboardError.hidden = state.dashboardLoading || state.dashboardLoaded || !errorMessage;
  elements.nativeUsageContent.hidden = !state.dashboardLoaded;
  elements.dashboardErrorMessage.textContent = errorMessage || '本地用量服务未能启动。';
  elements.usageSourceSelect.disabled = state.dashboardLoading;
  elements.usagePosterButton.disabled = state.dashboardLoading || !state.dashboardLoaded;
  if (state.snapshot) renderUsage();
}

function usageSettingsKey() {
  return `dual-codex-native-usage:${state.selectedUsageSourceId}`;
}

function loadUsageSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(usageSettingsKey()) || '{}');
    state.usageSettings = {
      relayMultiplier: Math.max(0, Number(saved.relayMultiplier ?? 1)),
      monthlyBudget: Math.max(0, Number(saved.monthlyBudget || 0)),
      costMode: ['standard', 'batch', 'flex', 'fast'].includes(saved.costMode) ? saved.costMode : 'standard'
    };
  } catch {
    state.usageSettings = { relayMultiplier: 1, monthlyBudget: 0, costMode: 'standard' };
  }
}

function usageEvents() {
  const now = new Date();
  let start = new Date(0);
  if (state.usageRange === 'today') start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (state.usageRange === 'week') {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    start.setDate(start.getDate() - ((start.getDay() || 7) - 1));
  }
  if (state.usageRange === '30d') {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    start.setDate(start.getDate() - 29);
  }
  return (state.usageData?.events || []).filter(event => {
    const time = new Date(event.timestamp);
    return time >= start && (!state.usageModel || event.model === state.usageModel)
      && (!state.usageProject || event.projectId === state.usageProject);
  });
}

function resolvePriceModel(model) {
  const pricing = state.usageData?.pricing || {};
  if (pricing.models?.[model]) return model;
  if (pricing.aliases?.[model] && pricing.models?.[pricing.aliases[model]]) return pricing.aliases[model];
  return Object.keys(pricing.models || {}).find(key => model.startsWith(key)) || '';
}

function estimateUsageEvent(event) {
  const pricing = state.usageData?.pricing || {};
  const modelId = resolvePriceModel(event.model);
  const rates = pricing.models?.[modelId];
  const mode = pricing.modes?.[state.usageSettings.costMode] || pricing.modes?.standard || { multiplier: 1 };
  if (!rates || (mode.modelPrefixes && !mode.modelPrefixes.some(prefix => modelId.startsWith(prefix)))) {
    return { priced: false, total: 0, parts: { input: 0, cached: 0, output: 0 } };
  }
  const input = Math.max(0, Number(event.input || 0));
  const cached = Math.min(input, Math.max(0, Number(event.cachedInput || 0)));
  const regular = Math.max(0, input - cached);
  const output = Math.max(0, Number(event.output || 0));
  const long = pricing.longContext && input > Number(pricing.longContext.thresholdInputTokens || Infinity)
    && (pricing.longContext.modelPrefixes || []).some(prefix => modelId.startsWith(prefix));
  const inputMultiplier = long ? Number(pricing.longContext.inputMultiplier || 1) : 1;
  const outputMultiplier = long ? Number(pricing.longContext.outputMultiplier || 1) : 1;
  const multiplier = Number(mode.multiplier || 1) * state.usageSettings.relayMultiplier;
  const unit = Number(pricing.unitTokens || 1_000_000);
  const parts = {
    input: regular / unit * Number(rates.input || 0) * inputMultiplier * multiplier,
    cached: cached / unit * Number(rates.cachedInput ?? rates.input ?? 0) * inputMultiplier * multiplier,
    output: output / unit * Number(rates.output || 0) * outputMultiplier * multiplier
  };
  return { priced: true, total: parts.input + parts.cached + parts.output, parts };
}

function usageAggregate(events) {
  const input = events.reduce((sum, event) => sum + Number(event.input || 0), 0);
  const cached = events.reduce((sum, event) => sum + Number(event.cachedInput || 0), 0);
  const total = events.reduce((sum, event) => sum + Number(event.total || 0), 0);
  const estimates = events.map(estimateUsageEvent);
  const cost = estimates.reduce((sum, estimate) => sum + estimate.total, 0);
  return {
    input, cached, total, cost,
    output: events.reduce((sum, event) => sum + Number(event.output || 0), 0),
    calls: events.length,
    tasks: new Set(events.map(event => event.sessionId)).size,
    projects: new Set(events.map(event => event.projectId)).size,
    cacheRate: input ? cached / input : 0,
    average: events.length ? total / events.length : 0,
    coverage: total ? events.reduce((sum, event, index) => sum + (estimates[index].priced ? Number(event.total || 0) : 0), 0) / total : 1,
    parts: estimates.reduce((parts, estimate) => ({ input: parts.input + estimate.parts.input, cached: parts.cached + estimate.parts.cached, output: parts.output + estimate.parts.output }), { input: 0, cached: 0, output: 0 })
  };
}

function formatUsd(value) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value || 0));
}

function posterRoundedRect(context, x, y, width, height, radius, fill) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
  context.fillStyle = fill;
  context.fill();
}

function posterEllipsis(context, value, maxWidth) {
  const text = String(value || '—');
  if (context.measureText(text).width <= maxWidth) return text;
  let fitted = text;
  while (fitted.length > 1 && context.measureText(`${fitted}…`).width > maxWidth) fitted = fitted.slice(0, -1);
  return `${fitted}…`;
}

function posterGroups(events, key, labelKey = key) {
  const groups = new Map();
  events.forEach(event => {
    const id = String(event[key] || 'unknown');
    const group = groups.get(id) || { id, label: String(event[labelKey] || id), total: 0 };
    group.total += Number(event.total || 0);
    groups.set(id, group);
  });
  return [...groups.values()].sort((a, b) => b.total - a.total);
}

function posterTimeline(events) {
  const raw = new Map();
  events.forEach(event => {
    const time = new Date(event.timestamp);
    const bucketTime = state.usageRange === 'today'
      ? new Date(time.getFullYear(), time.getMonth(), time.getDate(), time.getHours())
      : new Date(time.getFullYear(), time.getMonth(), time.getDate());
    const key = bucketTime.valueOf();
    const bucket = raw.get(key) || {
      key,
      label: state.usageRange === 'today'
        ? `${String(time.getHours()).padStart(2, '0')}:00`
        : `${String(time.getMonth() + 1).padStart(2, '0')}/${String(time.getDate()).padStart(2, '0')}`,
      cached: 0,
      uncached: 0,
      output: 0
    };
    const input = Math.max(0, Number(event.input || 0));
    const cached = Math.min(input, Math.max(0, Number(event.cachedInput || 0)));
    bucket.cached += cached;
    bucket.uncached += Math.max(0, input - cached);
    bucket.output += Math.max(0, Number(event.output || 0));
    raw.set(key, bucket);
  });
  const values = [...raw.values()].sort((a, b) => a.key - b.key);
  if (values.length <= 16) return values;
  const size = Math.ceil(values.length / 16);
  const compressed = [];
  for (let index = 0; index < values.length; index += size) {
    const chunk = values.slice(index, index + size);
    compressed.push({
      key: chunk[0].key,
      label: chunk.length > 1 ? `${chunk[0].label}–${chunk.at(-1).label}` : chunk[0].label,
      cached: chunk.reduce((sum, bucket) => sum + bucket.cached, 0),
      uncached: chunk.reduce((sum, bucket) => sum + bucket.uncached, 0),
      output: chunk.reduce((sum, bucket) => sum + bucket.output, 0)
    });
  }
  return compressed;
}

function createUsagePoster() {
  const events = usageEvents();
  const aggregate = usageAggregate(events);
  const projects = posterGroups(events, 'projectId', 'project');
  const models = posterGroups(events, 'model');
  const tasks = posterGroups(events, 'sessionId');
  const timeline = posterTimeline(events);
  const rangeLabel = { today: '今天', week: '本周', '30d': '近 30 天', all: '全部记录' }[state.usageRange];
  const sourceName = state.usageData?.source?.name || '全部账号';
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 1600;
  const context = canvas.getContext('2d');
  const colors = {
    bg: '#f3f5f2', panel: '#ffffff', ink: '#111815', muted: '#68736d', line: '#dce2dd',
    green: '#087f5b', greenSoft: '#dff3e9', blue: '#2563a9', coral: '#c65d18', violet: '#6950a1', lime: '#b7df4b'
  };
  const font = '"Segoe UI", "Microsoft YaHei", sans-serif';
  const mono = '"Cascadia Code", Consolas, monospace';
  context.fillStyle = colors.bg;
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.strokeStyle = colors.blue;
  context.lineWidth = 7;
  context.strokeRect(72, 61, 20, 36);
  context.strokeStyle = colors.green;
  context.strokeRect(98, 61, 20, 36);
  context.fillStyle = colors.lime;
  context.fillRect(111, 58, 13, 7);
  context.fillStyle = colors.ink;
  context.font = `700 30px ${font}`;
  context.fillText('Dual Codex Day', 146, 91);
  context.fillStyle = colors.muted;
  context.font = `400 17px ${font}`;
  context.textAlign = 'right';
  context.fillText(new Date(state.usageData?.generatedAt || Date.now()).toLocaleString('zh-CN'), 1128, 88);
  context.textAlign = 'left';

  posterRoundedRect(context, 72, 145, 170, 46, 23, colors.ink);
  context.fillStyle = colors.panel;
  context.font = `650 18px ${font}`;
  context.textAlign = 'center';
  context.fillText(rangeLabel, 157, 175);
  context.textAlign = 'left';
  context.fillStyle = colors.muted;
  context.font = `500 18px ${font}`;
  context.fillText(posterEllipsis(context, sourceName, 600), 266, 176);

  context.fillStyle = colors.ink;
  context.font = `700 48px ${font}`;
  context.fillText(`${sourceName} 与 Codex`, 72, 292);
  context.font = `750 104px ${font}`;
  context.fillStyle = colors.green;
  const tokenText = formatTokens(aggregate.total);
  context.fillText(tokenText, 68, 426);
  const tokenWidth = context.measureText(tokenText).width;
  context.fillStyle = colors.ink;
  context.font = `600 43px ${font}`;
  context.fillText('tokens', Math.min(900, 86 + tokenWidth), 416);
  context.fillStyle = colors.muted;
  context.font = `400 19px ${font}`;
  context.fillText(`${aggregate.calls.toLocaleString('zh-CN')} 次调用  ·  输入 ${formatTokens(aggregate.input)}  ·  输出 ${formatTokens(aggregate.output)}  ·  ${aggregate.tasks} 个任务`, 72, 476);

  const stats = [
    ['缓存命中率', `${(aggregate.cacheRate * 100).toFixed(1)}%`, colors.green],
    ['API 等价预计成本', aggregate.coverage ? formatUsd(aggregate.cost) : '—', colors.coral],
    ['活跃项目', String(aggregate.projects), colors.violet]
  ];
  stats.forEach((stat, index) => {
    const x = 72 + index * 352;
    if (index) { context.fillStyle = colors.line; context.fillRect(x - 25, 526, 1, 112); }
    context.fillStyle = stat[2];
    context.fillRect(x, 534, 34, 6);
    context.fillStyle = colors.muted;
    context.font = `400 16px ${font}`;
    context.fillText(stat[0], x, 577);
    context.fillStyle = colors.ink;
    context.font = `700 36px ${font}`;
    context.fillText(stat[1], x, 623);
  });

  posterRoundedRect(context, 52, 690, 1096, 500, 20, colors.panel);
  context.fillStyle = colors.ink;
  context.font = `700 26px ${font}`;
  context.fillText(state.usageRange === 'today' ? '今天的调用节奏' : 'Token 使用节奏', 86, 750);
  const legend = [['缓存', colors.blue], ['新输入', colors.green], ['输出', colors.coral]];
  let legendX = 790;
  context.font = `400 14px ${font}`;
  legend.forEach(([label, color]) => {
    context.fillStyle = color;
    context.fillRect(legendX, 739, 10, 10);
    context.fillStyle = colors.muted;
    context.fillText(label, legendX + 17, 750);
    legendX += 94;
  });

  const chart = { x: 126, y: 800, w: 936, h: 300 };
  const max = Math.max(1, ...timeline.map(bucket => bucket.cached + bucket.uncached + bucket.output));
  for (let tick = 0; tick <= 3; tick += 1) {
    const y = chart.y + chart.h - chart.h * tick / 3;
    context.fillStyle = colors.line;
    context.fillRect(chart.x, y, chart.w, 1);
    context.fillStyle = colors.muted;
    context.font = `400 13px ${font}`;
    context.textAlign = 'right';
    context.fillText(formatTokens(max * tick / 3), chart.x - 12, y + 5);
  }
  context.textAlign = 'left';
  if (!timeline.length) {
    context.fillStyle = colors.muted;
    context.font = `500 22px ${font}`;
    context.textAlign = 'center';
    context.fillText('当前筛选范围暂无数据', chart.x + chart.w / 2, chart.y + chart.h / 2);
    context.textAlign = 'left';
  } else {
    const slot = chart.w / timeline.length;
    const barWidth = Math.max(16, Math.min(44, slot * .58));
    const labelStep = Math.max(1, Math.ceil(timeline.length / 6));
    timeline.forEach((bucket, index) => {
      const x = chart.x + index * slot + (slot - barWidth) / 2;
      let bottom = chart.y + chart.h;
      [[bucket.cached, colors.blue], [bucket.uncached, colors.green], [bucket.output, colors.coral]].forEach(([value, color]) => {
        const height = chart.h * value / max;
        bottom -= height;
        if (height > 0) posterRoundedRect(context, x, bottom, barWidth, Math.max(2, height), 3, color);
      });
      if (index % labelStep === 0 || index === timeline.length - 1) {
        context.fillStyle = colors.muted;
        context.font = `400 12px ${font}`;
        context.textAlign = 'center';
        context.fillText(bucket.label, x + barWidth / 2, chart.y + chart.h + 30);
      }
    });
    context.textAlign = 'left';
  }

  context.fillStyle = colors.ink;
  context.font = `700 24px ${font}`;
  context.fillText('这段时间的主角', 72, 1272);
  const highlights = [
    ['主要项目', projects[0]?.label || '—', projects[0] ? `${(projects[0].total / Math.max(1, aggregate.total) * 100).toFixed(1)}%` : ''],
    ['主要模型', models[0]?.label || '—', models[0] ? formatTokens(models[0].total) : ''],
    ['最大任务', tasks[0]?.id?.slice(-8) || '—', tasks[0] ? formatTokens(tasks[0].total) : '']
  ];
  highlights.forEach((item, index) => {
    const x = 72 + index * 352;
    posterRoundedRect(context, x, 1310, 320, 132, 14, colors.panel);
    context.fillStyle = [colors.blue, colors.green, colors.violet][index];
    context.fillRect(x + 20, 1332, 27, 5);
    context.fillStyle = colors.muted;
    context.font = `400 15px ${font}`;
    context.fillText(item[0], x + 20, 1371);
    context.fillStyle = colors.ink;
    context.font = index === 1 ? `650 21px ${mono}` : `650 23px ${font}`;
    context.fillText(posterEllipsis(context, item[1], 210), x + 20, 1408);
    context.fillStyle = colors.muted;
    context.font = `400 14px ${font}`;
    context.textAlign = 'right';
    context.fillText(item[2], x + 298, 1408);
    context.textAlign = 'left';
  });

  const filters = [state.usageModel && `模型 ${state.usageModel}`, state.usageProject && `项目 ${elements.usageProjectFilter.selectedOptions[0]?.textContent}`].filter(Boolean).join(' · ');
  context.fillStyle = colors.muted;
  context.font = `400 14px ${font}`;
  context.fillText(filters || '全部模型 · 全部项目', 72, 1510);
  context.fillText('数据来自本地 Codex 日志 · API 标价估算，非实际账单', 72, 1546);
  context.textAlign = 'right';
  context.fillText('local profiles & usage · Dual Codex Day', 1128, 1546);
  context.textAlign = 'left';
  return canvas;
}

function openUsagePoster() {
  if (!state.dashboardLoaded) return;
  state.posterCanvas = createUsagePoster();
  elements.usagePosterPreview.src = state.posterCanvas.toDataURL('image/png');
  elements.usagePosterDialog.showModal();
}

function saveUsagePoster() {
  if (!state.posterCanvas) return;
  elements.usagePosterSave.disabled = true;
  state.posterCanvas.toBlob(blob => {
    if (!blob) {
      elements.usagePosterSave.disabled = false;
      showToast('海报生成失败。', true);
      return;
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const source = state.usageData?.source?.name || 'all';
    link.href = url;
    link.download = `dual-codex-day-${source.replace(/[^a-z0-9\u4e00-\u9fff-]/gi, '-')}-${state.usageRange}-${new Date().toISOString().slice(0, 10)}.png`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    elements.usagePosterSave.disabled = false;
    elements.usagePosterDialog.close();
    showToast('用量海报已保存。');
  }, 'image/png');
}

function renderTrend(events) {
  const buckets = new Map();
  events.forEach(event => {
    const time = new Date(event.timestamp);
    const key = state.usageRange === 'today'
      ? `${String(time.getHours()).padStart(2, '0')}:00`
      : `${String(time.getMonth() + 1).padStart(2, '0')}/${String(time.getDate()).padStart(2, '0')}`;
    const bucket = buckets.get(key) || { label: key, input: 0, output: 0 };
    bucket.input += Number(event.input || 0);
    bucket.output += Number(event.output || 0);
    buckets.set(key, bucket);
  });
  const values = [...buckets.values()];
  const chart = document.querySelector('#usage-trend-chart');
  if (!values.length) { chart.innerHTML = '<div class="chart-empty">当前范围暂无数据</div>'; return; }
  const width = 720, height = 190, left = 24, right = 12, top = 12, bottom = 28;
  const max = Math.max(1, ...values.flatMap(value => [value.input, value.output]));
  if (values.length === 1) {
    const baseline = height - bottom;
    const inputHeight = (height - top - bottom) * values[0].input / max;
    const outputHeight = (height - top - bottom) * values[0].output / max;
    chart.innerHTML = `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-label="Token 使用趋势">
      ${[0, .33, .66, 1].map(step => `<line class="chart-grid-line" x1="${left}" x2="${width - right}" y1="${top + step * (height - top - bottom)}" y2="${top + step * (height - top - bottom)}"></line>`).join('')}
      <rect class="chart-bar-input" x="330" y="${baseline - inputHeight}" width="26" height="${inputHeight}" rx="3"></rect>
      <rect class="chart-bar-output" x="364" y="${baseline - outputHeight}" width="26" height="${outputHeight}" rx="3"></rect>
      <text class="chart-label" x="360" y="${height - 7}" text-anchor="middle">${values[0].label}</text>
    </svg>`;
    return;
  }
  const x = index => left + (values.length === 1 ? (width - left - right) / 2 : index * (width - left - right) / (values.length - 1));
  const y = value => top + (height - top - bottom) * (1 - value / max);
  const points = key => values.map((value, index) => `${x(index)},${y(value[key])}`).join(' ');
  const area = `${left},${height - bottom} ${points('input')} ${x(values.length - 1)},${height - bottom}`;
  chart.innerHTML = `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-label="Token 使用趋势">
    ${[0, .33, .66, 1].map(step => `<line class="chart-grid-line" x1="${left}" x2="${width - right}" y1="${top + step * (height - top - bottom)}" y2="${top + step * (height - top - bottom)}"></line>`).join('')}
    <polygon class="chart-input-area" points="${area}"></polygon><polyline class="chart-input-line" points="${points('input')}"></polyline><polyline class="chart-output-line" points="${points('output')}"></polyline>
    ${values.map((value, index) => `<circle class="chart-dot-input" cx="${x(index)}" cy="${y(value.input)}" r="3"></circle><circle class="chart-dot-output" cx="${x(index)}" cy="${y(value.output)}" r="3"></circle><text class="chart-label" x="${x(index)}" y="${height - 7}" text-anchor="middle">${value.label}</text>`).join('')}
  </svg>`;
}

function renderNativeUsage() {
  const events = usageEvents();
  const aggregate = usageAggregate(events);
  const labels = { today: '今日用量', week: '本周用量', '30d': '近 30 天用量', all: '全部用量' };
  document.querySelector('#usage-title').textContent = labels[state.usageRange];
  document.querySelector('#usage-subtitle').textContent = `${state.usageData.source.name} · ${new Date(state.usageData.generatedAt).toLocaleString('zh-CN')}`;
  document.querySelector('#usage-kpi-total').textContent = formatTokens(aggregate.total);
  document.querySelector('#usage-kpi-total-note').textContent = `${aggregate.calls.toLocaleString('zh-CN')} 次调用`;
  document.querySelector('#usage-kpi-cost').textContent = formatUsd(aggregate.cost);
  document.querySelector('#usage-kpi-coverage').textContent = `${(aggregate.coverage * 100).toFixed(0)}% Token 已定价`;
  document.querySelector('#usage-kpi-tasks').textContent = aggregate.tasks.toLocaleString('zh-CN');
  document.querySelector('#usage-kpi-projects').textContent = `${aggregate.projects} 个项目`;
  document.querySelector('#usage-kpi-cache').textContent = `${(aggregate.cacheRate * 100).toFixed(1)}%`;
  document.querySelector('#usage-kpi-cached').textContent = `${formatTokens(aggregate.cached)} cached`;
  document.querySelector('#usage-kpi-average').textContent = formatTokens(aggregate.average);
  document.querySelector('#usage-cost-total').textContent = formatUsd(aggregate.cost);
  const maxPart = Math.max(aggregate.parts.input, aggregate.parts.cached, aggregate.parts.output, .000001);
  document.querySelector('#usage-cost-breakdown').innerHTML = [['普通输入', aggregate.parts.input], ['缓存输入', aggregate.parts.cached], ['输出', aggregate.parts.output]].map(([label, value]) => `<div class="cost-row"><span>${label}</span><span class="cost-track"><i style="width:${value / maxPart * 100}%"></i></span><strong>${formatUsd(value)}</strong></div>`).join('');
  const budget = state.usageSettings.monthlyBudget;
  document.querySelector('#usage-budget-label').textContent = budget ? `${formatUsd(aggregate.cost)} / ${formatUsd(budget)}` : '未设置';
  document.querySelector('#usage-budget-bar').style.width = `${budget ? Math.min(100, aggregate.cost / budget * 100) : 0}%`;
  renderTrend(events);

  const groups = new Map();
  events.forEach(event => {
    const group = groups.get(event.model) || { label: event.model, calls: 0, total: 0, cost: 0 };
    group.calls += 1; group.total += Number(event.total || 0); group.cost += estimateUsageEvent(event).total; groups.set(event.model, group);
  });
  const rows = [...groups.values()].sort((a, b) => b.total - a.total).slice(0, 7);
  document.querySelector('#usage-distribution').innerHTML = rows.length ? `<div class="usage-table-row header"><span>模型</span><span>调用</span><span>Token</span><span>成本</span></div>${rows.map(row => `<div class="usage-table-row"><strong>${escapeHtml(row.label)}</strong><span>${row.calls}</span><span>${formatTokens(row.total)}</span><span>${formatUsd(row.cost)}</span></div>`).join('')}` : '<div class="usage-empty">当前范围暂无模型记录</div>';

  const tasks = new Map();
  events.forEach(event => {
    const task = tasks.get(event.sessionId) || { id: event.sessionId, project: event.project, model: event.model, timestamp: event.timestamp, calls: 0, total: 0 };
    task.calls += 1; task.total += Number(event.total || 0); if (event.timestamp > task.timestamp) task.timestamp = event.timestamp; tasks.set(event.sessionId, task);
  });
  const taskRows = [...tasks.values()].sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 7);
  document.querySelector('#usage-task-count').textContent = `${tasks.size} 个任务`;
  document.querySelector('#usage-task-list').innerHTML = taskRows.length ? taskRows.map(task => `<div class="usage-task-row"><div><strong>${escapeHtml(task.project)}</strong><span>${escapeHtml(task.model)} · ${new Date(task.timestamp).toLocaleString('zh-CN')}</span></div><div class="usage-task-metric"><strong>${formatTokens(task.total)}</strong><span>${task.calls} 次调用</span></div></div>`).join('') : '<div class="usage-empty">当前范围暂无任务</div>';
}

function initializeUsageFilters() {
  const events = state.usageData?.events || [];
  const models = [...new Set(events.map(event => event.model))].sort();
  const projects = [...new Map(events.map(event => [event.projectId, event.project])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  elements.usageModelFilter.innerHTML = '<option value="">全部</option>' + models.map(model => `<option value="${escapeHtml(model)}">${escapeHtml(model)}</option>`).join('');
  elements.usageProjectFilter.innerHTML = '<option value="">全部</option>' + projects.map(([id, name]) => `<option value="${escapeHtml(id)}">${escapeHtml(name)}</option>`).join('');
  if (!models.includes(state.usageModel)) state.usageModel = '';
  if (!projects.some(([id]) => id === state.usageProject)) state.usageProject = '';
  elements.usageModelFilter.value = state.usageModel;
  elements.usageProjectFilter.value = state.usageProject;
}

async function loadDashboard(force = false) {
  if (state.dashboardLoading || (state.dashboardLoaded && !force)) return;
  state.dashboardLoading = true;
  state.dashboardLoaded = false;
  renderDashboardState();
  try {
    state.usageData = await window.dualCodexDay.getUsageData(state.selectedUsageSourceId);
    loadUsageSettings();
    initializeUsageFilters();
    state.dashboardLoading = false;
    state.dashboardLoaded = true;
    elements.usageSourceMeta.textContent = `${state.usageData.source.name} · ${state.usageData.source.kind === 'all' ? '汇总索引' : '独立索引'}`;
    renderDashboardState();
    renderNativeUsage();
  } catch (error) {
    state.dashboardLoading = false;
    renderDashboardState(error.message || '本地用量服务未能启动。');
  }
}

function switchView(view) {
  if (!['launcher', 'dashboard'].includes(view)) return;
  state.activeView = view;
  elements.launcherView.hidden = view !== 'launcher';
  elements.dashboardView.hidden = view !== 'dashboard';
  elements.primaryTabs.querySelectorAll('[data-view]').forEach(button => {
    const selected = button.dataset.view === view;
    button.classList.toggle('is-active', selected);
    button.setAttribute('aria-selected', String(selected));
  });
  if (state.snapshot) renderUsage();
  if (view === 'dashboard') loadDashboard();
}

elements.profileList.addEventListener('click', event => {
  const button = event.target.closest('[data-profile-id]');
  if (!button) return;
  state.selectedProfileId = button.dataset.profileId;
  renderProfiles();
  renderSelectedProfile();
  refreshIcons();
  refreshSnapshot(state.selectedProfileId, true);
});

elements.addProfile.addEventListener('click', () => {
  elements.nameInput.value = '';
  elements.dialog.showModal();
  elements.nameInput.focus();
});

elements.cancelProfile.addEventListener('click', () => elements.dialog.close());
elements.cancelProvider.addEventListener('click', () => elements.providerDialog.close());
elements.editProvider.addEventListener('click', openProviderEditor);
elements.toggleProviderKey.addEventListener('click', () => {
  const visible = elements.providerApiKeyInput.type === 'text';
  elements.providerApiKeyInput.type = visible ? 'password' : 'text';
  elements.toggleProviderKey.querySelector('[data-lucide="eye"]').hidden = !visible;
  elements.toggleProviderKey.querySelector('[data-lucide="eye-off"]').hidden = visible;
});

elements.providerForm.addEventListener('input', renderProviderFormMode);
elements.providerForm.addEventListener('change', renderProviderFormMode);

elements.importProviderConfig.addEventListener('click', async () => {
  const profile = selectedProfile();
  if (!profile || state.busy) return;
  setBusy(true);
  try {
    const imported = await window.dualCodexDay.importProfileConfig(profile.id);
    if (!imported) return;
    await refreshSnapshot(imported.id, true);
    await updateProviderPreview();
    showToast('已导入通用配置，当前供应商和独立认证保持不变。');
  } catch (error) {
    showToast(friendlyProviderError(error), true);
  } finally {
    setBusy(false);
    renderSelectedProfile();
  }
});

elements.providerForm.addEventListener('submit', async event => {
  event.preventDefault();
  const profile = selectedProfile();
  if (!profile || state.busy) return;
  setBusy(true);
  try {
    const updated = await window.dualCodexDay.saveProvider(
      profile.id,
      providerFromForm(),
      elements.providerApiKeyInput.value
    );
    elements.providerApiKeyInput.value = '';
    elements.providerDialog.close();
    await refreshSnapshot(updated.id);
    showToast(`已保存“${updated.name}”的供应商配置。`);
  } catch (error) {
    showToast(friendlyProviderError(error), true);
  } finally {
    setBusy(false);
    renderSelectedProfile();
  }
});

elements.createForm.addEventListener('submit', async event => {
  event.preventDefault();
  const name = elements.nameInput.value.trim();
  if (!name) return;
  setBusy(true);
  try {
    const profile = await window.dualCodexDay.createProfile(name);
    elements.dialog.close();
    await refreshSnapshot(profile.id);
    showToast(`已创建“${profile.name}”。`);
  } catch (error) {
    showToast(error.message || '创建账号配置失败。', true);
  } finally {
    setBusy(false);
  }
});

elements.chooseWorkspace.addEventListener('click', async () => {
  if (state.busy) return;
  setBusy(true);
  try {
    const workspace = await window.dualCodexDay.chooseWorkspace();
    state.snapshot.workspace = workspace;
    render();
  } catch (error) {
    showToast(error.message || '无法选择启动目录。', true);
  } finally {
    setBusy(false);
  }
});

elements.launchActions.addEventListener('click', async event => {
  const button = event.target.closest('[data-target]');
  const profile = selectedProfile();
  if (!button || !profile || state.busy) return;
  const target = button.dataset.target;
  setBusy(true);
  renderSelectedProfile();
  try {
    await window.dualCodexDay.launchProfile(profile.id, target);
    await refreshSnapshot(profile.id);
    showToast(`已用“${profile.name}”启动 ${targetMetadata[target].label}。`);
  } catch (error) {
    showToast(error.message || '启动失败。', true);
  } finally {
    setBusy(false);
    renderSelectedProfile();
  }
});

elements.openProfileFolder.addEventListener('click', async () => {
  const profile = selectedProfile();
  if (!profile || state.busy) return;
  try {
    await window.dualCodexDay.openProfileFolder(profile.id);
  } catch (error) {
    showToast(error.message || '无法打开配置目录。', true);
  }
});

elements.usageSourceButton.addEventListener('click', () => {
  const profile = selectedProfile();
  if (!profile || state.busy) return;
  const input = elements.usageSourceForm.querySelector(`input[name="profileUsageSource"][value="${profile.usageSource || 'profile'}"]`);
  if (input) input.checked = true;
  elements.usageSourceDialog.showModal();
});
elements.usageSourceCancel.addEventListener('click', () => elements.usageSourceDialog.close());
elements.usageSourceForm.addEventListener('submit', async event => {
  event.preventDefault();
  const profile = selectedProfile();
  const source = elements.usageSourceForm.querySelector('input[name="profileUsageSource"]:checked')?.value;
  if (!profile || !source || state.busy) return;
  setBusy(true);
  try {
    const updated = await window.dualCodexDay.setProfileUsageSource(profile.id, source);
    elements.usageSourceDialog.close();
    state.dashboardLoaded = false;
    await refreshSnapshot(updated.id, true);
    showToast(`“${updated.name}”已关联${source === 'default' ? '当前默认 Codex' : '独立 Profile'}用量。`);
  } catch (error) {
    showToast(error.message || '无法保存账号用量来源。', true);
  } finally {
    setBusy(false);
    renderSelectedProfile();
  }
});

elements.openDashboard.addEventListener('click', async () => {
  if (state.selectedProfileId) {
    state.selectedUsageSourceId = `profile:${state.selectedProfileId}`;
    state.dashboardLoaded = false;
    renderUsageSources();
  }
  switchView('dashboard');
});

elements.primaryTabs.addEventListener('click', event => {
  const button = event.target.closest('[data-view]');
  if (button) switchView(button.dataset.view);
});
elements.dashboardRetry.addEventListener('click', () => loadDashboard(true));
elements.usageSourceSelect.addEventListener('change', () => {
  state.selectedUsageSourceId = elements.usageSourceSelect.value;
  state.dashboardLoaded = false;
  renderUsageSources();
  loadDashboard(true);
});
elements.usageRange.addEventListener('click', event => {
  const button = event.target.closest('[data-range]');
  if (!button) return;
  state.usageRange = button.dataset.range;
  elements.usageRange.querySelectorAll('[data-range]').forEach(item => item.classList.toggle('is-active', item === button));
  renderNativeUsage();
});
elements.usageModelFilter.addEventListener('change', () => { state.usageModel = elements.usageModelFilter.value; renderNativeUsage(); });
elements.usageProjectFilter.addEventListener('change', () => { state.usageProject = elements.usageProjectFilter.value; renderNativeUsage(); });
elements.usageSettingsButton.addEventListener('click', () => {
  elements.usageRelayMultiplier.value = state.usageSettings.relayMultiplier;
  elements.usageMonthlyBudget.value = state.usageSettings.monthlyBudget || '';
  elements.usageCostMode.value = state.usageSettings.costMode;
  elements.usageSettingsDialog.showModal();
});
elements.usageSettingsCancel.addEventListener('click', () => elements.usageSettingsDialog.close());
elements.usageSettingsForm.addEventListener('submit', event => {
  event.preventDefault();
  state.usageSettings = {
    relayMultiplier: Math.max(0, Number(elements.usageRelayMultiplier.value || 1)),
    monthlyBudget: Math.max(0, Number(elements.usageMonthlyBudget.value || 0)),
    costMode: elements.usageCostMode.value
  };
  localStorage.setItem(usageSettingsKey(), JSON.stringify(state.usageSettings));
  elements.usageSettingsDialog.close();
  renderNativeUsage();
});
elements.usageDiagnosticsButton.addEventListener('click', () => {
  const d = state.usageData?.diagnostics || {};
  const counts = d.counts || {};
  const items = [['状态', d.status || 'unknown'], ['日志文件', counts.files || 0], ['有效事件', counts.events || 0], ['任务', counts.sessions || 0], ['JSON 错误', counts.invalidJson || 0], ['重复记录', counts.duplicateEvents || 0]];
  elements.usageDiagnosticsContent.innerHTML = items.map(([label, value]) => `<div><span>${label}</span><strong>${escapeHtml(value)}</strong></div>`).join('');
  elements.usageDiagnosticsDialog.showModal();
});
elements.usageDiagnosticsClose.addEventListener('click', () => elements.usageDiagnosticsDialog.close());
elements.usagePosterButton.addEventListener('click', openUsagePoster);
elements.usagePosterCancel.addEventListener('click', () => elements.usagePosterDialog.close());
elements.usagePosterSave.addEventListener('click', saveUsagePoster);
elements.usageExport.addEventListener('click', () => {
  const rows = usageEvents();
  const quote = value => `"${String(value ?? '').replaceAll('"', '""')}"`;
  const csv = '\ufeff' + [['时间', '项目', '模型', '输入', '缓存输入', '输出', '总 Token', '任务 ID'], ...rows.map(row => [row.timestamp, row.project, row.model, row.input, row.cachedInput, row.output, row.total, row.sessionId])]
    .map(row => row.map(quote).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url; link.download = `dual-codex-day-${state.selectedUsageSourceId.replaceAll(':', '-')}.csv`; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
elements.refresh.addEventListener('click', () => {
  if (state.activeView === 'dashboard') loadDashboard(true);
  else refreshSnapshot();
});

refreshIcons();
refreshSnapshot();
setInterval(() => {
  if (!state.busy && !elements.dialog.open) refreshSnapshot(state.selectedProfileId, true);
}, 4000);
