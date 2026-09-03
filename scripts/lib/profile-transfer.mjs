import { parse as parseToml } from 'smol-toml';

export const PROFILE_TRANSFER_APP = 'dual-codex-day';
export const PROFILE_TRANSFER_KIND = 'profile-transfer';
export const PROFILE_TRANSFER_SCHEMA_VERSION = 1;

const forbiddenKey = /(?:api.?key|access.?token|secret|password|credential|authorization|cookie|http.?headers?|env.?http.?headers?)/i;
const forbiddenObjectKeys = new Set(['__proto__', 'constructor', 'prototype']);
const supportedCostModes = new Set(['standard', 'batch', 'flex', 'fast']);
const supportedReviewPeriods = new Set(['week', 'month']);

function plainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function cloneSanitized(value, path = []) {
  if (Array.isArray(value)) return value.map((item, index) => cloneSanitized(item, [...path, String(index)]));
  if (!plainObject(value)) return value;
  const output = {};
  for (const [key, item] of Object.entries(value)) {
    if (forbiddenObjectKeys.has(key) || forbiddenKey.test(key)) continue;
    output[key] = cloneSanitized(item, [...path, key]);
  }
  return output;
}

function assertSafeConfig(value, path = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertSafeConfig(item, [...path, String(index)]));
    return;
  }
  if (!plainObject(value)) return;
  for (const [key, item] of Object.entries(value)) {
    if (forbiddenObjectKeys.has(key) || forbiddenKey.test(key)) {
      throw new Error(`Profile transfer contains a forbidden setting: ${[...path, key].join('.')}`);
    }
    assertSafeConfig(item, [...path, key]);
  }
}

function normalizeInventoryItems(items, label) {
  if (!Array.isArray(items)) throw new Error(`Profile transfer ${label} inventory must be a list.`);
  const seen = new Set();
  return items.map(item => {
    const id = String(item?.id || item?.name || '').trim();
    if (!id || id.length > 160 || /[\u0000-\u001f\u007f]/.test(id)) throw new Error(`Profile transfer contains an invalid ${label} id.`);
    if (seen.has(id)) throw new Error(`Profile transfer contains a duplicate ${label} id: ${id}`);
    seen.add(id);
    return { id, enabled: item?.enabled !== false };
  }).sort((a, b) => a.id.localeCompare(b.id));
}

export function normalizeTransferPreferences(value = {}) {
  const relayMultiplier = Math.max(0, Number(value?.relayMultiplier ?? 1));
  const monthlyBudget = Math.max(0, Number(value?.monthlyBudget || 0));
  const costMode = supportedCostModes.has(String(value?.costMode || 'standard')) ? String(value.costMode || 'standard') : 'standard';
  const reviewPeriod = supportedReviewPeriods.has(String(value?.reviewPeriod || 'week')) ? String(value.reviewPeriod || 'week') : 'week';
  if (!Number.isFinite(relayMultiplier) || !Number.isFinite(monthlyBudget)) throw new Error('Profile transfer contains invalid usage preferences.');
  return { relayMultiplier, monthlyBudget, costMode, reviewPeriod };
}

export function portableConfig(configText = '') {
  const parsed = String(configText || '').trim() ? parseToml(String(configText)) : {};
  const activeProviderId = typeof parsed.model_provider === 'string' ? parsed.model_provider : '';
  delete parsed.model;
  delete parsed.model_provider;
  delete parsed.model_reasoning_effort;
  delete parsed.personality;
  delete parsed.disable_response_storage;
  delete parsed.cli_auth_credentials_store;
  delete parsed.skills;
  delete parsed.plugins;
  if (activeProviderId && plainObject(parsed.model_providers)) {
    delete parsed.model_providers[activeProviderId];
    if (!Object.keys(parsed.model_providers).length) delete parsed.model_providers;
  }
  return cloneSanitized(parsed);
}

