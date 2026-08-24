import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export const SCHEMA_VERSION = 2;

function number(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function hash(value) {
  return createHash('sha256').update(String(value ?? '')).digest('hex');
}

function privateId(value, prefix) {
  return `${prefix}-${hash(value).slice(0, 12)}`;
}

function projectName(value) {
  const cleaned = String(value || '').replace(/[\\/]+$/, '');
  if (!cleaned) return '(unassigned project)';
  return cleaned.split(/[\\/]/).filter(Boolean).at(-1) || cleaned;
}

function formatLocalIso(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid timestamp: ${value}`);
  const pad = part => String(part).padStart(2, '0');
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const offset = `${sign}${pad(Math.floor(Math.abs(offsetMinutes) / 60))}:${pad(Math.abs(offsetMinutes) % 60)}`;
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}${offset}`;
}

function safeScriptJson(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

function walkJsonl(directory, output = []) {
  if (!existsSync(directory)) return output;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) walkJsonl(entryPath, output);
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.jsonl')) output.push(path.resolve(entryPath));
  }
  return output;
}

function tableColumns(database, table) {
  return new Set(database.prepare(`PRAGMA table_info(${table})`).all().map(column => column.name));
}

function addColumn(database, table, name, definition) {
  if (!tableColumns(database, table).has(name)) database.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);
}

function metadataValue(database, key) {
  return database.prepare('SELECT value FROM index_metadata WHERE key = ?').get(key)?.value ?? null;
}

