import { createReadStream, existsSync, mkdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { buildDashboard, getIndexDiagnostics, normalizeRetentionDays, openIndex, readDailySummary, refreshIndex, scanLogFiles, SCHEMA_VERSION } from './lib/session-index.mjs';
import { auditPricing, diffPricing, loadPricing } from './lib/pricing-audit.mjs';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.dirname(scriptDirectory);
const packageMetadata = JSON.parse(readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));

function parseArgs(argv) {
  const options = {
    codexRoot: path.join(os.homedir(), '.codex'),
    databasePath: path.join(repoRoot, '.codex-day', 'codex-day.sqlite'),
    dashboardPath: path.join(repoRoot, 'dist', 'index.html'),
    pricingPath: path.join(repoRoot, 'config', 'pricing.json'),
    candidatePath: null,
    host: '127.0.0.1',
    port: 8765,
    intervalSeconds: 4,
    pidFile: null,
    sourceId: 'default',
    retentionDays: process.env.CODEX_DAY_RETENTION_DAYS || 'all',
    command: 'serve',
    once: false,
    open: false,
    json: false,
    verbose: false,
    date: null
  };
  const valueOptions = new Map([
    ['--codex-root', 'codexRoot'], ['--database', 'databasePath'], ['--dashboard', 'dashboardPath'], ['--pid-file', 'pidFile'],
    ['--pricing', 'pricingPath'], ['--candidate', 'candidatePath'],
    ['--host', 'host'], ['--port', 'port'], ['--interval', 'intervalSeconds'], ['--retention-days', 'retentionDays'], ['--date', 'date'],
    ['--source-id', 'sourceId']
  ]);
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === 'doctor' && index === 0) { options.command = 'doctor'; continue; }
    if (arg === 'summary' && index === 0) { options.command = 'summary'; continue; }
    if (arg === 'pricing' && index === 0) { options.command = 'pricing'; continue; }
    if (arg === '--once') { options.once = true; continue; }
    if (arg === '--open') { options.open = true; continue; }
    if (arg === '--json') { options.json = true; continue; }
    if (arg === '--verbose') { options.verbose = true; continue; }
    if (arg === '--help' || arg === '-h') { options.help = true; continue; }
    const key = valueOptions.get(arg);
    if (!key || argv[index + 1] == null) throw new Error(`Unknown or incomplete option: ${arg}`);
    const value = argv[++index];
    if (key === 'codexRoot') {
      const resolved = path.resolve(value);
      options.codexRoot = Array.isArray(options.codexRoot) ? [...options.codexRoot, resolved]
        : options.codexRoot === path.join(os.homedir(), '.codex') ? [resolved] : [options.codexRoot, resolved];
      continue;
    }
    options[key] = ['port', 'intervalSeconds'].includes(key) ? Number(value)
      : ['host', 'retentionDays', 'date', 'sourceId'].includes(key) ? value : path.resolve(value);
  }
  if (!Number.isInteger(options.port) || options.port < 1 || options.port > 65535) throw new Error('Port must be an integer from 1 to 65535.');
  if (!Number.isFinite(options.intervalSeconds) || options.intervalSeconds < 2 || options.intervalSeconds > 60) throw new Error('Interval must be from 2 to 60 seconds.');
  if (!/^[a-z0-9:-]{1,80}$/i.test(options.sourceId)) throw new Error('Source id must use letters, numbers, colons, or hyphens.');
  options.retentionDays = normalizeRetentionDays(options.retentionDays);
  if (options.date != null && !/^\d{4}-\d{2}-\d{2}$/.test(options.date)) throw new Error('Summary date must use YYYY-MM-DD.');
  return options;
}

function printHelp() {
  console.log(`Dual Codex Day v${packageMetadata.version}\n\nUsage:\n  node scripts/codex-day.mjs [options]\n  node scripts/codex-day.mjs doctor [--json] [--verbose]\n  node scripts/codex-day.mjs summary [--date YYYY-MM-DD] [--json]\n  node scripts/codex-day.mjs pricing [--candidate file] [--json]\n\nOptions:\n  --once                 Build once and exit\n  --open                 Open the local dashboard\n  --codex-root <path>    Codex data directory (repeat for a combined source)\n  --database <path>      SQLite index path\n  --dashboard <path>     Generated HTML path\n  --pricing <path>       Pricing snapshot path\n  --candidate <path>     Candidate snapshot to compare without writing\n  --pid-file <path>      Write the running service PID to a file\n  --source-id <id>       Opaque identifier reported by the local service\n  --host <host>          HTTP host (default 127.0.0.1)\n  --port <port>          HTTP port (default 8765)\n  --interval <seconds>   Poll interval from 2 to 60\n  --retention-days <n>   Keep all history or 1-36500 days (default all)\n  --date <YYYY-MM-DD>    Local date for the summary command\n  --json                 Print command output as JSON\n  --verbose              Include private local paths in doctor output\n`);
}

