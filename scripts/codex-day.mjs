import { createReadStream, existsSync, mkdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { buildDashboard, openIndex, refreshIndex } from './lib/session-index.mjs';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.dirname(scriptDirectory);

function parseArgs(argv) {
  const options = {
    codexRoot: path.join(os.homedir(), '.codex'),
    databasePath: path.join(repoRoot, '.codex-day', 'codex-day.sqlite'),
    dashboardPath: path.join(repoRoot, 'dist', 'index.html'),
    host: '127.0.0.1',
    port: 8765,
    intervalSeconds: 4,
    pidFile: null,
    once: false,
    open: false
  };
  const valueOptions = new Map([
    ['--codex-root', 'codexRoot'], ['--database', 'databasePath'], ['--dashboard', 'dashboardPath'], ['--pid-file', 'pidFile'],
    ['--host', 'host'], ['--port', 'port'], ['--interval', 'intervalSeconds']
  ]);
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--once') { options.once = true; continue; }
    if (arg === '--open') { options.open = true; continue; }
    if (arg === '--help' || arg === '-h') { options.help = true; continue; }
    const key = valueOptions.get(arg);
    if (!key || argv[index + 1] == null) throw new Error(`Unknown or incomplete option: ${arg}`);
    const value = argv[++index];
    options[key] = ['port', 'intervalSeconds'].includes(key) ? Number(value)
      : key === 'host' ? value : path.resolve(value);
  }
  if (!Number.isInteger(options.port) || options.port < 1 || options.port > 65535) throw new Error('Port must be an integer from 1 to 65535.');
  if (!Number.isFinite(options.intervalSeconds) || options.intervalSeconds < 2 || options.intervalSeconds > 60) throw new Error('Interval must be from 2 to 60 seconds.');
  return options;
}

function printHelp() {
  console.log(`codex-day v0.6\n\nUsage:\n  node scripts/codex-day.mjs [options]\n\nOptions:\n  --once                 Build once and exit\n  --open                 Open the local dashboard\n  --codex-root <path>    Codex data directory\n  --database <path>      SQLite index path\n  --dashboard <path>     Generated HTML path\n  --pid-file <path>      Write the running service PID to a file\n  --host <host>          HTTP host (default 127.0.0.1)\n  --port <port>          HTTP port (default 8765)\n  --interval <seconds>   Poll interval from 2 to 60\n`);
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
    if (processIsRunning(existingPid)) throw new Error(`codex-day is already running with PID ${existingPid}.`);
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
const releasePidFile = acquirePidFile(options.pidFile);
process.on('exit', releasePidFile);

const paths = {
  templatePath: path.join(repoRoot, 'src', 'index.template.html'),
  stylesheetPath: path.join(repoRoot, 'src', 'token-dashboard.css'),
  pricingPath: path.join(repoRoot, 'config', 'pricing.json'),
  dashboardPath: options.dashboardPath
};
const database = openIndex(options.databasePath);
let latestPayload;
let latestIndex;
let updating = false;

function update(forceBuild = false) {
  if (updating) return null;
  updating = true;
  try {
    const result = refreshIndex(database, options.codexRoot);
    if (forceBuild || result.changedFiles || result.removedFiles || !existsSync(options.dashboardPath)) {
      latestPayload = buildDashboard(database, { ...paths, indexResult: result });
    }
    latestIndex = result;
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
  if (url.pathname === '/healthz' || url.pathname === '/api/status') {
    const body = JSON.stringify({
      ok: true,
      engine: 'sqlite',
      generatedAt: latestPayload?.generatedAt || null,
      events: latestIndex?.eventCount || 0,
      sessions: latestIndex?.sessionCount || 0,
      files: latestIndex?.filesScanned || 0,
      changedFiles: latestIndex?.changedFiles || 0
    });
    response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body), 'Cache-Control': 'no-store' });
    response.end(method === 'HEAD' ? undefined : body);
    return;
  }
  const routes = new Map([
    ['/', options.dashboardPath], ['/index.html', options.dashboardPath],
    ['/token-dashboard.css', path.join(outputDirectory, 'token-dashboard.css')],
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
