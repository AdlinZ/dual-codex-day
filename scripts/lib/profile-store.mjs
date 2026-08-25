import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const PROFILE_SCHEMA_VERSION = 1;
export const PROFILE_TARGETS = Object.freeze(['cli', 'vscode', 'desktop']);

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
const scriptsDirectory = path.dirname(moduleDirectory);
const inheritedCredentialVariables = [
  'CODEX_ACCESS_TOKEN',
  'CODEX_API_KEY',
  'OPENAI_API_KEY'
];
const inheritedCredentialVariableSet = new Set(inheritedCredentialVariables);

function localDataRoot() {
  if (process.platform === 'win32') {
    return process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
  }
  return process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share');
}

export function defaultProfilesRoot() {
  return path.resolve(process.env.CODEX_PROFILES_ROOT || path.join(localDataRoot(), 'dual-codex-day', 'profiles'));
}

function emptyRegistry() {
  return { schemaVersion: PROFILE_SCHEMA_VERSION, profiles: [] };
}

function registryPath(root) {
  return path.join(root, 'profiles.json');
}

function validateRegistry(registry) {
  if (!registry || registry.schemaVersion !== PROFILE_SCHEMA_VERSION || !Array.isArray(registry.profiles)) {
    throw new Error(`Unsupported or invalid profile registry. Expected schema ${PROFILE_SCHEMA_VERSION}.`);
  }
  const ids = new Set();
  for (const profile of registry.profiles) {
    if (!profile || typeof profile.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(profile.id)) {
      throw new Error('Profile registry contains an invalid profile id.');
    }
    if (ids.has(profile.id)) throw new Error('Profile registry contains a duplicate profile id.');
    ids.add(profile.id);
    normalizeProfileName(profile.name);
  }
  return registry;
}

export function loadProfileRegistry(root = defaultProfilesRoot()) {
  const resolvedRoot = path.resolve(root);
  const filePath = registryPath(resolvedRoot);
  if (!existsSync(filePath)) return emptyRegistry();
  try {
    return validateRegistry(JSON.parse(readFileSync(filePath, 'utf8')));
  } catch (error) {
    throw new Error(`Cannot read profile registry: ${error.message}`);
  }
}

