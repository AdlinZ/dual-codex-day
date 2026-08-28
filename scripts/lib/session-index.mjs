import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export const SCHEMA_VERSION = 4;
const PARSER_VERSION = '3';

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

export function scanLogFiles(codexRoot, options = {}) {
  const codexRoots = (Array.isArray(codexRoot) ? codexRoot : [codexRoot])
    .map(root => path.resolve(String(root || '')))
    .filter(Boolean);
  const roots = codexRoots.flatMap(root => ['sessions', 'archived_sessions']
    .map(name => path.join(root, name))
    .filter(existsSync));
  if (!roots.length && !options.allowEmpty) {
    throw new Error('No Codex session directories were found under the selected data source.');
  }
  return [...new Set(roots.flatMap(root => walkJsonl(root)))].sort((a, b) => a.localeCompare(b));
}

function normalizedRoots(codexRoot) {
  return [...new Set((Array.isArray(codexRoot) ? codexRoot : [codexRoot])
    .map(root => String(root || '').trim())
    .filter(Boolean)
    .map(root => path.resolve(root)))];
}

function pathKey(value) {
  const resolved = path.resolve(value);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

function rootForFile(filePath, roots) {
  const fileKey = pathKey(filePath);
  return roots
    .filter(root => fileKey === pathKey(root) || fileKey.startsWith(`${pathKey(root)}${path.sep}`))
    .sort((left, right) => right.length - left.length)[0] || null;
}

function rolloutIdFromPath(filePath) {
  const filename = path.basename(filePath);
  if (!filename.startsWith('rollout-') || !filename.toLowerCase().endsWith('.jsonl')) return null;
  const stem = path.basename(filePath, path.extname(filePath));
  const match = stem.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i);
  return match?.[1]?.toLowerCase() || null;
}

function normalizedUuid(value) {
  const text = nonEmpty(value)?.toLowerCase();
  return text && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(text) ? text : null;
}

function nonEmpty(value) {
  const text = String(value || '').trim();
  return text || null;
}

function counters(value) {
  if (!value || typeof value !== 'object') return null;
  const fields = ['input_tokens', 'cached_input_tokens', 'cache_read_input_tokens', 'output_tokens', 'reasoning_output_tokens', 'total_tokens'];
  if (!fields.some(field => Object.hasOwn(value, field))) return null;
  return {
    input: number(value.input_tokens),
    cachedInput: number(value.cached_input_tokens ?? value.cache_read_input_tokens),
    output: number(value.output_tokens),
    reasoningOutput: number(value.reasoning_output_tokens),
    reportedTotal: number(value.total_tokens)
  };
}

function signatureCounters(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return [
    Object.hasOwn(value, 'input_tokens') ? number(value.input_tokens) : null,
    Object.hasOwn(value, 'cached_input_tokens') || Object.hasOwn(value, 'cache_read_input_tokens')
      ? number(value.cached_input_tokens ?? value.cache_read_input_tokens)
      : null,
    Object.hasOwn(value, 'output_tokens') ? number(value.output_tokens) : null,
    Object.hasOwn(value, 'reasoning_output_tokens') ? number(value.reasoning_output_tokens) : null,
    Object.hasOwn(value, 'total_tokens') ? number(value.total_tokens) : null
  ];
}

function signatureFor(total, last) {
  return JSON.stringify([signatureCounters(total), signatureCounters(last)]);
}

function normalizeModel(value) {
  let name = String(value || '(unknown model)').toLowerCase();
  if (name.includes('/')) name = name.slice(name.lastIndexOf('/') + 1);
  name = name.replace(/-\d{4}-\d{2}-\d{2}$/, '').replace(/-\d{8}$/, '');
  return name || '(unknown model)';
}