function doctorReport(options) {
  const issues = [];
  let logFiles = 0;
  try {
    logFiles = scanLogFiles(options.codexRoot).length;
  } catch {
    issues.push({ level: 'error', code: 'source-unavailable', message: 'Codex session directories are unavailable.' });
  }

  let database = { exists: existsSync(options.databasePath), schemaVersion: null, supportedSchemaVersion: SCHEMA_VERSION };
  if (database.exists) {
    let connection;
    try {
      connection = new DatabaseSync(options.databasePath, { readOnly: true, timeout: 3000 });
      database.schemaVersion = Number(connection.prepare('PRAGMA user_version').get().user_version);
      if (database.schemaVersion === SCHEMA_VERSION) {
        database.diagnostics = getIndexDiagnostics(connection);
        if (database.diagnostics.status === 'warning') issues.push({ level: 'warning', code: 'parse-warnings', message: 'The index contains records that need attention.' });
        if (database.diagnostics.status === 'error') issues.push({ level: 'error', code: 'index-errors', message: 'The index contains unreadable source files.' });
      }
      else if (database.schemaVersion < SCHEMA_VERSION) {
        const stats = connection.prepare('SELECT COUNT(*) AS files, COUNT(DISTINCT session_id) AS sessions FROM source_files').get();
        const events = connection.prepare('SELECT COUNT(DISTINCT event_key) AS count FROM usage_events').get();
        database.counts = { files: Number(stats.files), sessions: Number(stats.sessions), events: Number(events.count) };
        issues.push({ level: 'warning', code: 'schema-upgrade-pending', message: 'The index will be upgraded on the next normal start.' });
      } else {
        issues.push({ level: 'error', code: 'schema-newer', message: 'The index schema is newer than this Dual Codex Day version.' });
      }
    } catch {
      issues.push({ level: 'error', code: 'database-unreadable', message: 'The SQLite index could not be read.' });
    } finally {
      connection?.close();
    }
  } else {
    issues.push({ level: 'warning', code: 'database-missing', message: 'The SQLite index has not been created yet.' });
  }

  const report = {
    version: packageMetadata.version,
    status: issues.some(issue => issue.level === 'error') ? 'error' : issues.length ? 'warning' : 'ok',
    runtime: { node: process.version, platform: process.platform, arch: process.arch },
    source: { readable: !issues.some(issue => issue.code === 'source-unavailable'), logFiles },
    database,
    service: {
      host: options.host,
      port: options.port,
      intervalSeconds: options.intervalSeconds,
      retentionDays: options.retentionDays ?? 'all'
    },
    issues
  };
  if (options.verbose) report.paths = { codexRoot: options.codexRoot, database: options.databasePath, dashboard: options.dashboardPath };
  return report;
}

function printDoctor(report, asJson) {
  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  console.log(`Dual Codex Day doctor v${report.version}`);
  console.log(`Status: ${report.status.toUpperCase()}`);
  console.log(`Runtime: ${report.runtime.node} · ${report.runtime.platform}/${report.runtime.arch}`);
  console.log(`Source: ${report.source.logFiles} JSONL files`);
  console.log(`Database: ${report.database.exists ? `schema v${report.database.schemaVersion}` : 'not created'}`);
  console.log(`Retention: ${report.service.retentionDays === 'all' ? 'all history' : `${report.service.retentionDays} days`}`);
  report.issues.forEach(issue => console.log(`${issue.level.toUpperCase()}: ${issue.code} · ${issue.message}`));
  if (report.paths) Object.entries(report.paths).forEach(([name, value]) => console.log(`${name}: ${value}`));
}

function printSummary(summary, asJson) {
  if (asJson) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }
  console.log(`Dual Codex Day summary · ${summary.date}`);
  console.log(`Tokens: ${Math.round(summary.tokens.total).toLocaleString('en-US')}`);
  console.log(`Calls: ${summary.calls.toLocaleString('en-US')} · Tasks: ${summary.tasks.toLocaleString('en-US')}`);
  console.log(`Cache rate: ${(summary.cacheRate * 100).toFixed(1)}%`);
  if (summary.topModel) console.log(`Top model: ${summary.topModel.name}`);
}

function pricingReport(options) {
  const current = loadPricing(options.pricingPath);
  const report = { audit: auditPricing(current) };
  if (options.candidatePath) {
    const candidate = loadPricing(options.candidatePath);
    report.candidateAudit = auditPricing(candidate);
    report.diff = diffPricing(current, candidate);
  }
  return report;
}

