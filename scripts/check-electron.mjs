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
const usageAnalysis = readFileSync(path.join(root, 'electron', 'renderer', 'usage-analysis.mjs'), 'utf8');
const css = readFileSync(path.join(root, 'electron', 'renderer', 'app.css'), 'utf8');
const capture = readFileSync(path.join(root, 'scripts', 'capture-electron.mjs'), 'utf8');

assert(packageMetadata.version === '0.18.0', 'Electron release must use package version 0.18.0');
assert(packageMetadata.main === 'electron/main.mjs', 'Electron main entry must be declared in package metadata');
assert(packageMetadata.scripts.desktop === 'electron .', 'desktop command must launch the Electron entry');
assert(/contextIsolation:\s*true/.test(main), 'Electron windows must enable context isolation');
assert(/nodeIntegration:\s*false/.test(main), 'Electron windows must disable renderer Node integration');
assert(/sandbox:\s*true/.test(main), 'Electron windows must run sandboxed renderers');
assert(/contextBridge\.exposeInMainWorld/.test(preload), 'preload must expose a narrow context bridge');
assert(!/ipcRenderer\.send/.test(preload), 'preload must not expose arbitrary fire-and-forget IPC');
assert(/Content-Security-Policy/.test(html) && /connect-src 'none'/.test(html), 'renderer must declare a local-only content security policy');
assert(!/frame-src|<iframe/i.test(html), 'native usage analysis must not embed the legacy web dashboard');
assert(/lucide\/dist\/esm\/createElement\.mjs/.test(renderer) && /icons\/refresh-cw\.mjs/.test(renderer), 'renderer must use tree-scoped Lucide icon modules');
assert(/profiles:create/.test(main) && /profiles:launch/.test(main), 'Electron main process must use profile IPC handlers');
assert(/profiles:stop/.test(main) && /stopProfileLaunch/.test(main + preload + renderer), 'Electron must close a specific recorded instance through scoped IPC');
assert(/showMessageBox/.test(main) && /默认运行环境/.test(main), 'instance shutdown must require confirmation and warn for the default runtime');
assert(/profiles:save-provider/.test(main) && /profiles:provider-preview/.test(main), 'Electron main process must expose scoped provider configuration handlers');
assert(/profiles:set-usage-source/.test(main) && /setProfileUsageSource/.test(preload), 'Electron must expose scoped Profile usage-source settings');
assert(/profiles:set-runtime-source/.test(main) && /setProfileRuntimeSource/.test(preload), 'Electron must expose scoped Profile runtime-source settings');
assert(/profiles:rename/.test(main) && /profiles:delete/.test(main) && /shell\.trashItem/.test(main), 'Electron must support rename and recoverable Profile deletion');
assert(/readProfileLoginStatus/.test(main) && /loginStatus/.test(renderer), 'Electron must show sanitized Codex login status without reading credential files');
assert(/profile\.usageSource === 'default' \? defaultCodexRoot : profile\.paths\.codexHome/.test(main), 'Profile summaries must resolve either the default Codex root or isolated Profile root');
assert(/profile-usage-source-dialog/.test(html) && /profileUsageSource/.test(renderer), 'Electron must provide a non-technical Profile usage-source control');
assert(/profileRuntimeSource/.test(html + renderer) && /当前默认 Codex/.test(html), 'Electron must distinguish the system-default runtime from isolated Profiles');
assert(/screenshotView === 'usage-source'/.test(main) && /profile-usage-source-dialog/.test(main), 'visual verification must cover the Profile usage-source dialog');
assert(/profiles:import-config/.test(main) && /importProfileConfig/.test(main), 'Electron main process must expose a scoped config.toml import flow');
assert(/profiles:export-transfer/.test(main) && /profiles:choose-transfer/.test(main) && /profiles:apply-transfer/.test(main), 'Electron must expose a preview-before-apply Profile transfer flow');
assert(/pendingProfileTransfers/.test(main) && /webContentsId/.test(main) && /PROFILE_TRANSFER_TTL_MS/.test(main), 'Profile transfer apply must use a renderer-scoped short-lived token');
assert(/PROFILE_TRANSFER_MAX_BYTES/.test(main) && /showSaveDialog/.test(main) && /showOpenDialog/.test(main), 'Profile transfer files must use bounded native file dialogs');
assert(/profile-transfer-dialog/.test(html + renderer + css) && /credentialRequired/.test(renderer), 'Electron must preview changes, missing components, and credential requirements');
assert(/screenshotView === 'profile-transfer'/.test(main), 'visual verification must cover the Profile transfer preview');
assert(/confirmLaunch/.test(main) && /listProfileLaunches/.test(main), 'Electron must verify launches and expose persistent instance status');
assert(/safeStorage\.encryptString/.test(main) && /safeStorage\.decryptString/.test(main), 'provider API keys must use operating-system encryption');
assert(/readDailySummary/.test(main), 'Electron main process must expose local usage summary data');
assert(/getSnapshot\(profileId\)/.test(main) && /readUsage\(launcherUsageSourceId\)/.test(main), 'launcher summary must follow the selected Profile usage source');
assert(/getSnapshot:\s*profileId\s*=>/.test(preload) && /getSnapshot\(preferredProfileId\)/.test(renderer), 'renderer must request the selected Profile summary');
assert(/usage\.source\?\.name/.test(renderer) && /profile:\$\{state\.selectedProfileId\}/.test(renderer), 'launcher and usage analysis must label and open the selected Profile source');
assert(/launcher-empty/.test(main) && /heading\.includes\('个人账号'\).*tokens === '0'.*calls === '0'/s.test(main), 'screenshot verification must cover an empty isolated Profile summary');
assert(/usage:get-data/.test(main) && /getUsageData/.test(preload), 'Electron must expose scoped native usage data IPC');
assert(/usage:get-comparison/.test(main) && /getUsageComparison/.test(preload) && /usage-comparison/.test(html + renderer + css), 'Electron must compare account usage through scoped read-only data');
assert(/readUsageSettings\(dataset\.source\.id\)/.test(renderer), 'account comparison must use each source cost settings');
assert(/task-detail-dialog/.test(html + renderer) && /groupUsageTasks/.test(renderer), 'usage tasks must open a drilldown with per-call details');
assert(/screenshotView === 'dashboard-task'/.test(main), 'visual verification must cover the task drilldown');
assert(!/dashboardWindow|dashboard:open|openDashboardWindow/.test(main + preload + renderer), 'Electron must not create a second dashboard window');
assert(/id="native-usage-content"/.test(html) && /data-view="dashboard"/.test(html), 'Electron interface must include a native usage-analysis view');
assert(/id="usage-source-select"/.test(html) && /usageSources/.test(main + renderer), 'usage analysis must expose default, combined, and Profile data sources');
assert(/usage-diagnostics-scope/.test(html + renderer + css) && /counts\.missingFiles/.test(renderer) && /droppedLegacyFiles/.test(renderer), 'usage diagnostics must explain current, retained, deferred, and discarded legacy sources');
assert(/codex-day-\$\{slug\}\.sqlite/.test(main) && /refreshIndex\(database, source\.roots\)/.test(main), 'each usage source must use an isolated index and explicit CODEX_HOME roots');
assert(/getUsageData:\s*sourceId/.test(preload) && /selectedUsageSourceId/.test(renderer), 'renderer must pass only the selected usage source id to the main process');
assert(/usage-trend-chart/.test(html) && /estimateUsageEvent/.test(renderer) && /usage-export-button/.test(html), 'native usage analysis must provide trends, cost estimates, and CSV export');
assert(/data-range="90d"/.test(html) && /state\.usageRange = 'custom'/.test(renderer) && /usage-custom-start/.test(html), 'native usage analysis must provide 90 day and custom date ranges');
assert(/usage:cc-switch-audit/.test(main) && /getCcSwitchAudit/.test(preload) && /usage-reconcile-dialog/.test(html + renderer), 'Electron must expose a read-only CC Switch reconciliation flow');
assert(/skills:get/.test(main) && /getSkills/.test(preload) && /data-view="skills"/.test(html), 'Electron must expose the Skills management view through scoped IPC');
assert(/knownSkillRoot/.test(main) && /knownCodexHome/.test(main) && /removeManagedSkill/.test(main), 'Skills mutations must validate managed roots and Codex homes');
assert(/skills:set-enabled/.test(main) && /skills\.config/.test(readFileSync(path.join(root, 'scripts', 'lib', 'skill-store.mjs'), 'utf8')), 'Skills management must support config-based enable and disable');
assert(/skill-conflict/.test(html + renderer + css) && /shell\.trashItem/.test(main), 'Skills management must show conflicts and use recoverable deletion');
assert(/skill-toggle-dialog/.test(html + renderer) && /data-overwrite/.test(renderer), 'Skills management must provide explicit enable and overwrite controls');
assert(/plugins:install/.test(main) && /installPlugin/.test(preload) && /plugin-manage-dialog/.test(html), 'Electron must manage plugin-provided Skills through scoped plugin IPC');
assert(/\['plugin', 'list', '--available', '--json'\]/.test(readFileSync(path.join(root, 'scripts', 'lib', 'plugin-store.mjs'), 'utf8')) && /data-skills-mode="plugins"/.test(html), 'plugin Skills must come from the authoritative Codex plugin list');
assert(/安装到/.test(renderer) && /plugin-row/.test(renderer + css), 'plugin Skills matrix must expose explicit target installation states');
assert(/skills-workspace-button/.test(html + renderer) && /data-skills-mode="available"/.test(html + renderer), 'Skills management must expose project selection and a separate installable catalog');
assert(/discoverProjectSkillRoots/.test(main) && /自动发现/.test(renderer), 'Skills management must automatically discover repository Skills in bounded project roots');
assert(!/cpSync.*plugins.cache/s.test(readFileSync(path.join(root, 'scripts', 'lib', 'plugin-store.mjs'), 'utf8')), 'plugin synchronization must not copy plugin cache directories');
assert(/setInterval\(\(\) =>/.test(renderer) && /loadDashboard\(true\)/.test(renderer), 'native usage analysis must refresh automatically while visible');
assert(/usage-poster-button/.test(html) && /createUsagePoster/.test(renderer) && /canvas\.width = 1200/.test(renderer) && /canvas\.height = 1600/.test(renderer), 'native usage analysis must export a filtered 1200 by 1600 poster');
assert(/data-report-period="week"/.test(html) && /data-report-period="month"/.test(html) && /createPeriodReportPoster/.test(renderer), 'native usage analysis must provide weekly and monthly reports with a dedicated poster');
assert(/turnId/.test(renderer + usageAnalysis) && /交互回合/.test(html + renderer) && /模型调用/.test(html + renderer), 'usage metrics must distinguish interaction turns from model calls');
assert(/dashboard-poster/.test(main) && /naturalWidth === 1200.*naturalHeight === 1600/s.test(main), 'visual verification must validate the rendered poster dimensions');
assert(/will-download/.test(main) && /nativeImage\.createFromPath/.test(main), 'packaged verification must exercise the PNG download and validate the saved file');
assert(!/auth\.json/i.test(main + preload + renderer + html), 'Electron code must never reference profile credential files');
assert(/grid-template-columns:\s*284px/.test(css), 'desktop layout must define a stable profile rail');
assert(/active-instance-count/.test(html) && /selected-profile-runtime/.test(html), 'Electron interface must expose multi-instance runtime status');
assert(/provider-dialog/.test(html) && /provider-config-preview/.test(html), 'Electron interface must expose the provider editor and TOML preview');
assert(/providerAuthMode/.test(html) && /provider-reasoning-input/.test(html) && /provider-personality-input/.test(html), 'provider editor must expose authentication and advanced model controls');
assert(/import-provider-config-button/.test(html) && /disable_response_storage/.test(html), 'provider editor must support common config import and the legacy storage compatibility option');
assert(/setInterval/.test(renderer) && /activeLaunches/.test(renderer), 'renderer must refresh and display active profile instances');
assert(/data-stop-launch/.test(renderer) && /stop-instance-button/.test(css), 'active launch rows must expose a stable close-instance control');
assert(!/readProviderSecret|decryptString|getProviderSecret/.test(preload), 'preload bridge must not expose provider key reads');
assert(!/filePath.*applyProfileTransfer|applyProfileTransfer.*filePath/s.test(preload), 'renderer must not submit a filesystem path when applying a Profile transfer');
assert(/previewProvider:\s*\(profileId, provider\)/.test(preload) && /importProfileConfig/.test(preload), 'preload must scope provider previews and imports to a selected Profile');
assert(!/linear-gradient|radial-gradient/.test(css), 'Electron interface must avoid decorative gradients');
assert(/DUAL_CODEX_DAY_SCREENSHOT_PATH_REPLACEMENTS/.test(main + capture), 'public Electron screenshots must replace local filesystem paths');
assert(/CODEX_USAGE_DATA_ROOT/.test(main + capture), 'Electron screenshot checks must isolate generated SQLite indexes');

if (process.platform === 'win32') {
  const electronExecutable = path.join(root, 'node_modules', 'electron', 'dist', 'electron.exe');
  const safeStorageCheck = spawnSync(electronExecutable, [path.join(root, 'scripts', 'check-safe-storage.cjs')], {
    cwd: root,
    encoding: 'utf8',
    timeout: 20_000,
    windowsHide: true
  });
  assert(safeStorageCheck.status === 0, `Electron safeStorage runtime check failed: ${safeStorageCheck.stderr || safeStorageCheck.stdout}`);
}

console.log('Electron checks passed: secure provider storage, profile actions, local summary, Lucide icons, and stable desktop layout.');
