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