function printPricing(report, asJson) {
  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  const { audit } = report;
  console.log(`Dual Codex Day pricing · ${audit.version || 'unversioned'}`);
  console.log(`Status: ${audit.status.toUpperCase()} · ${audit.counts.models} models`);
  console.log(`Verified: ${audit.counts.current} current · ${audit.counts.review} review · ${audit.counts.stale} stale · ${audit.counts.unverified} unverified`);
  audit.issues.forEach(issue => console.log(`${issue.level.toUpperCase()}: ${issue.code} · ${issue.message}`));
  if (!report.diff) return;
  console.log(`Candidate: ${report.diff.changed ? 'changes found' : 'no changes'}`);
  if (report.diff.addedModels.length) console.log(`Added models: ${report.diff.addedModels.join(', ')}`);
  if (report.diff.removedModels.length) console.log(`Removed models: ${report.diff.removedModels.join(', ')}`);
  report.diff.changedModels.forEach(item => console.log(`${item.model}: ${item.changes.map(change => `${change.field} ${change.from ?? 'null'} -> ${change.to ?? 'null'}`).join(', ')}`));
  if (report.diff.verificationChanges.length) console.log(`Verification dates changed: ${report.diff.verificationChanges.length}`);
  report.diff.configurationChanges.forEach(change => console.log(`${change.field}: ${JSON.stringify(change.from)} -> ${JSON.stringify(change.to)}`));
}

function processIsRunning(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; } catch { return false; }
}

function acquirePidFile(filePath) {
  if (!filePath) return () => {};
  mkdirSync(path.dirname(filePath), { recursive: true });
  if (existsSync(filePath)) {
    const existingPid = Number(readFileSync(filePath, 'utf8').trim());
    if (processIsRunning(existingPid)) throw new Error(`Dual Codex Day is already running with PID ${existingPid}.`);
    unlinkSync(filePath);
  }
  writeFileSync(filePath, `${process.pid}\n`, { encoding: 'utf8', flag: 'wx' });
  let released = false;
  return () => {
    if (released) return;
    released = true;
    try {
      if (Number(readFileSync(filePath, 'utf8').trim()) === process.pid) unlinkSync(filePath);
    } catch {}
  };
}

function openUrl(url) {
  const command = process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]]
    : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
  const child = spawn(command[0], command[1], { detached: true, stdio: 'ignore', windowsHide: true });
  child.unref();
}

function contentType(filePath) {
  if (filePath.endsWith('.html')) return 'text/html; charset=utf-8';
  if (filePath.endsWith('.css')) return 'text/css; charset=utf-8';
  if (filePath.endsWith('.js')) return 'text/javascript; charset=utf-8';
  if (filePath.endsWith('.svg')) return 'image/svg+xml';
  return 'application/octet-stream';
}

