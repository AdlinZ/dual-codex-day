import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { parse as parseToml, stringify as stringifyToml } from 'smol-toml';
import { readSkillMetadata } from './skill-store.mjs';

const SAFE_PLUGIN_ID = /^[a-zA-Z0-9._-]{1,100}@[a-zA-Z0-9._-]{1,100}$/;

function normalizePath(value) {
  return path.resolve(String(value || '').replace(/^\\\\\?\\/, ''));
}

function runCodex(codexExecutable, codexHome, args, runner = spawnSync) {
  const result = runner(codexExecutable, args, {
    encoding: 'utf8',
    timeout: 45_000,
    windowsHide: true,
    env: { ...process.env, CODEX_HOME: path.resolve(codexHome) }
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(String(result.stderr || result.stdout || 'Codex 插件命令执行失败。').trim());
  try { return JSON.parse(result.stdout || '{}'); } catch { throw new Error('Codex 插件命令返回了无法识别的数据。'); }
}

function pluginBundleRoot(codexHome, plugin) {
  const base = path.join(codexHome, 'plugins', 'cache', plugin.marketplaceName, plugin.name);
  if (existsSync(base)) {
    const versions = readdirSync(base, { withFileTypes: true })
      .filter(entry => entry.isDirectory())
      .sort((a, b) => b.name.localeCompare(a.name, undefined, { numeric: true }));
    const exact = versions.find(entry => entry.name === plugin.version);
    if (exact) return path.join(base, exact.name);
    if (versions[0]) return path.join(base, versions[0].name);
  }
  const source = normalizePath(plugin.source?.path);
  return existsSync(source) ? source : null;
}

function pluginSkills(codexHome, plugin) {
  const root = pluginBundleRoot(codexHome, plugin);
  if (!root) return [];
  const manifestPath = path.join(root, '.codex-plugin', 'plugin.json');
  let manifest = {};
  if (existsSync(manifestPath) && statSync(manifestPath).size < 512 * 1024) {
    try { manifest = JSON.parse(readFileSync(manifestPath, 'utf8')); } catch { /* Invalid optional metadata does not hide the plugin. */ }
  }
  const skillsRoot = path.resolve(root, String(manifest.skills || 'skills'));
  const relativeSkills = path.relative(path.resolve(root), skillsRoot);
  if (relativeSkills.startsWith('..') || path.isAbsolute(relativeSkills) || !existsSync(skillsRoot) || !statSync(skillsRoot).isDirectory()) return [];
  const skillDirectories = [];
  const visit = (directory, depth = 0) => {
    if (depth > 8 || skillDirectories.length >= 1_000) return;
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const child = path.join(directory, entry.name);
      if (existsSync(path.join(child, 'SKILL.md'))) skillDirectories.push(child);
      visit(child, depth + 1);
    }
  };
  visit(skillsRoot);
  return skillDirectories.map(skillPath => ({ ...readSkillMetadata(skillPath), path: skillPath }));
}

export function readPluginEnvironment(environment, codexExecutable, runner = spawnSync) {
  let listed;
  try {
    listed = runCodex(codexExecutable, environment.codexHome, ['plugin', 'list', '--available', '--json'], runner);
  } catch {
    listed = runCodex(codexExecutable, environment.codexHome, ['plugin', 'list', '--json'], runner);
  }
  const marketplaceList = runCodex(codexExecutable, environment.codexHome, ['plugin', 'marketplace', 'list', '--json'], runner);
  const marketplaces = new Map((marketplaceList.marketplaces || []).map(item => [item.name, normalizePath(item.root)]));
  const describe = plugin => ({
    pluginId: plugin.pluginId,
    name: plugin.name,
    marketplaceName: plugin.marketplaceName,
    marketplaceRoot: marketplaces.get(plugin.marketplaceName) || normalizePath(plugin.marketplaceSource?.source),
    version: plugin.version || '',
    enabled: plugin.enabled !== false,
    installPolicy: plugin.installPolicy || '',
    authPolicy: plugin.authPolicy || '',
    skills: pluginSkills(environment.codexHome, plugin),
    environmentId: environment.id,
    environmentLabel: environment.label,
    codexHome: environment.codexHome
  });
  return {
    installed: (listed.installed || []).filter(plugin => plugin.installed === true).map(describe),
    available: (listed.available || []).filter(plugin => plugin.installed !== true).map(describe)
  };
}

export function listPluginMarketplaces(codexHome, codexExecutable = 'codex', runner = spawnSync) {
  const result = runCodex(codexExecutable, codexHome, ['plugin', 'marketplace', 'list', '--json'], runner);
  return (result.marketplaces || []).map(item => ({ name: item.name, root: normalizePath(item.root) }));
}

export function scanPluginSkills({ environments = [], codexExecutable = 'codex', runner = spawnSync } = {}) {
  const cache = new Map();
  const failures = [];
  const entries = [];
  for (const environment of environments) {
    const key = normalizePath(environment.codexHome).toLowerCase();
    if (!cache.has(key)) {
      try { cache.set(key, readPluginEnvironment(environment, codexExecutable, runner)); }
      catch (error) { cache.set(key, { installed: [], available: [] }); failures.push({ environmentId: environment.id, message: error.message }); }
    }
    const source = cache.get(key);
    entries.push(...source.installed.map(plugin => ({ ...plugin, environmentId: environment.id, environmentLabel: environment.label })));
  }
  const byId = new Map();
  for (const entry of entries) {
    const item = byId.get(entry.pluginId) || { pluginId: entry.pluginId, name: entry.name, marketplaceName: entry.marketplaceName, version: entry.version, skills: entry.skills, locations: [] };
    if (entry.skills.length > item.skills.length) item.skills = entry.skills;
    item.locations.push({ environmentId: entry.environmentId, label: entry.environmentLabel, codexHome: entry.codexHome, enabled: entry.enabled, version: entry.version, marketplaceRoot: entry.marketplaceRoot });
    byId.set(entry.pluginId, item);
  }
  const availableById = new Map();
  for (const environment of environments) {
    const key = normalizePath(environment.codexHome).toLowerCase();
    for (const entry of cache.get(key)?.available || []) {
      if (byId.has(entry.pluginId)) continue;
      const item = availableById.get(entry.pluginId) || {
        pluginId: entry.pluginId,
        name: entry.name,
        marketplaceName: entry.marketplaceName,
        version: entry.version,
        skills: entry.skills,
        sources: []
      };
      if (entry.skills.length > item.skills.length) item.skills = entry.skills;
      if (!item.sources.some(source => normalizePath(source.codexHome).toLowerCase() === key)) {
        item.sources.push({
          environmentId: environment.id,
          label: environment.label,
          codexHome: entry.codexHome,
          marketplaceRoot: entry.marketplaceRoot
        });
      }
      availableById.set(entry.pluginId, item);
    }
  }
  return {
    environments,
    plugins: [...byId.values()].filter(plugin => plugin.skills.length > 0).sort((a, b) => a.name.localeCompare(b.name)),
    availablePlugins: [...availableById.values()].filter(plugin => plugin.skills.length > 0).sort((a, b) => a.name.localeCompare(b.name)),
    failures
  };
}

function assertPluginId(pluginId) {
  const value = String(pluginId || '').trim();
  if (!SAFE_PLUGIN_ID.test(value)) throw new Error('插件标识无效。');
  return value;
}

export function installPlugin({ codexExecutable = 'codex', targetCodexHome, pluginId, marketplaceRoot, marketplacePresent = true, runner = spawnSync }) {
  const id = assertPluginId(pluginId);
  if (!marketplacePresent) {
    if (!marketplaceRoot || !existsSync(normalizePath(marketplaceRoot))) throw new Error('目标环境缺少该插件的 Marketplace，且找不到可同步的来源。');
    runCodex(codexExecutable, targetCodexHome, ['plugin', 'marketplace', 'add', normalizePath(marketplaceRoot), '--json'], runner);
  }
  return runCodex(codexExecutable, targetCodexHome, ['plugin', 'add', id, '--json'], runner);
}

export function removePlugin({ codexExecutable = 'codex', codexHome, pluginId, runner = spawnSync }) {
  return runCodex(codexExecutable, codexHome, ['plugin', 'remove', assertPluginId(pluginId), '--json'], runner);
}

export function setPluginEnabled(codexHome, pluginId, enabled) {
  const id = assertPluginId(pluginId);
  const configPath = path.join(codexHome, 'config.toml');
  const config = existsSync(configPath) ? parseToml(readFileSync(configPath, 'utf8')) : {};
  config.plugins = { ...(config.plugins || {}), [id]: { ...(config.plugins?.[id] || {}), enabled: Boolean(enabled) } };
  mkdirSync(codexHome, { recursive: true });
  writeFileSync(configPath, stringifyToml(config), 'utf8');
  return { pluginId: id, enabled: Boolean(enabled), path: configPath };
}
