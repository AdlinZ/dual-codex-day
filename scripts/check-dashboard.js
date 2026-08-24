const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const templatePath = path.join(root, 'src', 'index.template.html');
const demoPath = path.join(root, 'demo', 'index.html');
const requiredIds = [
  'budget-today',
  'budget-month',
  'budget-forecast',
  'budget-status',
  'cost-alerts',
  'report-center',
  'report-token',
  'report-cost',
  'report-tasks',
  'report-cache',
  'report-heatmap',
  'report-insights',
  'export-report-poster',
  'settings-shell',
  'settings-currency',
  'settings-exchange-rate',
  'settings-relay-multiplier',
  'settings-daily-budget',
  'settings-monthly-budget',
  'settings-project-aliases',
  'settings-save'
];

function fail(message) {
  throw new Error(message);
}

function read(file) {
  if (!fs.existsSync(file)) fail(`Missing file: ${path.relative(root, file)}`);
  return fs.readFileSync(file, 'utf8');
}

function values(source, pattern) {
  return [...source.matchAll(pattern)].map(match => match[1]);
}

function checkHtml(file, source) {
  const label = path.relative(root, file);
  const ids = values(source, /\sid="([^"]+)"/g);
  const duplicateIds = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
  if (duplicateIds.length) fail(`${label}: duplicate ids: ${duplicateIds.join(', ')}`);

  const idSet = new Set(ids);
  const missingRequired = requiredIds.filter(id => !idSet.has(id));
  if (missingRequired.length) fail(`${label}: missing required ids: ${missingRequired.join(', ')}`);

  const inlineScripts = values(source, /<script>\s*([\s\S]*?)<\/script>/g);
  if (inlineScripts.length !== 1) fail(`${label}: expected one application script, found ${inlineScripts.length}`);
  new Function(inlineScripts[0]);

  const referencedIds = values(inlineScripts[0], /\$\('([^']+)'\)/g);
  const missingReferences = [...new Set(referencedIds.filter(id => !idSet.has(id)))];
  if (missingReferences.length) fail(`${label}: script references missing ids: ${missingReferences.join(', ')}`);

  const reportFunctions = ['reportBounds', 'reportSnapshot', 'renderReport', 'reportPosterCanvas', 'exportReportPoster'];
  const missingFunctions = reportFunctions.filter(name => !inlineScripts[0].includes(`function ${name}(`));
  if (missingFunctions.length) fail(`${label}: missing report functions: ${missingFunctions.join(', ')}`);
  if (!source.includes('data-report-period="week"') || !source.includes('data-report-period="month"')) {
    fail(`${label}: weekly and monthly report controls are required`);
  }
  if (!source.includes('codex-day-mark.svg')) fail(`${label}: codex-day logo asset is required`);
}

const template = read(templatePath);
const demo = read(demoPath);
checkHtml(templatePath, template);
checkHtml(demoPath, demo);

const payloadMatch = demo.match(/window\.__TOKEN_DATA__\s*=\s*([\s\S]*?);<\/script>/);
if (!payloadMatch) fail('demo/index.html: token payload was not found');
const payload = JSON.parse(payloadMatch[1]);
if (!payload.demo || !Array.isArray(payload.events) || payload.events.length === 0) {
  fail('demo/index.html: expected non-empty fictional demo data');
}
const demoDates = payload.events.map(event => new Date(event.timestamp));
const demoSpanDays = (Math.max(...demoDates) - Math.min(...demoDates)) / 86400000;
if (demoSpanDays < 42) fail('demo/index.html: report demo data must span at least six weeks');
payload.events.forEach((event, index) => {
  if (Number(event.cachedInput) + Number(event.uncachedInput) !== Number(event.input)) {
    fail(`demo/index.html: event ${index} cached and uncached input do not match input`);
  }
  if (Number(event.input) + Number(event.output) + Number(event.unclassified || 0) !== Number(event.total)) {
    fail(`demo/index.html: event ${index} token components do not match total`);
  }
});

const now = new Date(payload.generatedAt);
const weekStart = new Date(now); weekStart.setHours(0, 0, 0, 0); weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() || 7) - 1));
const previousWeekStart = new Date(weekStart); previousWeekStart.setDate(previousWeekStart.getDate() - 7);
const previousWeekEnd = new Date(previousWeekStart.getTime() + (now - weekStart));
const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
const previousMonthEnd = new Date(previousMonthStart.getTime() + (now - monthStart));
const inRange = (event, start, end) => new Date(event.timestamp) >= start && new Date(event.timestamp) <= end;
const reportRanges = [
  ['current week', weekStart, now],
  ['previous week', previousWeekStart, previousWeekEnd],
  ['current month', monthStart, now],
  ['previous month', previousMonthStart, previousMonthEnd]
];
reportRanges.forEach(([label, start, end]) => {
  if (!payload.events.some(event => inRange(event, start, end))) fail(`demo/index.html: ${label} report sample is empty`);
});

console.log(`Dashboard checks passed: ${payload.events.length} demo events across ${Math.floor(demoSpanDays)} days, ${requiredIds.length} required UI nodes.`);