function cumulativeDelta(previous, current) {
  if (!previous) return { ...current };
  return {
    input: Math.max(0, current.input - previous.input),
    cachedInput: Math.max(0, current.cachedInput - previous.cachedInput),
    output: Math.max(0, current.output - previous.output),
    reasoningOutput: Math.max(0, current.reasoningOutput - previous.reasoningOutput),
    reportedTotal: Math.max(0, current.reportedTotal - previous.reportedTotal)
  };
}

function updateHighWater(previous, current) {
  if (!previous) return { ...current };
  return {
    input: Math.max(previous.input, current.input),
    cachedInput: Math.max(previous.cachedInput, current.cachedInput),
    output: Math.max(previous.output, current.output),
    reasoningOutput: Math.max(previous.reasoningOutput, current.reasoningOutput),
    reportedTotal: Math.max(previous.reportedTotal, current.reportedTotal)
  };
}

function matchingReplayPrefix(childEvents, parentSignatures) {
  let parentOffset = 0;
  let matched = 0;
  for (const event of childEvents) {
    const relative = parentSignatures.slice(parentOffset).indexOf(event.signature);
    if (relative < 0) break;
    parentOffset += relative + 1;
    matched += 1;
  }
  return matched;
}

function readParentTimeline(filePath) {
  const events = [];
  let maximumTimestampMs = null;
  let hasTokenWithoutTimestamp = false;
  for (const line of readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    if (!line.trim()) continue;
    let row;
    try {
      row = JSON.parse(line);
    } catch {
      continue;
    }
    const timestampMs = new Date(row?.timestamp || '').getTime();
    if (Number.isFinite(timestampMs)) maximumTimestampMs = Math.max(maximumTimestampMs ?? timestampMs, timestampMs);
    if (row?.type !== 'event_msg' || row.payload?.type !== 'token_count') continue;
    const info = row.payload?.info;
    if (!info || (signatureCounters(info.total_token_usage) == null && signatureCounters(info.last_token_usage) == null)) continue;
    if (!Number.isFinite(timestampMs)) {
      hasTokenWithoutTimestamp = true;
      continue;
    }
    events.push({
      timestampMs,
      signature: signatureFor(info.total_token_usage, info.last_token_usage)
    });
  }
  return { events, maximumTimestampMs, hasTokenWithoutTimestamp };
}

