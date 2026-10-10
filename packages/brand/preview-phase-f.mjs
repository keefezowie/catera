import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const brand = path.dirname(fileURLToPath(import.meta.url));
const assets = path.join(brand, 'assets/phase-f');
const cache = path.resolve(brand, '../../output/phase-f-artwork');
await fs.mkdir(cache, { recursive: true });
const runtime = path.join(cache, 'lottie.min.js');
try { await fs.access(runtime); }
catch {
  const response = await fetch('https://raw.githubusercontent.com/airbnb/lottie-web/v5.13.0/build/player/lottie.min.js');
  if (!response.ok) throw new Error(`Lottie preview runtime: HTTP ${response.status}`);
  await fs.writeFile(runtime, await response.text());
}
const types = { '.html': 'text/html; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.js': 'text/javascript; charset=utf-8', '.md': 'text/plain; charset=utf-8' };
http.createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
    const name = pathname === '/' ? 'preview.html' : pathname.slice(1);
    if (!/^(?:[A-Za-z0-9][A-Za-z0-9.-]*|qa\/qa-[A-Za-z0-9.-]+\.png)$/.test(name)) { response.writeHead(404).end(); return; }
    const loader = /^loader-(body|half|closed|neutral|sparkles)\.png$/.exec(name);
    const file = name === 'lottie.min.js' ? runtime : loader ? path.join(brand, 'assets/mascot-motion', loader[1] + '.png') : path.join(assets, name);
    const body = await fs.readFile(file);
    response.writeHead(200, { 'Content-Type': types[path.extname(name)] || 'application/octet-stream', 'Cache-Control': 'no-store' }).end(body);
  } catch (error) { response.writeHead(error.code === 'ENOENT' ? 404 : 500).end('Preview file unavailable'); }
}).listen(4117, '127.0.0.1', () => console.log('Phase F artwork preview: http://127.0.0.1:4117'));
