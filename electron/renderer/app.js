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
import Pencil from '../../node_modules/lucide/dist/esm/icons/pencil.mjs';
import Trash2 from '../../node_modules/lucide/dist/esm/icons/trash-2.mjs';
import LogIn from '../../node_modules/lucide/dist/esm/icons/log-in.mjs';
import Square from '../../node_modules/lucide/dist/esm/icons/square.mjs';
import ArchiveRestore from '../../node_modules/lucide/dist/esm/icons/archive-restore.mjs';
import Pin from '../../node_modules/lucide/dist/esm/icons/pin.mjs';
import { aggregateUsage, filterUsageEvents, groupUsageTasks, topUsageLabel } from './usage-analysis.mjs';

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
  'image-down': ImageDown,
  pencil: Pencil,
  'trash-2': Trash2,
  'log-in': LogIn,
  square: Square,
  'archive-restore': ArchiveRestore,
  pin: Pin
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
  skillsData: null,
  skillsLoading: false,
  skillsMode: 'standalone',
  activePlugin: null,
  usageData: null,
  usageComparison: null,
  usageRange: 'week',
  usageCustomStart: '',
  usageCustomEnd: '',
  usageModel: '',
  usageProject: '',
  usageDetailTab: 'accounts',
  usageRefreshTimer: null,
  ccSwitchAudit: null,
  ccSwitchPath: '',
  usageSettings: { relayMultiplier: 1, monthlyBudget: 0, costMode: 'standard' },
  reportPeriod: 'week',
  posterCanvas: null,
  posterFilename: '',
  posterSuccessMessage: '海报已保存。',
  pendingProfileTransferToken: null,
  profileDiagnosisToken: null,
  profileDiagnosisReport: null,
  pendingLaunchTarget: null,
  pendingLaunchAllowed: false,
  profileRecoveryToken: null,
  profileRecoveryBackups: [],
  selectedRecoveryBackupId: null,
  skillsFocus: null
};

const elements = {
  version: document.querySelector('#version-label'),
  status: document.querySelector('#titlebar-status'),
  activeCount: document.querySelector('#active-instance-count'),
  refresh: document.querySelector('#refresh-button'),
  primaryTabs: document.querySelector('.primary-tabs'),
  launcherView: document.querySelector('#launcher-view'),
  dashboardView: document.querySelector('#dashboard-view'),
  skillsView: document.querySelector('#skills-view'),
  skillsMeta: document.querySelector('#skills-meta'),
  skillsTable: document.querySelector('#skills-table'),
  skillsWorkspace: document.querySelector('#skills-workspace-button'),
  skillsRefresh: document.querySelector('#skills-refresh-button'),
  skillsRestart: document.querySelector('#skills-restart-button'),
  skillsFocus: document.querySelector('#skills-focus'),
  skillsFocusCopy: document.querySelector('#skills-focus-copy'),
  skillsFocusClear: document.querySelector('#skills-focus-clear'),
  skillsMode: document.querySelector('#skills-mode'),
  standaloneSkillCount: document.querySelector('#standalone-skill-count'),
  pluginSkillCount: document.querySelector('#plugin-skill-count'),
  availableSkillCount: document.querySelector('#available-skill-count'),
  skillToggleDialog: document.querySelector('#skill-toggle-dialog'),
  skillToggleForm: document.querySelector('#skill-toggle-form'),
  skillToggleTitle: document.querySelector('#skill-toggle-title'),
  skillToggleTarget: document.querySelector('#skill-toggle-target'),
  skillToggleEnabled: document.querySelector('#skill-toggle-enabled'),
  skillToggleCancel: document.querySelector('#skill-toggle-cancel'),
  pluginManageDialog: document.querySelector('#plugin-manage-dialog'),
  pluginManageForm: document.querySelector('#plugin-manage-form'),
  pluginManageTitle: document.querySelector('#plugin-manage-title'),
  pluginManageEnvironment: document.querySelector('#plugin-manage-environment'),
  pluginManageSkills: document.querySelector('#plugin-manage-skills'),
  pluginManageEnabled: document.querySelector('#plugin-manage-enabled'),
  pluginManageCancel: document.querySelector('#plugin-manage-cancel'),
  pluginRemove: document.querySelector('#plugin-remove-button'),
  dashboardLoading: document.querySelector('#dashboard-loading'),
  dashboardError: document.querySelector('#dashboard-error'),
  dashboardErrorMessage: document.querySelector('#dashboard-error-message'),
  dashboardRetry: document.querySelector('#dashboard-retry-button'),
  nativeUsageContent: document.querySelector('#native-usage-content'),
  usageSourceSelect: document.querySelector('#usage-source-select'),
  usageSourceMeta: document.querySelector('#usage-source-meta'),
  usageRange: document.querySelector('#usage-range'),
  usageCustomRange: document.querySelector('#usage-custom-range'),
  usageCustomStart: document.querySelector('#usage-custom-start'),
  usageCustomEnd: document.querySelector('#usage-custom-end'),
  usageCustomApply: document.querySelector('#usage-custom-apply'),
  usageModelFilter: document.querySelector('#usage-model-filter'),
  usageProjectFilter: document.querySelector('#usage-project-filter'),
  usageFilterMenu: document.querySelector('#usage-filter-menu'),
  usageFilterCount: document.querySelector('#usage-filter-count'),
  usageFilterClear: document.querySelector('#usage-filter-clear'),
  usageActionsMenu: document.querySelector('#usage-actions-menu'),
  usageDetailTabs: document.querySelector('#usage-detail-tabs'),
  usageDetailPanels: document.querySelectorAll('[data-usage-detail-panel]'),
  usageExport: document.querySelector('#usage-export-button'),
  usagePosterButton: document.querySelector('#usage-poster-button'),
  usagePosterDialog: document.querySelector('#usage-poster-dialog'),
  usagePosterPreview: document.querySelector('#usage-poster-preview'),
  usagePosterTitle: document.querySelector('#usage-poster-title'),
  usagePosterCancel: document.querySelector('#usage-poster-cancel'),
  usagePosterSave: document.querySelector('#usage-poster-save'),
  usageSettingsButton: document.querySelector('#usage-settings-button'),
  usageDiagnosticsButton: document.querySelector('#usage-diagnostics-button'),
  usageReconcileButton: document.querySelector('#usage-reconcile-button'),
  usageSettingsDialog: document.querySelector('#usage-settings-dialog'),
  usageSettingsForm: document.querySelector('#usage-settings-form'),
  usageSettingsCancel: document.querySelector('#usage-settings-cancel'),
  usageRelayMultiplier: document.querySelector('#usage-relay-multiplier'),
  usageMonthlyBudget: document.querySelector('#usage-monthly-budget'),
  usageCostMode: document.querySelector('#usage-cost-mode'),
  usageDiagnosticsDialog: document.querySelector('#usage-diagnostics-dialog'),
  usageDiagnosticsContent: document.querySelector('#usage-diagnostics-content'),
  usageDiagnosticsScope: document.querySelector('#usage-diagnostics-scope'),
  usageDiagnosticsClose: document.querySelector('#usage-diagnostics-close'),
  usageReconcileDialog: document.querySelector('#usage-reconcile-dialog'),
  usageReconcileSource: document.querySelector('#usage-reconcile-source'),
  usageReconcileSummary: document.querySelector('#usage-reconcile-summary'),
  usageReconcileBreakdown: document.querySelector('#usage-reconcile-breakdown'),
  usageReconcileChoose: document.querySelector('#usage-reconcile-choose'),
  usageReconcileClose: document.querySelector('#usage-reconcile-close'),
  usageComparison: document.querySelector('#usage-comparison'),
  taskDetailDialog: document.querySelector('#task-detail-dialog'),
  taskDetailTitle: document.querySelector('#task-detail-title'),
  taskDetailMeta: document.querySelector('#task-detail-meta'),
  taskDetailSummary: document.querySelector('#task-detail-summary'),
  taskDetailCalls: document.querySelector('#task-detail-calls'),
  taskDetailClose: document.querySelector('#task-detail-close'),
  reportPeriod: document.querySelector('#report-period'),
  reportPosterButton: document.querySelector('#report-poster-button'),
  reportTitle: document.querySelector('#period-report-title'),
  reportDates: document.querySelector('#period-report-dates'),
  reportMetrics: document.querySelector('#report-metrics'),
  reportChart: document.querySelector('#report-chart'),
  reportLeaders: document.querySelector('#report-leaders'),
  addProfile: document.querySelector('#add-profile-button'),
  profileDiagnosisButton: document.querySelector('#profile-diagnosis-button'),
  profileDiagnosisDialog: document.querySelector('#profile-diagnosis-dialog'),
  profileDiagnosisTitle: document.querySelector('#profile-diagnosis-title'),
  profileDiagnosisStatus: document.querySelector('#profile-diagnosis-status'),
  profileDiagnosisHeadline: document.querySelector('#profile-diagnosis-headline'),
  profileDiagnosisMeta: document.querySelector('#profile-diagnosis-meta'),
  profileDiagnosisGroups: document.querySelector('#profile-diagnosis-groups'),
  profileDiagnosisClose: document.querySelector('#profile-diagnosis-close'),
  profileDiagnosisRefresh: document.querySelector('#profile-diagnosis-refresh'),
  profileDiagnosisLaunch: document.querySelector('#profile-diagnosis-launch'),
  profileDiagnosisExport: document.querySelector('#profile-diagnosis-export'),
  profileRecoveryButton: document.querySelector('#profile-recovery-button'),
  profileRecoveryDialog: document.querySelector('#profile-recovery-dialog'),
  profileRecoveryTitle: document.querySelector('#profile-recovery-title'),
  profileRecoveryCount: document.querySelector('#profile-recovery-count'),
  profileRecoveryList: document.querySelector('#profile-recovery-list'),
  profileRecoveryPreview: document.querySelector('#profile-recovery-preview'),
  profileRecoveryRunning: document.querySelector('#profile-recovery-running'),
  profileRecoveryClose: document.querySelector('#profile-recovery-close'),
  profileRecoveryApply: document.querySelector('#profile-recovery-apply'),
  exportProfileTransfer: document.querySelector('#export-profile-transfer-button'),
  importProfileTransfer: document.querySelector('#import-profile-transfer-button'),
  profileTransferDialog: document.querySelector('#profile-transfer-dialog'),
  profileTransferForm: document.querySelector('#profile-transfer-form'),
  profileTransferAction: document.querySelector('#profile-transfer-action'),
  profileTransferName: document.querySelector('#profile-transfer-name'),
  profileTransferVersion: document.querySelector('#profile-transfer-version'),
  profileTransferChanges: document.querySelector('#profile-transfer-changes'),
  profileTransferMissingSkills: document.querySelector('#profile-transfer-missing-skills'),
  profileTransferMissingSkillsList: document.querySelector('#profile-transfer-missing-skills-list'),
  profileTransferMissingPlugins: document.querySelector('#profile-transfer-missing-plugins'),
  profileTransferMissingPluginsList: document.querySelector('#profile-transfer-missing-plugins-list'),
  profileTransferCredential: document.querySelector('#profile-transfer-credential'),
  profileTransferCancel: document.querySelector('#profile-transfer-cancel'),
  profileTransferApply: document.querySelector('#profile-transfer-apply'),
  profileList: document.querySelector('#profile-list'),
  profileName: document.querySelector('#selected-profile-name'),
  profilePath: document.querySelector('#selected-profile-path'),
  profileRuntime: document.querySelector('#selected-profile-runtime'),
  profileStopButton: document.querySelector('#profile-stop-button'),
  profileReadiness: document.querySelector('#profile-readiness'),
  profileReadinessTitle: document.querySelector('#profile-readiness-title'),
  profileReadinessDetail: document.querySelector('#profile-readiness-detail'),
  profileReadinessButton: document.querySelector('#profile-readiness-button'),
  openProfileFolder: document.querySelector('#open-profile-folder-button'),
  renameProfile: document.querySelector('#rename-profile-button'),
  deleteProfile: document.querySelector('#delete-profile-button'),
  renameProfileDialog: document.querySelector('#rename-profile-dialog'),
  renameProfileForm: document.querySelector('#rename-profile-form'),
  renameProfileInput: document.querySelector('#rename-profile-input'),
  renameProfileCancel: document.querySelector('#rename-profile-cancel'),
  deleteProfileDialog: document.querySelector('#delete-profile-dialog'),
  deleteProfileForm: document.querySelector('#delete-profile-form'),
  deleteProfileName: document.querySelector('#delete-profile-name'),
  deleteProfileCancel: document.querySelector('#delete-profile-cancel'),
  usageSourceButton: document.querySelector('#profile-usage-source-button'),
  usageSourceLabel: document.querySelector('#profile-usage-source-label'),
  usageSourceDialog: document.querySelector('#profile-usage-source-dialog'),
  usageSourceForm: document.querySelector('#profile-usage-source-form'),
  usageSourceCancel: document.querySelector('#profile-usage-source-cancel'),
  profileLoginStatus: document.querySelector('#profile-login-status'),
  profileRuntimeSource: document.querySelector('#profile-runtime-source'),
  profileLoginState: document.querySelector('#profile-login-state'),
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

function renderProfileTransferPreview(preview) {
  elements.profileTransferAction.textContent = preview.action === 'update' ? '更新现有 Profile' : '新建 Profile';
  elements.profileTransferName.textContent = preview.profileName;
  elements.profileTransferVersion.textContent = preview.sourceVersion ? `来源版本 v${preview.sourceVersion}` : '来源版本未记录';
  elements.profileTransferChanges.innerHTML = preview.changes.length
    ? preview.changes.map(change => `<li>${escapeHtml(change.label)}</li>`).join('')
    : '<li>配置内容没有变化</li>';
  elements.profileTransferMissingSkills.hidden = preview.missingSkills.length === 0;
  elements.profileTransferMissingSkillsList.textContent = preview.missingSkills.join('、');
  elements.profileTransferMissingPlugins.hidden = preview.missingPlugins.length === 0;
  elements.profileTransferMissingPluginsList.textContent = preview.missingPlugins.join('、');
  elements.profileTransferCredential.hidden = !preview.credentialRequired;
}

function diagnosisStatusLabel(status) {
  return { ok: '正常', warning: '需留意', error: '需处理' }[status] || '未知';
}

function renderProfileDiagnosis(report, options = {}) {
  state.profileDiagnosisReport = report;
  state.pendingLaunchTarget = options.preflightTarget || null;
  state.pendingLaunchAllowed = options.canLaunch === true;
  elements.profileDiagnosisTitle.textContent = `${report.profile.name} · 环境体检`;
  elements.profileDiagnosisStatus.textContent = diagnosisStatusLabel(report.status);
  elements.profileDiagnosisStatus.dataset.status = report.status;
  elements.profileDiagnosisHeadline.textContent = report.status === 'error'
    ? `${report.counts.error} 项需要处理`
    : report.status === 'warning' ? `${report.counts.warning} 项需要留意` : '当前环境检查正常';
  const generatedAt = new Date(report.generatedAt);
  elements.profileDiagnosisMeta.textContent = Number.isNaN(generatedAt.valueOf()) ? '' : generatedAt.toLocaleString('zh-CN', { hour12: false });
  elements.profileDiagnosisGroups.innerHTML = report.groups.map(group => `
    <section class="diagnosis-group">
      <div class="diagnosis-group-heading"><h3>${escapeHtml(group.label)}</h3><span>${escapeHtml(diagnosisStatusLabel(group.status))}</span></div>
      ${group.checks.map(item => `
        <div class="diagnosis-check${item.action ? ' has-action' : ''}" data-status="${escapeHtml(item.status)}">
          <span class="diagnosis-dot"></span>
          <strong>${escapeHtml(item.label)}</strong>
          <span class="diagnosis-check-copy">${escapeHtml(item.detail)}${item.items?.length ? `<small>${escapeHtml(item.items.join('、'))}</small>` : ''}</span>
          ${item.action ? `<button type="button" data-diagnosis-action="${escapeHtml(`${group.id}:${item.id}`)}">${escapeHtml(item.action.label)}</button>` : ''}
        </div>
      `).join('')}
    </section>
  `).join('');
  elements.profileDiagnosisLaunch.hidden = !state.pendingLaunchTarget || !state.pendingLaunchAllowed;
  if (!elements.profileDiagnosisLaunch.hidden) {
    const metadata = targetMetadata[state.pendingLaunchTarget];
    elements.profileDiagnosisLaunch.querySelector('span').textContent = `继续打开 ${metadata?.label || '客户端'}`;
  }
}

function recoveryDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? '时间未知' : date.toLocaleString('zh-CN', { hour12: false });
}

