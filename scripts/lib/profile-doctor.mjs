import { createHash } from 'node:crypto';

export const PROFILE_DIAGNOSIS_APP = 'dual-codex-day';
export const PROFILE_DIAGNOSIS_KIND = 'profile-diagnosis';
export const PROFILE_DIAGNOSIS_SCHEMA_VERSION = 2;

const statusRank = { ok: 0, warning: 1, error: 2 };

function statusOf(items) {
  return items.reduce((current, item) => statusRank[item.status] > statusRank[current] ? item.status : current, 'ok');
}

function safeCount(value) {
  const count = Number(value);
  return Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
}

function safeItems(items) {
  if (!Array.isArray(items)) return [];
  return [...new Set(items.map(item => String(item || '').trim()).filter(Boolean).map(item => item.slice(0, 160)))];
}

function remediation(type, label, options = {}) {
  return { type, label, ...options };
}

function check(id, label, status, detail, items = [], options = {}) {
  if (!(status in statusRank)) throw new Error(`Unsupported diagnosis status: ${status}`);
  return {
    id,
    label,
    status,
    detail,
    items: safeItems(items),
    blocking: status === 'error' && options.blocking === true,
    action: options.action || null
  };
}

function group(id, label, checks) {
  return { id, label, status: statusOf(checks), checks };
}

function loginCheck(login = {}, targets = {}) {
  if (login.state === 'authenticated') return check('login', '登录状态', 'ok', 'Codex 登录已就绪');
  if (login.state === 'ready') return check('login', '认证状态', 'ok', '供应商认证已就绪');
  if (login.state === 'signed-out') {
    const target = targets.desktop?.available ? 'desktop' : targets.cli?.available ? 'cli' : null;
    return check(
      'login',
      '登录状态',
      'error',
      '当前运行环境尚未登录',
      [],
      { action: target ? remediation('launch-login', target === 'desktop' ? '打开 Codex 登录' : '打开 CLI 登录', { target }) : null }
    );
  }
  if (login.state === 'missing') {
    return check('login', '认证状态', 'error', '当前供应商缺少所需凭据', [], {
      blocking: true,
      action: remediation('open-provider-settings', '打开供应商设置')
    });
  }
  return check('login', '登录状态', 'warning', '暂时无法确认登录状态');
}

export function summarizeProfileReadiness(report = {}) {
  const checks = Array.isArray(report.groups) ? report.groups.flatMap(item => item.checks || []) : [];
  const issues = checks.filter(item => item.status !== 'ok');
  const blockers = issues.filter(item => item.blocking === true);
  const primary = blockers.find(item => item.action) || issues.find(item => item.action) || null;
  return {
    state: blockers.length ? 'blocked' : issues.length ? 'attention' : 'ready',
    issueCount: issues.length,
    blockingCount: blockers.length,
    actionCount: issues.filter(item => item.action).length,
    primaryAction: primary?.action || null
  };
}

