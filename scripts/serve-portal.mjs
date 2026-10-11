import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const prefix = '/portals/billing/';
const types = {
  '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.html': 'text/html', '.svg': 'image/svg+xml', '.woff2': 'font/woff2',
  '.txt': 'text/plain',
};

export function createPortalServer(root = resolve('dist/portals/billing'), readAsset = readFile) {
  const base = resolve(root);
  return createServer(async (request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405, { Allow: 'GET, HEAD' }).end();
      return;
    }
    try {
      const path = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      if (!path.startsWith(prefix)) {
        response.writeHead(404).end();
        return;
      }
      const file = resolve(base, path.slice(prefix.length));
      if (!file.startsWith(base + sep)) {
        response.writeHead(404).end();
        return;
      }
      const body = await readAsset(file);
      response.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream' });
      response.end(request.method === 'HEAD' ? undefined : body);
    } catch (error) {
      const status = error instanceof URIError ? 400
        : ['ENOENT', 'ENOTDIR'].includes(error.code) ? 404 : 500;
      response.writeHead(status).end();
    }
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT ?? 4204);
  createPortalServer().listen(port, '127.0.0.1', () => {
    console.log(`Billing assets: http://localhost:${port}${prefix}`);
  });
}
