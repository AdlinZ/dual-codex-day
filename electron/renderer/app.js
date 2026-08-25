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
  'file-input': FileInput
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
  providerPreviewRequest: 0
};

const elements = {
  version: document.querySelector('#version-label'),
  status: document.querySelector('#titlebar-status'),
  activeCount: document.querySelector('#active-instance-count'),
  refresh: document.querySelector('#refresh-button'),
  addProfile: document.querySelector('#add-profile-button'),
  profileList: document.querySelector('#profile-list'),
  profileName: document.querySelector('#selected-profile-name'),
  profilePath: document.querySelector('#selected-profile-path'),
  profileRuntime: document.querySelector('#selected-profile-runtime'),
  openProfileFolder: document.querySelector('#open-profile-folder-button'),
  workspacePath: document.querySelector('#workspace-path'),
  chooseWorkspace: document.querySelector('#choose-workspace-button'),
  providerName: document.querySelector('#provider-name'),
  providerDetail: document.querySelector('#provider-detail'),
  providerState: document.querySelector('#provider-state'),
  editProvider: document.querySelector('#edit-provider-button'),
  launchActions: document.querySelector('#launch-actions'),
  openDashboard: document.querySelector('#open-dashboard-button'),
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
    launchButtons.forEach(button => { button.disabled = true; });
    return;
  }
  elements.profileName.textContent = profile.name;
  elements.profilePath.textContent = profile.codexHome;
  const running = activeLaunches(profile.id).length;
  elements.profileRuntime.textContent = running ? `${running} 个实例运行中` : '当前未运行';
  elements.profileRuntime.classList.toggle('is-active', running > 0);
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
  elements.metricTokens.textContent = formatTokens(summary.tokens.total);
  elements.metricModel.textContent = summary.topModel?.name || '暂无模型';
  elements.metricCalls.textContent = Number(summary.calls).toLocaleString('zh-CN');
  elements.metricAverage.textContent = `平均 ${formatTokens(summary.averageTokens)}`;
  elements.metricTasks.textContent = Number(summary.tasks).toLocaleString('zh-CN');
  elements.metricCache.textContent = `${(Number(summary.cacheRate || 0) * 100).toFixed(1)}%`;
  elements.metricUpdated.textContent = usage.available ? `${formatTime(usage.updatedAt)} 更新` : '等待首次索引';
  const statusText = usage.status === 'error' ? '索引异常' : usage.available ? '本地就绪' : '等待索引';
  elements.status.querySelector('span:last-child').textContent = statusText;
  elements.status.classList.toggle('has-error', usage.status === 'error');
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
  refreshIcons();
}

async function refreshSnapshot(preferredProfileId = state.selectedProfileId, quiet = false) {
  if (!quiet) setBusy(true);
  try {
    const snapshot = await window.dualCodexDay.getSnapshot();
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

elements.profileList.addEventListener('click', event => {
  const button = event.target.closest('[data-profile-id]');
  if (!button) return;
  state.selectedProfileId = button.dataset.profileId;
  render();
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

elements.openDashboard.addEventListener('click', async () => {
  if (state.busy) return;
  setBusy(true);
  try {
    await window.dualCodexDay.openDashboard();
  } catch (error) {
    showToast(error.message || '无法打开详细仪表盘。', true);
  } finally {
    setBusy(false);
  }
});

elements.refresh.addEventListener('click', () => refreshSnapshot());

refreshIcons();
refreshSnapshot();
setInterval(() => {
  if (!state.busy && !elements.dialog.open) refreshSnapshot(state.selectedProfileId, true);
}, 4000);
