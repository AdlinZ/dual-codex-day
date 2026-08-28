import { existsSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

function number(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function dateKey(value) {
  const date = new Date(Number(value || 0) * 1000);
  if (Number.isNaN(date.getTime())) return '';
  const pad = part => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function aggregateBy(rows, getLabel) {
  const groups = new Map();
  for (const row of rows) {
    const label = String(getLabel(row) || '(unknown)');
    const current = groups.get(label) || { label, calls: 0, input: 0, cachedInput: 0, output: 0, total: 0 };
    current.calls += 1;
    current.input += number(row.input_tokens);
    current.cachedInput += number(row.cache_read_tokens);
    current.output += number(row.output_tokens);
    current.total += number(row.input_tokens) + number(row.output_tokens);
    groups.set(label, current);
  }
  return [...groups.values()].sort((left, right) => right.total - left.total || left.label.localeCompare(right.label));
}

function aggregate(rows, key) {
  return aggregateBy(rows, row => row[key]);
}

export function readCcSwitchAudit(databasePath) {
  const resolvedPath = path.resolve(String(databasePath || ''));
  if (!resolvedPath || !existsSync(resolvedPath)) throw new Error('找不到 CC Switch 数据库文件。');
  const database = new DatabaseSync(resolvedPath, { readOnly: true });
  try {
    const table = database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'proxy_request_logs'").get();
    if (!table) throw new Error('CC Switch 数据库中没有 proxy_request_logs 表。');
    const rows = database.prepare(`
      SELECT created_at, model, data_source, input_tokens, output_tokens, cache_read_tokens, cache_creation_tokens,
        status_code
      FROM proxy_request_logs
      WHERE app_type = 'codex'
      ORDER BY created_at
    `).all();
    const normalized = rows.map(row => ({ ...row, date: dateKey(row.created_at) })).filter(row => row.date);
    const totals = normalized.reduce((result, row) => ({
      calls: result.calls + 1,
      input: result.input + number(row.input_tokens),
      cachedInput: result.cachedInput + number(row.cache_read_tokens),
      output: result.output + number(row.output_tokens),
      total: result.total + number(row.input_tokens) + number(row.output_tokens)
    }), { calls: 0, input: 0, cachedInput: 0, output: 0, total: 0 });
    return {
      databaseName: path.basename(resolvedPath),
      appType: 'codex',
      totals,
      daily: aggregate(normalized, 'date'),
      dailyModels: normalized.length
        ? aggregateBy(normalized, row => `${row.date}\t${row.model}`).map(row => {
          const [date, ...modelParts] = row.label.split('\t');
          return { ...row, date, label: modelParts.join('\t') };
        })
        : [],
      models: aggregate(normalized, 'model'),
      sources: aggregate(normalized, 'data_source'),
      statusCodes: aggregate(normalized, 'status_code')
    };
  } finally {
    database.close();
  }
}
