import assert from 'node:assert/strict';
import { aggregateUsage, buildPeriodReview, filterUsageEvents, groupUsageTasks, periodBounds, summarizeUsageSources, topUsageLabel } from '../electron/renderer/usage-analysis.mjs';

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

const originalTimeZone = process.env.TZ;
try {
  process.env.TZ = 'Asia/Shanghai';
  const sunday = new Date('2026-09-06T23:30:00+08:00');
  const week = periodBounds('week', sunday);
  assert.deepEqual(
    [week.currentStart.getFullYear(), week.currentStart.getMonth() + 1, week.currentStart.getDate(), week.currentStart.getHours()],
    [2026, 8, 31, 0],
    'natural weeks must begin on local Monday at midnight'
  );
  assert.deepEqual(
    [week.previousStart.getFullYear(), week.previousStart.getMonth() + 1, week.previousStart.getDate()],
    [2026, 8, 24],
    'the comparison window must use the preceding natural week'
  );
  assert.equal(week.currentStart.toISOString(), '2026-08-30T16:00:00.000Z', 'local calendar boundaries must retain the active timezone offset');

  const review = buildPeriodReview(events, {
    period: 'week',
    now: new Date('2026-09-03T12:00:00+08:00'),
    estimate: () => ({ priced: true, total: 1, parts: {} })
  });
  assert.equal(review.current.total, 350);
  assert.equal(review.previous.total, 0);
  assert.equal(review.days.length, 4);
  assert(review.forecast.total > review.current.total, 'an in-progress cycle must provide an end-of-period forecast');
  assert.equal(review.forecast.cost, 4, 'the forecast must scale current cost by elapsed cycle progress');

  const month = periodBounds('month', new Date('2026-09-03T12:00:00+08:00'));
  assert.deepEqual(
    [month.previousStart.getFullYear(), month.previousStart.getMonth() + 1, month.previousStart.getDate(), month.previousEnd.getDate()],
    [2026, 8, 1, 3],
    'month comparison must cover the same elapsed portion of the previous calendar month'
  );

  const emptyReview = buildPeriodReview([], { period: 'month', now: new Date('2026-09-01T00:00:00+08:00') });
  assert.equal(emptyReview.current.total, 0);
  assert.equal(emptyReview.forecast, null);
  assert.equal(emptyReview.days.length, 1);

  const historicalReview = buildPeriodReview(events, {
    period: 'week',
    offset: -2,
    now: new Date('2026-09-03T12:00:00+08:00')
  });
  assert.deepEqual(
    [historicalReview.bounds.currentStart.getMonth() + 1, historicalReview.bounds.currentStart.getDate(), historicalReview.bounds.currentEnd.getDate()],
    [8, 17, 24],
    'historical navigation must select complete natural periods'
  );
  assert.equal(historicalReview.current.total, 60);
  assert.equal(historicalReview.days.length, 7);
  assert.equal(historicalReview.forecast, null, 'completed periods must not expose a forecast');
} finally {
  if (originalTimeZone === undefined) delete process.env.TZ;
  else process.env.TZ = originalTimeZone;
}

const sourceRows = summarizeUsageSources([
  { source: { id: 'default', name: '默认账号' }, events },
  { source: { id: 'profile-shared', name: '共享账号', duplicateOf: 'default' }, events },
  { source: { id: 'profile-broken', name: '损坏账号' }, events: [], error: 'index unavailable' }
], {
  start: new Date('2026-08-01T00:00:00Z'),
  end: new Date('2026-09-01T00:00:00Z'),
  excludeDuplicates: true
});
assert.equal(sourceRows.length, 2, 'shared default sources must not be counted twice');
assert.equal(sourceRows.find(row => row.source.id === 'default').aggregate.total, 410);
assert.equal(sourceRows.find(row => row.source.id === 'profile-broken').error, 'index unavailable', 'one failed account must remain isolated from healthy account summaries');

console.log('Usage analysis checks passed: ranges, calendar periods, forecasts, isolated account failures, aggregates, and task groups.');