function setMetadata(database, key, value) {
  database.prepare(`INSERT INTO index_metadata(key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run(key, String(value));
}

export function normalizeRetentionDays(value) {
  if (value == null || value === '' || String(value).toLowerCase() === 'all') return null;
  const days = Number(value);
  if (!Number.isInteger(days) || days < 1 || days > 36500) throw new Error('Retention days must be all or an integer from 1 to 36500.');
  return days;
}

function retentionSetting(retentionDays) {
  return retentionDays == null ? 'all' : String(retentionDays);
}

function retentionCutoffDate(retentionDays, now = new Date()) {
  if (retentionDays == null) return null;
  const cutoff = new Date(now);
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - retentionDays + 1);
  return formatLocalIso(cutoff).slice(0, 10);
}

export function scanLogFiles(codexRoot) {
  const roots = ['sessions', 'archived_sessions'].map(name => path.join(codexRoot, name)).filter(existsSync);
  if (!roots.length) throw new Error(`No Codex session directories were found under: ${codexRoot}`);
  return roots.flatMap(root => walkJsonl(root)).sort((a, b) => a.localeCompare(b));
}

export function parseSessionFile(filePath, options = {}) {
  const cutoffDate = options.cutoffDate || null;
  const source = readFileSync(filePath, 'utf8');
  const lines = source.split(/\r?\n/).filter(line => line.trim());
  const rows = [];
  const diagnostics = {
    totalLines: lines.length,
    parsedLines: 0,
    tokenRecords: 0,
    acceptedEvents: 0,
    duplicateEvents: 0,
    emptyUsage: 0,
    invalidJson: 0,
    invalidTimestamp: 0,
    outsideRetention: 0,
    oldestEvent: null,
    newestEvent: null,
    status: 'ok'
  };
  for (const line of lines) {
    try {
      rows.push(JSON.parse(line));
      diagnostics.parsedLines += 1;
    } catch {
      diagnostics.invalidJson += 1;
    }
  }

  let model = '(unknown model)';
  let cwd = '(unassigned project)';
  let rawSessionId = path.basename(filePath, path.extname(filePath));
  for (const row of rows) {
    if (row?.type === 'session_meta') {
      rawSessionId = String(row.payload?.session_id || row.payload?.id || rawSessionId);
      if (row.payload?.cwd) cwd = String(row.payload.cwd);
    }
    if (row?.type === 'turn_context') {
      if (row.payload?.model) model = String(row.payload.model);
      if (row.payload?.cwd) cwd = String(row.payload.cwd);
      break;
    }
  }

  const events = [];
  const eventKeys = new Set();
  for (const row of rows) {
    if (row?.type === 'session_meta') {
      rawSessionId = String(row.payload?.session_id || row.payload?.id || rawSessionId);
      if (row.payload?.cwd) cwd = String(row.payload.cwd);
      continue;
    }
    if (row?.type === 'turn_context') {
      if (row.payload?.model) model = String(row.payload.model);
      if (row.payload?.cwd) cwd = String(row.payload.cwd);
      continue;
    }
    if (row?.type !== 'event_msg' || row.payload?.type !== 'token_count') continue;
    diagnostics.tokenRecords += 1;
    const usage = row.payload?.info?.last_token_usage;
    if (!usage || number(usage.total_tokens) <= 0) {
      diagnostics.emptyUsage += 1;
      continue;
    }

    let timestamp;
    try {
      if (row.timestamp == null || row.timestamp === '') throw new Error('Missing timestamp');
      timestamp = formatLocalIso(row.timestamp);
    } catch {
      diagnostics.invalidTimestamp += 1;
      continue;
    }
    const input = number(usage.input_tokens);
    const cachedInput = number(usage.cached_input_tokens);
    const cacheWriteInput = number(usage.cache_write_input_tokens);
    const output = number(usage.output_tokens);
    const reasoningOutput = number(usage.reasoning_output_tokens);
    const total = number(usage.total_tokens);
    const eventKey = hash(`${rawSessionId}|${row.timestamp}|${input}|${output}|${total}`);
    if (eventKeys.has(eventKey)) {
      diagnostics.duplicateEvents += 1;
      continue;
    }
    eventKeys.add(eventKey);
    if (cutoffDate && timestamp.slice(0, 10) < cutoffDate) {
      diagnostics.outsideRetention += 1;
      continue;
    }
    diagnostics.oldestEvent = diagnostics.oldestEvent && diagnostics.oldestEvent < timestamp ? diagnostics.oldestEvent : timestamp;
    diagnostics.newestEvent = diagnostics.newestEvent && diagnostics.newestEvent > timestamp ? diagnostics.newestEvent : timestamp;
    events.push({
      eventKey,
      timestamp,
      date: timestamp.slice(0, 10),
      sessionId: privateId(rawSessionId, 'task'),
      model,
      project: projectName(cwd),
      projectId: privateId(cwd, 'project'),
      input,
      cachedInput,
      cacheWriteInput,
      uncachedInput: Math.max(0, input - cachedInput),
      output,
      reasoningOutput,
      unclassified: Math.max(0, total - input - output),
      total,
      contextWindow: number(row.payload?.info?.model_context_window)
    });
  }
  diagnostics.acceptedEvents = events.length;
  if (diagnostics.invalidJson || diagnostics.invalidTimestamp) diagnostics.status = 'warning';
  else if (!diagnostics.tokenRecords) diagnostics.status = 'empty';
  return { sessionId: privateId(rawSessionId, 'task'), events, diagnostics };
}

export function openIndex(databasePath) {
  mkdirSync(path.dirname(databasePath), { recursive: true });
  const database = new DatabaseSync(databasePath, { timeout: 5000 });
  database.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA foreign_keys = ON;');
  const version = Number(database.prepare('PRAGMA user_version').get().user_version);
  if (version > SCHEMA_VERSION) throw new Error(`Database schema ${version} is newer than supported schema ${SCHEMA_VERSION}`);
  database.exec(`
    CREATE TABLE IF NOT EXISTS source_files (
      path TEXT PRIMARY KEY,
      size INTEGER NOT NULL,
      mtime_ms REAL NOT NULL,
      session_id TEXT NOT NULL,
      indexed_at TEXT NOT NULL,
      total_lines INTEGER NOT NULL DEFAULT 0,
      parsed_lines INTEGER NOT NULL DEFAULT 0,
      token_records INTEGER NOT NULL DEFAULT 0,
      accepted_events INTEGER NOT NULL DEFAULT 0,
      duplicate_events INTEGER NOT NULL DEFAULT 0,
      empty_usage INTEGER NOT NULL DEFAULT 0,
      invalid_json INTEGER NOT NULL DEFAULT 0,
      invalid_timestamp INTEGER NOT NULL DEFAULT 0,
      outside_retention INTEGER NOT NULL DEFAULT 0,
      oldest_event TEXT,
      newest_event TEXT,
      parse_status TEXT NOT NULL DEFAULT 'unknown'
    );
    CREATE TABLE IF NOT EXISTS usage_events (
      source_path TEXT NOT NULL REFERENCES source_files(path) ON DELETE CASCADE,
      event_key TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      date TEXT NOT NULL,
      session_id TEXT NOT NULL,
      model TEXT NOT NULL,
      project TEXT NOT NULL,
      project_id TEXT NOT NULL,
      input INTEGER NOT NULL,
      cached_input INTEGER NOT NULL,
      cache_write_input INTEGER NOT NULL,
      uncached_input INTEGER NOT NULL,
      output INTEGER NOT NULL,
      reasoning_output INTEGER NOT NULL,
      unclassified INTEGER NOT NULL,
      total INTEGER NOT NULL,
      context_window INTEGER NOT NULL,
      PRIMARY KEY (source_path, event_key)
    );
    CREATE TABLE IF NOT EXISTS index_metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS usage_events_timestamp ON usage_events(timestamp);
    CREATE INDEX IF NOT EXISTS usage_events_event_key ON usage_events(event_key);
    CREATE INDEX IF NOT EXISTS usage_events_session ON usage_events(session_id);
  `);
  if (version < 2) {
    database.exec('BEGIN IMMEDIATE');
    try {
      const additions = [
        ['total_lines', "INTEGER NOT NULL DEFAULT 0"], ['parsed_lines', "INTEGER NOT NULL DEFAULT 0"],
        ['token_records', "INTEGER NOT NULL DEFAULT 0"], ['accepted_events', "INTEGER NOT NULL DEFAULT 0"],
        ['duplicate_events', "INTEGER NOT NULL DEFAULT 0"], ['empty_usage', "INTEGER NOT NULL DEFAULT 0"],
        ['invalid_json', "INTEGER NOT NULL DEFAULT 0"], ['invalid_timestamp', "INTEGER NOT NULL DEFAULT 0"],
        ['outside_retention', "INTEGER NOT NULL DEFAULT 0"], ['oldest_event', 'TEXT'], ['newest_event', 'TEXT'],
        ['parse_status', "TEXT NOT NULL DEFAULT 'unknown'"]
      ];
      additions.forEach(([name, definition]) => addColumn(database, 'source_files', name, definition));
      database.exec(`PRAGMA user_version = ${SCHEMA_VERSION}; COMMIT`);
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
  }
  return database;
}

export function refreshIndex(database, codexRoot, options = {}) {
  const retentionDays = normalizeRetentionDays(options.retentionDays);
  const cutoffDate = retentionCutoffDate(retentionDays, options.now || new Date());
  const setting = retentionSetting(retentionDays);
  const previousSetting = metadataValue(database, 'retention_days');
  const policyChanged = previousSetting !== setting;
  const files = scanLogFiles(codexRoot);
  const known = new Map(database.prepare('SELECT path, size, mtime_ms, session_id FROM source_files').all().map(row => [row.path, row]));
  const diskPaths = new Set(files);
  const removed = [...known.keys()].filter(filePath => !diskPaths.has(filePath));
  const changed = [];
  const unchanged = [];
  for (const filePath of files) {
    const stats = statSync(filePath);
    const row = known.get(filePath);
    if (policyChanged || !row || Number(row.size) !== stats.size || Number(row.mtime_ms) !== stats.mtimeMs) changed.push({ filePath, stats, row });
    else unchanged.push(filePath);
  }

  const deleteEvents = database.prepare('DELETE FROM usage_events WHERE source_path = ?');
  const deleteFile = database.prepare('DELETE FROM source_files WHERE path = ?');
  const markFileError = database.prepare("UPDATE source_files SET size = -1, mtime_ms = -1, indexed_at = ?, parse_status = 'error' WHERE path = ?");
  const upsertFile = database.prepare(`INSERT INTO source_files(
      path, size, mtime_ms, session_id, indexed_at, total_lines, parsed_lines, token_records, accepted_events,
      duplicate_events, empty_usage, invalid_json, invalid_timestamp, outside_retention, oldest_event, newest_event, parse_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(path) DO UPDATE SET
      size = excluded.size, mtime_ms = excluded.mtime_ms, session_id = excluded.session_id, indexed_at = excluded.indexed_at,
      total_lines = excluded.total_lines, parsed_lines = excluded.parsed_lines, token_records = excluded.token_records,
      accepted_events = excluded.accepted_events, duplicate_events = excluded.duplicate_events, empty_usage = excluded.empty_usage,
      invalid_json = excluded.invalid_json, invalid_timestamp = excluded.invalid_timestamp,
      outside_retention = excluded.outside_retention, oldest_event = excluded.oldest_event,
      newest_event = excluded.newest_event, parse_status = excluded.parse_status`);
  const insertEvent = database.prepare(`INSERT OR IGNORE INTO usage_events(
    source_path, event_key, timestamp, date, session_id, model, project, project_id, input, cached_input,
    cache_write_input, uncached_input, output, reasoning_output, unclassified, total, context_window
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

  let parsedEvents = 0;
  let failedFiles = 0;
  let prunedEvents = 0;
  database.exec('BEGIN IMMEDIATE');
  try {
    removed.forEach(filePath => deleteFile.run(filePath));
    for (const { filePath, stats, row } of changed) {
      let parsed;
      try {
        parsed = parseSessionFile(filePath, { cutoffDate });
      } catch {
        failedFiles += 1;
        if (!row) {
          upsertFile.run(filePath, -1, -1, privateId(filePath, 'task'), formatLocalIso(), 0, 0, 0, 0, 0, 0, 0, 0, 0, null, null, 'error');
        } else markFileError.run(formatLocalIso(), filePath);
        continue;
      }
      deleteEvents.run(filePath);
      const d = parsed.diagnostics;
      upsertFile.run(
        filePath, stats.size, stats.mtimeMs, parsed.sessionId, formatLocalIso(), d.totalLines, d.parsedLines,
        d.tokenRecords, d.acceptedEvents, d.duplicateEvents, d.emptyUsage, d.invalidJson, d.invalidTimestamp,
        d.outsideRetention, d.oldestEvent, d.newestEvent, d.status
      );
      for (const event of parsed.events) {
        insertEvent.run(
          filePath, event.eventKey, event.timestamp, event.date, event.sessionId, event.model, event.project, event.projectId,
          event.input, event.cachedInput, event.cacheWriteInput, event.uncachedInput, event.output, event.reasoningOutput,
          event.unclassified, event.total, event.contextWindow
        );
      }
      parsedEvents += parsed.events.length;
    }
    if (cutoffDate) prunedEvents = Number(database.prepare('DELETE FROM usage_events WHERE date < ?').run(cutoffDate).changes);
    setMetadata(database, 'retention_days', setting);
    setMetadata(database, 'last_refresh_at', formatLocalIso());
    setMetadata(database, 'last_cutoff_date', cutoffDate || '');
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }

  const eventCount = Number(database.prepare('SELECT COUNT(DISTINCT event_key) AS count FROM usage_events').get().count);
  const sessionCount = Number(database.prepare('SELECT COUNT(DISTINCT session_id) AS count FROM source_files').get().count);
  return {
    filesScanned: files.length,
    changedFiles: changed.length,
    unchangedFiles: unchanged.length,
    removedFiles: removed.length,
    failedFiles,
    parsedEvents,
    prunedEvents,
    eventCount,
    sessionCount,
    retentionDays: retentionDays ?? 'all',
    cutoffDate,
    policyChanged
  };
}

export function readIndexedEvents(database) {
  return database.prepare(`WITH deduplicated AS (
      SELECT MIN(rowid) AS row_id FROM usage_events GROUP BY event_key
    )
    SELECT timestamp, date, session_id AS "sessionId", model, project, project_id AS "projectId",
      input, cached_input AS "cachedInput", cache_write_input AS "cacheWriteInput", uncached_input AS "uncachedInput",
      output, reasoning_output AS "reasoningOutput", unclassified, total, context_window AS "contextWindow"
    FROM usage_events JOIN deduplicated ON usage_events.rowid = deduplicated.row_id
    ORDER BY timestamp`).all();
}

export function getIndexDiagnostics(database, options = {}) {
  const aggregate = database.prepare(`SELECT
      COUNT(*) AS files,
      COUNT(DISTINCT session_id) AS sessions,
      SUM(CASE WHEN parse_status = 'warning' THEN 1 ELSE 0 END) AS warning_files,
      SUM(CASE WHEN parse_status = 'error' THEN 1 ELSE 0 END) AS error_files,
      SUM(CASE WHEN token_records = 0 THEN 1 ELSE 0 END) AS files_without_tokens,
      SUM(total_lines) AS total_lines,
      SUM(parsed_lines) AS parsed_lines,
      SUM(token_records) AS token_records,
      SUM(accepted_events) AS accepted_events,
      SUM(duplicate_events) AS duplicate_events,
      SUM(empty_usage) AS empty_usage,
      SUM(invalid_json) AS invalid_json,
      SUM(invalid_timestamp) AS invalid_timestamp,
      SUM(outside_retention) AS outside_retention,
      MIN(oldest_event) AS oldest_event,
      MAX(newest_event) AS newest_event
    FROM source_files`).get();
  const eventCount = Number(database.prepare('SELECT COUNT(DISTINCT event_key) AS count FROM usage_events').get().count);
  const transientFailures = Number(options.indexResult?.failedFiles || 0);
  const warningCount = number(aggregate.invalid_json) + number(aggregate.invalid_timestamp);
  const errorCount = number(aggregate.error_files);
  let databaseBytes = 0;
  try {
    const databasePath = database.prepare('PRAGMA database_list').all().find(item => item.name === 'main')?.file;
    if (databasePath && existsSync(databasePath)) databaseBytes = statSync(databasePath).size;
  } catch {}
  const storedRetention = metadataValue(database, 'retention_days') || 'all';
  return {
    status: errorCount ? 'error' : warningCount ? 'warning' : 'ok',
    schemaVersion: Number(database.prepare('PRAGMA user_version').get().user_version),
    lastRefreshAt: metadataValue(database, 'last_refresh_at'),
    databaseBytes,
    retention: {
      days: storedRetention === 'all' ? 'all' : Number(storedRetention),
      cutoffDate: metadataValue(database, 'last_cutoff_date') || null,
      prunedEvents: Number(options.indexResult?.prunedEvents || 0),
      policyChanged: Boolean(options.indexResult?.policyChanged)
    },
    counts: {
      files: number(aggregate.files),
      sessions: number(aggregate.sessions),
      events: eventCount,
      warningFiles: number(aggregate.warning_files),
      errorFiles: number(aggregate.error_files),
      filesWithoutTokens: number(aggregate.files_without_tokens),
      totalLines: number(aggregate.total_lines),
      parsedLines: number(aggregate.parsed_lines),
      tokenRecords: number(aggregate.token_records),
      acceptedEvents: number(aggregate.accepted_events),
      duplicateEvents: number(aggregate.duplicate_events),
      emptyUsage: number(aggregate.empty_usage),
      invalidJson: number(aggregate.invalid_json),
      invalidTimestamp: number(aggregate.invalid_timestamp),
      outsideRetention: number(aggregate.outside_retention)
    },
    timeRange: { oldest: aggregate.oldest_event || null, newest: aggregate.newest_event || null },
    refresh: {
      changedFiles: Number(options.indexResult?.changedFiles || 0),
      unchangedFiles: Number(options.indexResult?.unchangedFiles || 0),
      removedFiles: Number(options.indexResult?.removedFiles || 0),
      failedFiles: transientFailures
    }
  };
}

export function buildDashboard(database, options) {
  const { templatePath, stylesheetPath, pricingPath, logoPath, dashboardPath, indexResult = {} } = options;
  for (const required of [templatePath, stylesheetPath, pricingPath, logoPath]) {
    if (!existsSync(required)) throw new Error(`Required dashboard source not found: ${required}`);
  }
  const events = readIndexedEvents(database);
  const diagnostics = getIndexDiagnostics(database, { indexResult });
  const generatedAt = formatLocalIso();
  const payload = {
    generatedAt,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'local',
    filesScanned: diagnostics.counts.files,
    sessionsScanned: diagnostics.counts.sessions,
    index: {
      engine: 'sqlite',
      changedFiles: Number(indexResult.changedFiles || 0),
      unchangedFiles: Number(indexResult.unchangedFiles || 0),
      removedFiles: Number(indexResult.removedFiles || 0)
    },
    diagnostics,
    events
  };
  const pricing = JSON.parse(readFileSync(pricingPath, 'utf8'));
  const template = readFileSync(templatePath, 'utf8');
  const tokenPattern = /<script id="token-data">[\s\S]*?<\/script>/;
  const pricingPattern = /<script id="pricing-data">[\s\S]*?<\/script>/;
  if (!tokenPattern.test(template)) throw new Error('The token-data marker is missing from the dashboard template.');
  if (!pricingPattern.test(template)) throw new Error('The pricing-data marker is missing from the dashboard template.');
  const html = template
    .replace(tokenPattern, `<script id="token-data">window.__TOKEN_DATA__ = ${safeScriptJson(payload)};</script>`)
    .replace(pricingPattern, `<script id="pricing-data">window.__PRICING_DATA__ = ${safeScriptJson(pricing)};</script>`);
  const outputDirectory = path.dirname(dashboardPath);
  mkdirSync(outputDirectory, { recursive: true });
  writeFileSync(dashboardPath, html, 'utf8');
  copyFileSync(stylesheetPath, path.join(outputDirectory, 'token-dashboard.css'));
  copyFileSync(logoPath, path.join(outputDirectory, 'codex-day-mark.svg'));
  writeFileSync(path.join(outputDirectory, 'live-update.js'), `window.__CODEX_DAY_LIVE__ = ${JSON.stringify(generatedAt)};`, 'utf8');
  return payload;
}
