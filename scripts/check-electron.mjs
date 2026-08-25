import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const root = path.resolve('.');
const packageMetadata = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
const main = readFileSync(path.join(root, 'electron', 'main.mjs'), 'utf8');
const preload = readFileSync(path.join(root, 'electron', 'preload.cjs'), 'utf8');
const html = readFileSync(path.join(root, 'electron', 'renderer', 'index.html'), 'utf8');
const renderer = readFileSync(path.join(root, 'electron', 'renderer', 'app.js'), 'utf8');
const css = readFileSync(path.join(root, 'electron', 'renderer', 'app.css'), 'utf8');

assert(packageMetadata.version === '0.10.0', 'Electron release must use package version 0.10.0');
assert(packageMetadata.main === 'electron/main.mjs', 'Electron main entry must be declared in package metadata');
assert(packageMetadata.scripts.desktop === 'electron .', 'desktop command must launch the Electron entry');
assert(/contextIsolation:\s*true/.test(main), 'Electron windows must enable context isolation');
assert(/nodeIntegration:\s*false/.test(main), 'Electron windows must disable renderer Node integration');
assert(/sandbox:\s*true/.test(main), 'Electron windows must run sandboxed renderers');
assert(/contextBridge\.exposeInMainWorld/.test(preload), 'preload must expose a narrow context bridge');
assert(!/ipcRenderer\.send/.test(preload), 'preload must not expose arbitrary fire-and-forget IPC');
assert(/Content-Security-Policy/.test(html) && /connect-src 'none'/.test(html), 'renderer must declare a local-only content security policy');
assert(/lucide\/dist\/esm\/createElement\.mjs/.test(renderer) && /icons\/refresh-cw\.mjs/.test(renderer), 'renderer must use tree-scoped Lucide icon modules');
assert(/profiles:create/.test(main) && /profiles:launch/.test(main), 'Electron main process must use profile IPC handlers');
assert(/profiles:save-provider/.test(main) && /profiles:provider-preview/.test(main), 'Electron main process must expose scoped provider configuration handlers');
assert(/profiles:import-config/.test(main) && /importProfileConfig/.test(main), 'Electron main process must expose a scoped config.toml import flow');
assert(/confirmLaunch/.test(main) && /listProfileLaunches/.test(main), 'Electron must verify launches and expose persistent instance status');
assert(/safeStorage\.encryptString/.test(main) && /safeStorage\.decryptString/.test(main), 'provider API keys must use operating-system encryption');
assert(/readDailySummary/.test(main), 'Electron main process must expose local usage summary data');
assert(!/auth\.json/i.test(main + preload + renderer + html), 'Electron code must never reference profile credential files');
assert(/grid-template-columns:\s*284px/.test(css), 'desktop layout must define a stable profile rail');
assert(/active-instance-count/.test(html) && /selected-profile-runtime/.test(html), 'Electron interface must expose multi-instance runtime status');
assert(/provider-dialog/.test(html) && /provider-config-preview/.test(html), 'Electron interface must expose the provider editor and TOML preview');
assert(/providerAuthMode/.test(html) && /provider-reasoning-input/.test(html) && /provider-personality-input/.test(html), 'provider editor must expose authentication and advanced model controls');
assert(/import-provider-config-button/.test(html) && /disable_response_storage/.test(html), 'provider editor must support common config import and the legacy storage compatibility option');
assert(/setInterval/.test(renderer) && /activeLaunches/.test(renderer), 'renderer must refresh and display active profile instances');
assert(!/readProviderSecret|decryptString|getProviderSecret/.test(preload), 'preload bridge must not expose provider key reads');
assert(/previewProvider:\s*\(profileId, provider\)/.test(preload) && /importProfileConfig/.test(preload), 'preload must scope provider previews and imports to a selected Profile');
assert(!/linear-gradient|radial-gradient/.test(css), 'Electron interface must avoid decorative gradients');

const electronExecutable = process.platform === 'win32'
  ? path.join(root, 'node_modules', 'electron', 'dist', 'electron.exe')
  : path.join(root, 'node_modules', '.bin', 'electron');
const safeStorageCheck = spawnSync(electronExecutable, [path.join(root, 'scripts', 'check-safe-storage.cjs')], {
  cwd: root,
  encoding: 'utf8',
  timeout: 20_000,
  windowsHide: true
});
assert(safeStorageCheck.status === 0, `Electron safeStorage runtime check failed: ${safeStorageCheck.stderr || safeStorageCheck.stdout}`);

console.log('Electron checks passed: secure provider storage, profile actions, local summary, Lucide icons, and stable desktop layout.');
