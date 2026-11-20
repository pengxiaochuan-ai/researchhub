import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import { createApiProxy } from './api-proxy.mjs';

const host = process.env.HOST ?? '0.0.0.0';
const port = Number(process.env.PORT ?? 3000);
const distRoot = resolve('dist');
const apiProxy = process.env.HUB_API_UPSTREAM
  ? createApiProxy({ upstream: process.env.HUB_API_UPSTREAM, authority: process.env.HUB_API_AUTHORITY ?? 'hub.pengxc.com' })
  : null;
const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

// Only P002's content-addressed derivatives are immutable. A hash-shaped name
// alone is insufficient: validate its bytes once per file version.
const contentHashChecks = new Map();
async function p002AssetCacheControl(pathname, filePath, fileStat) {
  const match = /^\/pages\/p002\/assets\/(?:crops|optimized)\/[^/]+[.-]([a-f0-9]{12,64})\.webp$/.exec(pathname);
  if (!match || !fileStat.isFile()) return undefined;
  const fingerprint = `${fileStat.dev}:${fileStat.ino}:${fileStat.size}:${fileStat.mtimeMs}:${fileStat.ctimeMs}`;
  const previous = contentHashChecks.get(filePath);
  if (previous?.fingerprint === fingerprint) return previous.result;
  const result = readFile(filePath).then(bytes => {
    const digest = createHash('sha256').update(bytes).digest('hex');
    return digest.startsWith(match[1]) ? 'public, max-age=31536000, immutable' : undefined;
  });
  contentHashChecks.set(filePath, { fingerprint, result });
  try { return await result; }
  catch (error) { contentHashChecks.delete(filePath); throw error; }
}

const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url ?? '/', `http://127.0.0.1:${port}`).pathname);
    if (pathname === '/health') {
      response.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      }).end('{"ok":true}');
      return;
    }

    if (apiProxy?.(request, response)) return;

    let filePath = resolve(distRoot, `.${pathname}`);
    if (filePath !== distRoot && !filePath.startsWith(`${distRoot}${sep}`)) {
      response.writeHead(403).end('Forbidden');
      return;
    }

    const fileStat = await stat(filePath);
    if (fileStat.isDirectory()) filePath = resolve(filePath, 'index.html');
    const cacheControl = await p002AssetCacheControl(pathname, filePath, fileStat);
    response.writeHead(200, {
      'Content-Type': contentTypes[extname(filePath)] ?? 'application/octet-stream',
      ...(cacheControl ? { 'Cache-Control': cacheControl } : {}),
    });
    createReadStream(filePath).pipe(response);
  } catch {
    response.writeHead(404).end('Not Found');
  }
});

server.listen(port, host, () => {
  console.log(`researchhub listening on ${host}:${port}`);
});
