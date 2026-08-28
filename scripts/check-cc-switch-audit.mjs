import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { readCcSwitchAudit } from './lib/cc-switch-audit.mjs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const temporaryRoot = mkdtempSync(path.join(os.tmpdir(), 'dual-codex-cc-switch-test-'));
const databasePath = path.join(temporaryRoot, 'cc-switch.db');
let database;
try {
  database = new DatabaseSync(databasePath);
  database.exec(`CREATE TABLE proxy_request_logs (
    request_id TEXT PRIMARY KEY, app_type TEXT NOT NULL, model TEXT NOT NULL, input_tokens INTEGER NOT NULL DEFAULT 0,
    output_tokens INTEGER NOT NULL DEFAULT 0, cache_read_tokens INTEGER NOT NULL DEFAULT 0,
    cache_creation_tokens INTEGER NOT NULL DEFAULT 0, status_code INTEGER NOT NULL, created_at INTEGER NOT NULL,
    data_source TEXT NOT NULL DEFAULT 'proxy'
  )`);
  database.prepare(`INSERT INTO proxy_request_logs(request_id, app_type, model, input_tokens, output_tokens, cache_read_tokens, status_code, created_at, data_source)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run('a', 'codex', 'gpt-5.6-sol', 100, 20, 80, 200, 1787788800, 'codex_session');
  database.prepare(`INSERT INTO proxy_request_logs(request_id, app_type, model, input_tokens, output_tokens, cache_read_tokens, status_code, created_at, data_source)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run('b', 'claude', 'claude-sonnet', 900, 90, 0, 200, 1787788800, 'proxy');
  database.close(); database = null;
  const audit = readCcSwitchAudit(databasePath);
  assert(audit.totals.calls === 1 && audit.totals.total === 120, 'audit must restrict rows to app_type=codex and use input + output totals');
  assert(audit.totals.cachedInput === 80 && audit.models[0].label === 'gpt-5.6-sol', 'audit must preserve model and cached-input breakdowns');
  assert(audit.daily.length === 1 && audit.sources[0].label === 'codex_session', 'audit must expose daily and source breakdowns');
  console.log('CC Switch audit checks passed: read-only Codex filtering, totals, daily, model, and source breakdowns.');
} finally {
  database?.close();
  rmSync(temporaryRoot, { recursive: true, force: true });
}