function parentSignatureResolver(rolloutIndex) {
  const cache = new Map();
  return (parentId, cutoffMs) => {
    if (!Number.isFinite(cutoffMs)) throw new Error('parented rollout root metadata is missing a valid timestamp');
    const candidates = rolloutIndex.get(parentId);
    if (!candidates?.length) return null;
    const snapshots = candidates.map(filePath => {
      let timeline = cache.get(filePath);
      if (!timeline) {
        timeline = readParentTimeline(filePath);
        cache.set(filePath, timeline);
      }
      if (timeline.hasTokenWithoutTimestamp) throw new Error(`parent rollout ${parentId} has token_count without a valid timestamp`);
      if (timeline.maximumTimestampMs == null || timeline.maximumTimestampMs < cutoffMs) {
        throw new Error(`parent rollout ${parentId} has not reached the child fork timestamp`);
      }
      return timeline.events.filter(event => event.timestampMs <= cutoffMs).map(event => event.signature);
    });
    const canonical = JSON.stringify(snapshots[0]);
    if (snapshots.slice(1).some(snapshot => JSON.stringify(snapshot) !== canonical)) {
      throw new Error(`parent rollout ${parentId} maps to files with different contents`);
    }
    return snapshots[0];
  };
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

  const rootMeta = rows.find(row => row?.type === 'session_meta') || null;
  const metaPayload = rootMeta?.payload || {};
  const filenameId = rolloutIdFromPath(filePath);
  const metaId = nonEmpty(metaPayload.id ?? metaPayload.thread_id ?? metaPayload.threadId);
  const rootThreadId = filenameId;
  const forkedParent = nonEmpty(metaPayload.forked_from_id);
  const spawnedParent = nonEmpty(metaPayload.source?.subagent?.thread_spawn?.parent_thread_id);
  const legacyParent = nonEmpty(metaPayload.parent_thread_id);
  const legacySessionParent = (metaPayload.thread_source === 'subagent' || metaPayload.source?.subagent)
    ? nonEmpty(metaPayload.session_id)
    : null;
  const parentCandidates = [forkedParent, spawnedParent, legacyParent, legacySessionParent].filter(Boolean);
  const distinctParents = [...new Set(parentCandidates.map(value => value.toLowerCase()))];
  let deferredReason = null;
  if (filenameId && metaId && filenameId !== metaId.toLowerCase()) {
    deferredReason = `rollout filename id ${filenameId} does not match root metadata id ${metaId}`;
  } else if (distinctParents.length > 1) {
    deferredReason = 'rollout parent identifiers do not match';
  }
  const rawParentThreadId = distinctParents[0] || null;
  const parentThreadId = normalizedUuid(rawParentThreadId);
  if (rawParentThreadId && !parentThreadId) deferredReason = `parent thread id is not a valid UUID: ${rawParentThreadId}`;
  if (parentThreadId && parentThreadId === rootThreadId) deferredReason = 'parent thread id matches root thread id';

  let model = '(unknown model)';
  let cwd = String(metaPayload.cwd || '(unassigned project)');
  const parsedTokenEvents = [];
  let totalHighWater = null;
  const lastSignatureBySource = new Map();
  let previousSignature = null;
  let eventIndex = 0;
  let turnIndex = 0;
  for (const row of rows) {
    if (row?.type === 'session_meta') {
      if (row.payload?.cwd) cwd = String(row.payload.cwd);
      continue;
    }
    if (row?.type === 'turn_context') {
      turnIndex += 1;
      if (row.payload?.model || row.payload?.info?.model) model = normalizeModel(row.payload.model || row.payload.info.model);
      if (row.payload?.cwd) cwd = String(row.payload.cwd);
      continue;
    }
    if (row?.type !== 'event_msg' || row.payload?.type !== 'token_count') continue;
    diagnostics.tokenRecords += 1;
    const info = row.payload?.info;
    const totalUsage = counters(info?.total_token_usage);
    const lastUsage = counters(info?.last_token_usage);
    if (!totalUsage && !lastUsage) {
      diagnostics.emptyUsage += 1;
      continue;
    }

    let timestamp = null;
    const timestampMs = new Date(row.timestamp || '').getTime();
    try {
      if (!Number.isFinite(timestampMs)) throw new Error('Invalid timestamp');
      timestamp = formatLocalIso(timestampMs);
    } catch {
      diagnostics.invalidTimestamp += 1;
    }
    if (info?.model || info?.model_name || row.payload?.model) {
      model = normalizeModel(info.model || info.model_name || row.payload.model);
    }
    const signature = signatureFor(info?.total_token_usage, info?.last_token_usage);
    const snapshotSource = nonEmpty(row.payload?.rate_limits?.limit_id) || '';
    const duplicateSnapshot = Boolean(totalUsage)
      && (lastSignatureBySource.get(snapshotSource) === signature || previousSignature === signature);
    if (totalUsage) lastSignatureBySource.set(snapshotSource, signature);
    previousSignature = signature;

    let usage = duplicateSnapshot
      ? { input: 0, cachedInput: 0, output: 0, reasoningOutput: 0, reportedTotal: 0 }
      : lastUsage || cumulativeDelta(totalHighWater, totalUsage);
    if (totalUsage) totalHighWater = updateHighWater(totalHighWater, totalUsage);
    usage = { ...usage, cachedInput: Math.min(usage.cachedInput, usage.input) };
    const isEmpty = usage.input === 0 && usage.output === 0 && usage.cachedInput === 0;
    if (duplicateSnapshot) {
      diagnostics.duplicateEvents += 1;
    }
    if (isEmpty && !duplicateSnapshot) diagnostics.emptyUsage += 1;
    if (!isEmpty) eventIndex += 1;
    parsedTokenEvents.push({
      signature,
      timestamp,
      timestampMs,
      tokenOffset: parsedTokenEvents.length,
      eventIndex: isEmpty ? null : eventIndex,
      turnIndex,
      model,
      cwd,
      usage,
      contextWindow: number(info?.model_context_window)
    });
  }

  let replayPrefix = 0;
  const hasBillableTokens = parsedTokenEvents.some(event => event.eventIndex != null);
  if (hasBillableTokens && !rootMeta) deferredReason = 'rollout has billable tokens but no root session metadata';
  else if (hasBillableTokens && !rootThreadId) deferredReason = 'rollout filename is missing a valid trailing UUID';
  if (!deferredReason && parentThreadId && !options.ignoreParent) {
    try {
      const parentSignatures = options.resolveParentSignatures?.(parentThreadId, new Date(rootMeta?.timestamp || '').getTime());
      if (!parentSignatures) deferredReason = `parent rollout ${parentThreadId} is unavailable`;
      else replayPrefix = matchingReplayPrefix(parsedTokenEvents, parentSignatures);
    } catch (error) {
      deferredReason = error.message;
    }
  }

  const events = [];
  for (const parsed of parsedTokenEvents) {
    if (deferredReason || parsed.eventIndex == null || !parsed.timestamp || parsed.tokenOffset < replayPrefix) continue;
    const { usage } = parsed;
    const eventKey = hash(`${rootThreadId}|${parsed.eventIndex}`);
    const total = usage.input + usage.output;
    const date = parsed.timestamp.slice(0, 10);
    if (cutoffDate && date < cutoffDate) {
      diagnostics.outsideRetention += 1;
      continue;
    }
    diagnostics.oldestEvent = diagnostics.oldestEvent && diagnostics.oldestEvent < parsed.timestamp ? diagnostics.oldestEvent : parsed.timestamp;
    diagnostics.newestEvent = diagnostics.newestEvent && diagnostics.newestEvent > parsed.timestamp ? diagnostics.newestEvent : parsed.timestamp;
    events.push({
      eventKey,
      eventIndex: parsed.eventIndex,
      tokenSignature: parsed.signature,
      turnId: privateId(`${rootThreadId}|turn|${parsed.turnIndex}`, 'turn'),
      timestamp: parsed.timestamp,
      date,
      sessionId: privateId(rootThreadId, 'task'),
      model: parsed.model,
      project: projectName(parsed.cwd),
      projectId: privateId(parsed.cwd, 'project'),
      input: usage.input,
      cachedInput: usage.cachedInput,
      cacheWriteInput: 0,
      uncachedInput: Math.max(0, usage.input - usage.cachedInput),
      output: usage.output,
      reasoningOutput: usage.reasoningOutput,
      unclassified: 0,
      total,
      contextWindow: parsed.contextWindow
    });
  }
  diagnostics.acceptedEvents = events.length;
  if (deferredReason) diagnostics.status = 'deferred';
  else if (diagnostics.invalidJson || diagnostics.invalidTimestamp) diagnostics.status = 'warning';
  else if (!diagnostics.tokenRecords) diagnostics.status = 'empty';
  return {
    sessionId: privateId(rootThreadId || filePath, 'task'),
    rootThreadId,
    parentThreadId,
    rootTimestampMs: new Date(rootMeta?.timestamp || '').getTime(),
    tokenSignatures: parsedTokenEvents.map(event => ({ signature: event.signature, timestampMs: event.timestampMs })),
    replayPrefix,
    deferredReason,
    events,
    diagnostics
  };
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
      source_key TEXT NOT NULL DEFAULT '',
      size INTEGER NOT NULL,
      mtime_ms REAL NOT NULL,
      session_id TEXT NOT NULL,
      indexed_at TEXT NOT NULL,
      parser_version TEXT NOT NULL DEFAULT '',
      present INTEGER NOT NULL DEFAULT 1,
      missing_since TEXT,
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
      event_index INTEGER,
      token_signature TEXT,
      turn_id TEXT NOT NULL,
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
  let migratedVersion = version;
  if (migratedVersion < 2) {
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
      database.exec('PRAGMA user_version = 2; COMMIT');
      migratedVersion = 2;
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
  }
  if (migratedVersion < 3) {
    database.exec('BEGIN IMMEDIATE');
    try {
      addColumn(database, 'usage_events', 'turn_id', "TEXT NOT NULL DEFAULT ''");
      database.exec('PRAGMA user_version = 3; COMMIT');
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
  }
  if (migratedVersion < 4) {
    database.exec('BEGIN IMMEDIATE');
    try {
      addColumn(database, 'source_files', 'source_key', "TEXT NOT NULL DEFAULT ''");
      addColumn(database, 'source_files', 'parser_version', "TEXT NOT NULL DEFAULT ''");
      addColumn(database, 'source_files', 'present', 'INTEGER NOT NULL DEFAULT 1');
      addColumn(database, 'source_files', 'missing_since', 'TEXT');
      addColumn(database, 'usage_events', 'event_index', 'INTEGER');
      addColumn(database, 'usage_events', 'token_signature', 'TEXT');
      database.exec('PRAGMA user_version = 4; COMMIT');
      migratedVersion = 4;
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
  }
  addColumn(database, 'source_files', 'parser_version', "TEXT NOT NULL DEFAULT ''");
  database.exec('CREATE INDEX IF NOT EXISTS source_files_source_key ON source_files(source_key);');
  return database;
}

export function refreshIndex(database, codexRoot, options = {}) {
  const retentionDays = normalizeRetentionDays(options.retentionDays);
  const cutoffDate = retentionCutoffDate(retentionDays, options.now || new Date());
  const setting = retentionSetting(retentionDays);
  const previousSetting = metadataValue(database, 'retention_days');
  const policyChanged = previousSetting !== setting;
  const parserChanged = metadataValue(database, 'parser_version') !== PARSER_VERSION;
  const roots = normalizedRoots(codexRoot);
  const rootsByKey = new Map(roots.map(root => [pathKey(root), root]));
  const files = scanLogFiles(codexRoot, { allowEmpty: true });
  const rolloutIndex = new Map();
  for (const filePath of files) {
    const rolloutId = rolloutIdFromPath(filePath);
    if (!rolloutId) continue;
    if (!rolloutIndex.has(rolloutId)) rolloutIndex.set(rolloutId, []);
    rolloutIndex.get(rolloutId).push(filePath);
  }
  const resolveParentSignatures = parentSignatureResolver(rolloutIndex);
  const knownRows = database.prepare('SELECT path, source_key, size, mtime_ms, session_id, parser_version, present FROM source_files').all();
  const known = new Map(knownRows.map(row => [pathKey(row.path), row]));
  const diskPaths = new Set(files.map(pathKey));
  const unselected = [];
  const selectedKnown = [];
  for (const row of knownRows) {
    const inferredRoot = rootForFile(row.path, roots);
    const selectedRoot = inferredRoot || rootsByKey.get(pathKey(row.source_key || row.path));
    if (!selectedRoot) unselected.push(row);
    else selectedKnown.push({ row, sourceKey: pathKey(selectedRoot) });
  }
  const missing = selectedKnown.filter(({ row }) => !diskPaths.has(pathKey(row.path)));
  const retainedMissing = missing.filter(({ row }) => row.parser_version === PARSER_VERSION);
  const staleMissing = missing.filter(({ row }) => row.parser_version !== PARSER_VERSION);
  const changed = [];
  const unchanged = [];
  for (const filePath of files) {
    const stats = statSync(filePath);
    const row = known.get(pathKey(filePath));
    const sourceRoot = rootForFile(filePath, roots);
    const sourceKey = pathKey(sourceRoot || filePath);
    if (policyChanged || parserChanged || !row || !Number(row.present) || pathKey(row.source_key || row.path) !== sourceKey
      || Number(row.size) !== stats.size || Number(row.mtime_ms) !== stats.mtimeMs) {
      changed.push({ filePath, sourceKey, stats, row });
    }
    else unchanged.push(filePath);
  }

  const deleteEvents = database.prepare('DELETE FROM usage_events WHERE source_path = ?');
  const deleteFile = database.prepare('DELETE FROM source_files WHERE path = ?');
  const markMissing = database.prepare(`UPDATE source_files SET source_key = ?, present = 0,
    missing_since = COALESCE(missing_since, ?) WHERE path = ?`);
  const markFileError = database.prepare(`UPDATE source_files SET source_key = ?, size = -1, mtime_ms = -1,
    indexed_at = ?, present = 1, missing_since = NULL, parse_status = 'error' WHERE path = ?`);
  const upsertFile = database.prepare(`INSERT INTO source_files(
      path, source_key, size, mtime_ms, session_id, indexed_at, parser_version, present, missing_since,
      total_lines, parsed_lines, token_records, accepted_events,
      duplicate_events, empty_usage, invalid_json, invalid_timestamp, outside_retention, oldest_event, newest_event, parse_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(path) DO UPDATE SET
      source_key = excluded.source_key, size = excluded.size, mtime_ms = excluded.mtime_ms,
      session_id = excluded.session_id, indexed_at = excluded.indexed_at, parser_version = excluded.parser_version,
      present = 1, missing_since = NULL,
      total_lines = excluded.total_lines, parsed_lines = excluded.parsed_lines, token_records = excluded.token_records,
      accepted_events = excluded.accepted_events, duplicate_events = excluded.duplicate_events, empty_usage = excluded.empty_usage,
      invalid_json = excluded.invalid_json, invalid_timestamp = excluded.invalid_timestamp,
      outside_retention = excluded.outside_retention, oldest_event = excluded.oldest_event,
      newest_event = excluded.newest_event, parse_status = excluded.parse_status`);
  const insertEvent = database.prepare(`INSERT OR IGNORE INTO usage_events(
    source_path, event_key, event_index, token_signature, turn_id, timestamp, date, session_id, model, project, project_id, input, cached_input,
    cache_write_input, uncached_input, output, reasoning_output, unclassified, total, context_window
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

  let parsedEvents = 0;
  let failedFiles = 0;
  let prunedEvents = 0;
  const refreshedAt = formatLocalIso();
  database.exec('BEGIN IMMEDIATE');
  try {
    unselected.forEach(({ path: filePath }) => deleteFile.run(filePath));
    staleMissing.forEach(({ row }) => deleteFile.run(row.path));
    retainedMissing.forEach(({ row, sourceKey }) => markMissing.run(sourceKey, refreshedAt, row.path));
    for (const { filePath, sourceKey, stats, row } of changed) {
      let parsed;
      try {
        parsed = parseSessionFile(filePath, { cutoffDate, resolveParentSignatures });
      } catch {
        failedFiles += 1;
        if (!row) {
          upsertFile.run(filePath, sourceKey, -1, -1, privateId(filePath, 'task'), refreshedAt, PARSER_VERSION, 0, 0, 0, 0, 0, 0, 0, 0, 0, null, null, 'error');
        } else markFileError.run(sourceKey, refreshedAt, row.path);
        continue;
      }
      if (row && row.path !== filePath) deleteFile.run(row.path);
      else deleteEvents.run(filePath);
      const d = parsed.diagnostics;
      upsertFile.run(
        filePath, sourceKey, stats.size, stats.mtimeMs, parsed.sessionId, refreshedAt, PARSER_VERSION, d.totalLines, d.parsedLines,
        d.tokenRecords, d.acceptedEvents, d.duplicateEvents, d.emptyUsage, d.invalidJson, d.invalidTimestamp,
        d.outsideRetention, d.oldestEvent, d.newestEvent, d.status
      );
      for (const event of parsed.events) {
        insertEvent.run(
          filePath, event.eventKey, event.eventIndex, event.tokenSignature, event.turnId, event.timestamp, event.date,
          event.sessionId, event.model, event.project, event.projectId,
          event.input, event.cachedInput, event.cacheWriteInput, event.uncachedInput, event.output, event.reasoningOutput,
          event.unclassified, event.total, event.contextWindow
        );
      }
      parsedEvents += parsed.events.length;
    }
    if (cutoffDate) prunedEvents = Number(database.prepare('DELETE FROM usage_events WHERE date < ?').run(cutoffDate).changes);
    setMetadata(database, 'retention_days', setting);
    setMetadata(database, 'parser_version', PARSER_VERSION);
    setMetadata(database, 'last_refresh_at', refreshedAt);
    setMetadata(database, 'last_cutoff_date', cutoffDate || '');
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }

  const canonicalCounts = database.prepare(`WITH ranked AS (
      SELECT usage_events.event_key, usage_events.session_id,
        ROW_NUMBER() OVER (
          PARTITION BY usage_events.event_key
          ORDER BY source_files.present DESC, source_files.indexed_at DESC, usage_events.rowid DESC
        ) AS event_rank
      FROM usage_events JOIN source_files ON usage_events.source_path = source_files.path
    )
    SELECT COUNT(*) AS events, COUNT(DISTINCT session_id) AS sessions
    FROM ranked WHERE event_rank = 1`).get();
  const eventCount = number(canonicalCounts.events);
  const sessionCount = number(canonicalCounts.sessions);
  return {
    filesScanned: files.length,
    changedFiles: changed.length,
    unchangedFiles: unchanged.length,
    removedFiles: missing.length + unselected.length,
    retainedMissingFiles: retainedMissing.length,
    droppedLegacyFiles: staleMissing.length,
    droppedSourceFiles: unselected.length,
    failedFiles,
    parsedEvents,
    prunedEvents,
    eventCount,
    sessionCount,
    retentionDays: retentionDays ?? 'all',
    cutoffDate,
    policyChanged,
    parserChanged
  };
}

export function readIndexedEvents(database) {
  return database.prepare(`WITH ranked AS (
      SELECT usage_events.rowid AS row_id,
        ROW_NUMBER() OVER (
          PARTITION BY usage_events.event_key
          ORDER BY source_files.present DESC, source_files.indexed_at DESC, usage_events.rowid DESC
        ) AS event_rank
      FROM usage_events JOIN source_files ON usage_events.source_path = source_files.path
    ), deduplicated AS (
      SELECT row_id FROM ranked WHERE event_rank = 1
    )
    SELECT turn_id AS "turnId", timestamp, date, session_id AS "sessionId", model, project, project_id AS "projectId",
      input, cached_input AS "cachedInput", cache_write_input AS "cacheWriteInput", uncached_input AS "uncachedInput",
      output, reasoning_output AS "reasoningOutput", unclassified, total, context_window AS "contextWindow"
    FROM usage_events JOIN deduplicated ON usage_events.rowid = deduplicated.row_id
    ORDER BY timestamp`).all();
}

export function readDailySummary(database, date = formatLocalIso().slice(0, 10)) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date))) throw new Error('Summary date must use YYYY-MM-DD.');
  const totals = database.prepare(`WITH ranked AS (
      SELECT usage_events.rowid AS row_id,
        ROW_NUMBER() OVER (
          PARTITION BY usage_events.event_key
          ORDER BY source_files.present DESC, source_files.indexed_at DESC, usage_events.rowid DESC
        ) AS event_rank
      FROM usage_events JOIN source_files ON usage_events.source_path = source_files.path
      WHERE usage_events.date = ?
    ), deduplicated AS (
      SELECT row_id FROM ranked WHERE event_rank = 1
    )
    SELECT COUNT(*) AS calls, COUNT(DISTINCT NULLIF(turn_id, '')) AS turns, COUNT(DISTINCT session_id) AS tasks,
      SUM(input) AS input, SUM(cached_input) AS cached_input,
      SUM(cache_write_input) AS cache_write_input, SUM(uncached_input) AS uncached_input,
      SUM(output) AS output, SUM(reasoning_output) AS reasoning_output,
      SUM(unclassified) AS unclassified, SUM(total) AS total
    FROM usage_events JOIN deduplicated ON usage_events.rowid = deduplicated.row_id`).get(date);
  const topModel = database.prepare(`WITH ranked AS (
      SELECT usage_events.rowid AS row_id,
        ROW_NUMBER() OVER (
          PARTITION BY usage_events.event_key
          ORDER BY source_files.present DESC, source_files.indexed_at DESC, usage_events.rowid DESC
        ) AS event_rank
      FROM usage_events JOIN source_files ON usage_events.source_path = source_files.path
      WHERE usage_events.date = ?
    ), deduplicated AS (
      SELECT row_id FROM ranked WHERE event_rank = 1
    )
    SELECT model, SUM(total) AS total
    FROM usage_events JOIN deduplicated ON usage_events.rowid = deduplicated.row_id
    GROUP BY model ORDER BY total DESC, model LIMIT 1`).get(date);
  const input = number(totals.input);
  const cachedInput = number(totals.cached_input);
  const total = number(totals.total);
  return {
    date: String(date),
    calls: number(totals.calls),
    turns: number(totals.turns),
    tasks: number(totals.tasks),
    tokens: {
      input,
      cachedInput,
      cacheWriteInput: number(totals.cache_write_input),
      uncachedInput: number(totals.uncached_input),
      output: number(totals.output),
      reasoningOutput: number(totals.reasoning_output),
      unclassified: number(totals.unclassified),
      total
    },
    cacheRate: input ? cachedInput / input : 0,
    averageTokens: number(totals.calls) ? total / number(totals.calls) : 0,
    topModel: topModel ? { name: topModel.model, tokens: number(topModel.total) } : null
  };
}

export function getIndexDiagnostics(database, options = {}) {
  const aggregate = database.prepare(`SELECT
      COUNT(*) AS files,
      COUNT(DISTINCT session_id) AS sessions,
      SUM(CASE WHEN present = 1 THEN 1 ELSE 0 END) AS present_files,
      SUM(CASE WHEN present = 0 THEN 1 ELSE 0 END) AS missing_files,
      SUM(CASE WHEN parse_status = 'deferred' THEN 1 ELSE 0 END) AS deferred_files,
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
  const canonicalCounts = database.prepare(`WITH ranked AS (
      SELECT usage_events.event_key, usage_events.session_id,
        ROW_NUMBER() OVER (
          PARTITION BY usage_events.event_key
          ORDER BY source_files.present DESC, source_files.indexed_at DESC, usage_events.rowid DESC
        ) AS event_rank
      FROM usage_events JOIN source_files ON usage_events.source_path = source_files.path
    )
    SELECT COUNT(*) AS events, COUNT(DISTINCT session_id) AS sessions
    FROM ranked WHERE event_rank = 1`).get();
  const eventCount = number(canonicalCounts.events);
  const sessionCount = number(canonicalCounts.sessions);
  const transientFailures = Number(options.indexResult?.failedFiles || 0);
  const warningCount = number(aggregate.invalid_json) + number(aggregate.invalid_timestamp) + number(aggregate.deferred_files);
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
      presentFiles: number(aggregate.present_files),
      missingFiles: number(aggregate.missing_files),
      deferredFiles: number(aggregate.deferred_files),
      sessions: sessionCount,
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
      retainedMissingFiles: Number(options.indexResult?.retainedMissingFiles || 0),
      droppedSourceFiles: Number(options.indexResult?.droppedSourceFiles || 0),
      droppedLegacyFiles: Number(options.indexResult?.droppedLegacyFiles || 0),
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