function renderProfileRecoveryList() {
  const backups = state.profileRecoveryBackups;
  elements.profileRecoveryCount.textContent = `${backups.length} 个`;
  if (!backups.length) {
    elements.profileRecoveryList.innerHTML = '<div class="recovery-list-empty">当前 Profile 暂无可恢复备份</div>';
    return;
  }
  elements.profileRecoveryList.innerHTML = backups.map(backup => `
    <button class="recovery-backup${backup.id === state.selectedRecoveryBackupId ? ' is-selected' : ''}${backup.status === 'invalid' ? ' is-invalid' : ''}" type="button" data-recovery-backup="${escapeHtml(backup.id)}" ${backup.status === 'invalid' ? 'disabled' : ''}>
      <span class="recovery-backup-status"></span>
      <span class="recovery-backup-copy"><strong>${backup.status === 'valid' ? '更新前备份' : '不可用备份'}</strong><small>${escapeHtml(recoveryDate(backup.createdAt))}</small>${backup.reason ? `<em title="${escapeHtml(backup.reason)}">${escapeHtml(backup.reason)}</em>` : ''}</span>
      <i data-lucide="chevron-right"></i>
    </button>
  `).join('');
}

function renderProfileRecoveryPreview(preview) {
  const fieldLabels = {
    name: '显示名称',
    provider: '供应商设置',
    usageSource: '用量来源',
    runtimeSource: '运行环境',
    createdAt: '创建时间',
    updatedAt: '更新时间'
  };
  const changes = preview.registryChanges.map(field => fieldLabels[field] || field);
  const configLabels = {
    replace: '替换当前 config.toml',
    create: '恢复备份中的 config.toml',
    remove: '恢复为无 config.toml 状态',
    unchanged: 'config.toml 内容相同'
  };
  elements.profileRecoveryPreview.innerHTML = `
    <div class="recovery-preview-heading"><span>可恢复</span><strong>${escapeHtml(preview.profileName)}</strong><small>${escapeHtml(recoveryDate(preview.createdAt))}</small></div>
    <div class="recovery-scope-row"><span><i data-lucide="settings-2"></i>账号设置</span><strong>${changes.length ? escapeHtml(changes.join('、')) : '内容相同'}</strong></div>
    <div class="recovery-scope-row"><span><i data-lucide="file-input"></i>config.toml</span><strong>${escapeHtml(configLabels[preview.configChange] || '状态未知')}</strong></div>
    <p class="recovery-preview-note">恢复会把这两部分还原到备份创建时的状态。完成时间：${escapeHtml(recoveryDate(preview.completedAt))}</p>
  `;
}

async function discardProfileTransfer() {
  const token = state.pendingProfileTransferToken;
  state.pendingProfileTransferToken = null;
  if (token) await window.dualCodexDay.discardProfileTransfer(token).catch(() => {});
}

async function discardProfileDiagnosis() {
  const token = state.profileDiagnosisToken;
  state.profileDiagnosisToken = null;
  if (token) await window.dualCodexDay.discardProfileDiagnosis(token).catch(() => {});
}

async function closeProfileDiagnosis() {
  await discardProfileDiagnosis();
  state.profileDiagnosisReport = null;
  state.pendingLaunchTarget = null;
  state.pendingLaunchAllowed = false;
  if (elements.profileDiagnosisDialog.open) elements.profileDiagnosisDialog.close();
}

async function discardProfileRecovery() {
  const token = state.profileRecoveryToken;
  state.profileRecoveryToken = null;
  if (token) await window.dualCodexDay.discardProfileRecovery(token).catch(() => {});
}

async function selectProfileRecovery(backupId) {
  const profile = selectedProfile();
  if (!profile || state.busy) return;
  state.selectedRecoveryBackupId = backupId;
  renderProfileRecoveryList();
  elements.profileRecoveryPreview.innerHTML = '<div class="recovery-empty"><span class="dashboard-spinner"></span><strong>正在校验备份</strong></div>';
  refreshIcons();
  setBusy(true);
  try {
    await discardProfileRecovery();
    const result = await window.dualCodexDay.previewProfileRecovery(profile.id, backupId);
    state.profileRecoveryToken = result.token;
    renderProfileRecoveryPreview(result.preview);
    refreshIcons();
  } catch (error) {
    elements.profileRecoveryPreview.innerHTML = `<div class="recovery-empty is-error"><i data-lucide="circle-alert"></i><strong>备份不可恢复</strong><span>${escapeHtml(friendlyProviderError(error))}</span></div>`;
    showToast(friendlyProviderError(error) || '无法预览 Profile 备份。', true);
    refreshIcons();
  } finally {
    setBusy(false);
    renderSelectedProfile();
  }
}

async function openProfileRecovery() {
  const profile = selectedProfile();
  if (!profile || state.busy) return;
  setBusy(true);
  try {
    await discardProfileRecovery();
    state.selectedRecoveryBackupId = null;
    state.profileRecoveryBackups = await window.dualCodexDay.listProfileRecoveryBackups(profile.id);
    elements.profileRecoveryTitle.textContent = `${profile.name} · 恢复中心`;
    elements.profileRecoveryRunning.hidden = activeLaunches(profile.id).length === 0;
    renderProfileRecoveryList();
    elements.profileRecoveryPreview.innerHTML = '<div class="recovery-empty"><i data-lucide="archive-restore"></i><strong>选择一个可用备份</strong><span>查看账号设置和 config.toml 的恢复范围。</span></div>';
    elements.profileRecoveryDialog.showModal();
    refreshIcons();
  } catch (error) {
    showToast(friendlyProviderError(error) || '无法读取 Profile 备份。', true);
  } finally {
    setBusy(false);
    renderSelectedProfile();
  }
}

async function loadProfileDiagnosis() {
  const profile = selectedProfile();
  if (!profile || state.busy) return;
  setBusy(true);
  try {
    await closeProfileDiagnosis();
    const result = await window.dualCodexDay.diagnoseProfile(profile.id);
    state.profileDiagnosisToken = result.token;
    renderProfileDiagnosis(result.report);
    if (!elements.profileDiagnosisDialog.open) elements.profileDiagnosisDialog.showModal();
    refreshIcons();
  } catch (error) {
    showToast(friendlyProviderError(error) || '无法完成 Profile 环境体检。', true);
  } finally {
    setBusy(false);
    renderSelectedProfile();
  }
}

function diagnosisAction(reference) {
  const [groupId, checkId] = String(reference || '').split(':');
  return state.profileDiagnosisReport?.groups
    .find(group => group.id === groupId)?.checks
    .find(item => item.id === checkId)?.action || null;
}

async function runDiagnosisAction(action) {
  const profile = selectedProfile();
  if (!profile || !action || state.busy) return;
  if (action.type === 'launch-login') {
    await closeProfileDiagnosis();
    return launchSelectedTarget(action.target, { skipPreflight: true });
  }
  if (action.type === 'open-provider-settings') {
    await closeProfileDiagnosis();
    openProviderEditor();
    return;
  }
  if (action.type === 'open-recovery') {
    await closeProfileDiagnosis();
    return openProfileRecovery();
  }
  if (action.type === 'open-profile-folder') {
    await closeProfileDiagnosis();
    try { await window.dualCodexDay.openProfileFolder(profile.id); }
    catch (error) { showToast(error.message || '无法打开配置目录。', true); }
    return;
  }
  if (action.type === 'open-skills') {
    state.skillsMode = action.mode || 'standalone';
    state.skillsFocus = { profileName: profile.name, items: Array.isArray(action.items) ? action.items : [] };
    await closeProfileDiagnosis();
    await switchView('skills');
    renderSkills();
    return;
  }
  if (action.type === 'open-usage-diagnostics') {
    state.selectedUsageSourceId = `profile:${profile.id}`;
    state.dashboardLoaded = false;
    await closeProfileDiagnosis();
    await switchView('dashboard');
    if (state.dashboardLoaded) elements.usageDiagnosticsButton.click();
  }
}

async function loadProfilePreflight(target) {
  const profile = selectedProfile();
  if (!profile || state.busy) return null;
  setBusy(true);
  try {
    await discardProfileDiagnosis();
    const result = await window.dualCodexDay.preflightProfile(profile.id, target);
    state.profileDiagnosisToken = result.token;
    renderProfileDiagnosis(result.report, { preflightTarget: target, canLaunch: result.canLaunch });
    if (!elements.profileDiagnosisDialog.open) elements.profileDiagnosisDialog.showModal();
    refreshIcons();
    return result;
  } catch (error) {
    showToast(error.message || '启动前检查失败。', true);
    return null;
  } finally {
    setBusy(false);
    renderSelectedProfile();
  }
}

async function launchSelectedTarget(target, options = {}) {
  const profile = selectedProfile();
  if (!profile || state.busy || !targetMetadata[target]) return;
  if (!options.skipPreflight) {
    const result = await loadProfilePreflight(target);
    if (!result || !result.canLaunch || result.needsConfirmation) {
      if (result && !result.canLaunch) showToast('当前 Profile 存在阻止启动的问题，请先完成处理。', true);
      return;
    }
    await closeProfileDiagnosis();
  }
  setBusy(true);
  renderSelectedProfile();
  try {
    const result = await window.dualCodexDay.launchProfile(profile.id, target);
    await refreshSnapshot(profile.id, true);
    showToast(result.workCombinationSaved === false
      ? `已启动 ${targetMetadata[target].label}，但最近工作未能保存。`
      : `已用“${profile.name}”启动 ${targetMetadata[target].label}。`);
  } catch (error) {
    showToast(error.message || '启动失败。', true);
  } finally {
    setBusy(false);
    renderSelectedProfile();
  }
}

async function launchWorkCombination(combinationId) {
  if (state.busy) return;
  let combination = null;
  setBusy(true);
  try {
    combination = await window.dualCodexDay.activateWorkCombination(combinationId);
    state.selectedProfileId = combination.profileId;
    await refreshSnapshot(combination.profileId, true);
  } catch (error) {
    showToast(error.message || '无法继续这项工作。', true);
  } finally {
    setBusy(false);
    render();
  }
  if (combination) launchSelectedTarget(combination.target);
}

