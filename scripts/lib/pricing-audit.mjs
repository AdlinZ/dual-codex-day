import { readFileSync } from 'node:fs';

const RATE_FIELDS = ['input', 'cachedInput', 'cacheWriteInput', 'output', 'contextWindow'];

function dateAge(dateValue, now) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateValue || ''))) return null;
  const value = new Date(`${dateValue}T00:00:00Z`);
  if (Number.isNaN(value.getTime())) return null;
  return Math.max(0, Math.floor((now.getTime() - value.getTime()) / 86400000));
}

function validRate(value, required = false) {
  if (value == null) return !required;
  return Number.isFinite(Number(value)) && Number(value) >= 0;
}

export function loadPricing(filePath) {
  const value = JSON.parse(readFileSync(filePath, 'utf8'));
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Pricing snapshot must be a JSON object.');
  return value;
}

export function auditPricing(pricing, now = new Date()) {
  const reviewAfterDays = Math.max(1, Number(pricing.verification?.reviewAfterDays || 45));
  const staleAfterDays = Math.max(reviewAfterDays, Number(pricing.verification?.staleAfterDays || 120));
  const rows = Object.entries(pricing.models || {}).map(([model, rates]) => {
    const verifiedAt = pricing.verification?.models?.[model] || null;
    const ageDays = dateAge(verifiedAt, now);
    const invalidRates = RATE_FIELDS.filter(field => !validRate(rates?.[field], ['input', 'output'].includes(field)));
    const status = invalidRates.length ? 'invalid'
      : ageDays == null ? 'unverified'
        : ageDays > staleAfterDays ? 'stale'
          : ageDays > reviewAfterDays ? 'review' : 'current';
    return { model, verifiedAt, ageDays, status, invalidRates };
  });
  const knownModels = new Set(rows.map(row => row.model));
  const orphanVerifications = Object.keys(pricing.verification?.models || {}).filter(model => !knownModels.has(model));
  const counts = Object.fromEntries(['current', 'review', 'stale', 'unverified', 'invalid'].map(status => [status, rows.filter(row => row.status === status).length]));
  const issues = [];
  if (!rows.length) issues.push({ code: 'no-models', level: 'error', message: 'The pricing snapshot contains no models.' });
  if (counts.invalid) issues.push({ code: 'invalid-rates', level: 'error', message: `${counts.invalid} models contain invalid rate fields.` });
  if (counts.unverified) issues.push({ code: 'unverified-models', level: 'warning', message: `${counts.unverified} models do not have an individual verification date.` });
  if (counts.review) issues.push({ code: 'review-due', level: 'warning', message: `${counts.review} models have reached the review threshold.` });
  if (counts.stale) issues.push({ code: 'stale-models', level: 'warning', message: `${counts.stale} models have stale verification dates.` });
  if (orphanVerifications.length) issues.push({ code: 'orphan-verifications', level: 'warning', message: `${orphanVerifications.length} verification entries do not match a configured model.` });
  const sourceUrl = String(pricing.source?.url || '');
  if (!/^https:\/\/(developers|platform)\.openai\.com\//.test(sourceUrl)) {
    issues.push({ code: 'unofficial-source', level: 'warning', message: 'The snapshot source is not an official OpenAI documentation URL.' });
  }
  return {
    status: issues.some(issue => issue.level === 'error') ? 'error' : issues.length ? 'warning' : 'ok',
    version: pricing.version || null,
    source: { capturedAt: pricing.source?.capturedAt || null, url: sourceUrl || null },
    thresholds: { reviewAfterDays, staleAfterDays },
    counts: { models: rows.length, ...counts },
    models: rows,
    orphanVerifications,
    issues
  };
}

function fieldChanges(current = {}, candidate = {}) {
  return RATE_FIELDS.filter(field => (current[field] ?? null) !== (candidate[field] ?? null))
    .map(field => ({ field, from: current[field] ?? null, to: candidate[field] ?? null }));
}

function flattenFields(value, prefix = '', output = new Map()) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    Object.keys(value).sort().forEach(key => flattenFields(value[key], prefix ? `${prefix}.${key}` : key, output));
  } else if (prefix) {
    output.set(prefix, value ?? null);
  }
  return output;
}

function configurationFields(pricing) {
  const { version: _version, models: _models, verification, ...root } = pricing;
  const verificationSettings = verification && typeof verification === 'object' && !Array.isArray(verification) ? { ...verification } : {};
  delete verificationSettings.models;
  return flattenFields({ ...root, verification: verificationSettings });
}

function configurationChanges(current, candidate) {
  const currentFields = configurationFields(current);
  const candidateFields = configurationFields(candidate);
  const paths = new Set([...currentFields.keys(), ...candidateFields.keys()]);
  return [...paths].sort()
    .filter(field => JSON.stringify(currentFields.get(field) ?? null) !== JSON.stringify(candidateFields.get(field) ?? null))
    .map(field => ({ field, from: currentFields.get(field) ?? null, to: candidateFields.get(field) ?? null }));
}

export function diffPricing(current, candidate) {
  const currentModels = current.models || {};
  const candidateModels = candidate.models || {};
  const currentIds = new Set(Object.keys(currentModels));
  const candidateIds = new Set(Object.keys(candidateModels));
  const addedModels = [...candidateIds].filter(model => !currentIds.has(model)).sort();
  const removedModels = [...currentIds].filter(model => !candidateIds.has(model)).sort();
  const changedModels = [...currentIds].filter(model => candidateIds.has(model))
    .map(model => ({ model, changes: fieldChanges(currentModels[model], candidateModels[model]) }))
    .filter(item => item.changes.length)
    .sort((a, b) => a.model.localeCompare(b.model));
  const verificationIds = new Set([...Object.keys(current.verification?.models || {}), ...Object.keys(candidate.verification?.models || {})]);
  const verificationChanges = [...verificationIds].filter(model => (current.verification?.models?.[model] || null) !== (candidate.verification?.models?.[model] || null))
    .map(model => ({ model, from: current.verification?.models?.[model] || null, to: candidate.verification?.models?.[model] || null }))
    .sort((a, b) => a.model.localeCompare(b.model));
  const configChanges = configurationChanges(current, candidate);
  return {
    changed: Boolean(addedModels.length || removedModels.length || changedModels.length || verificationChanges.length || configChanges.length || current.version !== candidate.version),
    version: { from: current.version || null, to: candidate.version || null },
    addedModels,
    removedModels,
    changedModels,
    verificationChanges,
    configurationChanges: configChanges
  };
}
