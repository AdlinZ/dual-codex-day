import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { auditPricing, diffPricing } from './lib/pricing-audit.mjs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const root = path.resolve(import.meta.dirname, '..');
const pricingPath = path.join(root, 'config', 'pricing.json');
const original = readFileSync(pricingPath, 'utf8');
const pricing = JSON.parse(original);
const audit = auditPricing(pricing, new Date('2026-08-25T12:00:00Z'));
assert(audit.status === 'warning', 'unverified legacy models should keep the snapshot in warning state');
assert(audit.counts.current === 4 && audit.counts.unverified === 5, 'pricing audit should distinguish individually verified models');
assert(!audit.issues.some(issue => issue.code === 'unofficial-source'), 'pricing audit should accept the official OpenAI documentation source');

const candidate = structuredClone(pricing);
candidate.version = 'candidate-test';
candidate.models['gpt-5.6-sol'].input = 4.25;
candidate.modes.standard.multiplier = 0.9;
candidate.models['gpt-test-new'] = { input: 1, cachedInput: 0.1, cacheWriteInput: null, output: 5, contextWindow: 100000 };
candidate.verification.models['gpt-test-new'] = '2026-08-25';
delete candidate.models['gpt-5.5-pro'];
const diff = diffPricing(pricing, candidate);
assert(diff.changed && diff.addedModels.includes('gpt-test-new') && diff.removedModels.includes('gpt-5.5-pro'), 'pricing diff should report added and removed models');
assert(diff.changedModels.some(item => item.model === 'gpt-5.6-sol' && item.changes.some(change => change.field === 'input')), 'pricing diff should report field-level rate changes');
assert(diff.configurationChanges.some(change => change.field === 'modes.standard.multiplier'), 'pricing diff should report field-level configuration changes');

const temporaryRoot = mkdtempSync(path.join(os.tmpdir(), 'codex-day-pricing-test-'));
try {
  const candidatePath = path.join(temporaryRoot, 'candidate.json');
  writeFileSync(candidatePath, JSON.stringify(candidate), 'utf8');
  const command = spawnSync(process.execPath, [path.join(root, 'scripts', 'codex-day.mjs'), 'pricing', '--candidate', candidatePath, '--json'], { cwd: root, encoding: 'utf8' });
  const output = JSON.parse(command.stdout);
  assert(command.status === 0 && output.diff.changed && output.diff.changedModels.length === 1 && output.diff.configurationChanges.length === 1, 'pricing command should return a complete read-only candidate preview');
  assert(readFileSync(pricingPath, 'utf8') === original, 'pricing command must not modify the active snapshot');
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true });
}

console.log('Pricing checks passed: verification audit, official source boundary, candidate diff, and read-only behavior.');
