import { existsSync, readdirSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { packager } from '@electron/packager';

function option(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const root = path.resolve('.');
const platform = option('--platform', process.platform);
const arch = option('--arch', process.arch);
const outputDirectory = path.join(root, 'dist', 'electron');
const packageMetadata = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
const electronVersion = String(packageMetadata.devDependencies.electron).replace(/^[^\d]*/, '');
const electronArchive = `electron-v${electronVersion}-${platform}-${arch}.zip`;

function findArchive(directory, fileName) {
  if (!directory || !existsSync(directory)) return null;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isFile() && entry.name === fileName) return target;
    if (entry.isDirectory()) {
      const nested = findArchive(target, fileName);
      if (nested) return nested;
    }
  }
  return null;
}

const cacheRoots = process.platform === 'win32'
  ? [path.join(process.env.LOCALAPPDATA || '', 'electron', 'Cache')]
  : [path.join(os.homedir(), '.cache', 'electron')];
const cachedArchive = process.env.ELECTRON_ZIP_DIR
  ? path.join(path.resolve(process.env.ELECTRON_ZIP_DIR), electronArchive)
  : cacheRoots.map(directory => findArchive(directory, electronArchive)).find(Boolean);

const paths = await packager({
  dir: root,
  name: 'dual-codex-day',
  executableName: 'dual-codex-day',
  appVersion: packageMetadata.version,
  electronVersion,
  electronZipDir: cachedArchive && existsSync(cachedArchive) ? path.dirname(cachedArchive) : undefined,
  platform,
  arch,
  out: outputDirectory,
  overwrite: true,
  asar: false,
  prune: true,
  icon: path.join(root, 'assets', 'codex-day.ico'),
  ignore: [
    /^\/\.dockerignore$/,
    /^\/\.env\.example$/,
    /^\/\.codex-day($|\/)/,
    /^\/\.git($|\/)/,
    /^\/\.github($|\/)/,
    /^\/\.gitignore$/,
    /^\/CHANGELOG\.md$/,
    /^\/Dockerfile$/,
    /^\/README\.md$/,
    /^\/compose\.yaml$/,
    /^\/demo($|\/)/,
    /^\/dist($|\/)/,
    /^\/docs($|\/)/,
    /^\/tailwind\.config\.js$/,
    /^\/windows($|\/)/,
    /^\/work($|\/)/,
    /^\/node_modules\/(?!(?:lucide|smol-toml)(?:\/|$))/,
    /^\/node_modules\/lucide\/(README\.md|dist\/cjs|dist\/umd|dist\/lucide\.d\.ts)/,
    /^\/node_modules\/lucide\/dist\/esm\/shared($|\/)/,
    /^\/node_modules\/lucide\/dist\/esm\/.*\.map$/,
    /^\/node_modules\/lucide\/dist\/esm\/(iconsAndAliases|lucide|replaceElement)\.mjs$/,
    /^\/node_modules\/lucide\/dist\/esm\/icons\/(?!refresh-cw\.mjs$|plus\.mjs$|shield-check\.mjs$|folder-open\.mjs$|folder-cog\.mjs$|ellipsis\.mjs$|square-terminal\.mjs$|panels-top-left\.mjs$|monitor-up\.mjs$|chart-no-axes-combined\.mjs$|user-round-plus\.mjs$|chevron-right\.mjs$|server-cog\.mjs$|settings-2\.mjs$|key-round\.mjs$|save-check\.mjs$|sliders-horizontal\.mjs$|eye\.mjs$|eye-off\.mjs$|file-input\.mjs$|rocket\.mjs$|circle-alert\.mjs$|database\.mjs$|download\.mjs$|image-down\.mjs$).+$/,
    /^\/scripts\/(check-|capture-|package-|build-(?:brand|demo|profiles))/,
    /^\/scripts\/codex-day-tray\.ps1$/,
    /^\/scripts\/codex-profiles-ui\.ps1$/,
    /^\/scripts\/open-/,
    /^\/scripts\/refresh-/,
    /^\/scripts\/watch-/,
    /^\/assets\/demo-preview\.png$/,
    /^\/config\/(profiles\.zh-CN|tray\.zh-CN)\.json$/,
    /^\/src\/styles\.css$/
  ]
});

const requiredPackagedFiles = [
  path.join('node_modules', 'smol-toml', 'dist', 'index.js'),
  path.join('node_modules', 'lucide', 'dist', 'esm', 'icons', 'server-cog.mjs'),
  path.join('node_modules', 'lucide', 'dist', 'esm', 'icons', 'settings-2.mjs'),
  path.join('node_modules', 'lucide', 'dist', 'esm', 'icons', 'key-round.mjs'),
  path.join('node_modules', 'lucide', 'dist', 'esm', 'icons', 'save-check.mjs'),
  path.join('node_modules', 'lucide', 'dist', 'esm', 'icons', 'sliders-horizontal.mjs'),
  path.join('node_modules', 'lucide', 'dist', 'esm', 'icons', 'eye.mjs'),
  path.join('node_modules', 'lucide', 'dist', 'esm', 'icons', 'eye-off.mjs'),
  path.join('node_modules', 'lucide', 'dist', 'esm', 'icons', 'file-input.mjs'),
  path.join('node_modules', 'lucide', 'dist', 'esm', 'icons', 'rocket.mjs'),
  path.join('node_modules', 'lucide', 'dist', 'esm', 'icons', 'circle-alert.mjs'),
  path.join('node_modules', 'lucide', 'dist', 'esm', 'icons', 'database.mjs'),
  path.join('node_modules', 'lucide', 'dist', 'esm', 'icons', 'download.mjs'),
  path.join('node_modules', 'lucide', 'dist', 'esm', 'icons', 'image-down.mjs')
];

for (const packagedDirectory of paths) {
  for (const relativeFile of requiredPackagedFiles) {
    const packagedFile = path.join(packagedDirectory, 'resources', 'app', relativeFile);
    if (!existsSync(packagedFile)) {
      throw new Error(`Packaged runtime dependency is missing: ${packagedFile}`);
    }
  }
}

console.log(paths.join('\n'));
