#!/usr/bin/env node
import path from 'node:path';
import {
  createProfile,
  defaultProfilesRoot,
  detectProfileTargets,
  launchProfile,
  listProfiles,
  PROFILE_SCHEMA_VERSION,
  PROFILE_TARGETS
} from './lib/profile-store.mjs';

function parseArguments(argv) {
  const command = argv[0] || 'help';
  const options = {
    root: defaultProfilesRoot(),
    json: false,
    target: null,
    workingDirectory: process.cwd(),
    positional: []
  };
  for (let index = 1; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--json') { options.json = true; continue; }
    if (argument === '--root' && argv[index + 1]) { options.root = path.resolve(argv[++index]); continue; }
    if (argument === '--target' && argv[index + 1]) { options.target = argv[++index]; continue; }
    if ((argument === '--workspace' || argument === '--cwd') && argv[index + 1]) {
      options.workingDirectory = path.resolve(argv[++index]);
      continue;
    }
    if (argument === '--help' || argument === '-h') { options.help = true; continue; }
    if (argument.startsWith('--')) throw new Error(`Unknown or incomplete option: ${argument}`);
    options.positional.push(argument);
  }
  return { command, options };
}

function print(value, json) {
  if (json) {
    console.log(JSON.stringify(value));
    return;
  }
  if (typeof value === 'string') console.log(value);
  else console.log(JSON.stringify(value, null, 2));
}

function printHelp() {
  console.log(`Dual Codex Day profiles

Usage:
  node scripts/codex-profiles.mjs list [--json] [--root path]
  node scripts/codex-profiles.mjs create <name> [--json] [--root path]
  node scripts/codex-profiles.mjs launch <id-or-name> --target cli|vscode|desktop [--workspace path]
  node scripts/codex-profiles.mjs doctor [--json]

Profiles use separate CODEX_HOME, SQLite, VS Code, and desktop data directories.
Desktop launching is experimental because the packaged app does not document multi-instance support.`);
}

try {
  const { command, options } = parseArguments(process.argv.slice(2));
  if (options.help || command === 'help') {
    printHelp();
  } else if (command === 'list') {
    print({ schemaVersion: PROFILE_SCHEMA_VERSION, root: options.root, profiles: listProfiles(options.root) }, options.json);
  } else if (command === 'create') {
    const name = options.positional.join(' ');
    print({ ok: true, profile: createProfile(options.root, name) }, options.json);
  } else if (command === 'doctor') {
    print({
      ok: true,
      schemaVersion: PROFILE_SCHEMA_VERSION,
      root: options.root,
      targets: detectProfileTargets(),
      profileCount: listProfiles(options.root).length
    }, options.json);
  } else if (command === 'launch') {
    const reference = options.positional.join(' ');
    if (!PROFILE_TARGETS.includes(options.target)) {
      throw new Error('Launch requires --target cli, vscode, or desktop.');
    }
    print({ ok: true, launch: launchProfile(options.root, reference, options.target, { workingDirectory: options.workingDirectory }) }, options.json);
  } else {
    throw new Error(`Unknown command: ${command}`);
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
