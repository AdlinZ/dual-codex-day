import { copyFileSync, cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve('.');
const output = path.join(root, 'dist', 'site');

rmSync(output, { recursive: true, force: true });
mkdirSync(path.join(output, 'assets'), { recursive: true });
mkdirSync(path.join(output, 'src'), { recursive: true });

cpSync(path.join(root, 'site'), output, { recursive: true });
cpSync(path.join(root, 'demo'), path.join(output, 'demo'), { recursive: true });

for (const asset of [
  'codex-day-mark.svg',
  'electron-launch-center.png',
  'electron-usage-analysis.png',
  'electron-provider-settings.png'
]) {
  copyFileSync(path.join(root, 'assets', asset), path.join(output, 'assets', asset));
}

copyFileSync(
  path.join(root, 'src', 'token-dashboard.css'),
  path.join(output, 'src', 'token-dashboard.css')
);
writeFileSync(path.join(output, '.nojekyll'), '', 'utf8');

console.log(output);
