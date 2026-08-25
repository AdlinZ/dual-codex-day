import { appendFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { buildDashboard, openIndex, refreshIndex } from './lib/session-index.mjs';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.dirname(scriptDirectory);
const temporaryRoot = mkdtempSync(path.join(os.tmpdir(), 'codex-day-index-test-'));
const codexRoot = path.join(temporaryRoot, '.codex');
const sessionDirectory = path.join(codexRoot, 'sessions', '2026', '08', '24');
const logPath = path.join(sessionDirectory, 'fixture.jsonl');
const databasePath = path.join(temporaryRoot, 'index.sqlite');
const dashboardPath = path.join(temporaryRoot, 'dist', 'index.html');
const migrationPath = path.join(temporaryRoot, 'legacy.sqlite');

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
    '{invalid-json',
    tokenEvent('2026-06-01T01:00:00.000Z', 500, 200, 50),
    tokenEvent('2026-08-24T01:00:00.000Z', 1000, 700, 100),
    tokenEvent('2026-08-24T02:00:00.000Z', 2000, 1500, 200),
    tokenEvent('2026-08-24T02:00:00.000Z', 2000, 1500, 200),
    tokenEvent('invalid-time', 100, 50, 10),
    tokenEvent('2026-08-24T02:30:00.000Z', 0, 0, 0)
  ];
  writeFileSync(logPath, `${initialLines.join('\n')}\n`, 'utf8');
  database = openIndex(databasePath);

  const first = refreshIndex(database, codexRoot);
  assert(first.changedFiles === 1 && first.eventCount === 3, 'first index should parse one file and deduplicate three events');
  const payload = buildDashboard(database, {
    templatePath: path.join(root, 'src', 'index.template.html'),
    stylesheetPath: path.join(root, 'src', 'token-dashboard.css'),
    pricingPath: path.join(root, 'config', 'pricing.json'),
    logoPath: path.join(root, 'assets', 'codex-day-mark.svg'),
    dashboardPath,
    indexResult: first
  });
  assert(payload.index.engine === 'sqlite' && payload.events.length === 3, 'dashboard payload should come from SQLite');
  assert(payload.diagnostics.schemaVersion === 2 && payload.diagnostics.status === 'warning', 'dashboard should expose schema v2 diagnostics');
  assert(payload.diagnostics.counts.invalidJson === 1 && payload.diagnostics.counts.invalidTimestamp === 1, 'diagnostics should count invalid JSON and timestamps');
  assert(payload.diagnostics.counts.duplicateEvents === 1 && payload.diagnostics.counts.emptyUsage === 1, 'diagnostics should count duplicate and empty usage records');
  assert(!readFileSync(dashboardPath, 'utf8').includes('private-session-id'), 'generated dashboard must not expose raw session ids');

  const unchanged = refreshIndex(database, codexRoot);
  assert(unchanged.changedFiles === 0 && unchanged.unchangedFiles === 1, 'unchanged files should not be reparsed');

  const rawLogBeforeRetention = readFileSync(logPath, 'utf8');
  const retained = refreshIndex(database, codexRoot, { retentionDays: 30, now: new Date('2026-08-24T12:00:00Z') });
  assert(retained.policyChanged && retained.eventCount === 2, '30 day retention should remove the old indexed event');
  const retainedUnchanged = refreshIndex(database, codexRoot, { retentionDays: 30, now: new Date('2026-08-24T12:00:00Z') });
  assert(retainedUnchanged.changedFiles === 0 && retainedUnchanged.eventCount === 2, 'unchanged retained files should not be reparsed');
  const restored = refreshIndex(database, codexRoot, { retentionDays: 'all', now: new Date('2026-08-24T12:00:00Z') });
  assert(restored.policyChanged && restored.changedFiles === 1 && restored.eventCount === 3, 'expanding retention should rescan and restore history');
  assert(readFileSync(logPath, 'utf8') === rawLogBeforeRetention, 'retention changes must not modify the source JSONL');

  appendFileSync(logPath, `${tokenEvent('2026-08-24T03:00:00.000Z', 3000, 2400, 300)}\n`, 'utf8');
  const incremental = refreshIndex(database, codexRoot);
  assert(incremental.changedFiles === 1 && incremental.eventCount === 4, 'changed file should be incrementally replaced');

  rmSync(logPath);
  const removed = refreshIndex(database, codexRoot);
  assert(removed.removedFiles === 1 && removed.eventCount === 0, 'removed files should be deleted from the index');

  const legacy = new DatabaseSync(migrationPath);
  legacy.exec(`
    CREATE TABLE source_files (path TEXT PRIMARY KEY, size INTEGER NOT NULL, mtime_ms REAL NOT NULL, session_id TEXT NOT NULL, indexed_at TEXT NOT NULL);
    CREATE TABLE usage_events (source_path TEXT NOT NULL, event_key TEXT NOT NULL, timestamp TEXT NOT NULL, date TEXT NOT NULL, session_id TEXT NOT NULL, model TEXT NOT NULL, project TEXT NOT NULL, project_id TEXT NOT NULL, input INTEGER NOT NULL, cached_input INTEGER NOT NULL, cache_write_input INTEGER NOT NULL, uncached_input INTEGER NOT NULL, output INTEGER NOT NULL, reasoning_output INTEGER NOT NULL, unclassified INTEGER NOT NULL, total INTEGER NOT NULL, context_window INTEGER NOT NULL, PRIMARY KEY (source_path, event_key));
    PRAGMA user_version = 1;
  `);
  legacy.close();
  const migrated = openIndex(migrationPath);
  const columns = new Set(migrated.prepare('PRAGMA table_info(source_files)').all().map(column => column.name));
  assert(Number(migrated.prepare('PRAGMA user_version').get().user_version) === 2 && columns.has('invalid_json') && columns.has('parse_status'), 'schema v1 should migrate to v2');
  migrated.close();

  const secondCodexRoot = path.join(temporaryRoot, '.codex-profile');
  const secondSessionDirectory = path.join(secondCodexRoot, 'sessions', '2026', '08', '24');
  mkdirSync(secondSessionDirectory, { recursive: true });
  writeFileSync(logPath, `${[
    JSON.stringify({ type: 'session_meta', payload: { id: 'default-account-session', cwd: path.join(temporaryRoot, 'default-project') } }),
    JSON.stringify({ type: 'turn_context', payload: { model: 'gpt-5.6-sol', cwd: path.join(temporaryRoot, 'default-project') } }),
    tokenEvent('2026-08-24T04:00:00.000Z', 400, 300, 40)
  ].join('\n')}\n`, 'utf8');
  writeFileSync(path.join(secondSessionDirectory, 'profile.jsonl'), `${[
    JSON.stringify({ type: 'session_meta', payload: { id: 'profile-account-session', cwd: path.join(temporaryRoot, 'profile-project') } }),
    JSON.stringify({ type: 'turn_context', payload: { model: 'gpt-5.6-sol', cwd: path.join(temporaryRoot, 'profile-project') } }),
    tokenEvent('2026-08-24T05:00:00.000Z', 800, 600, 80)
  ].join('\n')}\n`, 'utf8');
  const combined = refreshIndex(database, [codexRoot, secondCodexRoot]);
  assert(combined.filesScanned === 2 && combined.eventCount === 2, 'combined source should index both isolated CODEX_HOME roots');
  const isolated = refreshIndex(database, codexRoot);
  assert(isolated.filesScanned === 1 && isolated.removedFiles === 1 && isolated.eventCount === 1, 'isolated source must remove events from every unselected CODEX_HOME root');

  console.log('SQLite index checks passed: diagnostics, retention, migration, multi-root totals, and source isolation.');
} finally {
  if (database) database.close();
  const resolved = path.resolve(temporaryRoot);
  if (resolved.startsWith(path.resolve(os.tmpdir())) && path.basename(resolved).startsWith('codex-day-index-test-')) {
    rmSync(resolved, { recursive: true, force: true });
  }
}
