import assert from 'node:assert/strict';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  applyProfileRecovery,
  applyProfileTransfer,
  createProfile,
  exportProfileTransfer,
  findProfile,
  listProfileRecoveryBackups,
  listProfiles,
  previewProfileRecovery,
  updateProfileProvider,
  updateProfileUsageSource
} from './lib/profile-store.mjs';

const temporaryRoot = mkdtempSync(path.join(os.tmpdir(), 'codex-day-profile-recovery-test-'));
const sourceRoot = path.join(temporaryRoot, 'source');
const targetRoot = path.join(temporaryRoot, 'target');

function copyBackup(source, target) {
  mkdirSync(target, { recursive: true });
  for (const filename of ['backup.json', 'profiles.json', 'config.toml']) {
    const sourceFile = path.join(source, filename);
    if (existsSync(sourceFile)) copyFileSync(sourceFile, path.join(target, filename));
  }
}

try {
  let source = createProfile(sourceRoot, '恢复账号');
  source = updateProfileProvider(sourceRoot, source.id, {
    type: 'custom',
    name: '迁移供应商',
    baseUrl: 'https://relay.example.test/v1',
    model: 'gpt-recovery',
    providerId: 'recovery',
    authMode: 'none'
  });
  writeFileSync(path.join(source.paths.codexHome, 'config.toml'), 'model = "gpt-recovery"\n');
  const transfer = exportProfileTransfer(sourceRoot, source.id, { appVersion: '0.21.0' });

  let target = createProfile(targetRoot, '恢复账号');
  target = updateProfileUsageSource(targetRoot, target.id, 'default');
  const other = createProfile(targetRoot, '其他账号');
  const originalConfig = 'model = "gpt-original"\n[features]\njs_repl = true\n';
  writeFileSync(path.join(target.paths.codexHome, 'config.toml'), originalConfig);
  writeFileSync(path.join(target.paths.root, 'provider-key.bin'), 'encrypted-credential');
  writeFileSync(path.join(target.paths.codexHome, 'session.log'), 'keep-log');
  writeFileSync(path.join(target.paths.codexHome, 'state.sqlite'), 'keep-sqlite');
  writeFileSync(path.join(other.paths.codexHome, 'config.toml'), 'model = "other"\n');

  const otherBefore = findProfile(targetRoot, other.id);
  const appliedTransfer = applyProfileTransfer(targetRoot, transfer);
  assert.equal(appliedTransfer.preview.action, 'update');
  const backupId = path.basename(appliedTransfer.backupPath);
  const backups = listProfileRecoveryBackups(targetRoot, target.id);
  const recoverable = backups.find(item => item.id === backupId);
  assert.equal(recoverable?.status, 'valid');
  assert.equal(recoverable.action, 'update');
  assert.equal(recoverable.recoverable.profileRegistry, true);
  assert.equal(recoverable.recoverable.config, true);
  assert(recoverable.registryChanges.includes('provider') && recoverable.registryChanges.includes('usageSource'));
  assert.equal(recoverable.configChange, 'replace');

  const selected = previewProfileRecovery(targetRoot, target.id, backupId);
  assert.throws(() => applyProfileRecovery(targetRoot, target.id, backupId, {
    expectedFingerprint: selected.fingerprint,
    isProfileRunning: () => true
  }), /正在运行/);
  assert.throws(() => previewProfileRecovery(targetRoot, target.id, '../outside'), /备份标识|超出恢复目录/);
  assert.throws(() => previewProfileRecovery(targetRoot, other.id, backupId), /其他 Profile/);

  const restored = applyProfileRecovery(targetRoot, target.id, backupId, {
    expectedFingerprint: selected.fingerprint,
    isProfileRunning: () => false
  });
  assert.equal(restored.profile.usageSource, 'default');
  assert.equal(restored.profile.provider.type, 'official');
  assert.equal(readFileSync(path.join(restored.profile.paths.codexHome, 'config.toml'), 'utf8'), originalConfig);
  assert.equal(readFileSync(path.join(restored.profile.paths.root, 'provider-key.bin'), 'utf8'), 'encrypted-credential');
  assert.equal(readFileSync(path.join(restored.profile.paths.codexHome, 'session.log'), 'utf8'), 'keep-log');
  assert.equal(readFileSync(path.join(restored.profile.paths.codexHome, 'state.sqlite'), 'utf8'), 'keep-sqlite');
  assert.deepEqual(findProfile(targetRoot, other.id), otherBefore);
  assert(existsSync(path.join(restored.protectionPath, 'backup.json')), 'recovery must create a protection backup');

  updateProfileUsageSource(targetRoot, target.id, 'profile');
  writeFileSync(path.join(target.paths.codexHome, 'config.toml'), 'model = "before-failed-recovery"\n');
  const registryBeforeFailure = readFileSync(path.join(targetRoot, 'profiles.json'), 'utf8');
  const configBeforeFailure = readFileSync(path.join(target.paths.codexHome, 'config.toml'), 'utf8');
  const retry = previewProfileRecovery(targetRoot, target.id, backupId);
  assert.throws(() => applyProfileRecovery(targetRoot, target.id, backupId, {
    expectedFingerprint: retry.fingerprint,
    afterRestoreWrite: () => { throw new Error('simulated recovery interruption'); }
  }), /simulated recovery interruption/);
  assert.equal(readFileSync(path.join(targetRoot, 'profiles.json'), 'utf8'), registryBeforeFailure);
  assert.equal(readFileSync(path.join(target.paths.codexHome, 'config.toml'), 'utf8'), configBeforeFailure);

  const damagedId = `profile-transfer-damaged-${Date.now()}`;
  const damagedPath = path.join(targetRoot, 'backups', damagedId);
  copyBackup(appliedTransfer.backupPath, damagedPath);
  writeFileSync(path.join(damagedPath, 'config.toml'), 'model = "tampered"\n');
  assert.equal(listProfileRecoveryBackups(targetRoot, target.id).find(item => item.id === damagedId)?.status, 'invalid');
  assert.throws(() => previewProfileRecovery(targetRoot, target.id, damagedId), /完整性校验失败/);

  const incompleteId = `profile-transfer-incomplete-${Date.now()}`;
  const incompletePath = path.join(targetRoot, 'backups', incompleteId);
  copyBackup(appliedTransfer.backupPath, incompletePath);
  unlinkSync(path.join(incompletePath, 'profiles.json'));
  assert.equal(listProfileRecoveryBackups(targetRoot, target.id).find(item => item.id === incompleteId)?.status, 'invalid');

  const createRoot = path.join(temporaryRoot, 'created-target');
  const createdTransfer = applyProfileTransfer(createRoot, transfer);
  const creationBackups = listProfileRecoveryBackups(createRoot, createdTransfer.profile.id);
  assert.equal(creationBackups.find(item => item.id === path.basename(createdTransfer.backupPath))?.status, 'invalid');
  assert.throws(() => previewProfileRecovery(createRoot, createdTransfer.profile.id, path.basename(createdTransfer.backupPath)), /只支持已完成的 Profile 更新备份/);

  const protectionNames = readdirSync(path.join(targetRoot, 'backups')).filter(name => name.startsWith('profile-recovery-protection-'));
  assert(protectionNames.length >= 2, 'successful and failed recovery attempts must each create a protection backup');
  assert.equal(listProfiles(targetRoot).length, 2);
  console.log('Profile recovery checks passed: validation, preview tokens, scoped restore, protection backup, and rollback.');
} finally {
  const resolved = path.resolve(temporaryRoot);
  if (resolved.startsWith(path.resolve(os.tmpdir())) && path.basename(resolved).startsWith('codex-day-profile-recovery-test-')) {
    rmSync(resolved, { recursive: true, force: true });
  }
}