export function createProfileTransfer({ appVersion, profile, configText, skills = [], plugins = [], preferences = {}, exportedAt = new Date().toISOString() }) {
  return {
    app: PROFILE_TRANSFER_APP,
    kind: PROFILE_TRANSFER_KIND,
    schemaVersion: PROFILE_TRANSFER_SCHEMA_VERSION,
    exportedAt,
    sourceVersion: String(appVersion || ''),
    profile: {
      name: profile.name,
      usageSource: profile.usageSource,
      runtimeSource: profile.runtimeSource,
      provider: cloneSanitized(profile.provider)
    },
    commonConfig: portableConfig(configText),
    inventory: {
      skills: normalizeInventoryItems(skills, 'Skill'),
      plugins: normalizeInventoryItems(plugins, 'plugin')
    },
    preferences: normalizeTransferPreferences(preferences)
  };
}

export function parseProfileTransfer(value) {
  let transfer;
  try {
    transfer = typeof value === 'string' ? JSON.parse(value) : structuredClone(value);
  } catch (error) {
    throw new Error(`Profile transfer is not valid JSON: ${error.message}`);
  }
  if (!plainObject(transfer) || transfer.app !== PROFILE_TRANSFER_APP || transfer.kind !== PROFILE_TRANSFER_KIND) {
    throw new Error('The selected file is not a Dual Codex Day Profile transfer.');
  }
  if (transfer.schemaVersion !== PROFILE_TRANSFER_SCHEMA_VERSION) {
    throw new Error(`Unsupported Profile transfer schema ${transfer.schemaVersion}; expected ${PROFILE_TRANSFER_SCHEMA_VERSION}.`);
  }
  if (!plainObject(transfer.profile) || !plainObject(transfer.profile.provider) || !plainObject(transfer.commonConfig)) {
    throw new Error('Profile transfer is missing required configuration sections.');
  }
  if (!plainObject(transfer.inventory)) throw new Error('Profile transfer is missing its environment inventory.');
  assertSafeConfig(transfer);
  transfer.inventory = {
    skills: normalizeInventoryItems(transfer.inventory.skills, 'Skill'),
    plugins: normalizeInventoryItems(transfer.inventory.plugins, 'plugin')
  };
  transfer.preferences = normalizeTransferPreferences(transfer.preferences);
  return transfer;
}

export function transferDiff(transfer, targetProfile = null, available = {}) {
  const changes = [];
  const compare = (field, label, current, next) => {
    if (JSON.stringify(current) !== JSON.stringify(next)) changes.push({ field, label, current, next });
  };
  if (targetProfile) {
    compare('name', '显示名称', targetProfile.name, transfer.profile.name);
    compare('provider', '供应商设置', targetProfile.provider, transfer.profile.provider);
    compare('runtimeSource', '运行来源', targetProfile.runtimeSource, transfer.profile.runtimeSource);
    compare('usageSource', '用量来源', targetProfile.usageSource, transfer.profile.usageSource);
    changes.push({ field: 'commonConfig', label: '通用 config.toml', current: '当前配置', next: '导入配置' });
  } else {
    changes.push({ field: 'create', label: '新建 Profile', current: '不存在', next: transfer.profile.name });
  }
  const itemId = item => String(plainObject(item) ? item.id : item);
  const skillSet = new Set((available.skills || []).map(itemId));
  const pluginSet = new Set((available.plugins || []).map(itemId));
  const providerIdentity = provider => provider?.type === 'custom'
    ? [provider.type, provider.providerId, provider.baseUrl, provider.authMode]
    : [provider?.type || 'official'];
  const credentialRequired = transfer.profile.provider.type === 'custom'
    && transfer.profile.provider.authMode === 'environment'
    && (!targetProfile || JSON.stringify(providerIdentity(targetProfile.provider)) !== JSON.stringify(providerIdentity(transfer.profile.provider)));
  return {
    action: targetProfile ? 'update' : 'create',
    targetProfileId: targetProfile?.id || null,
    profileName: transfer.profile.name,
    sourceVersion: transfer.sourceVersion || '',
    changes,
    missingSkills: transfer.inventory.skills.filter(item => !skillSet.has(item.id)).map(item => item.id),
    missingPlugins: transfer.inventory.plugins.filter(item => !pluginSet.has(item.id)).map(item => item.id),
    credentialRequired,
    preferences: transfer.preferences
  };
}
