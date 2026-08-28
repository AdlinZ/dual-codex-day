import { appendFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { buildDashboard, getIndexDiagnostics, openIndex, readDailySummary, readIndexedEvents, refreshIndex } from './lib/session-index.mjs';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.dirname(scriptDirectory);
const temporaryRoot = mkdtempSync(path.join(os.tmpdir(), 'codex-day-index-test-'));
const codexRoot = path.join(temporaryRoot, '.codex');
const sessionDirectory = path.join(codexRoot, 'sessions', '2026', '08', '24');
const rootId = '11111111-1111-4111-8111-111111111111';
const logPath = path.join(sessionDirectory, `rollout-2026-08-24T09-00-00-${rootId}.jsonl`);
const databasePath = path.join(temporaryRoot, 'index.sqlite');
const dashboardPath = path.join(temporaryRoot, 'dist', 'index.html');
const migrationPath = path.join(temporaryRoot, 'legacy.sqlite');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sessionMeta(id, cwd, timestamp = '2026-08-24T00:00:00.000Z', extra = {}) {
  return JSON.stringify({ timestamp, type: 'session_meta', payload: { id, cwd, ...extra } });
}

function turnContext(model, cwd) {
  return JSON.stringify({ type: 'turn_context', payload: { model, cwd } });
}

function tokenEvent(timestamp, input, cached, output, options = {}) {
  const usage = values => ({
    input_tokens: values.input,
    cached_input_tokens: values.cached,
    output_tokens: values.output,
    reasoning_output_tokens: Math.floor(values.output / 4),
    total_tokens: values.input + values.output
  });
  const info = { model_context_window: 258400 };
  if (options.total !== false) info.total_token_usage = usage(options.total || { input, cached, output });
  if (options.last !== false) info.last_token_usage = usage({ input, cached, output });
  return JSON.stringify({
    timestamp,
    type: 'event_msg',
    payload: {
      type: 'token_count',
      info,
      rate_limits: { limit_id: options.limitId || 'codex' }
    }
  });
}

function writeRollout(directory, id, lines, stamp = '2026-08-24T09-00-00') {
  mkdirSync(directory, { recursive: true });
  const target = path.join(directory, `rollout-${stamp}-${id}.jsonl`);
  writeFileSync(target, `${lines.join('\n')}\n`, 'utf8');
  return target;
}

let database;
let semanticsDatabase;
try {
  mkdirSync(sessionDirectory, { recursive: true });
  const project = path.join(temporaryRoot, 'fictional-project');
  const initialLines = [
    sessionMeta(rootId, project),
    turnContext('gpt-5.6-sol', project),
    '{invalid-json',
    tokenEvent('2026-06-01T01:00:00.000Z', 500, 200, 50),
    tokenEvent('2026-08-24T01:00:00.000Z', 1000, 700, 100),
    turnContext('gpt-5.6-sol', project),
    tokenEvent('2026-08-24T02:00:00.000Z', 2000, 1500, 200),
    tokenEvent('2026-08-24T02:00:00.000Z', 2000, 1500, 200),
    tokenEvent('invalid-time', 100, 50, 10),
    tokenEvent('2026-08-24T02:30:00.000Z', 0, 0, 0)
  ];
  writeFileSync(logPath, `${initialLines.join('\n')}\n`, 'utf8');
  database = openIndex(databasePath);

  const first = refreshIndex(database, codexRoot);
  assert(first.changedFiles === 1 && first.eventCount === 3, 'first index should filter one duplicate cumulative snapshot');
  const payload = buildDashboard(database, {
    templatePath: path.join(root, 'src', 'index.template.html'),
    stylesheetPath: path.join(root, 'src', 'token-dashboard.css'),
    pricingPath: path.join(root, 'config', 'pricing.json'),
    logoPath: path.join(root, 'assets', 'codex-day-mark.svg'),
    dashboardPath,
    indexResult: first
  });
  assert(payload.index.engine === 'sqlite' && payload.events.length === 3, 'dashboard payload should come from SQLite');
  assert(payload.diagnostics.schemaVersion === 4 && payload.diagnostics.status === 'warning', 'dashboard should expose schema v4 diagnostics');
  const daily = readDailySummary(database, '2026-08-24');
  assert(daily.calls === 2 && daily.turns === 2 && daily.tasks === 1, 'daily summary must distinguish model calls, user turns, and tasks');
  assert(payload.diagnostics.counts.invalidJson === 1 && payload.diagnostics.counts.invalidTimestamp === 1, 'diagnostics should count invalid JSON and timestamps');
  assert(payload.diagnostics.counts.duplicateEvents === 1 && payload.diagnostics.counts.emptyUsage === 1, 'diagnostics should count duplicate and empty usage records');
  assert(!readFileSync(dashboardPath, 'utf8').includes(rootId), 'generated dashboard must not expose raw session ids');

  const unchanged = refreshIndex(database, codexRoot);
  assert(unchanged.changedFiles === 0 && unchanged.unchangedFiles === 1, 'unchanged files should not be reparsed');

  const rawLogBeforeRetention = readFileSync(logPath, 'utf8');
  const retained = refreshIndex(database, codexRoot, { retentionDays: 30, now: new Date('2026-08-24T12:00:00Z') });
  assert(retained.policyChanged && retained.eventCount === 2, '30 day retention should remove the old indexed event');
  const restored = refreshIndex(database, codexRoot, { retentionDays: 'all', now: new Date('2026-08-24T12:00:00Z') });
  assert(restored.policyChanged && restored.eventCount === 3, 'expanding retention should rescan and restore available history');
  assert(readFileSync(logPath, 'utf8') === rawLogBeforeRetention, 'retention changes must not modify source JSONL');

  appendFileSync(logPath, `${tokenEvent('2026-08-24T03:00:00.000Z', 3000, 2400, 300)}\n`, 'utf8');
  const incremental = refreshIndex(database, codexRoot);
  assert(incremental.changedFiles === 1 && incremental.eventCount === 4, 'changed file should be replaced with its current canonical events');

  rmSync(logPath);
  const missing = refreshIndex(database, codexRoot);
  assert(missing.retainedMissingFiles === 1 && missing.eventCount === 4, 'missing source files should retain their historical events');
  assert(database.prepare('SELECT present FROM source_files WHERE path = ?').get(logPath).present === 0, 'missing source should be marked absent');

  writeFileSync(logPath, `${[
    sessionMeta(rootId, project),
    turnContext('gpt-5.6-sol', project),
    tokenEvent('2026-08-24T04:00:00.000Z', 400, 300, 40)
  ].join('\n')}\n`, 'utf8');
  const reappeared = refreshIndex(database, codexRoot);
  assert(reappeared.changedFiles === 1 && reappeared.eventCount === 1, 'a reappearing source should replace its retained events');
  const reappearedSource = database.prepare('SELECT present, missing_since FROM source_files WHERE path = ?').get(logPath);
  assert(reappearedSource.present === 1 && reappearedSource.missing_since == null, 'reappearing source should be marked present');

  const legacy = new DatabaseSync(migrationPath);
  legacy.exec(`
    CREATE TABLE source_files (path TEXT PRIMARY KEY, size INTEGER NOT NULL, mtime_ms REAL NOT NULL, session_id TEXT NOT NULL, indexed_at TEXT NOT NULL);
    CREATE TABLE usage_events (source_path TEXT NOT NULL, event_key TEXT NOT NULL, timestamp TEXT NOT NULL, date TEXT NOT NULL, session_id TEXT NOT NULL, model TEXT NOT NULL, project TEXT NOT NULL, project_id TEXT NOT NULL, input INTEGER NOT NULL, cached_input INTEGER NOT NULL, cache_write_input INTEGER NOT NULL, uncached_input INTEGER NOT NULL, output INTEGER NOT NULL, reasoning_output INTEGER NOT NULL, unclassified INTEGER NOT NULL, total INTEGER NOT NULL, context_window INTEGER NOT NULL, PRIMARY KEY (source_path, event_key));
    PRAGMA user_version = 1;
  `);
  legacy.close();
  const migrated = openIndex(migrationPath);
  const sourceColumns = new Set(migrated.prepare('PRAGMA table_info(source_files)').all().map(column => column.name));
  const eventColumns = new Set(migrated.prepare('PRAGMA table_info(usage_events)').all().map(column => column.name));
  assert(Number(migrated.prepare('PRAGMA user_version').get().user_version) === 4
    && ['source_key', 'parser_version', 'present', 'missing_since', 'invalid_json', 'parse_status'].every(name => sourceColumns.has(name))
    && ['turn_id', 'event_index', 'token_signature'].every(name => eventColumns.has(name)), 'schema v1 should migrate through v4');
  migrated.close();

  const semanticsRoot = path.join(temporaryRoot, '.codex-semantics');
  const semanticsSessions = path.join(semanticsRoot, 'sessions', '2026', '08', '24');
  const semanticsArchive = path.join(semanticsRoot, 'archived_sessions');
  const semanticsPath = path.join(temporaryRoot, 'semantics.sqlite');
  const duplicateId = '22222222-2222-4222-8222-222222222222';
  const duplicateLines = [
    sessionMeta(duplicateId, project), turnContext('OpenAI/GPT-5.6-SOL-20260824', project),
    tokenEvent('2026-08-24T05:00:00.000Z', 100, 50, 10),
    tokenEvent('2026-08-24T05:01:00.000Z', 200, 100, 20)
  ];
  writeRollout(semanticsSessions, duplicateId, duplicateLines, '2026-08-24T10-00-00');
  writeRollout(semanticsArchive, duplicateId, duplicateLines, '2026-08-24T10-00-00');

  const fallbackId = '33333333-3333-4333-8333-333333333333';
  writeRollout(semanticsSessions, fallbackId, [
    sessionMeta(fallbackId, project), turnContext('model-a', project),
    tokenEvent('2026-08-24T06:00:00.000Z', 0, 0, 0, { last: false, total: { input: 100, cached: 50, output: 10 } }),
    turnContext('model-b', project),
    tokenEvent('2026-08-24T06:01:00.000Z', 0, 0, 0, { last: false, total: { input: 150, cached: 75, output: 15 } })
  ], '2026-08-24T11-00-00');

  const parentId = '44444444-4444-4444-8444-444444444444';
  const childId = '55555555-5555-4555-8555-555555555555';
  const parentEvents = [
    tokenEvent('2026-08-24T07:00:00.000Z', 300, 200, 30),
    tokenEvent('2026-08-24T07:01:00.000Z', 400, 250, 40)
  ];
  writeRollout(semanticsSessions, parentId, [
    sessionMeta(parentId, project), turnContext('gpt-5.6-sol', project), ...parentEvents,
    JSON.stringify({ timestamp: '2026-08-24T07:02:00.000Z', type: 'response_item', payload: {} })
  ], '2026-08-24T12-00-00');
  writeRollout(semanticsSessions, childId, [
    sessionMeta(childId, project, '2026-08-24T07:01:30.000Z', { forked_from_id: parentId, parent_thread_id: parentId }),
    turnContext('gpt-5.6-sol', project),
    ...parentEvents,
    tokenEvent('2026-08-24T07:03:00.000Z', 500, 300, 50)
  ], '2026-08-24T12-05-00');

  const mismatchFilenameId = '66666666-6666-4666-8666-666666666666';
  writeRollout(semanticsSessions, mismatchFilenameId, [
    sessionMeta('77777777-7777-4777-8777-777777777777', project),
    turnContext('gpt-5.6-sol', project), tokenEvent('2026-08-24T08:00:00.000Z', 600, 400, 60)
  ], '2026-08-24T13-00-00');

  semanticsDatabase = openIndex(semanticsPath);
  const semantics = refreshIndex(semanticsDatabase, semanticsRoot);
  assert(semantics.eventCount === 7, 'root dedup, total fallback, and replay filtering should produce seven canonical events');
  assert(readIndexedEvents(semanticsDatabase).length === 7, 'duplicate root files should collapse by root event index');
  assert(getIndexDiagnostics(semanticsDatabase).counts.sessions === 4, 'diagnostic tasks should count canonical root sessions');
  const mismatchRow = semanticsDatabase.prepare("SELECT parse_status FROM source_files WHERE path LIKE '%66666666-6666-4666-8666-666666666666.jsonl'").get();
  assert(mismatchRow.parse_status === 'deferred', 'filename and root metadata mismatch should be deferred');
  const fallbackRows = semanticsDatabase.prepare('SELECT input, output FROM usage_events WHERE session_id = (SELECT session_id FROM source_files WHERE path LIKE ?) ORDER BY event_index').all(`%${fallbackId}.jsonl`);
  assert(fallbackRows.length === 2 && fallbackRows[0].input === 100 && fallbackRows[1].input === 50 && fallbackRows[1].output === 5, 'total_token_usage fallback should use cumulative deltas');
  const childRows = semanticsDatabase.prepare('SELECT event_index FROM usage_events WHERE session_id = (SELECT session_id FROM source_files WHERE path LIKE ?)').all(`%${childId}.jsonl`);
  assert(childRows.length === 1 && childRows[0].event_index === 3, 'child rollout should skip the matching parent replay prefix');

  const secondCodexRoot = path.join(temporaryRoot, '.codex-profile');
  const secondId = '88888888-8888-4888-8888-888888888888';
  writeRollout(path.join(secondCodexRoot, 'sessions', '2026', '08', '24'), secondId, [
    sessionMeta(secondId, path.join(temporaryRoot, 'profile-project')),
    turnContext('gpt-5.6-sol', path.join(temporaryRoot, 'profile-project')),
    tokenEvent('2026-08-24T09:00:00.000Z', 800, 600, 80)
  ], '2026-08-24T14-00-00');
  const combined = refreshIndex(database, [codexRoot, secondCodexRoot]);
  assert(combined.filesScanned === 2 && combined.eventCount === 2, 'combined source should index default and Profile roots');
  const isolated = refreshIndex(database, codexRoot);
  assert(isolated.droppedSourceFiles === 1 && isolated.eventCount === 1, 'selecting one source should remove unselected Profile events');

  console.log('SQLite index checks passed: CC Switch deduplication, replay filtering, history retention, migration, and source isolation.');
} finally {
  semanticsDatabase?.close();
  database?.close();
  const resolved = path.resolve(temporaryRoot);
  if (resolved.startsWith(path.resolve(os.tmpdir())) && path.basename(resolved).startsWith('codex-day-index-test-')) {
    rmSync(resolved, { recursive: true, force: true });
  }
}
