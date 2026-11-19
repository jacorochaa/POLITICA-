// Servidor local do site (sem dependências).
// Uso: node scripts/servidor.mjs [porta]
//
// Além dos arquivos, responde em /proxy-fotos/... com as fotos dos vereadores,
// usando o mesmo código do proxy da Cloudflare (cloudflare/fotos-worker.js).
// Assim as fotos aparecem no computador mesmo sem o proxy publicado.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, normalize, extname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const port = Number(process.argv[2] || process.env.PORT || 8000);
const types = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.ico': 'image/x-icon', '.md': 'text/plain; charset=utf-8',
};

// proxy de fotos: cache em memória no lugar do cache da Cloudflare
const memoria = new Map();
globalThis.caches = globalThis.caches || {
  default: {
    match: async req => { const r = memoria.get(req.url); return r ? r.clone() : undefined; },
    put: async (req, res) => { if (memoria.size > 2000) memoria.clear(); memoria.set(req.url, res); },
  },
};
let worker = null;
async function proxyFotos(req, res, caminho) {
  try {
    worker = worker || (await import(pathToFileURL(join(root, 'cloudflare', 'fotos-worker.js')).href)).default;
    const pend = [];
    const r = await worker.fetch(new Request(`http://localhost${caminho}`), {}, { waitUntil: p => pend.push(p) });
    const corpo = Buffer.from(await r.arrayBuffer());
    res.writeHead(r.status, Object.fromEntries(r.headers));
    res.end(corpo);
    await Promise.all(pend);
  } catch (e) {
    res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' }).end('falha no proxy de fotos');
  }
}

http.createServer(async (req, res) => {
  let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (path.startsWith('/proxy-fotos/')) return proxyFotos(req, res, path.slice('/proxy-fotos'.length));
  if (path.endsWith('/')) path += 'index.html';
  const file = normalize(join(root, path));
  if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
  try {
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type': types[extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('404');
  }
}).listen(port, () => console.log(`Servindo ${root} em http://localhost:${port}`));
