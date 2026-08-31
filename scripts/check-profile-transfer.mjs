import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parse as parseToml } from 'smol-toml';
import {
  applyProfileTransfer,
  createProfile,
  exportProfileTransfer,
  findProfile,
  listProfiles,
  previewProfileTransfer,
  updateProfileProvider
} from './lib/profile-store.mjs';
import { parseProfileTransfer } from './lib/profile-transfer.mjs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertThrows(callback, pattern, message) {
  try { callback(); }
  catch (error) {
    assert(pattern.test(error.message), message);
    return;
  }
  throw new Error(message);
}

const temporaryRoot = mkdtempSync(path.join(os.tmpdir(), 'codex-day-profile-transfer-test-'));
const sourceRoot = path.join(temporaryRoot, 'source');
const targetRoot = path.join(temporaryRoot, 'target');

try {
  let source = createProfile(sourceRoot, '迁移账号');
  source = updateProfileProvider(sourceRoot, source.id, {
    type: 'custom',
    name: '公司中转站',
    note: '开发环境',
    baseUrl: 'https://relay.example.test/v1',
    model: 'gpt-test',
    providerId: 'company',
    authMode: 'environment',
    reasoningEffort: 'high',
    personality: 'pragmatic',
    disableResponseStorage: true
  });
  const sourceSkill = path.join(source.paths.codexHome, 'skills', 'release-check');
  mkdirSync(sourceSkill, { recursive: true });
  writeFileSync(path.join(sourceSkill, 'SKILL.md'), '# Release check\n');
  writeFileSync(path.join(source.paths.codexHome, 'provider-key.bin'), 'encrypted-secret');
  writeFileSync(path.join(source.paths.codexHome, 'auth.json'), '{"token":"secret"}');
  writeFileSync(path.join(source.paths.codexHome, 'config.toml'), `
model = "gpt-test"
model_provider = "company"
api_key = "must-not-export"
notify = ["notify.exe", "done"]

[model_providers.company]
name = "公司中转站"
base_url = "https://relay.example.test/v1"
wire_api = "responses"
env_key = "DUAL_CODEX_DAY_PROVIDER_API_KEY"

[features]
js_repl = true

[mcp_servers.figma]
command = "figma-bridge"

[[skills.config]]
path = ${JSON.stringify(path.join(sourceSkill, 'SKILL.md'))}
enabled = false

[plugins."openai-docs@openai"]
enabled = false
`);

  const transfer = exportProfileTransfer(sourceRoot, source.id, {
    appVersion: '0.18.0',
    plugins: [{ id: 'openai-docs@openai', enabled: false }],
    preferences: { relayMultiplier: 1.25, monthlyBudget: 50, costMode: 'fast' },
    exportedAt: '2026-08-31T00:00:00.000Z'
  });
  const serialized = JSON.stringify(transfer);
  assert(!/must-not-export|encrypted-secret|auth\.json|provider-key\.bin/.test(serialized), 'transfer JSON must not contain credentials or credential filenames');
  assert(transfer.commonConfig.features.js_repl === true && transfer.commonConfig.mcp_servers.figma.command === 'figma-bridge', 'portable common config must retain normal Codex settings');
  assert(!transfer.commonConfig.skills && !transfer.commonConfig.plugins && !transfer.commonConfig.api_key, 'portable common config must remove paths, component state, and sensitive settings');
  assert(transfer.inventory.skills[0].id === 'release-check' && transfer.inventory.skills[0].enabled === false, 'export must retain Profile-local Skill state by directory name');

  assertThrows(() => parseProfileTransfer({ ...transfer, schemaVersion: 99 }), /Unsupported Profile transfer schema/, 'unknown transfer schemas must be rejected');
  const malicious = JSON.parse(serialized);
  malicious.profile.provider.apiKey = 'secret';
  assertThrows(() => parseProfileTransfer(malicious), /forbidden setting/, 'sensitive provider fields must be rejected before normalization');

  const initialPreview = previewProfileTransfer(targetRoot, transfer, { available: { skills: [], plugins: [] } }).preview;
  assert(initialPreview.action === 'create' && initialPreview.credentialRequired, 'a custom environment provider must preview as a new Profile requiring credentials');
  assert(initialPreview.missingSkills[0] === 'release-check' && initialPreview.missingPlugins[0] === 'openai-docs@openai', 'preview must report unavailable Skills and plugins');

  const installedSkill = path.join(targetRoot, 'installed', 'release-check', 'SKILL.md');
  mkdirSync(path.dirname(installedSkill), { recursive: true });
  writeFileSync(installedSkill, '# Installed release check\n');
  const available = {
    skills: [{ id: 'release-check', path: installedSkill }],
    plugins: [{ id: 'openai-docs@openai' }]
  };
  const applied = applyProfileTransfer(targetRoot, transfer, { available });
  assert(applied.profile.name === '迁移账号' && applied.preview.action === 'create', 'apply must create a missing Profile');
  assert(applied.preferences.monthlyBudget === 50 && applied.preferences.costMode === 'fast', 'apply must return portable usage preferences for the renderer');
  assert(existsSync(path.join(applied.backupPath, 'backup.json')), 'apply must create backup metadata before writing');
  const appliedBackup = JSON.parse(readFileSync(path.join(applied.backupPath, 'backup.json'), 'utf8'));
  assert(appliedBackup.targetProfileId === applied.profile.id && appliedBackup.completedAt, 'successful imports must associate backup metadata with the target Profile');
  const appliedConfig = parseToml(readFileSync(path.join(applied.profile.paths.codexHome, 'config.toml'), 'utf8'));
  assert(appliedConfig.model_provider === 'company' && appliedConfig.features.js_repl === true, 'apply must combine imported common config with the imported provider');
  assert(appliedConfig.skills.config[0].path === path.resolve(installedSkill) && appliedConfig.skills.config[0].enabled === false, 'apply must rebuild Skill paths from the target environment');
  assert(appliedConfig.plugins['openai-docs@openai'].enabled === false, 'apply must restore available plugin state');
  assert(!existsSync(path.join(applied.profile.paths.codexHome, 'auth.json')), 'apply must never create or copy auth.json');

  const updatePreview = previewProfileTransfer(targetRoot, transfer, { available }).preview;
  assert(updatePreview.action === 'update' && !updatePreview.credentialRequired, 'an unchanged provider identity may keep an existing local credential');
  writeFileSync(path.join(applied.profile.paths.codexHome, 'config.toml'), 'notify = ["before-rollback"]\n');
  const registryBefore = readFileSync(path.join(targetRoot, 'profiles.json'), 'utf8');
  const configBefore = readFileSync(path.join(applied.profile.paths.codexHome, 'config.toml'), 'utf8');
  assertThrows(() => applyProfileTransfer(targetRoot, transfer, {
    available,
    afterConfigWrite: () => { throw new Error('simulated write interruption'); }
  }), /simulated write interruption/, 'apply must surface a write failure');
  assert(readFileSync(path.join(targetRoot, 'profiles.json'), 'utf8') === registryBefore, 'failed update must restore the registry');
  assert(readFileSync(path.join(applied.profile.paths.codexHome, 'config.toml'), 'utf8') === configBefore, 'failed update must restore config.toml');

  const failedCreateRoot = path.join(temporaryRoot, 'failed-create');
  assertThrows(() => applyProfileTransfer(failedCreateRoot, transfer, {
    available,
    afterConfigWrite: () => { throw new Error('simulated new Profile interruption'); }
  }), /simulated new Profile interruption/, 'failed create must surface its original error');
  assert(listProfiles(failedCreateRoot).length === 0, 'failed create must restore the previous empty registry');
  const failedBackups = readdirSync(path.join(failedCreateRoot, 'backups')).map(name => path.join(failedCreateRoot, 'backups', name));
  assert(failedBackups.some(item => existsSync(path.join(item, 'failed-profile-data'))), 'failed new Profile data must be preserved inside its backup');
  assertThrows(() => findProfile(failedCreateRoot, '迁移账号'), /Profile not found/, 'failed create must not leave a selectable Profile');

  const invalidRuntime = structuredClone(transfer);
  invalidRuntime.profile.runtimeSource = 'default';
  assertThrows(() => previewProfileTransfer(targetRoot, invalidRuntime), /isolated Profile runtime/, 'custom providers must reject the system-default runtime during preview');

  console.log('Profile transfer checks passed: sanitized export, preview, apply, backup, and rollback.');
} finally {
  const resolved = path.resolve(temporaryRoot);
  if (resolved.startsWith(path.resolve(os.tmpdir())) && path.basename(resolved).startsWith('codex-day-profile-transfer-test-')) {
    rmSync(resolved, { recursive: true, force: true });
  }
}
