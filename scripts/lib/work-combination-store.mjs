import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';

export const WORK_COMBINATION_SCHEMA_VERSION = 1;
export const MAX_WORK_COMBINATIONS = 24;
export const MAX_PINNED_WORK_COMBINATIONS = 8;
const WORK_TARGETS = new Set(['cli', 'vscode', 'desktop']);

function storePath(root) {
  return path.join(path.resolve(root), 'work-combinations.json');
}

function emptyStore() {
  return { schemaVersion: WORK_COMBINATION_SCHEMA_VERSION, items: [] };
}

function normalizeTimestamp(value, label, allowDefault = false) {
  const source = value === undefined || value === null || value === ''
    ? allowDefault ? Date.now() : null
    : value;
  if (source === null) throw new Error(`${label} must be a valid timestamp.`);
  const date = new Date(source);
  if (Number.isNaN(date.valueOf())) throw new Error(`${label} must be a valid timestamp.`);
  return date.toISOString();
}

function normalizeWorkspace(value, { requireDirectory = false } = {}) {
  if (typeof value !== 'string' || !value.trim() || value.includes('\0')) throw new Error('Workspace path is required.');
  const requested = value.trim();
  if (!path.isAbsolute(requested)) throw new Error('Workspace path must be absolute.');
  const workspace = path.normalize(requested);
  if (requireDirectory) {
    if (!existsSync(workspace) || !statSync(workspace).isDirectory()) throw new Error('Workspace directory is unavailable.');
  }
  return workspace;
}

function validateItem(item) {
  if (!item || typeof item.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(item.id)) throw new Error('Work combination has an invalid id.');
  if (typeof item.profileId !== 'string' || !/^[0-9a-f-]{36}$/i.test(item.profileId)) throw new Error('Work combination has an invalid Profile id.');
  const target = String(item.target || '').toLowerCase();
  if (!WORK_TARGETS.has(target)) throw new Error('Work combination has an unsupported target.');
  return {
    id: item.id,
    profileId: item.profileId,
    workspace: normalizeWorkspace(item.workspace),
    target,
    pinned: item.pinned === true,
    useCount: Math.max(1, Math.floor(Number(item.useCount) || 1)),
    createdAt: normalizeTimestamp(item.createdAt, 'createdAt'),
    lastUsedAt: normalizeTimestamp(item.lastUsedAt, 'lastUsedAt')
  };
}

function validateStore(store) {
  if (!store || store.schemaVersion !== WORK_COMBINATION_SCHEMA_VERSION || !Array.isArray(store.items)) {
    throw new Error(`expected schema ${WORK_COMBINATION_SCHEMA_VERSION}`);
  }
  const ids = new Set();
  const items = store.items.map(validateItem);
  for (const item of items) {
    if (ids.has(item.id)) throw new Error('Work combination store contains a duplicate id.');
    ids.add(item.id);
  }
  return { schemaVersion: WORK_COMBINATION_SCHEMA_VERSION, items };
}

