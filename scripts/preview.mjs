import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';

const root = resolve(process.cwd(), 'dist');
const port = Number(process.env.PORT || 8032);
const host = process.env.HOST || '127.0.0.1';

const mimeTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.jpg', 'image/jpeg'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.mp4', 'video/mp4'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.webm', 'video/webm'],
  ['.webp', 'image/webp'],
  ['.xml', 'application/xml; charset=utf-8'],
]);

async function resolveRequest(pathname) {
  const cleanPath = decodeURIComponent(pathname).replace(/\0/g, '');
  const route = cleanPath === '/' ? '/index.html' : cleanPath;
  const candidates = extname(route) ? [route] : [`${route}.html`, `${route}/index.html`];

  for (const candidate of candidates) {
    const file = resolve(root, `.${candidate}`);
    if (file !== root && !file.startsWith(`${root}${sep}`)) continue;
    try {
      const details = await stat(file);
      if (details.isFile()) return { file, details };
    } catch {
      // Try the next clean-route candidate.
    }
  }

  const fallback = resolve(root, '404.html');
  return { file: fallback, details: await stat(fallback), notFound: true };
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url || '/', `http://${request.headers.host || host}`);
    const { file, details, notFound } = await resolveRequest(url.pathname);
    const type = mimeTypes.get(extname(file).toLowerCase()) || 'application/octet-stream';
    const range = request.headers.range?.match(/bytes=(\d*)-(\d*)/);

    if (range && details.size > 0) {
      const start = range[1] ? Number(range[1]) : 0;
      const end = range[2] ? Math.min(Number(range[2]), details.size - 1) : details.size - 1;
      if (start > end || start >= details.size) {
        response.writeHead(416, { 'Content-Range': `bytes */${details.size}` });
        response.end();
        return;
      }
      response.writeHead(206, {
        'Accept-Ranges': 'bytes',
        'Content-Length': end - start + 1,
        'Content-Range': `bytes ${start}-${end}/${details.size}`,
        'Content-Type': type,
      });
      createReadStream(file, { start, end }).pipe(response);
      return;
    }

    response.writeHead(notFound ? 404 : 200, {
      'Accept-Ranges': 'bytes',
      'Content-Length': details.size,
      'Content-Type': type,
    });
    createReadStream(file).pipe(response);
  } catch (error) {
    response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end(`Preview server error: ${error.message}`);
  }
});

server.listen(port, host, () => {
  console.log(`Preview: http://${host}:${port}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.closeAllConnections?.();
    server.close();
    process.exit(0);
  });
}
