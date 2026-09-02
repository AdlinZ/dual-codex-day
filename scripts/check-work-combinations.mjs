import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  findWorkCombination,
  listWorkCombinations,
  loadWorkCombinations,
  MAX_PINNED_WORK_COMBINATIONS,
  MAX_WORK_COMBINATIONS,
  recordWorkCombination,
  removeWorkCombination,
  setWorkCombinationPinned,
  updateWorkCombinationWorkspace,
  WORK_COMBINATION_SCHEMA_VERSION
} from './lib/work-combination-store.mjs';

const root = mkdtempSync(path.join(os.tmpdir(), 'dual-codex-day-work-'));
const profileId = '11111111-1111-4111-8111-111111111111';

try {
  assert.deepEqual(loadWorkCombinations(root), { schemaVersion: WORK_COMBINATION_SCHEMA_VERSION, items: [] });
  const alpha = path.join(root, 'alpha');
  const beta = path.join(root, 'beta');
  mkdirSync(alpha);
  mkdirSync(beta);

  const first = recordWorkCombination(root, {
    profileId,
    workspace: alpha,
    target: 'desktop',
    usedAt: '2026-09-02T01:00:00.000Z'
  });
  const repeated = recordWorkCombination(root, {
    profileId,
    workspace: alpha,
    target: 'desktop',
    usedAt: '2026-09-02T02:00:00.000Z'
  });
  assert.equal(first.id, repeated.id);
  assert.equal(repeated.useCount, 2);
  assert.equal(listWorkCombinations(root)[0].lastUsedAt, '2026-09-02T02:00:00.000Z');

  const second = recordWorkCombination(root, {
    profileId,
    workspace: alpha,
    target: 'vscode',
    usedAt: '2026-09-02T03:00:00.000Z'
  });
  setWorkCombinationPinned(root, first.id, true);
  assert.equal(findWorkCombination(root, first.id).pinned, true);

  const updated = updateWorkCombinationWorkspace(root, second.id, beta);
  assert.equal(updated.workspace, path.resolve(beta));
  const duplicate = recordWorkCombination(root, {
    profileId,
    workspace: alpha,
    target: 'vscode',
    usedAt: '2026-09-02T04:00:00.000Z'
  });
  const merged = updateWorkCombinationWorkspace(root, second.id, alpha);
  assert.equal(merged.id, duplicate.id, 'repairing to an existing combination must consolidate duplicates');
  assert.equal(removeWorkCombination(root, merged.id).id, merged.id);
  assert.equal(listWorkCombinations(root).length, 1);

  for (let index = 0; index < MAX_WORK_COMBINATIONS + 6; index += 1) {
    const directory = path.join(root, `recent-${index}`);
    mkdirSync(directory);
    recordWorkCombination(root, {
      profileId,
      workspace: directory,
      target: 'cli',
      usedAt: new Date(Date.UTC(2026, 8, 3, 0, index)).toISOString()
    });
  }
  const bounded = listWorkCombinations(root);
  assert.equal(bounded.length, MAX_WORK_COMBINATIONS);
  assert(bounded.some(item => item.id === first.id && item.pinned), 'pinned work must survive recent-item retention');

  const pinCandidates = bounded.filter(item => !item.pinned).slice(0, MAX_PINNED_WORK_COMBINATIONS);
  pinCandidates.slice(0, MAX_PINNED_WORK_COMBINATIONS - 1).forEach(item => setWorkCombinationPinned(root, item.id, true));
  assert.throws(
    () => setWorkCombinationPinned(root, pinCandidates.at(-1).id, true),
    /At most 8/,
    'pinning must enforce a bounded persistent list'
  );

  assert.throws(() => recordWorkCombination(root, { profileId, workspace: 'relative', target: 'desktop' }), /absolute/);
  assert.throws(() => recordWorkCombination(root, { profileId, workspace: path.join(root, 'missing'), target: 'desktop' }), /unavailable/);
  const invalidTimestamp = loadWorkCombinations(root);
  invalidTimestamp.items[0].lastUsedAt = 'invalid';
  writeFileSync(path.join(root, 'work-combinations.json'), JSON.stringify(invalidTimestamp), 'utf8');
  assert.throws(() => loadWorkCombinations(root), /valid timestamp/);
  writeFileSync(path.join(root, 'work-combinations.json'), '{broken', 'utf8');
  assert.throws(() => loadWorkCombinations(root), /Cannot read work combinations/);

  console.log('Work combination checks passed: recent deduplication, pinning, retention, repair, removal, and corruption handling.');
} finally {
  rmSync(root, { recursive: true, force: true });
}