function saveStore(root, store) {
  const validated = validateStore(store);
  const target = storePath(root);
  mkdirSync(path.dirname(target), { recursive: true });
  const temporary = `${target}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(validated, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  renameSync(temporary, target);
}

function workspaceKey(value) {
  const normalized = path.normalize(value);
  return process.platform === 'win32' ? normalized.toLowerCase() : normalized;
}

function trimStore(items) {
  const sorted = [...items].sort((left, right) => Date.parse(right.lastUsedAt) - Date.parse(left.lastUsedAt));
  const pinned = sorted.filter(item => item.pinned);
  const recent = sorted.filter(item => !item.pinned).slice(0, Math.max(0, MAX_WORK_COMBINATIONS - pinned.length));
  return [...pinned, ...recent];
}

export function loadWorkCombinations(root) {
  const target = storePath(root);
  if (!existsSync(target)) return emptyStore();
  try {
    return validateStore(JSON.parse(readFileSync(target, 'utf8')));
  } catch (error) {
    throw new Error(`Cannot read work combinations: ${error.message}`);
  }
}

export function listWorkCombinations(root) {
  return loadWorkCombinations(root).items
    .sort((left, right) => Date.parse(right.lastUsedAt) - Date.parse(left.lastUsedAt));
}

export function findWorkCombination(root, combinationId) {
  const id = String(combinationId || '').trim();
  const item = loadWorkCombinations(root).items.find(candidate => candidate.id === id);
  if (!item) throw new Error('Work combination was not found.');
  return item;
}

export function recordWorkCombination(root, input = {}) {
  const profileId = String(input.profileId || '').trim();
  if (!/^[0-9a-f-]{36}$/i.test(profileId)) throw new Error('Profile id is required.');
  const target = String(input.target || '').trim().toLowerCase();
  if (!WORK_TARGETS.has(target)) throw new Error('Unsupported work combination target.');
  const workspace = normalizeWorkspace(input.workspace, { requireDirectory: true });
  const usedAt = normalizeTimestamp(input.usedAt, 'usedAt', true);
  const store = loadWorkCombinations(root);
  const existing = store.items.find(item => item.profileId === profileId
    && item.target === target
    && workspaceKey(item.workspace) === workspaceKey(workspace));

  if (existing) {
    existing.lastUsedAt = usedAt;
    existing.useCount += 1;
  } else {
    store.items.push({
      id: randomUUID(),
      profileId,
      workspace,
      target,
      pinned: false,
      useCount: 1,
      createdAt: usedAt,
      lastUsedAt: usedAt
    });
  }
  store.items = trimStore(store.items);
  saveStore(root, store);
  return existing || store.items.find(item => item.profileId === profileId
    && item.target === target
    && workspaceKey(item.workspace) === workspaceKey(workspace));
}

export function setWorkCombinationPinned(root, combinationId, pinned) {
  const store = loadWorkCombinations(root);
  const item = store.items.find(candidate => candidate.id === String(combinationId || ''));
  if (!item) throw new Error('Work combination was not found.');
  const nextPinned = pinned === true;
  if (nextPinned && !item.pinned && store.items.filter(candidate => candidate.pinned).length >= MAX_PINNED_WORK_COMBINATIONS) {
    throw new Error(`At most ${MAX_PINNED_WORK_COMBINATIONS} work combinations can be pinned.`);
  }
  item.pinned = nextPinned;
  saveStore(root, store);
  return item;
}

export function updateWorkCombinationWorkspace(root, combinationId, workspace) {
  const store = loadWorkCombinations(root);
  const item = store.items.find(candidate => candidate.id === String(combinationId || ''));
  if (!item) throw new Error('Work combination was not found.');
  const nextWorkspace = normalizeWorkspace(workspace, { requireDirectory: true });
  const duplicate = store.items.find(candidate => candidate.id !== item.id
    && candidate.profileId === item.profileId
    && candidate.target === item.target
    && workspaceKey(candidate.workspace) === workspaceKey(nextWorkspace));
  if (duplicate) {
    duplicate.pinned = duplicate.pinned || item.pinned;
    duplicate.useCount += item.useCount;
    duplicate.lastUsedAt = Date.parse(duplicate.lastUsedAt) >= Date.parse(item.lastUsedAt) ? duplicate.lastUsedAt : item.lastUsedAt;
    store.items = store.items.filter(candidate => candidate.id !== item.id);
    saveStore(root, store);
    return duplicate;
  }
  item.workspace = nextWorkspace;
  saveStore(root, store);
  return item;
}

export function removeWorkCombination(root, combinationId) {
  const store = loadWorkCombinations(root);
  const index = store.items.findIndex(candidate => candidate.id === String(combinationId || ''));
  if (index < 0) throw new Error('Work combination was not found.');
  const [removed] = store.items.splice(index, 1);
  saveStore(root, store);
  return removed;
}
