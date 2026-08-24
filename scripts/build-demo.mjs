import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.dirname(scriptDirectory);

function option(argv, name, fallback) {
  const index = argv.indexOf(name);
  if (index < 0) return fallback;
  if (!argv[index + 1]) throw new Error(`Missing value for ${name}`);
  return path.resolve(argv[index + 1]);
}

function safeScriptJson(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

function replaceMarker(html, pattern, replacement, label) {
  if (!pattern.test(html)) throw new Error(`${label} marker is missing from the dashboard template.`);
  return html.replace(pattern, replacement);
}

function openFile(filePath) {
  const command = process.platform === 'win32' ? ['cmd', ['/c', 'start', '', filePath]]
    : process.platform === 'darwin' ? ['open', [filePath]] : ['xdg-open', [filePath]];
  const child = spawn(command[0], command[1], { detached: true, stdio: 'ignore', windowsHide: true });
  child.unref();
}

const argv = process.argv.slice(2);
const sampleDataPath = option(argv, '--sample-data', path.join(root, 'demo', 'sample-data.json'));
const pricingPath = option(argv, '--pricing', path.join(root, 'config', 'pricing.json'));
const outputPath = option(argv, '--output', path.join(root, 'demo', 'index.html'));
const templatePath = path.join(root, 'src', 'index.template.html');

const payload = JSON.parse(readFileSync(sampleDataPath, 'utf8'));
payload.demo = true;
const pricing = JSON.parse(readFileSync(pricingPath, 'utf8'));
let html = readFileSync(templatePath, 'utf8');
html = replaceMarker(
  html,
  /<script id="token-data">[\s\S]*?<\/script>/,
  `<script id="token-data">window.__TOKEN_DATA__ = ${safeScriptJson(payload)};</script>`,
  'token-data'
);
html = replaceMarker(
  html,
  /<script id="pricing-data">[\s\S]*?<\/script>/,
  `<script id="pricing-data">window.__PRICING_DATA__ = ${safeScriptJson(pricing)};</script>`,
  'pricing-data'
);
html = html
  .replace('href="token-dashboard.css"', 'href="../src/token-dashboard.css"')
  .replaceAll('codex-day-mark.svg', '../assets/codex-day-mark.svg');

mkdirSync(path.dirname(outputPath), { recursive: true });
writeFileSync(outputPath, html, 'utf8');
console.log(`Demo: ${outputPath}`);
if (argv.includes('--open')) openFile(outputPath);
