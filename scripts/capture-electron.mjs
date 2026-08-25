import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { createProfile, launchProfile } from './lib/profile-store.mjs';

const root = path.resolve('.');
const outputPath = path.resolve(process.argv[2] || path.join(root, 'dist', 'electron-v0.10.0.png'));
const packagedExecutable = process.argv[3] && !process.argv[3].startsWith('--') ? path.resolve(process.argv[3]) : null;
const screenshotView = process.argv.find(argument => argument.startsWith('--view='))?.slice('--view='.length) || '';
const temporaryRoot = mkdtempSync(path.join(os.tmpdir(), 'dual-codex-day-electron-'));
mkdirSync(path.dirname(outputPath), { recursive: true });

try {
  const workProfile = createProfile(temporaryRoot, '工作账号');
  createProfile(temporaryRoot, '个人账号');
  launchProfile(temporaryRoot, workProfile.id, 'desktop', {
    targets: { desktop: { available: true, executable: process.execPath, experimental: true } },
    workingDirectory: root,
    spawnProcess: () => ({ pid: process.pid, unref() {} })
  });
  const electronExecutable = packagedExecutable || (process.platform === 'win32'
    ? path.join(root, 'node_modules', 'electron', 'dist', 'electron.exe')
    : path.join(root, 'node_modules', '.bin', 'electron'));
  const userDataArgument = `--user-data-dir=${path.join(temporaryRoot, 'electron-user-data')}`;
  const result = spawnSync(electronExecutable, packagedExecutable ? [userDataArgument] : ['.', userDataArgument], {
    cwd: root,
    env: {
      ...process.env,
      CODEX_PROFILES_ROOT: temporaryRoot,
      DUAL_CODEX_DAY_SCREENSHOT: outputPath,
      DUAL_CODEX_DAY_SCREENSHOT_VIEW: screenshotView
    },
    encoding: 'utf8',
    timeout: 30_000,
    windowsHide: true
  });
  if (result.status !== 0) {
    const detail = result.error?.message
      || result.stderr
      || result.stdout
      || `Electron exited with status ${result.status ?? 'null'} and signal ${result.signal ?? 'none'}.`;
    throw new Error(detail);
  }
  console.log(outputPath);
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true });
}
