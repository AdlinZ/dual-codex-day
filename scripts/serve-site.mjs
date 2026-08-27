import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';

const root = path.resolve('dist', 'site');
const host = '127.0.0.1';
const port = Number(process.env.DUAL_CODEX_DAY_SITE_PORT || 4173);
const contentTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml']
]);

if (!existsSync(path.join(root, 'index.html'))) {
  throw new Error('Site build is missing. Run npm run build:site first.');
}

const server = createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url || '/', `http://${host}:${port}`).pathname);
  const relativePath = pathname.endsWith('/') ? `${pathname}index.html` : pathname;
  const filePath = path.resolve(root, `.${relativePath}`);

  if (!filePath.startsWith(`${root}${path.sep}`) || !existsSync(filePath) || !statSync(filePath).isFile()) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found');
    return;
  }

  response.writeHead(200, {
    'Content-Type': contentTypes.get(path.extname(filePath).toLowerCase()) || 'application/octet-stream',
    'Cache-Control': 'no-store'
  });
  createReadStream(filePath).pipe(response);
});

server.listen(port, host, () => {
  console.log(`http://${host}:${port}/`);
});