export function diagnoseProfileEnvironment(input = {}) {
  const profile = input.profile || {};
  const provider = profile.provider || { type: 'official' };
  const configuration = input.configuration || {};
  const directories = input.directories || {};
  const components = input.components || {};
  const targets = input.targets || {};
  const usage = input.usage || {};
  const recovery = input.recovery || {};
  const missingSkills = safeItems(components.missingSkills);
  const missingPlugins = safeItems(components.missingPlugins);
  const pluginFailureCount = safeCount(components.pluginFailureCount);
  const configUnavailable = !configuration.configExists || configuration.configValid === false;
  const configAction = recovery.backupState === 'valid'
    ? remediation('open-recovery', '打开恢复中心')
    : remediation('open-profile-folder', '打开配置目录');
  const missingPluginAction = missingPlugins.length
    ? remediation('open-skills', '查看缺少的插件', { mode: 'available', items: missingPlugins })
    : pluginFailureCount
      ? remediation('open-skills', '检查插件环境', { mode: 'plugins' })
      : null;

  const groups = [
    group('configuration', '配置与目录', [
      check('registry', 'Profile 注册表', configuration.registryValid === false ? 'error' : 'ok', configuration.registryValid === false ? 'Profile 注册表无效' : 'Profile 注册信息有效', [], {
        blocking: configuration.registryValid === false,
        action: configuration.registryValid === false ? remediation('open-profile-folder', '打开配置目录') : null
      }),
      check('config', 'config.toml', configUnavailable ? 'error' : 'ok', !configuration.configExists ? '缺少 config.toml' : configuration.configValid === false ? 'config.toml 无法解析' : 'config.toml 可正常解析', [], {
        blocking: configUnavailable,
        action: configUnavailable ? configAction : null
      }),
      check('runtime-directory', '运行目录', directories.runtimeAvailable === false ? 'error' : 'ok', directories.runtimeAvailable === false ? '当前运行目录不可用' : '当前运行目录可读', [], {
        blocking: directories.runtimeAvailable === false,
        action: directories.runtimeAvailable === false ? remediation('open-profile-folder', '打开配置目录') : null
      }),
      check('usage-directory', '用量目录', directories.usageAvailable === false ? 'warning' : 'ok', directories.usageAvailable === false ? '当前用量来源目录不可用' : '当前用量来源目录可读')
    ]),
    group('authentication', '供应商与认证', [
      provider.type === 'custom' && provider.authMode === 'environment'
        ? check('credential-storage', '安全凭据存储', input.credentialStorageAvailable === false ? 'error' : 'ok', input.credentialStorageAvailable === false ? '操作系统安全凭据存储不可用' : '操作系统安全凭据存储可用', [], {
            blocking: input.credentialStorageAvailable === false,
            action: input.credentialStorageAvailable === false ? remediation('open-provider-settings', '打开供应商设置') : null
          })
        : check('credential-storage', '认证方式', 'ok', provider.type === 'official' ? '使用 Codex 官方登录' : provider.authMode === 'openai' ? '使用 Codex 登录' : '供应商无需认证'),
      loginCheck(input.loginStatus, targets)
    ]),
    group('targets', '客户端入口', ['cli', 'vscode', 'desktop'].map(id => {
      const labels = { cli: 'Codex CLI', vscode: 'VS Code', desktop: 'Codex 桌面端' };
      return check(id, labels[id], targets[id]?.available ? 'ok' : 'warning', targets[id]?.available ? '入口可用' : '未检测到可用入口');
    })),
    group('components', 'Skills 与插件', [
      check('skills', 'Skills 配置', missingSkills.length ? 'warning' : 'ok', missingSkills.length ? `${missingSkills.length} 个 Skill 路径失效` : `${safeCount(components.configuredSkills)} 个已配置 Skill 路径有效`, missingSkills, {
        action: missingSkills.length ? remediation('open-skills', '查看相关 Skills', { mode: 'standalone', items: missingSkills }) : null
      }),
      check('plugins', '插件状态', missingPlugins.length || pluginFailureCount ? 'warning' : 'ok', pluginFailureCount ? `${pluginFailureCount} 个插件环境读取失败` : missingPlugins.length ? `${missingPlugins.length} 个已配置插件未安装` : `${safeCount(components.installedPlugins)} 个插件状态可读取`, missingPlugins, {
        action: missingPluginAction
      })
    ]),
    group('usage', '用量索引', [
      check('usage-index', '账号用量', usage.available === false || usage.status === 'error' ? 'error' : usage.status === 'warning' ? 'warning' : 'ok', usage.available === false ? '用量索引无法读取' : usage.status === 'error' ? '用量索引状态异常' : usage.status === 'warning' ? '用量索引包含待处理记录' : '用量索引可正常读取', [], {
        action: usage.available === false || ['error', 'warning'].includes(usage.status)
          ? remediation('open-usage-diagnostics', '打开数据诊断')
          : null
      })
    ]),
    group('recovery', '运行与恢复', [
      check('instances', '运行实例', 'ok', `${safeCount(recovery.activeLaunches)} 个实例正在运行`),
      check('backup', '迁移备份', recovery.backupState === 'invalid' ? 'warning' : 'ok', recovery.backupState === 'valid' ? `最近备份：${String(recovery.backupCreatedAt || '时间未知')}` : recovery.backupState === 'invalid' ? '最近的迁移备份不完整' : '尚未产生此 Profile 的迁移备份', [], {
        action: recovery.backupState === 'invalid' ? remediation('open-recovery', '查看恢复中心') : null
      })
    ])
  ];

  const status = statusOf(groups);
  const checks = groups.flatMap(item => item.checks);
  const report = {
    schemaVersion: PROFILE_DIAGNOSIS_SCHEMA_VERSION,
    generatedAt: String(input.generatedAt || new Date().toISOString()),
    profile: {
      id: String(profile.id || ''),
      name: String(profile.name || 'Profile'),
      runtimeSource: profile.runtimeSource === 'default' ? 'default' : 'profile',
      usageSource: profile.usageSource === 'default' ? 'default' : 'profile',
      providerType: provider.type === 'custom' ? 'custom' : 'official',
      authMode: provider.type === 'custom' ? String(provider.authMode || 'environment') : 'official'
    },
    status,
    counts: {
      ok: checks.filter(item => item.status === 'ok').length,
      warning: checks.filter(item => item.status === 'warning').length,
      error: checks.filter(item => item.status === 'error').length,
      blocking: checks.filter(item => item.blocking).length
    },
    groups
  };
  return { ...report, readiness: summarizeProfileReadiness(report) };
}

function redactText(value) {
  return String(value || '')
    .replace(/(?:[a-z]:\\|\\\\|\/(?:users|home|root|var|tmp)\/)[^\s,，、]*/gi, '[path]')
    .replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, '[id]');
}

export function createProfileDiagnosisExport(report, options = {}) {
  if (!report || report.schemaVersion !== PROFILE_DIAGNOSIS_SCHEMA_VERSION || !Array.isArray(report.groups)) {
    throw new Error('Invalid Profile diagnosis report.');
  }
  const reference = createHash('sha256').update(String(report.profile?.id || '')).digest('hex').slice(0, 12);
  return {
    app: PROFILE_DIAGNOSIS_APP,
    kind: PROFILE_DIAGNOSIS_KIND,
    schemaVersion: PROFILE_DIAGNOSIS_SCHEMA_VERSION,
    appVersion: String(options.appVersion || ''),
    generatedAt: report.generatedAt,
    profile: {
      reference: `profile-${reference}`,
      runtimeSource: report.profile.runtimeSource,
      usageSource: report.profile.usageSource,
      providerType: report.profile.providerType,
      authMode: report.profile.authMode
    },
    status: report.status,
    counts: { ...report.counts },
    groups: report.groups.map(item => ({
      id: item.id,
      label: item.label,
      status: item.status,
      checks: item.checks.map(entry => ({
        id: entry.id,
        label: entry.label,
        status: entry.status,
        detail: redactText(entry.detail),
        items: safeItems(entry.items).map(redactText),
        blocking: entry.blocking === true,
        action: entry.action ? { ...entry.action, items: safeItems(entry.action.items).map(redactText) } : null
      }))
    }))
  };
}
