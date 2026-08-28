import { cpSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parse as parseToml, stringify as stringifyToml } from 'smol-toml';

const MAX_SKILL_FILE = 512 * 1024;
const SAFE_NAME = /^[a-zA-Z0-9._-]{1,100}$/;
const DISCOVERY_SKIP = new Set(['.git', '.hg', '.svn', '.cache', 'node_modules', 'dist', 'build', 'out', 'target', 'vendor']);

function keyFor(value) {
  const resolved = path.resolve(value);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

function isWithin(root, candidate) {
  const base = keyFor(root);
  const target = keyFor(candidate);
  return target === base || target.startsWith(`${base}${path.sep}`);
}

function safeRoot(root) {
  return path.resolve(root);
}

export function readSkillMetadata(skillPath) {
  const file = path.join(skillPath, 'SKILL.md');
  if (!existsSync(file) || statSync(file).size > MAX_SKILL_FILE) return { name: path.basename(skillPath), description: '' };
  const content = readFileSync(file, 'utf8');
  const match = content.match(/^---\s*\r?\n([\s\S]*?)\r?\n---/);
  let frontmatter = {};
  if (match) {
    try { frontmatter = parseToml(match[1]); } catch { /* YAML frontmatter is intentionally parsed conservatively below. */ }
    for (const line of match[1].split(/\r?\n/)) {
      const item = line.match(/^\s*(name|description)\s*:\s*(.+?)\s*$/);
      if (item) frontmatter[item[1]] = item[2].replace(/^['"]|['"]$/g, '');
    }
  }
  return {
    name: String(frontmatter.name || path.basename(skillPath)).trim().slice(0, 100),
    description: String(frontmatter.description || '').trim().slice(0, 500)
  };
}

function scanRoot(rootInfo) {
  const root = safeRoot(rootInfo.path);
  if (!existsSync(root) || !statSync(root).isDirectory()) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter(entry => (entry.isDirectory() || entry.isSymbolicLink()) && SAFE_NAME.test(entry.name) && (rootInfo.scope === 'system' || entry.name !== '.system'))
    .map(entry => {
      const skillPath = path.join(root, entry.name);
      if (!statSync(skillPath).isDirectory()) return null;
      const metadata = readSkillMetadata(skillPath);
      return { ...metadata, id: `${rootInfo.id}:${entry.name}`, directory: entry.name, path: skillPath, symlink: lstatSync(skillPath).isSymbolicLink(), scope: rootInfo.scope, label: rootInfo.label, managed: rootInfo.managed !== false, readOnly: rootInfo.readOnly === true };
    }).filter(Boolean);
}

export function discoverProjectSkillRoots(searchRoots = [], { maxDepth = 5, maxDirectories = 5_000, maxProjects = 20 } = {}) {
  const projects = [];
  const seen = new Set();
  let visited = 0;
  const visit = (directory, depth) => {
    if (depth > maxDepth || visited >= maxDirectories || projects.length >= maxProjects) return;
    const resolved = path.resolve(directory);
    const key = keyFor(resolved);
    if (seen.has(key) || !existsSync(resolved)) return;
    seen.add(key);
    visited += 1;
    let entries;
    try {
      if (!statSync(resolved).isDirectory()) return;
      entries = readdirSync(resolved, { withFileTypes: true });
    } catch {
      return;
    }
    const skillsRoot = path.join(resolved, '.agents', 'skills');
    try {
      const hasSkills = existsSync(skillsRoot) && statSync(skillsRoot).isDirectory()
        && readdirSync(skillsRoot, { withFileTypes: true }).some(entry => (entry.isDirectory() || entry.isSymbolicLink()) && existsSync(path.join(skillsRoot, entry.name, 'SKILL.md')));
      if (hasSkills) projects.push({ workspace: resolved, path: skillsRoot, name: path.basename(resolved) || resolved });
    } catch { /* Unreadable project directories are ignored. */ }
    if (depth === maxDepth || projects.length >= maxProjects) return;
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.isSymbolicLink() || entry.name.startsWith('.') || DISCOVERY_SKIP.has(entry.name.toLowerCase())) continue;
      visit(path.join(resolved, entry.name), depth + 1);
      if (visited >= maxDirectories || projects.length >= maxProjects) break;
    }
  };
  for (const root of searchRoots) visit(root, 0);
  return projects;
}

function defaultRoots({ profiles = [], workspace = process.cwd(), projectSkillRoots = [], defaultCodexHome = path.join(os.homedir(), '.codex'), sharedSkillsRoot = path.join(os.homedir(), '.agents', 'skills') } = {}) {
  const roots = [
    { id: 'shared', label: '共享 Skills', scope: 'shared', path: sharedSkillsRoot, managed: true },
    { id: 'default', label: '默认 Codex', scope: 'default', path: path.join(defaultCodexHome, 'skills'), managed: true },
    { id: 'system', label: '系统内置', scope: 'system', path: path.join(defaultCodexHome, 'skills', '.system'), managed: false, readOnly: true }
  ];
  for (const profile of profiles) {
    const root = profile.runtimeSource === 'default' ? defaultCodexHome : profile.codexHome;
    roots.push({ id: `profile:${profile.id}`, label: profile.name, scope: 'profile', path: path.join(root, 'skills'), managed: true });
    if (profile.runtimeSource !== 'default') roots.push({ id: `system:${profile.id}`, label: `${profile.name} · 系统内置`, scope: 'system', path: path.join(root, 'skills', '.system'), managed: false, readOnly: true });
  }
  const currentSkillsRoot = path.join(workspace, '.agents', 'skills');
  roots.push({ id: 'workspace', label: '当前项目', scope: 'workspace', path: currentSkillsRoot, managed: false, discovered: false });
  const knownRoots = new Set(roots.map(root => keyFor(root.path)));
  for (const [index, project] of projectSkillRoots.entries()) {
    const projectPath = path.resolve(project.path || path.join(project.workspace, '.agents', 'skills'));
    const key = keyFor(projectPath);
    if (knownRoots.has(key)) continue;
    knownRoots.add(key);
    roots.push({ id: `workspace:auto:${index}`, label: `${project.name || path.basename(project.workspace)} · 自动发现`, scope: 'workspace', path: projectPath, managed: false, discovered: true, workspace: path.resolve(project.workspace) });
  }
  return roots;
}

export function scanSkills(options = {}) {
  const roots = defaultRoots(options);
  const entries = roots.flatMap(scanRoot);
  const byName = new Map();
  for (const entry of entries) {
    const bucket = byName.get(entry.name) || [];
    bucket.push(entry);
    byName.set(entry.name, bucket);
  }
  const skills = [...byName.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([name, locations]) => ({
    name,
    description: locations.find(item => item.description)?.description || '',
    conflict: new Set(locations.map(item => keyFor(item.path))).size > 1,
    locations,
    availability: {
      shared: locations.some(item => item.scope === 'shared'),
      default: locations.some(item => item.scope === 'default'),
      profiles: locations.filter(item => item.scope === 'profile').map(item => item.label),
      workspace: locations.some(item => item.scope === 'workspace'),
      system: locations.some(item => item.scope === 'system')
    }
  }));
  return { generatedAt: new Date().toISOString(), roots, skills };
}

function assertSkillName(name) {
  const value = String(name || '').trim();
  if (!SAFE_NAME.test(value) || value === '.' || value === '..') throw new Error('Skill 名称包含不支持的字符。');
  return value;
}

function copySkill(source, targetRoot, { overwrite = false } = {}) {
  const name = assertSkillName(path.basename(source));
  const root = safeRoot(targetRoot);
  const target = path.join(root, name);
  if (!isWithin(root, target)) throw new Error('Skill 目标路径无效。');
  if (!existsSync(source) || !statSync(source).isDirectory()) throw new Error('找不到源 Skill 目录。');
  if (existsSync(target)) {
    if (!overwrite) throw new Error(`目标位置已有同名 Skill：${name}`);
  }
  mkdirSync(root, { recursive: true });
  if (!existsSync(target)) {
    cpSync(source, target, { recursive: true, errorOnExist: true, dereference: true });
    return target;
  }
  const suffix = `${process.pid}-${Date.now()}`;
  const staged = path.join(root, `.${name}.staged-${suffix}`);
  const backup = path.join(root, `.${name}.backup-${suffix}`);
  try {
    cpSync(source, staged, { recursive: true, errorOnExist: true, dereference: true });
    renameSync(target, backup);
    renameSync(staged, target);
    rmSync(backup, { recursive: true, force: true });
  } catch (error) {
    if (!existsSync(target) && existsSync(backup)) renameSync(backup, target);
    rmSync(staged, { recursive: true, force: true });
    throw error;
  }
  return target;
}

export function shareSkill(skillPath, { overwrite = false } = {}) {
  return copySkill(skillPath, path.join(os.homedir(), '.agents', 'skills'), { overwrite });
}

export function syncSkill(skillPath, targetRoot, { overwrite = false } = {}) {
  return copySkill(skillPath, targetRoot, { overwrite });
}

function configPath(codexHome) { return path.join(codexHome, 'config.toml'); }

export function setSkillEnabled(codexHome, skillName, enabled) {
  const requested = String(skillName || '').trim();
  const name = requested.endsWith('SKILL.md') ? requested : assertSkillName(requested);
  const skillPath = name.endsWith('SKILL.md') ? path.resolve(name) : path.join(path.join(codexHome, 'skills'), name, 'SKILL.md');
  const target = configPath(codexHome);
  const parsed = existsSync(target) ? parseToml(readFileSync(target, 'utf8')) : {};
  const list = Array.isArray(parsed.skills?.config) ? parsed.skills.config : [];
  const next = list.filter(item => String(item?.path || '') !== skillPath);
  next.push({ path: skillPath, enabled: Boolean(enabled) });
  parsed.skills = { ...(parsed.skills || {}), config: next };
  mkdirSync(codexHome, { recursive: true });
  writeFileSync(target, stringifyToml(parsed), 'utf8');
  return { path: target, skillPath, enabled: Boolean(enabled) };
}

export function removeManagedSkill(skillPath, approvedRoots, trash = null) {
  const target = path.resolve(skillPath);
  if (path.basename(target) === '.system') throw new Error('系统内置 Skills 只读，不能删除。');
  const root = approvedRoots.map(safeRoot).find(candidate => isWithin(candidate, target) && keyFor(candidate) !== keyFor(target));
  if (!root) throw new Error('该 Skill 不在可管理目录中。');
  if (!existsSync(target)) return false;
  if (trash) return trash(target);
  rmSync(target, { recursive: true, force: true });
  return true;
}

export function skillRoots(options = {}) { return defaultRoots(options); }
