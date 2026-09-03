export function usageBounds(range, customStart = '', customEnd = '', now = new Date()) {
  let start = new Date(0);
  let end = null;
  if (range === 'today') start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (range === 'week') {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    start.setDate(start.getDate() - ((start.getDay() || 7) - 1));
  }
  if (range === '30d' || range === '90d') {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    start.setDate(start.getDate() - (range === '30d' ? 29 : 89));
  }
  if (range === 'custom' && customStart && customEnd) {
    start = new Date(`${customStart}T00:00:00`);
    end = new Date(`${customEnd}T00:00:00`);
    end.setDate(end.getDate() + 1);
  }
  return { start, end };
}

export function filterUsageEvents(events, options = {}) {
  const { start, end } = usageBounds(options.range || 'all', options.customStart, options.customEnd, options.now);
  return (events || []).filter(event => {
    const time = new Date(event.timestamp);
    return time >= start
      && (!end || time < end)
      && (!options.model || event.model === options.model)
      && (!options.projectId || event.projectId === options.projectId);
  });
}

export function aggregateUsage(events, estimate = () => ({ priced: false, total: 0, parts: {} })) {
  const input = events.reduce((sum, event) => sum + Number(event.input || 0), 0);
  const cached = events.reduce((sum, event) => sum + Number(event.cachedInput || 0), 0);
  const total = events.reduce((sum, event) => sum + Number(event.total || 0), 0);
  const estimates = events.map(estimate);
  const cost = estimates.reduce((sum, item) => sum + Number(item.total || 0), 0);
  return {
    input,
    cached,
    total,
    cost,
    output: events.reduce((sum, event) => sum + Number(event.output || 0), 0),
    calls: events.length,
    turns: new Set(events.map(event => event.turnId).filter(Boolean)).size,
    tasks: new Set(events.map(event => event.sessionId)).size,
    projects: new Set(events.map(event => event.projectId)).size,
    cacheRate: input ? cached / input : 0,
    average: events.length ? total / events.length : 0,
    coverage: total ? events.reduce((sum, event, index) => sum + (estimates[index].priced ? Number(event.total || 0) : 0), 0) / total : 1,
    parts: estimates.reduce((parts, item) => ({
      input: parts.input + Number(item.parts?.input || 0),
      cached: parts.cached + Number(item.parts?.cached || 0),
      output: parts.output + Number(item.parts?.output || 0)
    }), { input: 0, cached: 0, output: 0 })
  };
}

