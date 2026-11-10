// Minimal static file server for local development and browser tests.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../site', import.meta.url));
const port = Number(process.env.PORT) || 4173;

// Send the same content security policy as production, so browser tests catch violations.
async function productionCsp() {
  try {
    const headers = await readFile(join(root, '_headers'), 'utf8');
    return headers.match(/Content-Security-Policy:\s*(.+)/)?.[1].trim();
  } catch {
    return undefined;
  }
}
const csp = await productionCsp();

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
};

createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const file = normalize(join(root, path.endsWith('/') ? `${path}index.html` : path));
  if (file !== root && !file.startsWith(root + sep)) {
    res.writeHead(403).end();
    return;
  }
  const headers = name => ({
    'content-type': types[extname(name)] ?? 'application/octet-stream',
    ...(csp ? { 'content-security-policy': csp } : {}),
  });
  // Like Cloudflare Pages: /method serves method.html, and an unknown path gets 404.html with status 404.
  for (const name of extname(file) ? [file] : [file, `${file}.html`]) {
    try {
      const body = await readFile(name);
      res.writeHead(200, headers(name)).end(body);
      return;
    } catch {
      // Try the next name.
    }
  }
  try {
    res.writeHead(404, headers('404.html')).end(await readFile(join(root, '404.html')));
  } catch {
    res.writeHead(404).end('Not found');
  }
}).listen(port, () => console.log(`http://localhost:${port}`));
