import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { installPlugin, scanPluginSkills, setPluginEnabled } from './lib/plugin-store.mjs';

const root = mkdtempSync(path.join(os.tmpdir(), 'dcd-plugins-'));
const codexHome = path.join(root, 'codex');
const bundle = path.join(codexHome, 'plugins', 'cache', 'demo-market', 'demo-plugin', '1.2.3');
const availableBundle = path.join(root, 'market', 'plugins', 'catalog-plugin');
const skills = path.join(bundle, 'skills');
mkdirSync(path.join(bundle, '.codex-plugin'), { recursive: true });
mkdirSync(path.join(skills, 'alpha'), { recursive: true });
mkdirSync(path.join(skills, 'beta'), { recursive: true });
mkdirSync(path.join(availableBundle, 'skills', 'gamma'), { recursive: true });
writeFileSync(path.join(bundle, '.codex-plugin', 'plugin.json'), JSON.stringify({ name: 'demo-plugin', version: '1.2.3', skills: './skills/' }), 'utf8');
writeFileSync(path.join(skills, 'alpha', 'SKILL.md'), '---\nname: alpha\ndescription: Alpha skill\n---\n', 'utf8');
writeFileSync(path.join(skills, 'beta', 'SKILL.md'), '---\nname: beta\ndescription: Beta skill\n---\n', 'utf8');
writeFileSync(path.join(availableBundle, 'skills', 'gamma', 'SKILL.md'), '---\nname: gamma\ndescription: Gamma skill\n---\n', 'utf8');

const calls = [];
const runner = (_executable, args) => {
  calls.push(args);
  if (args.join(' ') === 'plugin list --available --json') return { status: 0, stdout: JSON.stringify({ installed: [{ pluginId: 'demo-plugin@demo-market', name: 'demo-plugin', marketplaceName: 'demo-market', version: '1.2.3', installed: true, enabled: true, source: { path: bundle } }], available: [{ pluginId: 'catalog-plugin@demo-market', name: 'catalog-plugin', marketplaceName: 'demo-market', version: '2.0.0', installed: false, source: { path: availableBundle } }] }), stderr: '' };
  if (args.join(' ') === 'plugin marketplace list --json') return { status: 0, stdout: JSON.stringify({ marketplaces: [{ name: 'demo-market', root: path.join(root, 'market') }] }), stderr: '' };
  return { status: 0, stdout: '{}', stderr: '' };
};
const scanned = scanPluginSkills({ environments: [{ id: 'default', label: '默认 Codex', codexHome }, { id: 'alias', label: 'HL', codexHome }], codexExecutable: 'codex', runner });
assert.equal(calls.length, 2, 'shared runtime roots should invoke the plugin CLI once');
assert.equal(scanned.plugins.length, 1);
assert.deepEqual(scanned.plugins[0].skills.map(skill => skill.name), ['alpha', 'beta']);
assert.equal(scanned.plugins[0].locations.length, 2);
assert.equal(scanned.availablePlugins.length, 1);
assert.deepEqual(scanned.availablePlugins[0].skills.map(skill => skill.name), ['gamma']);

const market = path.join(root, 'market');
mkdirSync(market, { recursive: true });
const installCalls = [];
installPlugin({ codexExecutable: 'codex', targetCodexHome: path.join(root, 'target'), pluginId: 'demo-plugin@demo-market', marketplaceRoot: market, marketplacePresent: false, runner: (_exe, args) => { installCalls.push(args); return { status: 0, stdout: '{}', stderr: '' }; } });
assert.deepEqual(installCalls.map(args => args.slice(0, 3)), [['plugin', 'marketplace', 'add'], ['plugin', 'add', 'demo-plugin@demo-market']]);

mkdirSync(codexHome, { recursive: true });
writeFileSync(path.join(codexHome, 'config.toml'), '[general]\nkeep = true\n', 'utf8');
setPluginEnabled(codexHome, 'demo-plugin@demo-market', false);
const config = readFileSync(path.join(codexHome, 'config.toml'), 'utf8');
assert.match(config, /keep = true/);
assert.match(config, /enabled = false/);
console.log('Plugin checks passed.');
