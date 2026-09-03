import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { applyProfileTransfer, createProfile, exportProfileTransfer, launchProfile, updateProfileUsageSource } from './lib/profile-store.mjs';
import { recordWorkCombination, setWorkCombinationPinned } from './lib/work-combination-store.mjs';

const root = path.resolve('.');
const outputPath = path.resolve(process.argv[2] || path.join(root, 'dist', 'electron-v0.24.0.png'));
const packagedExecutable = process.argv[3] && !process.argv[3].startsWith('--') ? path.resolve(process.argv[3]) : null;
const screenshotView = process.argv.find(argument => argument.startsWith('--view='))?.slice('--view='.length) || '';
const liveData = process.argv.includes('--live');
const temporaryRoot = mkdtempSync(path.join(os.tmpdir(), 'dual-codex-day-electron-'));
mkdirSync(path.dirname(outputPath), { recursive: true });

function tokenEvent(timestamp, input, cached, output) {
  return JSON.stringify({
    timestamp,
    type: 'event_msg',
    payload: {
      type: 'token_count',
      info: {
        last_token_usage: {
          input_tokens: input,
          cached_input_tokens: cached,
          cache_write_input_tokens: 0,
          output_tokens: output,
          reasoning_output_tokens: Math.floor(output / 4),
          total_tokens: input + output
        },
        model_context_window: 258400
      }
    }
  });
}

function createUsageFixture(codexRoot, fixtureId = 'default', scale = 1) {
  const now = new Date();
  const sessionDirectory = path.join(codexRoot, 'sessions', String(now.getFullYear()), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0'));
  const project = path.join(temporaryRoot, `fictional-${fixtureId}-project`);
  const sessionId = fixtureId === 'work'
    ? '22222222-2222-4222-8222-222222222222'
    : '11111111-1111-4111-8111-111111111111';
  mkdirSync(sessionDirectory, { recursive: true });
  const events = [
    JSON.stringify({ type: 'session_meta', payload: { id: sessionId, cwd: project } }),
    JSON.stringify({ type: 'turn_context', payload: { model: 'gpt-5.6-sol', cwd: project } }),
    tokenEvent(new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000).toISOString(), 42000 * scale, 26000 * scale, 3800 * scale),
    tokenEvent(new Date(now.getTime() - 70 * 60 * 1000).toISOString(), 128000 * scale, 96000 * scale, 9200 * scale),
    tokenEvent(new Date(now.getTime() - 35 * 60 * 1000).toISOString(), 86000 * scale, 61000 * scale, 6800 * scale),
    tokenEvent(new Date(now.getTime() - 8 * 60 * 1000).toISOString(), 154000 * scale, 122000 * scale, 11300 * scale)
  ];
  writeFileSync(path.join(sessionDirectory, `rollout-synthetic-${sessionId}.jsonl`), `${events.join('\n')}\n`, 'utf8');
}

function createSkillFixture(skillsRoot, name, description) {
  const directory = path.join(skillsRoot, name);
  mkdirSync(directory, { recursive: true });
  writeFileSync(path.join(directory, 'SKILL.md'), `---\nname: ${name}\ndescription: ${description}\n---\n`, 'utf8');
}

try {
  const usageRoot = path.join(temporaryRoot, '.codex');
  const screenshotWorkspace = path.join(temporaryRoot, 'fictional-workspace');
  if (!liveData) {
    createUsageFixture(usageRoot);
    const workProfile = createProfile(temporaryRoot, '工作账号');
    createUsageFixture(workProfile.paths.codexHome, 'work', 0.35);
    const personalProfile = createProfile(temporaryRoot, '个人账号');
    if (screenshotView === 'profile-recovery') {
      updateProfileUsageSource(temporaryRoot, workProfile.id, 'default');
      const recoverySourceRoot = path.join(temporaryRoot, 'recovery-source');
      const recoverySource = createProfile(recoverySourceRoot, '工作账号');
      const recoveryTransfer = exportProfileTransfer(recoverySourceRoot, recoverySource.id, { appVersion: '0.24.0' });
      applyProfileTransfer(temporaryRoot, recoveryTransfer);
    }
    createSkillFixture(path.join(usageRoot, 'skills'), 'issue-drafter', '整理产品问题并生成可提交的 Issue 草稿。');
    createSkillFixture(path.join(workProfile.paths.codexHome, 'skills'), 'issue-drafter', '工作账号中的同名版本。');
    createSkillFixture(path.join(workProfile.paths.codexHome, 'skills'), 'daily-report', '根据当天事实材料生成结构化日报。');
    createSkillFixture(path.join(usageRoot, 'skills', '.system'), 'skill-installer', '安装和管理 Codex Skills。');
    createSkillFixture(path.join(screenshotWorkspace, '.agents', 'skills'), 'product-review', '检查当前项目的产品需求和交付边界。');
    createSkillFixture(path.join(screenshotWorkspace, '.agents', 'skills'), 'release-check', '核对当前项目的发布清单。');
    const activeLaunch = launchProfile(temporaryRoot, workProfile.id, 'desktop', {
      targets: { desktop: { available: true, executable: process.execPath, experimental: true } },
      workingDirectory: screenshotWorkspace,
      spawnProcess: () => ({ pid: process.pid, unref() {} })
    });
    recordWorkCombination(temporaryRoot, {
      profileId: workProfile.id,
      workspace: screenshotWorkspace,
      target: 'desktop',
      usedAt: activeLaunch.launchedAt
    });
    const reviewWorkspace = path.join(temporaryRoot, 'case-review');
    mkdirSync(reviewWorkspace);
    const pinned = recordWorkCombination(temporaryRoot, {
      profileId: personalProfile.id,
      workspace: reviewWorkspace,
      target: 'vscode',
      usedAt: new Date(Date.now() - 3_600_000).toISOString()
    });
    setWorkCombinationPinned(temporaryRoot, pinned.id, true);
    const staleWorkspace = path.join(temporaryRoot, 'archived-project');
    mkdirSync(staleWorkspace);
    recordWorkCombination(temporaryRoot, {
      profileId: workProfile.id,
      workspace: staleWorkspace,
      target: 'cli',
      usedAt: new Date(Date.now() - 7_200_000).toISOString()
    });
    rmSync(staleWorkspace, { recursive: true, force: true });
  }
  const electronExecutable = packagedExecutable || (process.platform === 'win32'
    ? path.join(root, 'node_modules', 'electron', 'dist', 'electron.exe')
    : path.join(root, 'node_modules', '.bin', 'electron'));
  const userDataArgument = `--user-data-dir=${path.join(temporaryRoot, 'electron-user-data')}`;
  const result = spawnSync(electronExecutable, packagedExecutable ? [userDataArgument] : ['.', userDataArgument], {
    cwd: root,
    env: {
      ...process.env,
      ...(liveData ? {} : {
        CODEX_PROFILES_ROOT: temporaryRoot,
        CODEX_USAGE_ROOT: usageRoot,
        CODEX_USAGE_DATA_ROOT: path.join(temporaryRoot, 'usage-index')
      }),
      DUAL_CODEX_DAY_SCREENSHOT: outputPath,
      DUAL_CODEX_DAY_SCREENSHOT_VIEW: screenshotView,
      DUAL_CODEX_DAY_SCREENSHOT_WORKSPACE: liveData ? '' : screenshotWorkspace,
      DUAL_CODEX_DAY_SCREENSHOT_PATH_REPLACEMENTS: liveData ? '' : JSON.stringify([
        [temporaryRoot, 'C:\\DualCodexDay\\Profiles'],
        [root, 'C:\\Projects\\dual-codex-day']
      ])
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