async function toggleWorkCombinationPin(combinationId, pinned) {
  if (state.busy) return;
  setBusy(true);
  try {
    await window.dualCodexDay.setWorkCombinationPinned(combinationId, pinned);
    await refreshSnapshot(state.selectedProfileId, true);
    showToast(pinned ? '工作组合已固定。' : '已取消固定。');
  } catch (error) {
    showToast(error.message || '无法更新固定状态。', true);
  } finally {
    setBusy(false);
    render();
  }
}

async function repairWorkCombination(combinationId) {
  if (state.busy) return;
  setBusy(true);
  try {
    const updated = await window.dualCodexDay.repairWorkCombinationWorkspace(combinationId);
    if (!updated) return;
    await refreshSnapshot(state.selectedProfileId, true);
    showToast('工作目录已更新。');
  } catch (error) {
    showToast(error.message || '无法更新工作目录。', true);
  } finally {
    setBusy(false);
    render();
  }
}

async function removeSavedWork(combinationId) {
  const item = state.snapshot?.workCombinations?.items.find(candidate => candidate.id === combinationId);
  if (!item || state.busy || !confirm(`从最近工作中移除“${item.workspaceName}”？`)) return;
  setBusy(true);
  try {
    await window.dualCodexDay.removeWorkCombination(combinationId);
    await refreshSnapshot(state.selectedProfileId, true);
    showToast('工作组合已移除。');
  } catch (error) {
    showToast(error.message || '无法移除工作组合。', true);
  } finally {
    setBusy(false);
    render();
  }
}

function setBusy(value) {
  state.busy = value;
  document.body.classList.toggle('is-busy', value);
  elements.refresh.disabled = value;
  elements.addProfile.disabled = value;
  elements.importProfileTransfer.disabled = value;
  elements.exportProfileTransfer.disabled = value || !selectedProfile();
  elements.profileDiagnosisButton.disabled = value || !selectedProfile();
  elements.profileRecoveryButton.disabled = value || !selectedProfile();
  elements.profileRecoveryApply.disabled = value || !state.profileRecoveryToken || activeLaunches(state.selectedProfileId).length > 0;
  elements.profileTransferApply.disabled = value;
  elements.profileDiagnosisRefresh.disabled = value;
  elements.profileDiagnosisLaunch.disabled = value;
  elements.profileDiagnosisExport.disabled = value || !state.profileDiagnosisToken;
  elements.profileReadinessButton.disabled = value || !selectedProfile();
  elements.profileStopButton.disabled = value || activeLaunches(state.selectedProfileId).length === 0;
  elements.saveProvider.disabled = value;
  elements.importProviderConfig.disabled = value;
  elements.renameProfile.disabled = value || !selectedProfile();
  elements.deleteProfile.disabled = value || !selectedProfile();
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
        <span>${activeLaunches(profile.id).length ? `${activeLaunches(profile.id).length} 个实例运行中` : profile.runtimeSource === 'default' ? '当前默认 Codex' : escapeHtml(profile.provider?.name || 'OpenAI 官方')}</span>
        <small class="profile-readiness-label" data-state="${escapeHtml(profile.readiness?.state || 'attention')}">${profile.readiness?.state === 'ready' ? '就绪' : profile.readiness?.state === 'blocked' ? '不可启动' : '需留意'}${profile.readiness?.issueCount ? ` · ${profile.readiness.issueCount} 项` : ''}</small>
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
    elements.profileStopButton.hidden = true;
    elements.providerName.textContent = '未选择 Profile';
    elements.providerDetail.textContent = '请选择账号配置';
    elements.providerState.textContent = '未配置';
    elements.providerState.classList.remove('is-ready', 'is-error');
    elements.editProvider.disabled = true;
    elements.openProfileFolder.disabled = true;
    elements.renameProfile.disabled = true;
    elements.deleteProfile.disabled = true;
    elements.exportProfileTransfer.disabled = true;
    elements.profileDiagnosisButton.disabled = true;
    elements.profileRecoveryButton.disabled = true;
    elements.profileReadiness.dataset.state = 'unknown';
    elements.profileReadinessTitle.textContent = '等待选择 Profile';
    elements.profileReadinessDetail.textContent = '选择账号后检查配置、认证和本机入口';
    elements.profileReadinessButton.textContent = '查看体检';
    elements.profileReadinessButton.disabled = true;
    elements.usageSourceButton.disabled = true;
    elements.profileLoginStatus.textContent = '未选择账号';
    elements.profileRuntimeSource.textContent = '请选择一个账号配置';
    elements.profileLoginState.textContent = '未选择';
    elements.profileLoginState.classList.remove('is-ready', 'is-error');
    launchButtons.forEach(button => { button.disabled = true; });
    return;
  }
  elements.profileName.textContent = profile.name;
  elements.profilePath.textContent = profile.runtimeRoot || profile.codexHome;
  const running = activeLaunches(profile.id).length;
  if (elements.profileRecoveryDialog.open) elements.profileRecoveryRunning.hidden = running === 0;
  elements.profileRuntime.textContent = running ? `${running} 个实例运行中` : '当前未运行';
  elements.profileRuntime.classList.toggle('is-active', running > 0);
  elements.profileStopButton.hidden = running === 0;
  elements.profileStopButton.disabled = state.busy;
  elements.profileStopButton.querySelector('span').textContent = '关闭客户端';
  elements.profileStopButton.querySelector('small').textContent = `${running} 个实例`;
  const sameSource = profile.runtimeSource === profile.usageSource;
  elements.usageSourceLabel.textContent = sameSource
    ? profile.runtimeSource === 'default' ? '默认账号' : '独立账号'
    : '混合来源';
  elements.usageSourceButton.disabled = state.busy;
  elements.renameProfile.disabled = state.busy;
  elements.deleteProfile.disabled = state.busy;
  elements.exportProfileTransfer.disabled = state.busy;
  elements.profileDiagnosisButton.disabled = state.busy;
  elements.profileRecoveryButton.disabled = state.busy;
  const readiness = profile.readiness || { state: 'attention', issueCount: 1, blockingCount: 0, actionCount: 0 };
  elements.profileReadiness.dataset.state = readiness.state;
  elements.profileReadinessTitle.textContent = readiness.state === 'ready'
    ? '当前环境已就绪'
    : readiness.state === 'blocked'
      ? `${readiness.blockingCount} 项问题阻止启动`
      : `${readiness.issueCount} 项状态需要确认`;
  elements.profileReadinessDetail.textContent = readiness.state === 'ready'
    ? '配置、认证、客户端和本地组件检查正常'
    : readiness.state === 'blocked'
      ? '打开体检并完成处理后再启动客户端'
      : '启动前会展示影响范围和对应处理入口';
  elements.profileReadinessButton.textContent = readiness.state === 'ready' ? '查看体检' : '处理问题';
  elements.profileReadinessButton.disabled = state.busy;
  const provider = profile.provider || { type: 'official', name: 'OpenAI 官方' };
  const providerReady = provider.type === 'official'
    || provider.authMode !== 'environment'
    || profile.hasProviderCredential;
  elements.providerName.textContent = profile.runtimeSource === 'default' ? '当前默认 Codex' : provider.name;
  elements.providerDetail.textContent = profile.runtimeSource === 'default'
    ? '沿用系统账号配置'
    : provider.type === 'custom'
    ? provider.note || `${provider.model} · ${provider.baseUrl}`
    : 'ChatGPT 官方登录';
  elements.providerState.textContent = profile.runtimeSource === 'default'
    ? '系统配置'
    : provider.type === 'custom'
    ? provider.authMode === 'environment'
      ? profile.hasProviderCredential ? '密钥已保存' : '缺少密钥'
      : provider.authMode === 'openai' ? 'Codex 登录' : '无需认证'
    : '官方认证';
  elements.providerState.classList.toggle('is-ready', providerReady);
  elements.providerState.classList.toggle('is-error', !providerReady);
  elements.editProvider.disabled = state.busy || profile.runtimeSource === 'default';
  elements.openProfileFolder.disabled = state.busy;
  const login = profile.loginStatus || { state: 'unknown', method: 'unknown' };
  const loginLabels = {
    chatgpt: 'ChatGPT 已登录',
    'api-key': 'API Key 已登录',
    'provider-key': profile.hasProviderCredential ? '中转密钥已就绪' : '缺少中转密钥',
    none: login.state === 'signed-out' ? '尚未登录' : '无需登录',
    unknown: '状态未知'
  };
  elements.profileLoginStatus.textContent = loginLabels[login.method] || '状态未知';
  elements.profileRuntimeSource.textContent = profile.runtimeSource === 'default' ? '系统默认运行环境' : '独立运行环境';
  elements.profileLoginState.textContent = login.state === 'authenticated' || login.state === 'ready'
    ? '已就绪'
    : login.state === 'signed-out' ? '未登录' : login.state === 'missing' ? '缺少配置' : '未知';
  elements.profileLoginState.classList.toggle('is-ready', login.state === 'authenticated' || login.state === 'ready');
  elements.profileLoginState.classList.toggle('is-error', login.state === 'signed-out' || login.state === 'missing');
  launchButtons.forEach(button => {
    const target = button.dataset.target;
    button.disabled = state.busy || !state.snapshot.targets[target]?.available;
  });
  const desktopButton = elements.launchActions.querySelector('[data-target="desktop"]');
  desktopButton.querySelector('span').textContent = login.state === 'signed-out' ? '打开 Codex 并登录' : profile.runtimeSource === 'default' ? '打开默认 Codex' : '打开独立 Codex';
  desktopButton.querySelector('small').textContent = profile.runtimeSource === 'default' ? '现有账号' : '多开';
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
  elements.metricAverage.textContent = `${Number(summary.turns || 0).toLocaleString('zh-CN')} 回合 · 平均 ${formatTokens(summary.averageTokens)}`;
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
  const profile = selectedProfile();
  const isolated = profile?.runtimeSource !== 'default';
  elements.targetList.innerHTML = Object.entries(targetMetadata).map(([key, metadata]) => {
    const target = state.snapshot.targets[key] || { available: false };
    const detail = isolated ? metadata.detail : key === 'desktop' ? '当前默认客户端数据' : key === 'vscode' ? '当前 VS Code 用户数据' : '系统 CODEX_HOME';
    return `
      <div class="target-row">
        <span class="target-icon"><i data-lucide="${metadata.icon}"></i></span>
        <span class="target-copy">
          <strong>${metadata.label}</strong>
          <span>${detail}</span>
        </span>
        <span class="availability${target.available ? '' : ' is-missing'}">${target.available ? '可用' : '未找到'}</span>
      </div>
    `;
  }).join('');
}

function renderRecent() {
  const recent = state.snapshot.recentLaunches;
  const work = state.snapshot.workCombinations || { items: [], error: null };
  const combinationRows = work.error
    ? `<div class="list-empty is-error">${escapeHtml(work.error)}</div>`
    : work.items.length
      ? work.items.map(item => {
          const metadata = targetMetadata[item.target] || targetMetadata.cli;
          const primaryLabel = item.isLast ? '继续上次工作' : item.workspaceName;
          const detail = item.isLast
            ? `${item.workspaceName} · ${item.profileName} · ${metadata.label}`
            : `${item.profileName} · ${metadata.label}`;
          const stateLabel = item.unavailableReason === 'profile-missing'
            ? '账号已删除'
            : item.unavailableReason === 'workspace-missing'
              ? '重选目录'
              : item.unavailableReason === 'target-missing'
                ? '入口不可用'
                : item.pinned ? '已固定' : item.isLast ? '上次' : formatTime(item.lastUsedAt);
          return `
            <div class="work-combination-row${item.available ? '' : ' is-unavailable'}">
              <button class="work-combination-main" type="button" data-work-launch="${escapeHtml(item.id)}" title="${escapeHtml(item.workspace)}" ${item.available ? '' : 'disabled'}>
                <span class="recent-icon"><i data-lucide="${metadata.icon}"></i></span>
                <span class="recent-copy"><strong>${escapeHtml(primaryLabel)}</strong><span>${escapeHtml(detail)}</span><small>${escapeHtml(item.workspace)}</small></span>
              </button>
              ${item.unavailableReason === 'workspace-missing'
                ? `<button class="work-state-button" type="button" data-work-repair="${escapeHtml(item.id)}">${stateLabel}</button>`
                : `<span class="work-combination-state${item.available ? '' : ' is-error'}">${escapeHtml(stateLabel)}</span>`}
              <button class="icon-button work-pin-button${item.pinned ? ' is-active' : ''}" type="button" data-work-pin="${escapeHtml(item.id)}" data-pinned="${item.pinned}" title="${item.pinned ? '取消固定' : '固定工作组合'}" aria-label="${item.pinned ? '取消固定' : '固定工作组合'}"><i data-lucide="pin"></i></button>
              <button class="icon-button work-remove-button" type="button" data-work-remove="${escapeHtml(item.id)}" title="移除工作组合" aria-label="移除工作组合"><i data-lucide="trash-2"></i></button>
            </div>
          `;
        }).join('')
      : '<div class="list-empty">成功启动后会在这里保留最近工作</div>';
  const active = recent.filter(item => item.active);
  const activeRows = active.map(item => {
    const metadata = targetMetadata[item.target] || targetMetadata.cli;
    return `
      <div class="recent-row${item.active ? ' has-action' : ''}">
        <span class="recent-icon"><i data-lucide="${metadata.icon}"></i></span>
        <span class="recent-copy">
          <strong>${escapeHtml(item.profileName)}</strong>
          <span>${metadata.label} · ${item.runtimeSource === 'default' ? '默认账号' : '独立账号'}</span>
        </span>
        <span class="launch-state${item.active ? ' is-active' : ''}">${item.active ? '运行中' : formatTime(item.launchedAt)}</span>
        ${item.active ? `<button class="icon-button stop-instance-button" type="button" data-stop-launch="${escapeHtml(item.id)}" title="关闭实例" aria-label="关闭 ${escapeHtml(item.profileName)} 的 ${metadata.label}"><i data-lucide="square"></i></button>` : ''}
      </div>
    `;
  }).join('');
  elements.recentList.innerHTML = `
    ${combinationRows}
    ${activeRows ? `<div class="recent-group-label has-spacing">运行实例</div>${activeRows}` : ''}
  `;
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
  elements.reportPosterButton.disabled = state.dashboardLoading || !state.dashboardLoaded;
  if (state.snapshot) renderUsage();
}