function sendFile(response, filePath, method) {
  if (!existsSync(filePath)) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found');
    return;
  }
  const size = statSync(filePath).size;
  response.writeHead(200, {
    'Content-Type': contentType(filePath),
    'Content-Length': size,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  if (method === 'HEAD') response.end(); else createReadStream(filePath).pipe(response);
}

const options = parseArgs(process.argv.slice(2));
if (options.help) {
  printHelp();
  process.exit(0);
}
if (options.command === 'doctor') {
  const report = doctorReport(options);
  printDoctor(report, options.json);
  process.exit(report.status === 'error' ? 1 : 0);
}
if (options.command === 'summary') {
  if (!existsSync(options.databasePath)) throw new Error('The SQLite index has not been created yet. Start Dual Codex Day first.');
  const summaryDatabase = new DatabaseSync(options.databasePath, { readOnly: true, timeout: 3000 });
  try { printSummary(readDailySummary(summaryDatabase, options.date || undefined), options.json); }
  finally { summaryDatabase.close(); }
  process.exit(0);
}
if (options.command === 'pricing') {
  const report = pricingReport(options);
  printPricing(report, options.json);
  process.exit(report.audit.status === 'error' || report.candidateAudit?.status === 'error' ? 1 : 0);
}
const releasePidFile = acquirePidFile(options.pidFile);
process.on('exit', releasePidFile);

const paths = {
  templatePath: path.join(repoRoot, 'src', 'index.template.html'),
  stylesheetPath: path.join(repoRoot, 'src', 'token-dashboard.css'),
  pricingPath: options.pricingPath,
  logoPath: path.join(repoRoot, 'assets', 'codex-day-mark.svg'),
  dashboardPath: options.dashboardPath,
  databasePath: options.databasePath
};
const database = openIndex(options.databasePath);
let latestPayload;
let latestIndex;
let latestError = null;
let updating = false;

function update(forceBuild = false) {
  if (updating) return null;
  updating = true;
  try {
    const result = refreshIndex(database, options.codexRoot, { retentionDays: options.retentionDays });
    if (forceBuild || result.changedFiles || result.removedFiles || result.failedFiles || result.prunedEvents || result.policyChanged || !existsSync(options.dashboardPath)) {
      latestPayload = buildDashboard(database, { ...paths, indexResult: result });
    }
    latestIndex = result;
    latestError = null;
    return result;
  } finally {
    updating = false;
  }
}

const initial = update(true);
console.log(`Indexed: ${initial.eventCount} calls, ${initial.sessionCount} sessions, ${initial.filesScanned} files (${initial.changedFiles} changed)`);
console.log(`Database: ${options.databasePath}`);
console.log(`Dashboard: ${options.dashboardPath}`);

if (options.once) {
  database.close();
  process.exit(0);
}

const outputDirectory = path.dirname(options.dashboardPath);
const server = createServer((request, response) => {
  const method = request.method || 'GET';
  if (!['GET', 'HEAD'].includes(method)) {
    response.writeHead(405, { Allow: 'GET, HEAD' }); response.end(); return;
  }
  const url = new URL(request.url || '/', 'http://localhost');
  if (url.pathname === '/healthz') {
    const body = JSON.stringify({ ok: true, version: packageMetadata.version, sourceId: options.sourceId });
    response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body), 'Cache-Control': 'no-store' });
    response.end(method === 'HEAD' ? undefined : body);
    return;
  }
  if (url.pathname === '/api/status') {
    const diagnostics = getIndexDiagnostics(database, { indexResult: latestIndex });
    if (latestError) diagnostics.status = 'error';
    const body = JSON.stringify({
      ok: !latestError,
      version: packageMetadata.version,
      sourceId: options.sourceId,
      engine: 'sqlite',
      generatedAt: latestPayload?.generatedAt || null,
      diagnostics,
      lastError: latestError
    });
    response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body), 'Cache-Control': 'no-store' });
    response.end(method === 'HEAD' ? undefined : body);
    return;
  }
  if (url.pathname === '/api/summary') {
    const requestedDate = url.searchParams.get('date');
    if (requestedDate && !/^\d{4}-\d{2}-\d{2}$/.test(requestedDate)) {
      const body = JSON.stringify({ ok: false, error: 'date must use YYYY-MM-DD' });
      response.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body), 'Cache-Control': 'no-store' });
      response.end(method === 'HEAD' ? undefined : body);
      return;
    }
    const summary = readDailySummary(database, requestedDate || undefined);
    const body = JSON.stringify({ ok: true, version: packageMetadata.version, summary });
    response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body), 'Cache-Control': 'no-store' });
    response.end(method === 'HEAD' ? undefined : body);
    return;
  }
  const routes = new Map([
    ['/', options.dashboardPath], ['/index.html', options.dashboardPath],
    ['/token-dashboard.css', path.join(outputDirectory, 'token-dashboard.css')],
    ['/codex-day-mark.svg', path.join(outputDirectory, 'codex-day-mark.svg')],
    ['/live-update.js', path.join(outputDirectory, 'live-update.js')]
  ]);
  const filePath = routes.get(url.pathname);
  if (!filePath) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); response.end('Not found'); return;
  }
  sendFile(response, filePath, method);
});

let timer;
server.on('error', error => {
  if (timer) clearInterval(timer);
  database.close();
  releasePidFile();
  console.error(`Local service failed: ${error.message}`);
  process.exit(1);
});

server.listen(options.port, options.host, () => {
  const dashboardUrl = `http://${options.host}:${options.port}/?live=1`;
  console.log(`Local service: ${dashboardUrl}`);
  console.log(`Live indexing every ${options.intervalSeconds} seconds. Press Ctrl+C to stop.`);
  if (options.open) openUrl(dashboardUrl);
});

timer = setInterval(() => {
  try {
    const result = update(false);
    if (result && (result.changedFiles || result.removedFiles)) {
      console.log(`Updated: ${result.eventCount} calls, ${result.changedFiles} changed files, ${result.removedFiles} removed files`);
    }
  } catch (error) {
    latestError = { category: 'index-refresh', at: new Date().toISOString() };
    console.warn(`Index refresh failed: ${error.message}`);
  }
}, options.intervalSeconds * 1000);

function shutdown() {
  if (timer) clearInterval(timer);
  server.close(() => {
    database.close();
    releasePidFile();
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