export function groupUsageTasks(events) {
  const tasks = new Map();
  for (const event of events) {
    const task = tasks.get(event.sessionId) || {
      id: event.sessionId,
      project: event.project,
      timestamp: event.timestamp,
      calls: 0,
      total: 0,
      input: 0,
      cached: 0,
      output: 0,
      turns: new Set(),
      models: new Set(),
      events: []
    };
    task.calls += 1;
    task.total += Number(event.total || 0);
    task.input += Number(event.input || 0);
    task.cached += Number(event.cachedInput || 0);
    task.output += Number(event.output || 0);
    if (event.turnId) task.turns.add(event.turnId);
    if (event.model) task.models.add(event.model);
    if (event.timestamp > task.timestamp) task.timestamp = event.timestamp;
    task.events.push(event);
    tasks.set(event.sessionId, task);
  }
  return [...tasks.values()].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

export function topUsageLabel(events, key, labelKey = key) {
  const groups = new Map();
  for (const event of events) {
    const id = event[key];
    const group = groups.get(id) || { id, label: event[labelKey], total: 0 };
    group.total += Number(event.total || 0);
    groups.set(id, group);
  }
  return [...groups.values()].sort((a, b) => b.total - a.total)[0] || null;
}

export function periodBounds(period = 'week', now = new Date(), offset = 0) {
  if (!['week', 'month'].includes(period)) throw new Error(`Unsupported review period: ${period}`);
  const normalizedOffset = Math.min(0, Math.trunc(Number(offset) || 0));
  const currentStart = period === 'month'
    ? new Date(now.getFullYear(), now.getMonth(), 1)
    : new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (period === 'week') currentStart.setDate(currentStart.getDate() - ((currentStart.getDay() || 7) - 1));
  if (period === 'month') currentStart.setMonth(currentStart.getMonth() + normalizedOffset);
  else currentStart.setDate(currentStart.getDate() + normalizedOffset * 7);
  const currentPeriodEnd = period === 'month'
    ? new Date(currentStart.getFullYear(), currentStart.getMonth() + 1, 1)
    : new Date(currentStart.getFullYear(), currentStart.getMonth(), currentStart.getDate() + 7);
  const previousStart = period === 'month'
    ? new Date(currentStart.getFullYear(), currentStart.getMonth() - 1, 1)
    : new Date(currentStart.getFullYear(), currentStart.getMonth(), currentStart.getDate() - 7);
  const isCurrent = normalizedOffset === 0;
  const elapsed = isCurrent
    ? Math.max(0, Math.min(now.getTime() - currentStart.getTime(), currentPeriodEnd.getTime() - currentStart.getTime()))
    : currentPeriodEnd.getTime() - currentStart.getTime();
  const previousPeriodEnd = new Date(currentStart);
  const previousEnd = isCurrent
    ? new Date(Math.min(previousPeriodEnd.getTime(), previousStart.getTime() + elapsed + 1))
    : previousPeriodEnd;
  const currentEnd = isCurrent ? new Date(Math.min(currentPeriodEnd.getTime(), now.getTime() + 1)) : currentPeriodEnd;
  const progress = elapsed > 0 ? elapsed / (currentPeriodEnd.getTime() - currentStart.getTime()) : 0;
  return { currentStart, currentEnd, currentPeriodEnd, previousStart, previousEnd, previousPeriodEnd, progress, offset: normalizedOffset, isCurrent };
}

function eventsWithin(events, start, end) {
  return (events || []).filter(event => {
    const time = new Date(event.timestamp);
    return time >= start && time < end;
  });
}

export function buildPeriodReview(events, options = {}) {
  const bounds = periodBounds(options.period || 'week', options.now || new Date(), options.offset || 0);
  const estimate = options.estimate || (() => ({ priced: false, total: 0, parts: {} }));
  const currentEvents = eventsWithin(events, bounds.currentStart, bounds.currentEnd);
  const previousEvents = eventsWithin(events, bounds.previousStart, bounds.previousEnd);
  const current = aggregateUsage(currentEvents, estimate);
  const previous = aggregateUsage(previousEvents, estimate);
  const days = [];
  const dayCursor = new Date(bounds.currentStart);
  const lastDay = new Date(bounds.currentEnd.getFullYear(), bounds.currentEnd.getMonth(), bounds.currentEnd.getDate());
  while (dayCursor <= lastDay && dayCursor < bounds.currentPeriodEnd) {
    const next = new Date(dayCursor.getFullYear(), dayCursor.getMonth(), dayCursor.getDate() + 1);
    days.push({ date: new Date(dayCursor), ...aggregateUsage(eventsWithin(currentEvents, dayCursor, next), estimate) });
    dayCursor.setDate(dayCursor.getDate() + 1);
  }
  const forecast = bounds.isCurrent && bounds.progress > 0 ? {
    total: current.total / bounds.progress,
    cost: current.cost / bounds.progress,
    calls: current.calls / bounds.progress,
    tasks: current.tasks / bounds.progress
  } : null;
  return { bounds, currentEvents, previousEvents, current, previous, days, forecast };
}

export function summarizeUsageSources(datasets, options = {}) {
  const rows = [];
  for (const dataset of datasets || []) {
    if (options.excludeDuplicates && dataset?.source?.duplicateOf) continue;
    if (dataset?.error) {
      rows.push({ source: dataset.source, events: [], aggregate: aggregateUsage([]), error: dataset.error });
      continue;
    }
    const events = filterUsageEvents(dataset?.events, {
      range: 'all',
      model: options.model,
      projectId: options.projectId
    }).filter(event => {
      const time = new Date(event.timestamp);
      return (!options.start || time >= options.start) && (!options.end || time < options.end);
    });
    const estimate = event => options.estimate ? options.estimate(event, dataset) : ({ priced: false, total: 0, parts: {} });
    rows.push({ source: dataset.source, events, aggregate: aggregateUsage(events, estimate), error: null });
  }
  return rows;
}