function usageSettingsKey(sourceId = state.selectedUsageSourceId) {
  return `dual-codex-native-usage:${sourceId}`;
}

function readUsageSettings(sourceId = state.selectedUsageSourceId) {
  try {
    const saved = JSON.parse(localStorage.getItem(usageSettingsKey(sourceId)) || '{}');
    return {
      relayMultiplier: Math.max(0, Number(saved.relayMultiplier ?? 1)),
      monthlyBudget: Math.max(0, Number(saved.monthlyBudget || 0)),
      costMode: ['standard', 'batch', 'flex', 'fast'].includes(saved.costMode) ? saved.costMode : 'standard'
    };
  } catch {
    return { relayMultiplier: 1, monthlyBudget: 0, costMode: 'standard' };
  }
}

function loadUsageSettings() {
  state.usageSettings = readUsageSettings();
}

function usageEvents() {
  return filterUsageEvents(state.usageData?.events, {
    range: state.usageRange,
    customStart: state.usageCustomStart,
    customEnd: state.usageCustomEnd,
    model: state.usageModel,
    projectId: state.usageProject
  });
}

function usageRangeLabel() {
  if (state.usageRange === 'custom' && state.usageCustomStart && state.usageCustomEnd) {
    return `${state.usageCustomStart} 至 ${state.usageCustomEnd}`;
  }
  return { today: '今天', week: '本周', '30d': '近 30 天', '90d': '近 90 天', all: '全部记录' }[state.usageRange] || '当前范围';
}

function aggregateAuditRows(rows) {
  return rows.reduce((result, row) => ({
    calls: result.calls + Number(row.calls || 0),
    input: result.input + Number(row.input || 0),
    cachedInput: result.cachedInput + Number(row.cachedInput || 0),
    output: result.output + Number(row.output || 0),
    total: result.total + Number(row.total || 0)
  }), { calls: 0, input: 0, cachedInput: 0, output: 0, total: 0 });
}

function auditDateRange() {
  const events = usageEvents();
  if (state.usageRange === 'all') return null;
  if (state.usageRange === 'custom') return { start: state.usageCustomStart, end: state.usageCustomEnd };
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (state.usageRange === 'week') start.setDate(start.getDate() - ((start.getDay() || 7) - 1));
  if (state.usageRange === '30d') start.setDate(start.getDate() - 29);
  if (state.usageRange === '90d') start.setDate(start.getDate() - 89);
  return { start: start.toLocaleDateString('en-CA'), end: now.toLocaleDateString('en-CA') };
}

function renderReconcile() {
  const audit = state.ccSwitchAudit;
  if (!audit) return;
  const range = auditDateRange();
  const ccRows = range ? audit.daily.filter(row => row.label >= range.start && row.label <= range.end) : audit.daily;
  const cc = aggregateAuditRows(ccRows);
  const dcd = usageAggregate(usageEvents());
  const deltaTokens = cc.total - dcd.total;
  const deltaCalls = cc.calls - dcd.calls;
  const signed = value => `${value >= 0 ? '+' : ''}${formatTokens(value)}`;
  elements.usageReconcileSource.textContent = `${audit.databaseName} · app_type=codex · 仅读取，不会修改原文件`;
  elements.usageReconcileSummary.innerHTML = [
    ['DCD Token', formatTokens(dcd.total), '当前筛选范围'],
    ['CC Switch Token', formatTokens(cc.total), 'input + output'],
    ['Token 差额', signed(deltaTokens), deltaTokens === 0 ? '一致' : 'CC Switch - DCD'],
    ['调用差额', `${deltaCalls >= 0 ? '+' : ''}${deltaCalls.toLocaleString('zh-CN')}`, 'CC Switch - DCD']
  ].map(([label, value, note]) => `<div><span>${label}</span><strong>${escapeHtml(value)}</strong><small>${note}</small></div>`).join('');
  const dcdModels = new Map();
  for (const event of usageEvents()) {
    const current = dcdModels.get(event.model) || { label: event.model, calls: 0, total: 0 };
    current.calls += 1; current.total += Number(event.total || 0); dcdModels.set(event.model, current);
  }
  const ccModelRows = range ? audit.dailyModels.filter(row => row.date >= range.start && row.date <= range.end) : audit.models;
  const ccModels = new Map();
  for (const row of ccModelRows) {
    const current = ccModels.get(row.label) || { label: row.label, calls: 0, total: 0 };
    current.calls += Number(row.calls || 0); current.total += Number(row.total || 0); ccModels.set(row.label, current);
  }
  const modelNames = [...new Set([...dcdModels.keys(), ...ccModels.keys()])].sort((left, right) => left.localeCompare(right)).slice(0, 8);
  elements.usageReconcileBreakdown.innerHTML = `<div class="reconcile-note">${range ? `当前对账范围：${usageRangeLabel()}` : '当前对账范围：全部记录'}。缓存输入单独展示，不重复加到总 Token。</div><div class="reconcile-table"><div class="reconcile-row header"><span>模型</span><span>DCD</span><span>CC Switch</span><span>差额</span></div>${modelNames.map(name => {
    const left = dcdModels.get(name)?.total || 0;
    const value = ccModels.get(name)?.total || 0;
    return `<div class="reconcile-row"><strong>${escapeHtml(name)}</strong><span>${formatTokens(left)}</span><span>${formatTokens(value)}</span><span>${signed(value - left)}</span></div>`;
  }).join('')}</div>`;
}

async function openReconcile() {
  if (!elements.usageReconcileDialog.open) elements.usageReconcileDialog.showModal();
  elements.usageReconcileSummary.innerHTML = '<div class="reconcile-loading">正在读取 CC Switch 数据库...</div>';
  elements.usageReconcileBreakdown.innerHTML = '';
  try {
    const savedPath = state.ccSwitchPath || localStorage.getItem('dual-codex-cc-switch-db') || '';
    state.ccSwitchAudit = await window.dualCodexDay.getCcSwitchAudit(savedPath || null);
    if (savedPath) state.ccSwitchPath = savedPath;
    renderReconcile();
  } catch (error) {
    elements.usageReconcileSummary.innerHTML = `<div class="reconcile-loading">${escapeHtml(error.message || '无法读取 CC Switch 数据库。')}</div>`;
    elements.usageReconcileBreakdown.innerHTML = '<div class="reconcile-note">请确认选择的是 CC Switch 的 SQLite 数据库文件。</div>';
  }
}

function resolvePriceModel(model, usageData = state.usageData) {
  const pricing = usageData?.pricing || {};
  if (pricing.models?.[model]) return model;
  if (pricing.aliases?.[model] && pricing.models?.[pricing.aliases[model]]) return pricing.aliases[model];
  return Object.keys(pricing.models || {}).find(key => model.startsWith(key)) || '';
}

function estimateUsageEvent(event, usageData = state.usageData, settings = state.usageSettings) {
  const pricing = usageData?.pricing || {};
  const modelId = resolvePriceModel(event.model, usageData);
  const rates = pricing.models?.[modelId];
  const mode = pricing.modes?.[settings.costMode] || pricing.modes?.standard || { multiplier: 1 };
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
  const multiplier = Number(mode.multiplier || 1) * settings.relayMultiplier;
  const unit = Number(pricing.unitTokens || 1_000_000);
  const parts = {
    input: regular / unit * Number(rates.input || 0) * inputMultiplier * multiplier,
    cached: cached / unit * Number(rates.cachedInput ?? rates.input ?? 0) * inputMultiplier * multiplier,
    output: output / unit * Number(rates.output || 0) * outputMultiplier * multiplier
  };
  return { priced: true, total: parts.input + parts.cached + parts.output, parts };
}

function usageAggregate(events) {
  return aggregateUsage(events, event => estimateUsageEvent(event));
}

function filteredUsageEvents() {
  return (state.usageData?.events || []).filter(event => (!state.usageModel || event.model === state.usageModel)
    && (!state.usageProject || event.projectId === state.usageProject));
}

function reportBounds(period = state.reportPeriod, now = new Date()) {
  const currentStart = new Date(now.getFullYear(), now.getMonth(), period === 'month' ? 1 : now.getDate());
  if (period === 'week') currentStart.setDate(currentStart.getDate() - ((currentStart.getDay() || 7) - 1));
  const previousStart = period === 'month'
    ? new Date(currentStart.getFullYear(), currentStart.getMonth() - 1, 1)
    : new Date(currentStart.getFullYear(), currentStart.getMonth(), currentStart.getDate() - 7);
  const previousPeriodEnd = period === 'month'
    ? new Date(currentStart.getFullYear(), currentStart.getMonth(), 1)
    : new Date(previousStart.getFullYear(), previousStart.getMonth(), previousStart.getDate() + 7);
  const elapsed = now.getTime() - currentStart.getTime();
  const previousEnd = new Date(Math.min(previousPeriodEnd.getTime(), previousStart.getTime() + elapsed + 1));
  return { currentStart, currentEnd: new Date(now.getTime() + 1), previousStart, previousEnd };
}

function reportData() {
  const bounds = reportBounds();
  const events = filteredUsageEvents();
  const currentEvents = events.filter(event => {
    const time = new Date(event.timestamp);
    return time >= bounds.currentStart && time < bounds.currentEnd;
  });
  const previousEvents = events.filter(event => {
    const time = new Date(event.timestamp);
    return time >= bounds.previousStart && time < bounds.previousEnd;
  });
  const current = usageAggregate(currentEvents);
  const previous = usageAggregate(previousEvents);
  const days = [];
  const dayCursor = new Date(bounds.currentStart);
  const today = new Date(bounds.currentEnd.getFullYear(), bounds.currentEnd.getMonth(), bounds.currentEnd.getDate());
  while (dayCursor <= today) {
    const next = new Date(dayCursor.getFullYear(), dayCursor.getMonth(), dayCursor.getDate() + 1);
    const dayEvents = currentEvents.filter(event => {
      const time = new Date(event.timestamp);
      return time >= dayCursor && time < next;
    });
    days.push({ date: new Date(dayCursor), ...usageAggregate(dayEvents) });
    dayCursor.setDate(dayCursor.getDate() + 1);
  }
  return {
    bounds,
    currentEvents,
    previousEvents,
    current,
    previous,
    days,
    projects: posterGroups(currentEvents, 'projectId', 'project'),
    models: posterGroups(currentEvents, 'model'),
    peakDay: [...days].sort((a, b) => b.total - a.total)[0] || null
  };
}

function reportDelta(current, previous) {
  if (!previous) return current ? { text: '上期无数据', className: 'is-up' } : { text: '暂无变化', className: '' };
  const value = (current - previous) / previous * 100;
  return { text: `${value >= 0 ? '+' : ''}${value.toFixed(1)}% 较上期`, className: value > 0 ? 'is-up' : value < 0 ? 'is-down' : '' };
}

function reportDate(value) {
  return new Intl.DateTimeFormat('zh-CN', { month: 'short', day: 'numeric' }).format(value);
}

