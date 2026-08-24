import { appendFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDashboard, openIndex, refreshIndex } from './lib/session-index.mjs';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.dirname(scriptDirectory);
const temporaryRoot = mkdtempSync(path.join(os.tmpdir(), 'codex-day-index-test-'));
const codexRoot = path.join(temporaryRoot, '.codex');
const sessionDirectory = path.join(codexRoot, 'sessions', '2026', '08', '24');
const logPath = path.join(sessionDirectory, 'fixture.jsonl');
const databasePath = path.join(temporaryRoot, 'index.sqlite');
const dashboardPath = path.join(temporaryRoot, 'dist', 'index.html');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function tokenEvent(timestamp, input, cached, output) {
  return JSON.stringify({
    timestamp,
    type: 'event_msg',
    payload: {
      type: 'token_count',
      info: {
        last_token_usage: {
          input_tokens: input,
          cached_input_tokens: cached,
          cache_write_input_tokens: 0,
          output_tokens: output,
          reasoning_output_tokens: Math.floor(output / 4),
          total_tokens: input + output
        },
        model_context_window: 258400
      }
    }
  });
}

let database;
try {
  mkdirSync(sessionDirectory, { recursive: true });
  const initialLines = [
    JSON.stringify({ type: 'session_meta', payload: { id: 'private-session-id', cwd: path.join(temporaryRoot, 'fictional-project') } }),
    JSON.stringify({ type: 'turn_context', payload: { model: 'gpt-5.6-sol', cwd: path.join(temporaryRoot, 'fictional-project') } }),
    tokenEvent('2026-08-24T01:00:00.000Z', 1000, 700, 100),
    tokenEvent('2026-08-24T02:00:00.000Z', 2000, 1500, 200),
    tokenEvent('2026-08-24T02:00:00.000Z', 2000, 1500, 200)
  ];
  writeFileSync(logPath, `${initialLines.join('\n')}\n`, 'utf8');
  database = openIndex(databasePath);

  const first = refreshIndex(database, codexRoot);
  assert(first.changedFiles === 1 && first.eventCount === 2, 'first index should parse one file and deduplicate two events');
  const payload = buildDashboard(database, {
    templatePath: path.join(root, 'src', 'index.template.html'),
    stylesheetPath: path.join(root, 'src', 'token-dashboard.css'),
    pricingPath: path.join(root, 'config', 'pricing.json'),
    dashboardPath,
    indexResult: first
  });
  assert(payload.index.engine === 'sqlite' && payload.events.length === 2, 'dashboard payload should come from SQLite');
  assert(!readFileSync(dashboardPath, 'utf8').includes('private-session-id'), 'generated dashboard must not expose raw session ids');

  const unchanged = refreshIndex(database, codexRoot);
  assert(unchanged.changedFiles === 0 && unchanged.unchangedFiles === 1, 'unchanged files should not be reparsed');

  appendFileSync(logPath, `${tokenEvent('2026-08-24T03:00:00.000Z', 3000, 2400, 300)}\n`, 'utf8');
  const incremental = refreshIndex(database, codexRoot);
  assert(incremental.changedFiles === 1 && incremental.eventCount === 3, 'changed file should be incrementally replaced');

  rmSync(logPath);
  const removed = refreshIndex(database, codexRoot);
  assert(removed.removedFiles === 1 && removed.eventCount === 0, 'removed files should be deleted from the index');
  console.log('SQLite index checks passed: full, unchanged, changed, deduplicated, and removed file paths.');
} finally {
  if (database) database.close();
  const resolved = path.resolve(temporaryRoot);
  if (resolved.startsWith(path.resolve(os.tmpdir())) && path.basename(resolved).startsWith('codex-day-index-test-')) {
    rmSync(resolved, { recursive: true, force: true });
  }
}
