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

console.log(`Dashboard checks passed: ${payload.events.length} demo events, ${requiredIds.length} required UI nodes.`);
