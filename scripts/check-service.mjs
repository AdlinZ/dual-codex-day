import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { spawn, spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.dirname(scriptDirectory);
const packageMetadata = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
const temporaryRoot = mkdtempSync(path.join(os.tmpdir(), 'codex-day-service-test-'));
const codexRoot = path.join(temporaryRoot, '.codex');
const sessionDirectory = path.join(codexRoot, 'sessions', '2026', '08', '24');
const databasePath = path.join(temporaryRoot, 'index.sqlite');
const dashboardPath = path.join(temporaryRoot, 'dist', 'index.html');
const pidPath = path.join(temporaryRoot, 'service.pid');
const children = new Set();

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function delay(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

async function availablePort() {
  const server = createServer();
  await new Promise((resolve, reject) => server.once('error', reject).listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}

function startService(port) {
  const child = spawn(process.execPath, [
    path.join(root, 'scripts', 'codex-day.mjs'),
    '--codex-root', codexRoot,
    '--database', databasePath,
    '--dashboard', dashboardPath,
    '--pid-file', pidPath,
    '--host', '127.0.0.1',
    '--port', String(port),
    '--interval', '2'
  ], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
  child.output = '';
  child.stdout.on('data', chunk => { child.output += chunk; });
  child.stderr.on('data', chunk => { child.output += chunk; });
  children.add(child);
  child.once('exit', () => children.delete(child));
  return child;
}

async function waitForHealth(port, child) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (child.exitCode != null) throw new Error(`service exited before becoming healthy:\n${child.output}`);
    try {
      const response = await fetch(`http://127.0.0.1:${port}/healthz`);
      if (response.ok) return response.json();
    } catch {}
    await delay(100);
  }
  throw new Error(`service did not become healthy:\n${child.output}`);
}

async function waitForExit(child) {
  if (child.exitCode != null) return child.exitCode;
  return new Promise(resolve => child.once('exit', resolve));
}

let first;
let second;
try {
  mkdirSync(sessionDirectory, { recursive: true });
  const fixture = [
    JSON.stringify({ type: 'session_meta', payload: { id: 'service-test', cwd: path.join(temporaryRoot, 'project') } }),
    JSON.stringify({ type: 'turn_context', payload: { model: 'gpt-5.6-sol', cwd: path.join(temporaryRoot, 'project') } }),
    JSON.stringify({
      timestamp: '2026-08-24T01:00:00.000Z', type: 'event_msg',
      payload: { type: 'token_count', info: { last_token_usage: { input_tokens: 100, cached_input_tokens: 50, output_tokens: 20, total_tokens: 120 } } }
    })
  ];
  writeFileSync(path.join(sessionDirectory, 'fixture.jsonl'), `${fixture.join('\n')}\n`, 'utf8');

  const port = await availablePort();
  first = startService(port);
  const firstStatus = await waitForHealth(port, first);
  assert(firstStatus.ok && firstStatus.version === packageMetadata.version, 'service health should report liveness and package version');
  const statusResponse = await fetch(`http://127.0.0.1:${port}/api/status`);
  const status = await statusResponse.json();
  assert(status.ok && status.diagnostics.schemaVersion === 2 && status.diagnostics.counts.events === 1, 'status endpoint should expose schema v2 diagnostics');
  assert(!JSON.stringify(status).includes(temporaryRoot), 'status endpoint must not expose private local paths');
  const summaryResponse = await fetch(`http://127.0.0.1:${port}/api/summary?date=2026-08-24`);
  const summaryPayload = await summaryResponse.json();
  assert(summaryPayload.ok && summaryPayload.summary.calls === 1 && summaryPayload.summary.tasks === 1, 'summary endpoint should aggregate calls and tasks for a local date');
  assert(summaryPayload.summary.tokens.total === 120 && summaryPayload.summary.tokens.cachedInput === 50, 'summary endpoint should aggregate token components');
  assert(!JSON.stringify(summaryPayload).includes(temporaryRoot) && !JSON.stringify(summaryPayload).includes('service-test'), 'summary endpoint must omit paths and session identifiers');
  const invalidSummary = await fetch(`http://127.0.0.1:${port}/api/summary?date=not-a-date`);
  assert(invalidSummary.status === 400, 'summary endpoint should reject invalid dates');
  const summaryCommand = spawnSync(process.execPath, [path.join(root, 'scripts', 'codex-day.mjs'), 'summary', '--json', '--date', '2026-08-24', '--database', databasePath], { cwd: root, encoding: 'utf8' });
  const commandSummary = JSON.parse(summaryCommand.stdout);
  assert(summaryCommand.status === 0 && commandSummary.tokens.total === 120, 'summary command should return the same read-only daily aggregate');
  const doctor = spawnSync(process.execPath, [path.join(root, 'scripts', 'codex-day.mjs'), 'doctor', '--json', '--codex-root', codexRoot, '--database', databasePath, '--dashboard', dashboardPath], { cwd: root, encoding: 'utf8' });
  const doctorReport = JSON.parse(doctor.stdout);
  assert(doctor.status === 0 && doctorReport.status === 'ok', 'doctor should report a healthy fixture');
  assert(!doctor.stdout.includes(temporaryRoot), 'doctor JSON should omit private paths by default');
  const logoResponse = await fetch(`http://127.0.0.1:${port}/codex-day-mark.svg`);
  assert(logoResponse.ok && logoResponse.headers.get('content-type') === 'image/svg+xml', 'service should expose the generated logo asset');
  assert(Number(readFileSync(pidPath, 'utf8').trim()) === first.pid, 'PID file should identify the running service');

  const duplicate = startService(port);
  const duplicateExit = await waitForExit(duplicate);
  assert(duplicateExit !== 0 && /already running with PID/.test(duplicate.output), 'a duplicate PID owner should be rejected');

  first.kill();
  await waitForExit(first);
  first = null;

  second = startService(port);
  await waitForHealth(port, second);
  assert(Number(readFileSync(pidPath, 'utf8').trim()) === second.pid, 'a stale PID file should be replaced on restart');
  console.log('Service checks passed: health, diagnostics, daily summary privacy, doctor, PID ownership, duplicate rejection, and stale PID recovery.');
} finally {
  for (const child of children) child.kill();
  if (second) await waitForExit(second);
  if (first) await waitForExit(first);
  const resolved = path.resolve(temporaryRoot);
  if (resolved.startsWith(path.resolve(os.tmpdir())) && path.basename(resolved).startsWith('codex-day-service-test-')) {
    for (let attempt = 0; attempt < 20 && existsSync(resolved); attempt += 1) {
      try { rmSync(resolved, { recursive: true, force: true }); } catch { await delay(100); }
    }
  }
}
