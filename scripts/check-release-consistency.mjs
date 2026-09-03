import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve('.');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(relativePath, encoding = 'utf8') {
  const filePath = path.join(root, relativePath);
  assert(existsSync(filePath), `Missing release file: ${relativePath}`);
  return readFileSync(filePath, encoding);
}

function pngDimensions(relativePath) {
  const content = read(relativePath, null);
  assert(content.length >= 24 && content.subarray(1, 4).toString('ascii') === 'PNG', `${relativePath} must be a PNG image.`);
  return { width: content.readUInt32BE(16), height: content.readUInt32BE(20) };
}

const packageMetadata = JSON.parse(read('package.json'));
const packageLock = JSON.parse(read('package-lock.json'));
const version = packageMetadata.version;
const releaseTag = `v${version}`;
const releaseDocument = `docs/releases/${releaseTag}.md`;
const changelog = read('CHANGELOG.md');
const releaseNotes = read(releaseDocument);
const readme = read('README.md');
const site = read('site/index.html');
const releaseWorkflow = read('.github/workflows/release.yml');

assert(/^\d+\.\d+\.\d+$/.test(version), 'package.json must contain a stable semantic version.');
assert(packageLock.version === version && packageLock.packages?.['']?.version === version, 'package-lock.json version must match package.json.');
assert(changelog.includes(`## [${version}] -`), `CHANGELOG.md must include ${version}.`);
assert(releaseNotes.startsWith(`# Dual Codex Day ${releaseTag}\n`), `${releaseDocument} must use the current release heading.`);
assert(readme.includes(`Electron \`${releaseTag}\``), `README.md must identify the current Electron release as ${releaseTag}.`);
assert(site.includes(`Windows · ${releaseTag} · MIT`), `The public site must identify the current release as ${releaseTag}.`);
assert(releaseWorkflow.includes('docs/releases/${GITHUB_REF_NAME}.md'), 'Release workflow must load versioned release notes.');
assert(releaseWorkflow.includes('windows-package'), 'Release workflow must require the Windows package smoke test.');

for (const [relativePath, expectedWidth, expectedHeight] of [
  ['assets/electron-launch-center.png', 2160, 1440],
  ['assets/electron-usage-analysis.png', 2160, 1440],
  ['assets/electron-provider-settings.png', 2100, 1440]
]) {
  const dimensions = pngDimensions(relativePath);
  assert(dimensions.width === expectedWidth && dimensions.height === expectedHeight, `${relativePath} must be ${expectedWidth}x${expectedHeight}.`);
  assert(statSync(path.join(root, relativePath)).size > 50_000, `${relativePath} appears to be empty or incomplete.`);
}

console.log(`Release consistency checks passed for ${releaseTag}: metadata, notes, site, workflow, and screenshots.`);