function renderPeriodReport() {
  const report = reportData();
  const periodLabel = state.reportPeriod === 'month' ? '本月报告' : '本周报告';
  elements.reportTitle.textContent = periodLabel;
  elements.reportDates.textContent = `${reportDate(report.bounds.currentStart)} - ${reportDate(new Date(report.bounds.currentEnd.getTime() - 1))}`;
  const metrics = [
    ['Token', formatTokens(report.current.total), reportDelta(report.current.total, report.previous.total)],
    ['交互回合', report.current.turns.toLocaleString('zh-CN'), reportDelta(report.current.turns, report.previous.turns)],
    ['模型调用', report.current.calls.toLocaleString('zh-CN'), reportDelta(report.current.calls, report.previous.calls)],
    ['任务', report.current.tasks.toLocaleString('zh-CN'), reportDelta(report.current.tasks, report.previous.tasks)]
  ];
  elements.reportMetrics.innerHTML = metrics.map(([label, value, delta]) => `<div class="report-metric"><span>${label}</span><strong>${value}</strong><small class="${delta.className}">${delta.text}</small></div>`).join('');
  const max = Math.max(1, ...report.days.map(day => day.total));
  const labelStep = Math.max(1, Math.ceil(report.days.length / 10));
  const chartWidth = 900, chartHeight = 230, chartTop = 10, chartBottom = 34, slot = chartWidth / Math.max(1, report.days.length);
  const chartBodyHeight = chartHeight - chartTop - chartBottom;
  elements.reportChart.innerHTML = `<svg viewBox="0 0 ${chartWidth} ${chartHeight}" preserveAspectRatio="none" aria-label="报告每日 Token">
    <line class="report-grid-line" x1="0" x2="${chartWidth}" y1="${chartTop + chartBodyHeight}" y2="${chartTop + chartBodyHeight}"></line>
    ${report.days.map((day, index) => {
      const barWidth = Math.max(5, Math.min(28, slot * .58));
      const height = day.total ? Math.max(4, chartBodyHeight * day.total / max) : 2;
      const x = index * slot + (slot - barWidth) / 2;
      const label = index % labelStep === 0 || index === report.days.length - 1 ? `${day.date.getMonth() + 1}/${day.date.getDate()}` : '';
      return `<rect class="report-bar" x="${x}" y="${chartTop + chartBodyHeight - height}" width="${barWidth}" height="${height}" rx="3"><title>${reportDate(day.date)} · ${formatTokens(day.total)}</title></rect><text class="report-chart-label" x="${x + barWidth / 2}" y="${chartHeight - 8}" text-anchor="middle">${label}</text>`;
    }).join('')}
  </svg>`;
  const leaders = [
    ['峰值日期', report.peakDay?.total ? reportDate(report.peakDay.date) : '暂无数据', report.peakDay?.total ? formatTokens(report.peakDay.total) : '0'],
    ['主要项目', report.projects[0]?.label || '暂无数据', report.projects[0] ? formatTokens(report.projects[0].total) : '0'],
    ['主要模型', report.models[0]?.label || '暂无数据', report.models[0] ? formatTokens(report.models[0].total) : '0'],
    ['预计成本', formatUsd(report.current.cost), `${(report.current.coverage * 100).toFixed(0)}% 已定价`]
  ];
  elements.reportLeaders.innerHTML = leaders.map(([label, value, detail]) => `<div class="report-leader"><span>${label}</span><strong>${escapeHtml(value)}</strong><b>${escapeHtml(detail)}</b></div>`).join('');
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
  const rangeLabel = usageRangeLabel();
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
  context.fillText(`${aggregate.turns.toLocaleString('zh-CN')} 回合  ·  ${aggregate.calls.toLocaleString('zh-CN')} 次模型调用  ·  输入 ${formatTokens(aggregate.input)}  ·  输出 ${formatTokens(aggregate.output)}`, 72, 476);

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
  context.fillText(state.usageRange === 'today' ? '今天的 Token 节奏' : 'Token 使用节奏', 86, 750);
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

function createPeriodReportPoster() {
  const report = reportData();
  const periodLabel = state.reportPeriod === 'month' ? '月报' : '周报';
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 1600;
  const context = canvas.getContext('2d');
  const colors = { bg: '#f3f5f2', panel: '#ffffff', ink: '#111815', muted: '#68736d', line: '#dce2dd', green: '#087f5b', blue: '#2563a9', coral: '#c65d18', violet: '#6950a1', lime: '#b7df4b' };
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
  context.fillText(state.usageData?.source?.name || '全部账号', 1128, 88);
  context.textAlign = 'left';

  posterRoundedRect(context, 72, 145, 128, 46, 23, colors.ink);
  context.fillStyle = colors.panel;
  context.font = `650 18px ${font}`;
  context.textAlign = 'center';
  context.fillText(periodLabel, 136, 175);
  context.textAlign = 'left';
  context.fillStyle = colors.muted;
  context.font = `500 18px ${font}`;
  context.fillText(`${reportDate(report.bounds.currentStart)} - ${reportDate(new Date(report.bounds.currentEnd.getTime() - 1))}`, 224, 176);

  context.fillStyle = colors.ink;
  context.font = `700 49px ${font}`;
  context.fillText(`${periodLabel}工作节奏`, 72, 294);
  context.fillStyle = colors.green;
  context.font = `760 108px ${font}`;
  context.fillText(formatTokens(report.current.total), 68, 430);
  const totalDelta = reportDelta(report.current.total, report.previous.total);
  context.fillStyle = colors.muted;
  context.font = `500 21px ${font}`;
  context.fillText(`${totalDelta.text}  ·  ${report.current.turns.toLocaleString('zh-CN')} 回合  ·  ${report.current.calls.toLocaleString('zh-CN')} 次模型调用`, 72, 478);

  const metricValues = [
    ['任务', report.current.tasks.toLocaleString('zh-CN'), `${report.current.projects} 个项目`, colors.blue],
    ['缓存率', `${(report.current.cacheRate * 100).toFixed(1)}%`, `${formatTokens(report.current.cached)} cached`, colors.green],
    ['预计成本', formatUsd(report.current.cost), `${(report.current.coverage * 100).toFixed(0)}% 已定价`, colors.coral],
    ['每次模型调用', formatTokens(report.current.average), '平均 Token', colors.violet]
  ];
  metricValues.forEach((item, index) => {
    const x = 72 + index * 264;
    posterRoundedRect(context, x, 548, 240, 154, 12, colors.panel);
    context.fillStyle = item[3];
    context.fillRect(x + 20, 570, 31, 5);
    context.fillStyle = colors.muted;
    context.font = `400 15px ${font}`;
    context.fillText(item[0], x + 20, 611);
    context.fillStyle = colors.ink;
    context.font = `700 30px ${font}`;
    context.fillText(posterEllipsis(context, item[1], 195), x + 20, 653);
    context.fillStyle = colors.muted;
    context.font = `400 14px ${font}`;
    context.fillText(item[2], x + 20, 681);
  });

  context.fillStyle = colors.ink;
  context.font = `700 25px ${font}`;
  context.fillText(`${periodLabel}每日 Token`, 72, 790);
  const chart = { x: 82, y: 838, w: 1036, h: 300 };
  const max = Math.max(1, ...report.days.map(day => day.total));
  const slot = chart.w / Math.max(1, report.days.length);
  const labelStep = Math.max(1, Math.ceil(report.days.length / 10));
  report.days.forEach((day, index) => {
    const barWidth = Math.max(5, Math.min(46, slot * 0.62));
    const height = chart.h * day.total / max;
    const x = chart.x + index * slot + (slot - barWidth) / 2;
    if (height > 0) posterRoundedRect(context, x, chart.y + chart.h - height, barWidth, Math.max(3, height), 4, colors.blue);
    if (index % labelStep === 0 || index === report.days.length - 1) {
      context.fillStyle = colors.muted;
      context.font = `400 13px ${font}`;
      context.textAlign = 'center';
      context.fillText(`${day.date.getMonth() + 1}/${day.date.getDate()}`, x + barWidth / 2, chart.y + chart.h + 28);
    }
  });
  context.textAlign = 'left';

  context.fillStyle = colors.ink;
  context.font = `700 24px ${font}`;
  context.fillText('本期重点', 72, 1242);
  const leaders = [
    ['峰值日期', report.peakDay?.total ? reportDate(report.peakDay.date) : '暂无数据', report.peakDay?.total ? formatTokens(report.peakDay.total) : '0'],
    ['主要项目', report.projects[0]?.label || '暂无数据', report.projects[0] ? formatTokens(report.projects[0].total) : '0'],
    ['主要模型', report.models[0]?.label || '暂无数据', report.models[0] ? formatTokens(report.models[0].total) : '0']
  ];
  leaders.forEach((item, index) => {
    const x = 72 + index * 352;
    posterRoundedRect(context, x, 1280, 320, 150, 12, colors.panel);
    context.fillStyle = colors.muted;
    context.font = `400 15px ${font}`;
    context.fillText(item[0], x + 20, 1314);
    context.fillStyle = colors.ink;
    context.font = index === 2 ? `650 21px ${mono}` : `650 23px ${font}`;
    context.fillText(posterEllipsis(context, item[1], 270), x + 20, 1358);
    context.fillStyle = colors.muted;
    context.font = `400 14px ${font}`;
    context.fillText(item[2], x + 20, 1391);
  });

  context.fillStyle = colors.muted;
  context.font = `400 14px ${font}`;
  context.fillText('数据来自本地 Codex 日志 · API 标价估算，非实际账单', 72, 1546);
  context.textAlign = 'right';
  context.fillText(`${periodLabel.toLowerCase()} · Dual Codex Day`, 1128, 1546);
  context.textAlign = 'left';
  return canvas;
}

function openUsagePoster() {
  if (!state.dashboardLoaded) return;
  state.posterCanvas = createUsagePoster();
  state.posterFilename = `dual-codex-day-${(state.usageData?.source?.name || 'all').replace(/[^a-z0-9\u4e00-\u9fff-]/gi, '-')}-${state.usageRange}-${new Date().toISOString().slice(0, 10)}.png`;
  state.posterSuccessMessage = '用量海报已保存。';
  elements.usagePosterTitle.textContent = '用量海报';
  elements.usagePosterPreview.src = state.posterCanvas.toDataURL('image/png');
  elements.usagePosterDialog.showModal();
}

function openReportPoster() {
  if (!state.dashboardLoaded) return;
  state.posterCanvas = createPeriodReportPoster();
  state.posterFilename = `dual-codex-day-${state.reportPeriod}-report-${new Date().toISOString().slice(0, 10)}.png`;
  state.posterSuccessMessage = `${state.reportPeriod === 'month' ? '月报' : '周报'}海报已保存。`;
  elements.usagePosterTitle.textContent = state.reportPeriod === 'month' ? '月报海报' : '周报海报';
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
    link.href = url;
    link.download = state.posterFilename || `dual-codex-day-poster-${new Date().toISOString().slice(0, 10)}.png`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    elements.usagePosterSave.disabled = false;
    elements.usagePosterDialog.close();
    showToast(state.posterSuccessMessage);
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

function comparisonEvents(dataset) {
  return filterUsageEvents(dataset?.events, {
    range: state.usageRange,
    customStart: state.usageCustomStart,
    customEnd: state.usageCustomEnd,
    model: state.usageModel,
    projectId: state.usageProject
  });
}

function renderUsageComparison() {
  const datasets = state.usageComparison?.sources || [];
  if (!datasets.length) {
    elements.usageComparison.innerHTML = '<div class="usage-empty compact-empty">暂无可比较账号</div>';
    return;
  }
  const rows = datasets.map(dataset => {
    if (dataset.error) return `<div class="comparison-row is-error"><div><strong>${escapeHtml(dataset.source.name)}</strong><small>${escapeHtml(dataset.error)}</small></div><span>读取失败</span></div>`;
    const events = comparisonEvents(dataset);
    const settings = readUsageSettings(dataset.source.id);
    const aggregate = aggregateUsage(events, event => estimateUsageEvent(event, dataset, settings));
    const topModel = topUsageLabel(events, 'model');
    return `<button class="comparison-row${dataset.source.id === state.selectedUsageSourceId ? ' is-selected' : ''}" type="button" data-comparison-source="${escapeHtml(dataset.source.id)}">
      <div class="comparison-account"><strong>${escapeHtml(dataset.source.name)}</strong><small>${escapeHtml(dataset.source.detail)}</small></div>
      <span><strong>${formatTokens(aggregate.total)}</strong><small>Token</small></span>
      <span><strong>${aggregate.tasks.toLocaleString('zh-CN')}</strong><small>任务</small></span>
      <span><strong>${aggregate.calls.toLocaleString('zh-CN')}</strong><small>调用</small></span>
      <span><strong>${(aggregate.cacheRate * 100).toFixed(1)}%</strong><small>缓存率</small></span>
      <span><strong>${formatUsd(aggregate.cost)}</strong><small>预计成本</small></span>
      <span class="comparison-model"><strong>${escapeHtml(topModel?.label || '暂无数据')}</strong><small>主要模型</small></span>
    </button>`;
  });
  elements.usageComparison.innerHTML = rows.join('');
}

function openTaskDetail(taskId) {
  const task = groupUsageTasks(usageEvents()).find(item => item.id === taskId);
  if (!task) return;
  elements.taskDetailTitle.textContent = task.project;
  elements.taskDetailMeta.textContent = `${new Date(task.timestamp).toLocaleString('zh-CN')} · 任务 ${task.id.slice(-8)}`;
  const cacheRate = task.input ? task.cached / task.input : 0;
  const summary = [
    ['总 Token', formatTokens(task.total)],
    ['交互回合', task.turns.size.toLocaleString('zh-CN')],
    ['模型调用', task.calls.toLocaleString('zh-CN')],
    ['缓存率', `${(cacheRate * 100).toFixed(1)}%`]
  ];
  elements.taskDetailSummary.innerHTML = summary.map(([label, value]) => `<div><span>${label}</span><strong>${value}</strong></div>`).join('');
  elements.taskDetailCalls.innerHTML = [...task.events].sort((a, b) => b.timestamp.localeCompare(a.timestamp)).map(event => `<div class="task-call-row">
    <div><strong>${escapeHtml(event.model)}</strong><small>${new Date(event.timestamp).toLocaleString('zh-CN')}</small></div>
    <span>${formatTokens(event.input)}</span><span>${formatTokens(event.cachedInput)}</span><span>${formatTokens(event.output)}</span><strong>${formatTokens(event.total)}</strong>
  </div>`).join('');
  elements.taskDetailDialog.showModal();
}

function renderNativeUsage() {
  const events = usageEvents();
  const aggregate = usageAggregate(events);
  document.querySelector('#usage-title').textContent = `${usageRangeLabel()}用量`;
  document.querySelector('#usage-subtitle').textContent = `最后更新 ${new Date(state.usageData.generatedAt).toLocaleString('zh-CN')}`;
  document.querySelector('#usage-kpi-total').textContent = formatTokens(aggregate.total);
  document.querySelector('#usage-kpi-total-note').textContent = `${aggregate.turns.toLocaleString('zh-CN')} 回合 · ${aggregate.calls.toLocaleString('zh-CN')} 次模型调用`;
  document.querySelector('#usage-kpi-cost').textContent = formatUsd(aggregate.cost);
  document.querySelector('#usage-kpi-coverage').textContent = `${(aggregate.coverage * 100).toFixed(0)}% Token 已定价`;
  document.querySelector('#usage-kpi-tasks').textContent = aggregate.tasks.toLocaleString('zh-CN');
  document.querySelector('#usage-kpi-projects').textContent = `${aggregate.projects} 个项目`;
  document.querySelector('#usage-kpi-cache').textContent = `${(aggregate.cacheRate * 100).toFixed(1)}%`;
  document.querySelector('#usage-kpi-cached').textContent = `${formatTokens(aggregate.cached)} cached`;
  document.querySelector('#usage-kpi-average').textContent = formatTokens(aggregate.average);
  document.querySelector('#usage-cost-total').textContent = formatUsd(aggregate.cost);
  const maxPart = Math.max(aggregate.parts.input, aggregate.parts.cached, aggregate.parts.output, .000001);
  document.querySelector('#usage-cost-breakdown').innerHTML = [['普通输入', aggregate.parts.input], ['缓存输入', aggregate.parts.cached], ['输出', aggregate.parts.output]].map(([label, value]) => `<div class="cost-row"><span>${label}</span><progress class="cost-track" max="${maxPart}" value="${value}"></progress><strong>${formatUsd(value)}</strong></div>`).join('');
  const budget = state.usageSettings.monthlyBudget;
  document.querySelector('#usage-budget-label').textContent = budget ? `${formatUsd(aggregate.cost)} / ${formatUsd(budget)}` : '未设置';
  document.querySelector('#usage-budget-bar').value = budget ? Math.min(100, aggregate.cost / budget * 100) : 0;
  const filterCount = Number(Boolean(state.usageModel)) + Number(Boolean(state.usageProject));
  elements.usageFilterCount.textContent = String(filterCount);
  elements.usageFilterCount.hidden = filterCount === 0;
  renderUsageComparison();
  renderTrend(events);

  const groups = new Map();
  events.forEach(event => {
    const group = groups.get(event.model) || { label: event.model, calls: 0, total: 0, cost: 0 };
    group.calls += 1; group.total += Number(event.total || 0); group.cost += estimateUsageEvent(event).total; groups.set(event.model, group);
  });
  const rows = [...groups.values()].sort((a, b) => b.total - a.total).slice(0, 7);
  document.querySelector('#usage-distribution').innerHTML = rows.length ? `<div class="usage-table-row header"><span>模型</span><span>模型调用</span><span>Token</span><span>成本</span></div>${rows.map(row => `<div class="usage-table-row"><strong>${escapeHtml(row.label)}</strong><span>${row.calls}</span><span>${formatTokens(row.total)}</span><span>${formatUsd(row.cost)}</span></div>`).join('')}` : '<div class="usage-empty">当前范围暂无模型记录</div>';

  const tasks = groupUsageTasks(events);
  const taskRows = tasks.slice(0, 7);
  document.querySelector('#usage-task-count').textContent = tasks.length.toLocaleString('zh-CN');
  document.querySelector('#usage-task-list').innerHTML = taskRows.length ? taskRows.map(task => `<button class="usage-task-row" type="button" data-task-id="${escapeHtml(task.id)}"><div><strong>${escapeHtml(task.project)}</strong><span>${escapeHtml([...task.models].join(' / '))} · ${new Date(task.timestamp).toLocaleString('zh-CN')}</span></div><div class="usage-task-metric"><strong>${formatTokens(task.total)}</strong><span>${task.turns.size} 回合 · ${task.calls} 次模型调用</span></div></button>`).join('') : '<div class="usage-empty">当前范围暂无任务</div>';
  renderPeriodReport();
}

function selectUsageDetail(tab) {
  const button = elements.usageDetailTabs.querySelector(`[data-usage-detail="${tab}"]`);
  if (!button) return;
  state.usageDetailTab = tab;
  elements.usageDetailTabs.querySelectorAll('[data-usage-detail]').forEach(item => {
    item.setAttribute('aria-selected', String(item === button));
  });
  elements.usageDetailPanels.forEach(panel => {
    panel.hidden = panel.dataset.usageDetailPanel !== tab;
  });
}

function initializeUsageFilters() {
  const events = state.usageData?.events || [];
  const models = [...new Set(events.map(event => event.model))].sort();
  const projects = [...new Map(events.map(event => [event.projectId, event.project])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  elements.usageModelFilter.innerHTML = '<option value="">全部模型</option>' + models.map(model => `<option value="${escapeHtml(model)}">${escapeHtml(model)}</option>`).join('');
  elements.usageProjectFilter.innerHTML = '<option value="">全部项目</option>' + projects.map(([id, name]) => `<option value="${escapeHtml(id)}">${escapeHtml(name)}</option>`).join('');
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
    state.usageComparison = await window.dualCodexDay.getUsageComparison();
    loadUsageSettings();
    initializeUsageFilters();
    state.dashboardLoading = false;
    state.dashboardLoaded = true;
    const counts = state.usageData.diagnostics?.counts || {};
    const scope = Number(counts.missingFiles || 0) > 0
      ? `${Number(counts.presentFiles || 0)} 个当前日志 · ${Number(counts.missingFiles || 0)} 个历史日志`
      : `${Number(counts.presentFiles || counts.files || 0)} 个当前日志`;
    elements.usageSourceMeta.textContent = `${state.usageData.source.kind === 'all' ? '汇总索引' : '独立索引'} · ${scope}`;
    renderDashboardState();
    renderNativeUsage();
    if (!state.usageRefreshTimer) {
      state.usageRefreshTimer = setInterval(() => {
        if (state.activeView === 'dashboard' && !state.busy && !elements.usageReconcileDialog.open) loadDashboard(true);
      }, 30_000);
    }
  } catch (error) {
    state.dashboardLoading = false;
    renderDashboardState(error?.message || String(error) || '本地用量服务未能启动。');
  }
}

function switchView(view) {
  if (!['launcher', 'dashboard', 'skills'].includes(view)) return Promise.resolve();
  state.activeView = view;
  elements.launcherView.hidden = view !== 'launcher';
  elements.dashboardView.hidden = view !== 'dashboard';
  elements.skillsView.hidden = view !== 'skills';
  elements.primaryTabs.querySelectorAll('[data-view]').forEach(button => {
    const selected = button.dataset.view === view;
    button.classList.toggle('is-active', selected);
    button.setAttribute('aria-selected', String(selected));
  });
  if (state.snapshot) renderUsage();
  if (view === 'dashboard') return loadDashboard();
  if (view === 'skills') return loadSkills();
  return Promise.resolve();
}

function renderSkills() {
  if (state.skillsLoading) {
    elements.skillsTable.innerHTML = '<div class="skills-loading">正在扫描 Skill 目录...</div>';
    elements.skillsMeta.textContent = '正在读取共享、默认、Profile 与仓库目录';
    return;
  }
  const data = state.skillsData;
  if (!data) return;
  const pluginData = data.pluginData || { plugins: [], availablePlugins: [], environments: [], failures: [] };
  const pluginSkillTotal = pluginData.plugins.reduce((total, plugin) => total + plugin.skills.length, 0);
  const availableSkillTotal = (pluginData.availablePlugins || []).reduce((total, plugin) => total + plugin.skills.length, 0);
  const workspaceRoot = data.roots.find(root => root.scope === 'workspace');
  const discoveredProjects = data.roots.filter(root => root.scope === 'workspace' && root.discovered);
  const workspaceSkillTotal = data.skills.filter(skill => skill.locations.some(location => location.scope === 'workspace')).length;
  const focusItems = state.skillsFocus?.items || [];
  const matchesFocus = value => !focusItems.length || focusItems.some(item => String(value || '').toLowerCase().includes(String(item).toLowerCase()) || String(item).toLowerCase().includes(String(value || '').toLowerCase()));
  elements.skillsFocus.hidden = !state.skillsFocus;
  if (state.skillsFocus) {
    elements.skillsFocusCopy.textContent = focusItems.length
      ? `来自“${state.skillsFocus.profileName}”的体检：${focusItems.join('、')}`
      : `来自“${state.skillsFocus.profileName}”的体检，请检查当前环境状态`;
  }
  elements.standaloneSkillCount.textContent = String(data.skills.length);
  elements.pluginSkillCount.textContent = String(pluginSkillTotal);
  elements.availableSkillCount.textContent = String(availableSkillTotal);
  elements.skillsMode.querySelectorAll('[data-skills-mode]').forEach(button => {
    const selected = button.dataset.skillsMode === state.skillsMode;
    button.classList.toggle('is-active', selected);
    button.setAttribute('aria-selected', String(selected));
  });
  elements.skillsMeta.textContent = `${data.skills.length} 个独立 Skill · 项目来源 ${workspaceSkillTotal} 个（自动发现 ${discoveredProjects.length} 个项目） · ${pluginData.plugins.length} 个已安装插件包含 ${pluginSkillTotal} 个 Skill · ${pluginData.availablePlugins.length} 个可安装插件包含 ${availableSkillTotal} 个 Skill${pluginData.failures.length ? ` · ${pluginData.failures.length} 个环境读取失败` : ''}${workspaceRoot ? ` · 当前项目 ${workspaceRoot.path}` : ''}`;
  if (state.skillsMode === 'plugins') {
    renderPluginSkills({ ...pluginData, plugins: pluginData.plugins.filter(plugin => matchesFocus(plugin.pluginId) || matchesFocus(plugin.name)) });
    return;
  }
  if (state.skillsMode === 'available') {
    renderAvailablePluginSkills({ ...pluginData, availablePlugins: (pluginData.availablePlugins || []).filter(plugin => matchesFocus(plugin.pluginId) || matchesFocus(plugin.name)) });
    return;
  }
  const columns = data.roots.filter(root => root.scope !== 'system');
  const visibleSkills = data.skills.filter(skill => matchesFocus(skill.name));
  elements.skillsTable.style.setProperty('--skill-column-count', String(columns.length));
  elements.skillsTable.innerHTML = visibleSkills.length ? `
    <div class="skills-matrix-header"><span>Skill</span>${columns.map(root => `<span title="${escapeHtml(root.path)}">${escapeHtml(root.label)}</span>`).join('')}<span>操作</span></div>
    ${visibleSkills.map(skill => {
      const source = skill.locations.find(item => !item.readOnly) || skill.locations[0];
      const shared = skill.locations.find(item => item.scope === 'shared');
      const onlySystem = skill.locations.every(item => item.readOnly);
      return `<div class="skill-row ${skill.conflict ? 'has-conflict' : ''}" data-skill-name="${escapeHtml(skill.name)}">
        <div class="skill-identity"><div><strong>${escapeHtml(skill.name)}</strong>${skill.conflict ? '<span class="skill-conflict">同名冲突</span>' : onlySystem ? '<span class="skill-readonly">系统只读</span>' : ''}</div><p>${escapeHtml(skill.description || '未提供描述')}</p><small>${escapeHtml(source.path)}</small></div>
        ${columns.map(root => {
          const present = skill.locations.some(item => item.path.toLowerCase() === `${root.path}\\${skill.name}`.toLowerCase());
          const same = present && source.path.toLowerCase() === `${root.path}\\${skill.name}`.toLowerCase();
          if (root.scope === 'workspace') return `<div class="skill-cell workspace-skill-cell ${present ? 'is-present' : ''}" title="${escapeHtml(root.path)}"><span>${present ? '项目来源' : '—'}</span></div>`;
          return `<button class="skill-cell ${present ? 'is-present' : ''}" type="button" data-skill-sync="${escapeHtml(skill.name)}" data-source="${escapeHtml(source.path)}" data-target-root="${escapeHtml(root.path)}" data-overwrite="${present}" ${same || source.readOnly ? 'disabled' : ''} title="${present ? '覆盖此位置的同名 Skill' : `复制到 ${escapeHtml(root.label)}`}"><span>${present ? same ? '当前来源' : '覆盖同步' : '同步'}</span></button>`;
        }).join('')}
        <div class="skill-actions">
          <button class="icon-button" type="button" data-skill-share="${escapeHtml(skill.name)}" data-source="${escapeHtml(source.path)}" ${shared || source.readOnly ? 'disabled' : ''} title="共享给所有 Codex" aria-label="共享给所有 Codex"><i data-lucide="folder-cog"></i></button>
          <button class="icon-button" type="button" data-skill-toggle="${escapeHtml(skill.name)}" data-skill-path="${escapeHtml(source.path)}" title="启用或停用" aria-label="启用或停用"><i data-lucide="settings-2"></i></button>
          <button class="icon-button danger-icon-button" type="button" data-skill-remove="${escapeHtml(source.path)}" ${!source.managed || source.readOnly ? 'disabled' : ''} title="移入回收站" aria-label="移入回收站"><i data-lucide="trash-2"></i></button>
        </div>
      </div>`;
    }).join('')}` : `<div class="skills-loading">${state.skillsFocus ? '没有扫描到体检中提到的 Skill，请检查失效路径或从其他来源重新同步。' : '当前目录中没有可识别的 Skills。'}</div>`;
  refreshIcons();
}

function renderPluginSkills(data) {
  const columns = data.environments || [];
  elements.skillsTable.style.setProperty('--skill-column-count', String(columns.length));
  elements.skillsTable.innerHTML = data.plugins.length ? `
    <div class="skills-matrix-header"><span>插件及其 Skills</span>${columns.map(item => `<span title="${escapeHtml(item.codexHome)}">${escapeHtml(item.label)}</span>`).join('')}<span>来源</span></div>
    ${data.plugins.map(plugin => `<div class="skill-row plugin-row">
      <div class="skill-identity plugin-identity"><div><strong>${escapeHtml(plugin.name)}</strong><span class="plugin-badge">插件</span></div><p>${plugin.skills.map(skill => escapeHtml(skill.name)).join(' · ')}</p><small>${escapeHtml(plugin.pluginId)}${plugin.version ? ` · v${escapeHtml(plugin.version)}` : ''}</small></div>
      ${columns.map(environment => {
        const location = plugin.locations.find(item => item.environmentId === environment.id);
        return location
          ? `<button class="skill-cell plugin-cell is-present ${location.enabled ? 'is-enabled' : 'is-disabled'}" type="button" data-plugin-manage="${escapeHtml(plugin.pluginId)}" data-environment-id="${escapeHtml(environment.id)}"><span>${location.enabled ? '已启用' : '已停用'}</span><small>管理</small></button>`
          : `<button class="skill-cell plugin-cell" type="button" data-plugin-install="${escapeHtml(plugin.pluginId)}" data-target-home="${escapeHtml(environment.codexHome)}" data-target-label="${escapeHtml(environment.label)}"><span>安装到 ${escapeHtml(environment.label)}</span></button>`;
      }).join('')}
      <div class="plugin-source"><strong>${escapeHtml(plugin.marketplaceName)}</strong><span>${plugin.skills.length} 个 Skill</span></div>
    </div>`).join('')}` : '<div class="skills-loading">没有检测到包含 Skills 的已安装插件。</div>';
  refreshIcons();
}

function renderAvailablePluginSkills(data) {
  const columns = data.environments || [];
  const plugins = data.availablePlugins || [];
  elements.skillsTable.style.setProperty('--skill-column-count', String(columns.length));
  elements.skillsTable.innerHTML = plugins.length ? `
    <div class="skills-matrix-header"><span>Marketplace 插件及其 Skills</span>${columns.map(item => `<span title="${escapeHtml(item.codexHome)}">${escapeHtml(item.label)}</span>`).join('')}<span>来源</span></div>
    ${plugins.map(plugin => `<div class="skill-row plugin-row available-plugin-row">
      <div class="skill-identity plugin-identity"><div><strong>${escapeHtml(plugin.name)}</strong><span class="plugin-badge available-badge">可安装</span></div><p>${plugin.skills.map(skill => escapeHtml(skill.name)).join(' · ')}</p><small>${escapeHtml(plugin.pluginId)}${plugin.version ? ` · v${escapeHtml(plugin.version)}` : ''}</small></div>
      ${columns.map(environment => `<button class="skill-cell plugin-cell" type="button" data-plugin-install="${escapeHtml(plugin.pluginId)}" data-target-home="${escapeHtml(environment.codexHome)}" data-target-label="${escapeHtml(environment.label)}"><span>安装</span><small>${escapeHtml(environment.label)}</small></button>`).join('')}
      <div class="plugin-source"><strong>${escapeHtml(plugin.marketplaceName)}</strong><span>${plugin.skills.length} 个 Skill</span></div>
    </div>`).join('')}` : '<div class="skills-loading">当前 Marketplace 中没有包含 Skills 的未安装插件。</div>';
  refreshIcons();
}

async function loadSkills() {
  if (state.skillsLoading) return;
  state.skillsLoading = true;
  renderSkills();
  try {
    state.skillsData = await window.dualCodexDay.getSkills();
  } catch (error) {
    showToast(error.message || '读取 Skills 失败。', true);
  } finally {
    state.skillsLoading = false;
    renderSkills();
  }
}

async function runSkillAction(action, success) {
  if (state.busy) return;
  setBusy(true);
  try {
    const result = await action();
    state.skillsData = result.skills || result;
    renderSkills();
    showToast(`${success} 重启 Codex 后生效。`);
  } catch (error) {
    showToast(error.message || 'Skill 操作失败。', true);
  } finally { setBusy(false); }
}

elements.skillsTable.addEventListener('click', async event => {
  const pluginInstall = event.target.closest('[data-plugin-install]');
  const pluginManage = event.target.closest('[data-plugin-manage]');
  if (pluginInstall) {
    const pluginId = pluginInstall.dataset.pluginInstall;
    const targetLabel = pluginInstall.dataset.targetLabel;
    if (!confirm(`把插件“${pluginId}”安装到“${targetLabel}”？\n该插件包含的全部 Skills 会一起安装。`)) return;
    return runSkillAction(() => window.dualCodexDay.installPlugin(pluginId, pluginInstall.dataset.targetHome), `插件已安装到“${targetLabel}”。`);
  }
  if (pluginManage) {
    const plugin = state.skillsData.pluginData.plugins.find(item => item.pluginId === pluginManage.dataset.pluginManage);
    const environment = state.skillsData.pluginData.environments.find(item => item.id === pluginManage.dataset.environmentId);
    const location = plugin?.locations.find(item => item.environmentId === environment?.id);
    if (!plugin || !environment || !location) return;
    state.activePlugin = { plugin, environment, location };
    elements.pluginManageTitle.textContent = plugin.name;
    elements.pluginManageEnvironment.textContent = `${environment.label} · ${plugin.marketplaceName}`;
    elements.pluginManageSkills.textContent = `包含：${plugin.skills.map(skill => skill.name).join('、')}`;
    elements.pluginManageEnabled.checked = location.enabled;
    elements.pluginManageDialog.showModal();
    return;
  }
  const share = event.target.closest('[data-skill-share]');
  const sync = event.target.closest('[data-skill-sync]');
  const remove = event.target.closest('[data-skill-remove]');
  const toggle = event.target.closest('[data-skill-toggle]');
  if (share) return runSkillAction(() => window.dualCodexDay.shareSkill(share.dataset.source, false), `“${share.dataset.skillShare}”已加入共享目录。`);
  if (sync) {
    const overwrite = sync.dataset.overwrite === 'true';
    if (overwrite && !confirm(`目标位置已有同名 Skill。用当前版本覆盖它？\n${sync.dataset.targetRoot}`)) return;
    return runSkillAction(() => window.dualCodexDay.syncSkill(sync.dataset.source, sync.dataset.targetRoot, overwrite), `“${sync.dataset.skillSync}”已同步。`);
  }
  if (remove) {
    if (!confirm(`将这个 Skill 目录移入回收站？\n${remove.dataset.skillRemove}`)) return;
    return runSkillAction(() => window.dualCodexDay.removeSkill(remove.dataset.skillRemove), 'Skill 已移入回收站。');
  }
  if (toggle) {
    const name = toggle.dataset.skillToggle;
    const targets = [{ name: '默认 Codex', codexHome: state.snapshot.profiles.find(item => item.runtimeSource === 'default')?.runtimeRoot || '' }, ...state.snapshot.profiles.filter(item => item.runtimeSource !== 'default').map(item => ({ name: item.name, codexHome: item.codexHome }))].filter(item => item.codexHome);
    elements.skillToggleTitle.textContent = `设置“${name}”`;
    elements.skillToggleTarget.innerHTML = targets.map(item => `<option value="${escapeHtml(item.codexHome)}">${escapeHtml(item.name)}</option>`).join('');
    elements.skillToggleEnabled.checked = true;
    elements.skillToggleForm.dataset.skillName = name;
    elements.skillToggleForm.dataset.skillPath = toggle.dataset.skillPath;
    elements.skillToggleDialog.showModal();
  }
});

elements.skillsMode.addEventListener('click', event => {
  const button = event.target.closest('[data-skills-mode]');
  if (!button) return;
  state.skillsMode = button.dataset.skillsMode;
  renderSkills();
});
elements.skillsFocusClear.addEventListener('click', () => {
  state.skillsFocus = null;
  renderSkills();
});

elements.pluginManageCancel.addEventListener('click', () => elements.pluginManageDialog.close());
elements.pluginManageForm.addEventListener('submit', async event => {
  event.preventDefault();
  const active = state.activePlugin;
  if (!active) return;
  elements.pluginManageDialog.close();
  const enabled = elements.pluginManageEnabled.checked;
  return runSkillAction(() => window.dualCodexDay.setPluginEnabled(active.plugin.pluginId, active.environment.codexHome, enabled), `“${active.plugin.name}”已在“${active.environment.label}”中${enabled ? '启用' : '停用'}。`);
});

elements.pluginRemove.addEventListener('click', async () => {
  const active = state.activePlugin;
  if (!active) return;
  if (!confirm(`从“${active.environment.label}”卸载插件“${active.plugin.name}”？\n插件包含的全部 Skills 会一起移除。`)) return;
  elements.pluginManageDialog.close();
  return runSkillAction(() => window.dualCodexDay.removePlugin(active.plugin.pluginId, active.environment.codexHome), `“${active.plugin.name}”已从“${active.environment.label}”卸载。`);
});

elements.skillToggleCancel.addEventListener('click', () => elements.skillToggleDialog.close());
elements.skillToggleForm.addEventListener('submit', async event => {
  event.preventDefault();
  const name = elements.skillToggleForm.dataset.skillName;
  const skillPath = elements.skillToggleForm.dataset.skillPath;
  const codexHome = elements.skillToggleTarget.value;
  const targetName = elements.skillToggleTarget.selectedOptions[0]?.textContent || 'Codex';
  const enabled = elements.skillToggleEnabled.checked;
  elements.skillToggleDialog.close();
  return runSkillAction(() => window.dualCodexDay.setSkillEnabled(codexHome, skillPath, enabled), `“${name}”已在“${targetName}”中${enabled ? '启用' : '停用'}。`);
});

elements.skillsRefresh.addEventListener('click', loadSkills);
elements.skillsWorkspace.addEventListener('click', async () => {
  if (state.busy) return;
  setBusy(true);
  try {
    const workspace = await window.dualCodexDay.chooseWorkspace();
    state.snapshot.workspace = workspace;
    state.skillsData = null;
  } catch (error) {
    showToast(error.message || '无法选择项目目录。', true);
  } finally {
    setBusy(false);
  }
  await loadSkills();
});
elements.skillsRestart.addEventListener('click', () => {
  const profile = selectedProfile();
  if (!profile) return showToast('请先在启动中心选择一个账号。', true);
  launchSelectedTarget('desktop');
});

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

elements.profileDiagnosisButton.addEventListener('click', loadProfileDiagnosis);
elements.profileReadinessButton.addEventListener('click', loadProfileDiagnosis);
elements.profileDiagnosisRefresh.addEventListener('click', () => state.pendingLaunchTarget
  ? loadProfilePreflight(state.pendingLaunchTarget)
  : loadProfileDiagnosis());
elements.profileDiagnosisClose.addEventListener('click', closeProfileDiagnosis);
elements.profileDiagnosisDialog.addEventListener('cancel', event => {
  event.preventDefault();
  closeProfileDiagnosis();
});
elements.profileDiagnosisGroups.addEventListener('click', event => {
  const button = event.target.closest('[data-diagnosis-action]');
  if (button) runDiagnosisAction(diagnosisAction(button.dataset.diagnosisAction));
});
elements.profileDiagnosisLaunch.addEventListener('click', async () => {
  const target = state.pendingLaunchAllowed ? state.pendingLaunchTarget : null;
  if (!target) return;
  await closeProfileDiagnosis();
  launchSelectedTarget(target, { skipPreflight: true });
});
elements.profileDiagnosisExport.addEventListener('click', async () => {
  if (!state.profileDiagnosisToken || state.busy) return;
  setBusy(true);
  try {
    const exported = await window.dualCodexDay.exportProfileDiagnosis(state.profileDiagnosisToken);
    if (exported) showToast('脱敏 Profile 诊断已导出。');
  } catch (error) {
    showToast(friendlyProviderError(error) || '无法导出 Profile 诊断。', true);
  } finally {
    setBusy(false);
    renderSelectedProfile();
  }
});

elements.profileRecoveryButton.addEventListener('click', openProfileRecovery);
elements.profileRecoveryList.addEventListener('click', event => {
  const button = event.target.closest('[data-recovery-backup]');
  if (!button || button.disabled) return;
  selectProfileRecovery(button.dataset.recoveryBackup);
});
elements.profileRecoveryClose.addEventListener('click', async () => {
  await discardProfileRecovery();
  elements.profileRecoveryDialog.close();
});
elements.profileRecoveryDialog.addEventListener('cancel', event => {
  event.preventDefault();
  discardProfileRecovery().finally(() => elements.profileRecoveryDialog.close());
});
elements.profileRecoveryApply.addEventListener('click', async () => {
  const token = state.profileRecoveryToken;
  const profile = selectedProfile();
  if (!token || !profile || state.busy) return;
  if (activeLaunches(profile.id).length) return showToast('请先关闭该 Profile 正在运行的客户端。', true);
  state.profileRecoveryToken = null;
  setBusy(true);
  try {
    const restored = await window.dualCodexDay.applyProfileRecovery(token);
    elements.profileRecoveryDialog.close();
    state.dashboardLoaded = false;
    await refreshSnapshot(restored.profile.id, true);
    showToast(`“${restored.profile.name}”已恢复，并已创建保护备份。`);
  } catch (error) {
    showToast(friendlyProviderError(error) || '无法恢复 Profile。', true);
  } finally {
    setBusy(false);
    renderSelectedProfile();
  }
});

elements.exportProfileTransfer.addEventListener('click', async () => {
  const profile = selectedProfile();
  if (!profile || state.busy) return;
  setBusy(true);
  try {
    const exported = await window.dualCodexDay.exportProfileTransfer(profile.id, readUsageSettings(`profile:${profile.id}`));
    if (exported) showToast(`“${exported.profileName}”已导出。`);
  } catch (error) {
    showToast(friendlyProviderError(error) || '无法导出 Profile。', true);
  } finally {
    setBusy(false);
    renderSelectedProfile();
  }
});

elements.importProfileTransfer.addEventListener('click', async () => {
  if (state.busy) return;
  setBusy(true);
  try {
    await discardProfileTransfer();
    const selected = await window.dualCodexDay.chooseProfileTransfer();
    if (!selected) return;
    state.pendingProfileTransferToken = selected.token;
    renderProfileTransferPreview(selected.preview);
    elements.profileTransferDialog.showModal();
    refreshIcons();
  } catch (error) {
    showToast(friendlyProviderError(error) || '无法读取 Profile 迁移文件。', true);
  } finally {
    setBusy(false);
    renderSelectedProfile();
  }
});

elements.profileTransferCancel.addEventListener('click', async () => {
  await discardProfileTransfer();
  elements.profileTransferDialog.close();
});

elements.profileTransferDialog.addEventListener('cancel', event => {
  event.preventDefault();
  discardProfileTransfer().finally(() => elements.profileTransferDialog.close());
});

elements.profileTransferForm.addEventListener('submit', async event => {
  event.preventDefault();
  const token = state.pendingProfileTransferToken;
  if (!token || state.busy) return;
  let credentialRequired = false;
  setBusy(true);
  try {
    const applied = await window.dualCodexDay.applyProfileTransfer(token);
    state.pendingProfileTransferToken = null;
    credentialRequired = applied.preview.credentialRequired;
    localStorage.setItem(usageSettingsKey(`profile:${applied.profile.id}`), JSON.stringify(applied.preferences));
    elements.profileTransferDialog.close();
    state.dashboardLoaded = false;
    await refreshSnapshot(applied.profile.id, true);
    showToast(credentialRequired ? 'Profile 已导入，请重新填写中转站 API Key。' : `“${applied.profile.name}”已导入。`);
  } catch (error) {
    showToast(friendlyProviderError(error) || '无法应用 Profile 迁移。', true);
  } finally {
    setBusy(false);
    renderSelectedProfile();
  }
  if (credentialRequired) openProviderEditor();
});

elements.cancelProfile.addEventListener('click', () => elements.dialog.close());
elements.renameProfileCancel.addEventListener('click', () => elements.renameProfileDialog.close());
elements.deleteProfileCancel.addEventListener('click', () => elements.deleteProfileDialog.close());
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

elements.renameProfile.addEventListener('click', () => {
  const profile = selectedProfile();
  if (!profile || state.busy) return;
  elements.renameProfileInput.value = profile.name;
  elements.renameProfileDialog.showModal();
  elements.renameProfileInput.select();
});

elements.renameProfileForm.addEventListener('submit', async event => {
  event.preventDefault();
  const profile = selectedProfile();
  const name = elements.renameProfileInput.value.trim();
  if (!profile || !name || state.busy) return;
  setBusy(true);
  try {
    const updated = await window.dualCodexDay.renameProfile(profile.id, name);
    elements.renameProfileDialog.close();
    await refreshSnapshot(updated.id, true);
    showToast(`账号已重命名为“${updated.name}”。`);
  } catch (error) {
    showToast(error.message || '无法重命名账号。', true);
  } finally {
    setBusy(false);
    renderSelectedProfile();
  }
});

elements.deleteProfile.addEventListener('click', () => {
  const profile = selectedProfile();
  if (!profile || state.busy) return;
  elements.deleteProfileName.textContent = profile.name;
  elements.deleteProfileDialog.showModal();
});

elements.deleteProfileForm.addEventListener('submit', async event => {
  event.preventDefault();
  const profile = selectedProfile();
  if (!profile || state.busy) return;
  setBusy(true);
  try {
    await window.dualCodexDay.deleteProfile(profile.id);
    elements.deleteProfileDialog.close();
    state.selectedProfileId = null;
    state.dashboardLoaded = false;
    await refreshSnapshot(null, true);
    showToast(`“${profile.name}”的独立配置已移入回收站。`);
  } catch (error) {
    showToast(error.message || '无法删除账号配置。', true);
  } finally {
    setBusy(false);
    renderSelectedProfile();
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
  launchSelectedTarget(button.dataset.target);
});

elements.profileStopButton.addEventListener('click', async () => {
  const profile = selectedProfile();
  const running = activeLaunches(profile?.id);
  if (!profile || !running.length || state.busy) return;
  setBusy(true);
  try {
    const result = await window.dualCodexDay.stopProfileLaunches(profile.id);
    if (result.canceled) return;
    await refreshSnapshot(profile.id, true);
    const forced = result.results.filter(item => item.forced).length;
    const suffix = forced ? `，其中 ${forced} 个已强制结束` : '';
    showToast(`“${profile.name}”的 ${result.results.length} 个客户端已关闭${suffix}。`);
  } catch (error) {
    await refreshSnapshot(profile.id, true);
    showToast(error.message || '无法关闭客户端。', true);
  } finally {
    setBusy(false);
    render();
  }
});

elements.recentList.addEventListener('click', async event => {
  const workLaunch = event.target.closest('[data-work-launch]');
  if (workLaunch) return launchWorkCombination(workLaunch.dataset.workLaunch);
  const workPin = event.target.closest('[data-work-pin]');
  if (workPin) return toggleWorkCombinationPin(workPin.dataset.workPin, workPin.dataset.pinned !== 'true');
  const workRepair = event.target.closest('[data-work-repair]');
  if (workRepair) return repairWorkCombination(workRepair.dataset.workRepair);
  const workRemove = event.target.closest('[data-work-remove]');
  if (workRemove) return removeSavedWork(workRemove.dataset.workRemove);
  const button = event.target.closest('[data-stop-launch]');
  if (!button || state.busy) return;
  const launch = state.snapshot?.recentLaunches.find(item => item.id === button.dataset.stopLaunch);
  if (!launch?.active) return;
  setBusy(true);
  button.disabled = true;
  try {
    const result = await window.dualCodexDay.stopProfileLaunch(launch.id);
    if (result.canceled) return;
    await refreshSnapshot(state.selectedProfileId, true);
    const suffix = result.alreadyStopped ? '已经结束。' : result.forced ? '已强制关闭。' : '已关闭。';
    showToast(`“${launch.profileName}”的 ${targetMetadata[launch.target]?.label || '客户端'}${suffix}`);
  } catch (error) {
    showToast(error.message || '无法关闭实例。', true);
  } finally {
    setBusy(false);
    render();
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
  const runtimeInput = elements.usageSourceForm.querySelector(`input[name="profileRuntimeSource"][value="${profile.runtimeSource || 'profile'}"]`);
  if (runtimeInput) runtimeInput.checked = true;
  const defaultRuntime = elements.usageSourceForm.querySelector('input[name="profileRuntimeSource"][value="default"]');
  defaultRuntime.disabled = profile.provider?.type === 'custom';
  defaultRuntime.closest('label').classList.toggle('is-disabled', defaultRuntime.disabled);
  elements.usageSourceDialog.showModal();
});
elements.usageSourceCancel.addEventListener('click', () => elements.usageSourceDialog.close());
elements.usageSourceForm.addEventListener('submit', async event => {
  event.preventDefault();
  const profile = selectedProfile();
  const source = elements.usageSourceForm.querySelector('input[name="profileUsageSource"]:checked')?.value;
  const runtimeSource = elements.usageSourceForm.querySelector('input[name="profileRuntimeSource"]:checked')?.value;
  if (!profile || !source || !runtimeSource || state.busy) return;
  setBusy(true);
  try {
    await window.dualCodexDay.setProfileRuntimeSource(profile.id, runtimeSource);
    const updated = await window.dualCodexDay.setProfileUsageSource(profile.id, source);
    elements.usageSourceDialog.close();
    state.dashboardLoaded = false;
    await refreshSnapshot(updated.id, true);
    showToast(`“${updated.name}”已使用${runtimeSource === 'default' ? '当前默认 Codex' : '独立 Profile'}运行环境。`);
  } catch (error) {
    showToast(error.message || '无法保存账号来源。', true);
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
elements.usageComparison.addEventListener('click', event => {
  const row = event.target.closest('[data-comparison-source]');
  if (!row) return;
  state.selectedUsageSourceId = row.dataset.comparisonSource;
  state.dashboardLoaded = false;
  renderUsageSources();
  loadDashboard(true);
});
elements.usageDetailTabs.addEventListener('click', event => {
  const button = event.target.closest('[data-usage-detail]');
  if (button) selectUsageDetail(button.dataset.usageDetail);
});
document.querySelector('#usage-task-list').addEventListener('click', event => {
  const row = event.target.closest('[data-task-id]');
  if (row) openTaskDetail(row.dataset.taskId);
});
elements.taskDetailClose.addEventListener('click', () => elements.taskDetailDialog.close());
elements.usageRange.addEventListener('click', event => {
  const button = event.target.closest('[data-range]');
  if (!button) return;
  state.usageRange = button.dataset.range;
  elements.usageRange.querySelectorAll('[data-range]').forEach(item => item.classList.toggle('is-active', item === button));
  elements.usageCustomRange.open = false;
  renderNativeUsage();
});
elements.usageCustomApply.addEventListener('click', () => {
  const start = elements.usageCustomStart.value;
  const end = elements.usageCustomEnd.value;
  if (!start || !end || start > end) {
    showToast('自定义日期必须包含有效的开始和结束日期。', true);
    return;
  }
  state.usageCustomStart = start;
  state.usageCustomEnd = end;
  state.usageRange = 'custom';
  elements.usageRange.querySelectorAll('[data-range]').forEach(item => item.classList.remove('is-active'));
  elements.usageCustomRange.open = false;
  renderNativeUsage();
});
elements.usageModelFilter.addEventListener('change', () => { state.usageModel = elements.usageModelFilter.value; renderNativeUsage(); });
elements.usageProjectFilter.addEventListener('change', () => { state.usageProject = elements.usageProjectFilter.value; renderNativeUsage(); });
elements.usageFilterClear.addEventListener('click', () => {
  state.usageModel = '';
  state.usageProject = '';
  elements.usageModelFilter.value = '';
  elements.usageProjectFilter.value = '';
  elements.usageFilterMenu.open = false;
  renderNativeUsage();
});
elements.usageActionsMenu.addEventListener('click', event => {
  if (event.target.closest('button')) elements.usageActionsMenu.open = false;
});
document.addEventListener('click', event => {
  [elements.usageFilterMenu, elements.usageActionsMenu, elements.usageCustomRange].forEach(menu => {
    if (menu.open && !menu.contains(event.target)) menu.open = false;
  });
});
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
  const refresh = d.refresh || {};
  const items = [
    ['状态', d.status || 'unknown'],
    ['当前日志', counts.presentFiles || 0],
    ['已保留历史', counts.missingFiles || 0],
    ['延后处理', counts.deferredFiles || 0],
    ['有效事件', counts.events || 0],
    ['根任务', counts.sessions || 0],
    ['重复快照', counts.duplicateEvents || 0],
    ['旧版历史清理', refresh.droppedLegacyFiles || 0]
  ];
  elements.usageDiagnosticsContent.innerHTML = items.map(([label, value]) => `<div><span>${label}</span><strong>${escapeHtml(value)}</strong></div>`).join('');
  elements.usageDiagnosticsScope.textContent = '统计包含当前可读取的 Codex 日志，以及从 v0.11.0 起已进入本地台账但随后消失的日志。无法按新口径验证的旧版缺失记录不会保留。';
  elements.usageDiagnosticsDialog.showModal();
});
elements.usageDiagnosticsClose.addEventListener('click', () => elements.usageDiagnosticsDialog.close());
elements.usageReconcileButton.addEventListener('click', openReconcile);
elements.usageReconcileClose.addEventListener('click', () => elements.usageReconcileDialog.close());
elements.usageReconcileChoose.addEventListener('click', async () => {
  const selected = await window.dualCodexDay.chooseCcSwitchDatabase();
  if (!selected) return;
  state.ccSwitchPath = selected;
  localStorage.setItem('dual-codex-cc-switch-db', selected);
  await openReconcile();
});
elements.usagePosterButton.addEventListener('click', openUsagePoster);
elements.reportPosterButton.addEventListener('click', openReportPoster);
elements.reportPeriod.addEventListener('click', event => {
  const button = event.target.closest('[data-report-period]');
  if (!button) return;
  state.reportPeriod = button.dataset.reportPeriod;
  elements.reportPeriod.querySelectorAll('[data-report-period]').forEach(item => item.classList.toggle('is-active', item === button));
  renderPeriodReport();
});
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
