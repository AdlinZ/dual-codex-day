import assert from 'node:assert/strict';
import { aggregateUsage, filterUsageEvents, groupUsageTasks, topUsageLabel } from '../electron/renderer/usage-analysis.mjs';

const events = [
  { timestamp: '2026-08-31T09:00:00', sessionId: 'task-a', turnId: 'turn-a', project: 'alpha', projectId: 'p-a', model: 'gpt-a', input: 100, cachedInput: 40, output: 20, total: 120 },
  { timestamp: '2026-08-31T09:10:00', sessionId: 'task-a', turnId: 'turn-b', project: 'alpha', projectId: 'p-a', model: 'gpt-b', input: 200, cachedInput: 100, output: 30, total: 230 },
  { timestamp: '2026-08-20T08:00:00', sessionId: 'task-b', turnId: 'turn-c', project: 'beta', projectId: 'p-b', model: 'gpt-a', input: 50, cachedInput: 0, output: 10, total: 60 }
];

const today = filterUsageEvents(events, { range: 'today', now: new Date('2026-08-31T18:00:00') });
assert.equal(today.length, 2);
assert.equal(filterUsageEvents(events, { range: 'all', model: 'gpt-b' }).length, 1);
assert.equal(filterUsageEvents(events, { range: 'custom', customStart: '2026-08-20', customEnd: '2026-08-20' }).length, 1);

const aggregate = aggregateUsage(today, () => ({ priced: true, total: 0.5, parts: { input: 0.2, cached: 0.1, output: 0.2 } }));
assert.deepEqual({ total: aggregate.total, calls: aggregate.calls, turns: aggregate.turns, tasks: aggregate.tasks }, { total: 350, calls: 2, turns: 2, tasks: 1 });
assert.equal(aggregate.cacheRate, 140 / 300);
assert.equal(aggregate.cost, 1);

const tasks = groupUsageTasks(events);
assert.equal(tasks.length, 2);
assert.equal(tasks[0].id, 'task-a');
assert.equal(tasks[0].turns.size, 2);
assert.deepEqual([...tasks[0].models], ['gpt-a', 'gpt-b']);
assert.equal(topUsageLabel(events, 'projectId', 'project').label, 'alpha');

console.log('Usage analysis checks passed: ranges, filters, aggregates, comparison labels, and task drilldown groups.');
