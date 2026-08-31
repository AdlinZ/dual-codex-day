import assert from 'node:assert/strict';
import { createProfileDiagnosisExport, diagnoseProfileEnvironment } from './lib/profile-doctor.mjs';

const healthyInput = {
  generatedAt: '2026-08-31T08:00:00.000Z',
  profile: {
    id: '11111111-1111-4111-8111-111111111111',
    name: '工作账号',
    runtimeSource: 'profile',
    usageSource: 'profile',
    provider: { type: 'official' }
  },
  configuration: { registryValid: true, configExists: true, configValid: true },
  directories: { runtimeAvailable: true, usageAvailable: true },
  credentialStorageAvailable: true,
  loginStatus: { state: 'authenticated', method: 'chatgpt' },
  targets: { cli: { available: true }, vscode: { available: true }, desktop: { available: true } },
  components: { configuredSkills: 2, missingSkills: [], installedPlugins: 1, missingPlugins: [], pluginFailureCount: 0 },
  usage: { available: true, status: 'ok' },
  recovery: { activeLaunches: 1, backupState: 'valid', backupCreatedAt: '2026-08-31T07:30:00.000Z' }
};

const healthy = diagnoseProfileEnvironment(healthyInput);
assert.equal(healthy.status, 'ok');
assert.equal(healthy.counts.error, 0);
assert.equal(healthy.groups.length, 6);

const degraded = diagnoseProfileEnvironment({
  ...healthyInput,
  profile: { ...healthyInput.profile, provider: { type: 'custom', authMode: 'environment' } },
  configuration: { registryValid: true, configExists: true, configValid: false },
  directories: { runtimeAvailable: true, usageAvailable: false },
  credentialStorageAvailable: false,
  loginStatus: { state: 'missing', method: 'provider-key' },
  targets: { cli: { available: false }, vscode: { available: true }, desktop: { available: false } },
  components: {
    configuredSkills: 3,
    missingSkills: ['release-check'],
    installedPlugins: 0,
    missingPlugins: ['openai-docs@openai'],
    pluginFailureCount: 1
  },
  usage: { available: false, status: 'error' },
  recovery: { activeLaunches: 0, backupState: 'invalid' }
});
assert.equal(degraded.status, 'error');
assert(degraded.counts.error >= 3 && degraded.counts.warning >= 4, 'degraded diagnostics must preserve error and warning severity');
assert(degraded.groups.find(group => group.id === 'components').checks.some(item => item.items.includes('release-check')), 'missing component names must remain actionable in the local report');

const exported = createProfileDiagnosisExport({
  ...degraded,
  groups: degraded.groups.map(group => ({
    ...group,
    checks: group.checks.map(item => item.id === 'skills'
      ? { ...item, detail: 'Missing C:\\Users\\Alice\\.codex\\skills', items: [...item.items, 'C:\\Users\\Alice\\private-skill'] }
      : item)
  }))
}, { appVersion: '0.20.0' });
const serialized = JSON.stringify(exported);
assert.equal(exported.profile.reference.length, 20);
assert(!serialized.includes('工作账号') && !serialized.includes(healthyInput.profile.id), 'diagnostic export must remove Profile names and internal ids');
assert(!/C:\\Users|Alice|private-skill/.test(serialized), 'diagnostic export must redact absolute paths and path-contained names');
assert(!/auth\.json|api.?key|secret/i.test(serialized), 'diagnostic export must not contain credential material or credential filenames');
assert.equal(exported.appVersion, '0.20.0');

assert.throws(() => createProfileDiagnosisExport({ schemaVersion: 99 }), /Invalid Profile diagnosis report/);
console.log('Profile doctor checks passed: severity, actionable groups, and sanitized export.');
