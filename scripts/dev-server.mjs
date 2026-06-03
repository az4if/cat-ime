#!/usr/bin/env node
/**
 * Local dev server: static files + /api/anikoto/* proxy (Anikoto has no browser CORS).
 * Usage: npm start → http://127.0.0.1:3000
 */
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.PORT) || 3000;
const ANIKOTO = 'https://anikotoapi.site';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Access-Control-Allow-Origin': '*', ...headers });
  res.end(body);
}

async function proxyAnikoto(req, res, url) {
  const target = ANIKOTO + url.pathname.replace(/^\/api\/anikoto/, '') + url.search;
  try {
    const upstream = await fetch(target, { headers: { Accept: 'application/json' } });
    const body = await upstream.arrayBuffer();
    send(res, upstream.status, Buffer.from(body), {
      'Content-Type': upstream.headers.get('content-type') || 'application/json',
    });
  } catch (e) {
    send(res, 502, JSON.stringify({ ok: false, error: String(e.message) }), {
      'Content-Type': 'application/json',
    });
  }
}

function serveStatic(req, res, url) {
  let p = url.pathname === '/' ? '/index.html' : url.pathname;
  const filePath = path.join(ROOT, decodeURIComponent(p));
  if (!filePath.startsWith(ROOT)) {
    send(res, 403, 'Forbidden');
    return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      send(res, 404, 'Not found');
      return;
    }
    const ext = path.extname(filePath);
    send(res, 200, data, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  if (url.pathname.startsWith('/api/anikoto')) {
    void proxyAnikoto(req, res, url);
    return;
  }
  serveStatic(req, res, url);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Cat-ime dev server: http://127.0.0.1:${PORT}`);
  console.log('Do not open index.html as file:// — use this URL.');
});
