import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

function read(filePath) {
  if (!existsSync(filePath)) throw new Error(`Missing container file: ${filePath}`);
  return readFileSync(filePath, 'utf8');
}

function requireMatch(value, pattern, message) {
  if (!pattern.test(value)) throw new Error(message);
}

const dockerfile = read('Dockerfile');
const compose = read('compose.yaml');
const dockerignore = read('.dockerignore');
const envExample = read('.env.example');

requireMatch(dockerfile, /^FROM node:22-/m, 'Docker image must use Node.js 22.');
requireMatch(dockerfile, /^USER node$/m, 'Container must run as the non-root node user.');
requireMatch(dockerfile, /^HEALTHCHECK /m, 'Docker image must define a health check.');
requireMatch(dockerfile, /"--codex-root", "\/codex"/, 'Container must read logs from /codex.');
requireMatch(dockerfile, /"--database", "\/data\/codex-day\.sqlite"/, 'Container database must be stored under /data.');
requireMatch(dockerfile, /"--host", "0\.0\.0\.0"/, 'Container service must listen on its network interface.');

requireMatch(compose, /source: "\$\{CODEX_DATA_DIR:/, 'Compose must require an explicit Codex data directory.');
requireMatch(compose, /target: \/codex\s+read_only: true/, 'Codex log mount must be read-only.');
requireMatch(compose, /source: index\s+target: \/data/, 'SQLite data must use the persistent index volume.');
requireMatch(compose, /127\.0\.0\.1:\$\{CODEX_DAY_PORT:-8765\}:8765/, 'Published port must remain bound to localhost.');
requireMatch(compose, /CODEX_DAY_RETENTION_DAYS: "\$\{CODEX_DAY_RETENTION_DAYS:-all\}"/, 'Compose must expose the retention policy.');
requireMatch(dockerignore, /^\.codex-day$/m, 'Private SQLite data must be excluded from the image context.');
requireMatch(dockerignore, /^dist$/m, 'Generated personal dashboards must be excluded from the image context.');
requireMatch(envExample, /^CODEX_DATA_DIR=\/path\/to\/your\/\.codex$/m, 'Environment example must use a placeholder path.');
requireMatch(envExample, /^CODEX_DAY_RETENTION_DAYS=all$/m, 'Environment example must default to all history.');

const releaseWorkflow = read('.github/workflows/release.yml');
requireMatch(releaseWorkflow, /packages: write/, 'Release workflow must be allowed to publish packages.');
requireMatch(releaseWorkflow, /ghcr\.io\/adlinz\/codex-day/, 'Release workflow must publish the public GHCR image.');
requireMatch(releaseWorkflow, /linux\/amd64,linux\/arm64/, 'Release workflow must publish amd64 and arm64 images.');
requireMatch(releaseWorkflow, /pattern=v\{\{version\}\}/, 'Release workflow must publish the v-prefixed image tag.');
requireMatch(releaseWorkflow, /docker logout ghcr\.io[\s\S]*imagetools inspect/, 'Release workflow must verify anonymous GHCR access before release.');

const dockerCommand = process.platform === 'win32' ? 'docker.exe' : 'docker';
const docker = spawnSync(dockerCommand, ['compose', '--env-file', '.env.example', 'config', '--quiet'], { encoding: 'utf8' });

if (docker.error?.code === 'ENOENT') {
  console.log('Container checks passed (static configuration; Docker is not installed).');
} else if (docker.status !== 0) {
  throw new Error(`docker compose config failed:\n${docker.stderr || docker.stdout}`);
} else {
  console.log('Container checks passed, including docker compose config.');
}
