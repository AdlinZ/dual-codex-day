import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync, copyFileSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const SCHEMA_VERSION = 1;

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

export function scanLogFiles(codexRoot) {
  const roots = ['sessions', 'archived_sessions'].map(name => path.join(codexRoot, name)).filter(existsSync);
  if (!roots.length) throw new Error(`No Codex session directories were found under: ${codexRoot}`);
  return roots.flatMap(root => walkJsonl(root)).sort((a, b) => a.localeCompare(b));
}

export function parseSessionFile(filePath) {
  const lines = readFileSync(filePath, 'utf8').split(/\r?\n/).filter(Boolean);
  const rows = [];
  for (const line of lines) {
    try { rows.push(JSON.parse(line)); } catch {}
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
    const usage = row.payload?.info?.last_token_usage;
    if (!usage || number(usage.total_tokens) <= 0) continue;

    let timestamp;
    try { timestamp = formatLocalIso(row.timestamp); } catch { continue; }
    const input = number(usage.input_tokens);
    const cachedInput = number(usage.cached_input_tokens);
    const cacheWriteInput = number(usage.cache_write_input_tokens);
    const output = number(usage.output_tokens);
    const reasoningOutput = number(usage.reasoning_output_tokens);
    const total = number(usage.total_tokens);
    const eventKey = hash(`${rawSessionId}|${row.timestamp}|${input}|${output}|${total}`);
    if (eventKeys.has(eventKey)) continue;
    eventKeys.add(eventKey);
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
  return { sessionId: privateId(rawSessionId, 'task'), events };
}

export function openIndex(databasePath) {
  mkdirSync(path.dirname(databasePath), { recursive: true });
  const database = new DatabaseSync(databasePath, { timeout: 5000 });
  database.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA foreign_keys = ON;');
  const version = database.prepare('PRAGMA user_version').get().user_version;
  if (version > SCHEMA_VERSION) throw new Error(`Database schema ${version} is newer than supported schema ${SCHEMA_VERSION}`);
  database.exec(`
    CREATE TABLE IF NOT EXISTS source_files (
      path TEXT PRIMARY KEY,
      size INTEGER NOT NULL,
      mtime_ms REAL NOT NULL,
      session_id TEXT NOT NULL,
      indexed_at TEXT NOT NULL
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
    CREATE INDEX IF NOT EXISTS usage_events_timestamp ON usage_events(timestamp);
    CREATE INDEX IF NOT EXISTS usage_events_event_key ON usage_events(event_key);
    CREATE INDEX IF NOT EXISTS usage_events_session ON usage_events(session_id);
    PRAGMA user_version = ${SCHEMA_VERSION};
  `);
  return database;
}

export function refreshIndex(database, codexRoot) {
  const files = scanLogFiles(codexRoot);
  const known = new Map(database.prepare('SELECT path, size, mtime_ms FROM source_files').all().map(row => [row.path, row]));
  const diskPaths = new Set(files);
  const removed = [...known.keys()].filter(filePath => !diskPaths.has(filePath));
  const changed = [];
  const unchanged = [];
  for (const filePath of files) {
    const stats = statSync(filePath);
    const row = known.get(filePath);
    if (!row || Number(row.size) !== stats.size || Number(row.mtime_ms) !== stats.mtimeMs) changed.push({ filePath, stats });
    else unchanged.push(filePath);
  }

  const deleteEvents = database.prepare('DELETE FROM usage_events WHERE source_path = ?');
  const deleteFile = database.prepare('DELETE FROM source_files WHERE path = ?');
  const upsertFile = database.prepare(`INSERT INTO source_files(path, size, mtime_ms, session_id, indexed_at) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(path) DO UPDATE SET size = excluded.size, mtime_ms = excluded.mtime_ms, session_id = excluded.session_id, indexed_at = excluded.indexed_at`);
  const insertEvent = database.prepare(`INSERT OR IGNORE INTO usage_events(
    source_path, event_key, timestamp, date, session_id, model, project, project_id, input, cached_input,
    cache_write_input, uncached_input, output, reasoning_output, unclassified, total, context_window
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

  let parsedEvents = 0;
  database.exec('BEGIN IMMEDIATE');
  try {
    removed.forEach(filePath => deleteFile.run(filePath));
    for (const { filePath, stats } of changed) {
      const parsed = parseSessionFile(filePath);
      deleteEvents.run(filePath);
      upsertFile.run(filePath, stats.size, stats.mtimeMs, parsed.sessionId, formatLocalIso());
      for (const event of parsed.events) {
        insertEvent.run(
          filePath, event.eventKey, event.timestamp, event.date, event.sessionId, event.model, event.project, event.projectId,
          event.input, event.cachedInput, event.cacheWriteInput, event.uncachedInput, event.output, event.reasoningOutput,
          event.unclassified, event.total, event.contextWindow
        );
      }
      parsedEvents += parsed.events.length;
    }
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }

  const eventCount = Number(database.prepare('SELECT COUNT(DISTINCT event_key) AS count FROM usage_events').get().count);
  const sessionCount = Number(database.prepare('SELECT COUNT(DISTINCT session_id) AS count FROM source_files').get().count);
  return { filesScanned: files.length, changedFiles: changed.length, unchangedFiles: unchanged.length, removedFiles: removed.length, parsedEvents, eventCount, sessionCount };
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

export function buildDashboard(database, options) {
  const { templatePath, stylesheetPath, pricingPath, dashboardPath, indexResult = {} } = options;
  for (const required of [templatePath, stylesheetPath, pricingPath]) {
    if (!existsSync(required)) throw new Error(`Required dashboard source not found: ${required}`);
  }
  const events = readIndexedEvents(database);
  const stats = database.prepare('SELECT COUNT(*) AS files, COUNT(DISTINCT session_id) AS sessions FROM source_files').get();
  const generatedAt = formatLocalIso();
  const payload = {
    generatedAt,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'local',
    filesScanned: Number(stats.files),
    sessionsScanned: Number(stats.sessions),
    index: {
      engine: 'sqlite',
      changedFiles: Number(indexResult.changedFiles || 0),
      unchangedFiles: Number(indexResult.unchangedFiles || 0),
      removedFiles: Number(indexResult.removedFiles || 0)
    },
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
  writeFileSync(path.join(outputDirectory, 'live-update.js'), `window.__CODEX_DAY_LIVE__ = ${JSON.stringify(generatedAt)};`, 'utf8');
  return payload;
}