function saveProfileRegistry(root, registry) {
  const resolvedRoot = path.resolve(root);
  mkdirSync(resolvedRoot, { recursive: true });
  validateRegistry(registry);
  const target = registryPath(resolvedRoot);
  const temporary = `${target}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(registry, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  renameSync(temporary, target);
}

export function normalizeProfileName(value) {
  if (typeof value !== 'string') throw new Error('Profile name must be text.');
  const name = value.trim();
  if (name.length < 1 || name.length > 40) throw new Error('Profile name must contain 1 to 40 characters.');
  if (/[\u0000-\u001f\u007f]/.test(name)) throw new Error('Profile name cannot contain control characters.');
  return name;
}

export function profilePaths(root, profileId) {
  const profileRoot = path.join(path.resolve(root), 'data', profileId);
  const codexHome = path.join(profileRoot, 'codex-home');
  return {
    root: profileRoot,
    codexHome,
    sqliteHome: path.join(codexHome, 'sqlite'),
    desktopData: path.join(profileRoot, 'desktop-data'),
    vscodeData: path.join(profileRoot, 'vscode-data')
  };
}

function ensureProfileDirectories(paths) {
  for (const directory of Object.values(paths)) mkdirSync(directory, { recursive: true });
  const configPath = path.join(paths.codexHome, 'config.toml');
  if (!existsSync(configPath)) {
    const config = [
      '# Created by Dual Codex Day profiles.',
      '# Keep each profile credential inside this CODEX_HOME.',
      'cli_auth_credentials_store = "file"',
      ''
    ].join('\n');
    writeFileSync(configPath, config, { encoding: 'utf8', mode: 0o600 });
  }
}

function enrichProfile(root, profile) {
  return { ...profile, paths: profilePaths(root, profile.id) };
}

export function listProfiles(root = defaultProfilesRoot()) {
  return loadProfileRegistry(root).profiles.map(profile => enrichProfile(root, profile));
}

export function createProfile(root = defaultProfilesRoot(), requestedName) {
  const name = normalizeProfileName(requestedName);
  const registry = loadProfileRegistry(root);
  if (registry.profiles.some(profile => profile.name.localeCompare(name, undefined, { sensitivity: 'accent' }) === 0)) {
    throw new Error(`A profile named "${name}" already exists.`);
  }
  const timestamp = new Date().toISOString();
  const profile = { id: randomUUID(), name, createdAt: timestamp, updatedAt: timestamp };
  const paths = profilePaths(root, profile.id);
  ensureProfileDirectories(paths);
  registry.profiles.push(profile);
  saveProfileRegistry(root, registry);
  return enrichProfile(root, profile);
}

export function findProfile(root = defaultProfilesRoot(), reference) {
  const query = String(reference || '').trim();
  if (!query) throw new Error('A profile id or name is required.');
  const profiles = listProfiles(root);
  const exactId = profiles.find(profile => profile.id === query);
  if (exactId) return exactId;
  const byName = profiles.filter(profile => profile.name.localeCompare(query, undefined, { sensitivity: 'accent' }) === 0);
  if (byName.length === 1) return byName[0];
  throw new Error(`Profile not found: ${query}`);
}

function executableFromPath(names, environment = process.env) {
  const searchPath = environment.PATH || environment.Path || '';
  const extensions = process.platform === 'win32'
    ? (environment.PATHEXT || '.EXE;.CMD;.BAT;.COM').split(';')
    : [''];
  for (const directory of searchPath.split(path.delimiter).filter(Boolean)) {
    for (const name of names) {
      const candidates = path.extname(name) ? [name] : extensions.map(extension => `${name}${extension.toLowerCase()}`);
      for (const candidate of candidates) {
        const filePath = path.join(directory.replace(/^"|"$/g, ''), candidate);
        if (existsSync(filePath)) return filePath;
      }
    }
  }
  return null;
}

function detectCodeExecutable(environment = process.env) {
  if (environment.CODEX_PROFILES_VSCODE_EXE && existsSync(environment.CODEX_PROFILES_VSCODE_EXE)) {
    return path.resolve(environment.CODEX_PROFILES_VSCODE_EXE);
  }
  const candidates = process.platform === 'win32' ? [
    path.join(environment.LOCALAPPDATA || '', 'Programs', 'Microsoft VS Code', 'Code.exe'),
    path.join(environment.ProgramFiles || '', 'Microsoft VS Code', 'Code.exe')
  ] : [];
  return candidates.find(candidate => candidate && existsSync(candidate)) || executableFromPath(['code'], environment);
}

function detectDesktopExecutable(environment = process.env) {
  if (environment.CODEX_DESKTOP_EXE && existsSync(environment.CODEX_DESKTOP_EXE)) {
    return path.resolve(environment.CODEX_DESKTOP_EXE);
  }
  if (process.platform !== 'win32') return null;
  const powershell = executableFromPath(['powershell.exe', 'pwsh.exe'], environment);
  if (!powershell) return null;
  const command = "$p=Get-AppxPackage OpenAI.Codex -ErrorAction SilentlyContinue | Select-Object -First 1; if($p){ Join-Path $p.InstallLocation 'app\\ChatGPT.exe' }";
  const result = spawnSync(powershell, ['-NoProfile', '-Command', command], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 5000
  });
  const candidate = String(result.stdout || '').trim();
  return result.status === 0 && candidate && existsSync(candidate) ? candidate : null;
}

export function detectProfileTargets(environment = process.env) {
  const codex = environment.CODEX_PROFILES_CODEX_EXE && existsSync(environment.CODEX_PROFILES_CODEX_EXE)
    ? path.resolve(environment.CODEX_PROFILES_CODEX_EXE)
    : executableFromPath(['codex.exe', 'codex'], environment);
  const vscode = detectCodeExecutable(environment);
  const desktop = detectDesktopExecutable(environment);
  return {
    cli: { available: Boolean(codex), executable: codex },
    vscode: { available: Boolean(vscode), executable: vscode },
    desktop: { available: Boolean(desktop), executable: desktop, experimental: true }
  };
}

export function profileEnvironment(profile, baseEnvironment = process.env) {
  const environment = { ...baseEnvironment };
  for (const variable of Object.keys(environment)) {
    if (inheritedCredentialVariableSet.has(variable.toUpperCase())) delete environment[variable];
  }
  environment.CODEX_HOME = profile.paths.codexHome;
  environment.CODEX_SQLITE_HOME = profile.paths.sqliteHome;
  environment.CODEX_PROFILE_ID = profile.id;
  environment.CODEX_PROFILE_NAME = profile.name;
  return environment;
}

function validateWorkingDirectory(value) {
  const directory = path.resolve(value || process.cwd());
  if (!existsSync(directory)) throw new Error(`Working directory does not exist: ${directory}`);
  return directory;
}

export function buildLaunchPlan(profile, target, options = {}) {
  if (!PROFILE_TARGETS.includes(target)) throw new Error(`Unsupported target: ${target}`);
  ensureProfileDirectories(profile.paths);
  const workingDirectory = validateWorkingDirectory(options.workingDirectory);
  const targets = options.targets || detectProfileTargets(options.environment || process.env);
  const detected = targets[target];
  if (!detected?.available || !detected.executable) throw new Error(`${target} is not installed or could not be located.`);
  const environment = profileEnvironment(profile, options.environment || process.env);

  if (target === 'cli') {
    const powershell = executableFromPath(['powershell.exe', 'pwsh.exe'], options.environment || process.env);
    if (!powershell) throw new Error('PowerShell is required to open an interactive Codex terminal.');
    const runner = path.join(scriptsDirectory, 'run-codex-profile.ps1');
    return {
      target,
      command: powershell,
      args: [
        '-NoLogo', '-NoExit', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', runner,
        '-CodexHome', profile.paths.codexHome,
        '-SqliteHome', profile.paths.sqliteHome,
        '-CodexExecutable', detected.executable,
        '-WorkingDirectory', workingDirectory,
        '-ProfileName', profile.name
      ],
      cwd: workingDirectory,
      environment,
      experimental: false
    };
  }

  if (target === 'vscode') {
    return {
      target,
      command: detected.executable,
      args: ['--new-window', '--user-data-dir', profile.paths.vscodeData, workingDirectory],
      cwd: workingDirectory,
      environment,
      experimental: false
    };
  }

  return {
    target,
    command: detected.executable,
    args: [`--user-data-dir=${profile.paths.desktopData}`],
    cwd: workingDirectory,
    environment,
    experimental: true
  };
}

export function launchProfile(root, reference, target, options = {}) {
  const profile = findProfile(root, reference);
  const plan = buildLaunchPlan(profile, target, options);
  const child = spawn(plan.command, plan.args, {
    cwd: plan.cwd,
    env: plan.environment,
    detached: true,
    stdio: 'ignore',
    windowsHide: false
  });
  child.unref();
  return {
    profile: { id: profile.id, name: profile.name },
    target: plan.target,
    experimental: plan.experimental,
    pid: child.pid
  };
}
