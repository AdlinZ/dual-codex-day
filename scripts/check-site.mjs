import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve('.');
const output = path.join(root, 'dist', 'site');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(relativePath) {
  const filePath = path.join(root, relativePath);
  assert(existsSync(filePath), `Missing site file: ${relativePath}`);
  return readFileSync(filePath, 'utf8');
}

const html = read('site/index.html');
const css = read('site/styles.css');
const script = read('site/app.js');
const server = read('scripts/serve-site.mjs');
const workflow = read('.github/workflows/pages.yml');

for (const text of ['Dual Codex Day', '多账号', '用量分析', '供应商设置', '非 OpenAI 官方项目']) {
  assert(html.includes(text), `Site must include: ${text}`);
}

assert(html.includes('releases/latest/download/dual-codex-day-windows-x64.zip'), 'Site must link to the latest Windows release asset.');
assert(html.includes('./demo/'), 'Site must link to the public demo.');
assert(!/<script[^>]+https?:/i.test(html), 'Site must not load remote scripts.');
assert(!/linear-gradient|radial-gradient/i.test(css), 'Site must not use decorative gradients.');
assert(/showModal\(\)/.test(script) && /dialog\.close\(\)/.test(script), 'Screenshot preview must support opening and closing.');
assert(/127\.0\.0\.1/.test(server) && /dist.*site/.test(server), 'Site preview must remain local and serve only the built site.');

for (const asset of [
  'assets/codex-day-mark.svg',
  'assets/electron-launch-center.png',
  'assets/electron-usage-analysis.png',
  'assets/electron-provider-settings.png'
]) {
  const filePath = path.join(root, asset);
  assert(existsSync(filePath) && statSync(filePath).size > 0, `Missing public asset: ${asset}`);
}

for (const builtFile of [
  'index.html',
  'styles.css',
  'app.js',
  '.nojekyll',
  'demo/index.html',
  'src/token-dashboard.css',
  'assets/electron-launch-center.png'
]) {
  assert(existsSync(path.join(output, builtFile)), `Site build is incomplete: ${builtFile}`);
}

assert(/actions\/configure-pages@v5/.test(workflow), 'Pages workflow must configure GitHub Pages.');
assert(/enablement:\s*true/.test(workflow), 'Pages workflow must support first-run enablement.');
assert(/actions\/deploy-pages@v4/.test(workflow), 'Pages workflow must deploy the site artifact.');
assert(/npm run build:site/.test(workflow), 'Pages workflow must use the shared site build.');

console.log('Site checks passed: responsive landing page, local assets, public demo, release download, and Pages workflow.');
