import assert from 'node:assert/strict';
import { createProfileDiagnosisExport, diagnoseProfileEnvironment, summarizeProfileReadiness } from './lib/profile-doctor.mjs';

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
assert.equal(healthy.counts.blocking, 0);
assert.deepEqual(healthy.readiness, { state: 'ready', issueCount: 0, blockingCount: 0, actionCount: 0, primaryAction: null });
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
assert(degraded.counts.blocking >= 3, 'invalid config and missing credentials must block launches');
assert.equal(degraded.readiness.state, 'blocked');
assert.equal(degraded.readiness.primaryAction.type, 'open-profile-folder');
assert(degraded.groups.find(group => group.id === 'components').checks.some(item => item.items.includes('release-check')), 'missing component names must remain actionable in the local report');
assert.equal(degraded.groups.find(group => group.id === 'components').checks.find(item => item.id === 'skills').action.type, 'open-skills');
assert.equal(degraded.groups.find(group => group.id === 'usage').checks[0].blocking, false, 'usage diagnostics must remain actionable without blocking a client launch');

const signedOut = diagnoseProfileEnvironment({
  ...healthyInput,
  loginStatus: { state: 'signed-out', method: 'none' },
  recovery: { activeLaunches: 0, backupState: 'none' }
});
assert.equal(signedOut.readiness.state, 'attention');
assert.equal(signedOut.readiness.blockingCount, 0);
assert.deepEqual(signedOut.readiness.primaryAction, { type: 'launch-login', label: '打开 Codex 登录', target: 'desktop' });
assert.deepEqual(summarizeProfileReadiness(signedOut), signedOut.readiness);

const defaultAccount = diagnoseProfileEnvironment({
  ...healthyInput,
  profile: {
    ...healthyInput.profile,
    id: '00000000-0000-4000-8000-000000000000',
    name: '默认账号',
    runtimeSource: 'default',
    usageSource: 'default'
  },
  configuration: {
    registryValid: true,
    registryRequired: false,
    configExists: false,
    configValid: false,
    configRequired: false
  },
  recovery: { activeLaunches: 0, backupState: 'none' }
});
assert.equal(defaultAccount.groups.find(group => group.id === 'configuration').checks.find(item => item.id === 'config').status, 'ok', 'the built-in default account may use Codex defaults without a config.toml');
assert.equal(defaultAccount.groups.find(group => group.id === 'configuration').checks.find(item => item.id === 'registry').status, 'ok', 'the built-in default account must not require a Profile registry entry');
assert.equal(defaultAccount.readiness.state, 'ready', 'a healthy built-in default account must be launch-ready');

const exported = createProfileDiagnosisExport({
  ...degraded,
  groups: degraded.groups.map(group => ({
    ...group,
    checks: group.checks.map(item => item.id === 'skills'
      ? { ...item, detail: 'Missing C:\\Users\\Alice\\.codex\\skills', items: [...item.items, 'C:\\Users\\Alice\\private-skill'] }
      : item)
  }))
}, { appVersion: '0.23.0' });
const serialized = JSON.stringify(exported);
assert.equal(exported.profile.reference.length, 20);
assert(!serialized.includes('工作账号') && !serialized.includes(healthyInput.profile.id), 'diagnostic export must remove Profile names and internal ids');
assert(!/C:\\Users|Alice|private-skill/.test(serialized), 'diagnostic export must redact absolute paths and path-contained names');
assert(!/auth\.json|api.?key|secret/i.test(serialized), 'diagnostic export must not contain credential material or credential filenames');
assert.equal(exported.appVersion, '0.23.0');
assert.equal(exported.groups.find(group => group.id === 'components').checks.find(item => item.id === 'skills').action.type, 'open-skills');

assert.throws(() => createProfileDiagnosisExport({ schemaVersion: 99 }), /Invalid Profile diagnosis report/);
console.log('Profile doctor checks passed: severity, actionable groups, and sanitized export.');
