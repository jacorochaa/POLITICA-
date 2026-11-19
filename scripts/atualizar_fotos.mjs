#!/usr/bin/env node
/*
 * Baixa as fotos oficiais das candidaturas (TSE, Portal de Dados Abertos) e
 * salva uma por arquivo em data/fotos/<ano>/<UF>/<sq>.jpg, só para quem está
 * em data/candidatos/<ano>/ (sem vices e suplentes).
 *
 * O site não busca direto no TSE porque o servidor de lá envia o cabeçalho
 * CORS duplicado e o navegador recusa.
 *
 * Uso:
 *   node scripts/atualizar_fotos.mjs            # 2026, todos os estados
 *   node scripts/atualizar_fotos.mjs 2026 DF BR # só alguns estados
 * Sem dependências: só Node 18+.
 */
import { mkdir, readFile, writeFile, stat, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateRawSync } from 'node:zlib';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const ano = process.argv[2] || '2026';
const pedidos = process.argv.slice(3).map(s => s.toUpperCase());
const url = uf => `https://cdn.tse.jus.br/estatistica/sead/eleicoes/eleicoes${ano}/fotos/foto_cand${ano}_${uf}_div.zip`;

/** códigos (sq) das candidaturas que o site lista, por estado do zip de fotos */
async function candidaturas() {
  const dir = join(RAIZ, 'data', 'candidatos', ano);
  const meta = JSON.parse(await readFile(join(dir, 'index.json'), 'utf8'));
  const iSq = meta.campos.indexOf('sq');
  const porUF = {};
  const add = (uf, recs) => { porUF[uf] = porUF[uf] || new Set(); recs.forEach(r => porUF[uf].add(String(r[iSq]))); };
  if (meta.tipo === 'municipal') {
    for (const uf of Object.keys(meta.indice)) {
      const p = join(dir, uf);
      for (const f of await readdir(p)) add(uf, JSON.parse(await readFile(join(p, f), 'utf8')));
    }
  } else {
    for (const f of await readdir(dir)) {
      if (f === 'index.json') continue;
      add(f.replace('.json', ''), JSON.parse(await readFile(join(dir, f), 'utf8')));
    }
  }
  return porUF;
}

async function baixar(u) {
  const r = await fetch(u);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

function* entradas(zip) {
  let p = zip.length - 22;
  while (p >= 0 && zip.readUInt32LE(p) !== 0x06054b50) p--;
  if (p < 0) throw new Error('zip inválido');
  let i = zip.readUInt32LE(p + 16);
  const fim = i + zip.readUInt32LE(p + 12);
  while (i < fim && zip.readUInt32LE(i) === 0x02014b50) {
    const method = zip.readUInt16LE(i + 10), size = zip.readUInt32LE(i + 20);
    const n = zip.readUInt16LE(i + 28), e = zip.readUInt16LE(i + 30), k = zip.readUInt16LE(i + 32);
    const off = zip.readUInt32LE(i + 42);
    const nome = zip.toString('utf8', i + 46, i + 46 + n);
    const ln = zip.readUInt16LE(off + 26), le = zip.readUInt16LE(off + 28);
    const ini = off + 30 + ln + le;
    yield { nome, dados: () => {
      const raw = zip.subarray(ini, ini + size);
      return method === 8 ? inflateRawSync(raw) : raw;
    } };
    i += 46 + n + e + k;
  }
}

const porUF = await candidaturas();
const ufs = pedidos.length ? pedidos : Object.keys(porUF).sort();
let novas = 0, total = 0, bytes = 0;
for (const uf of ufs) {
  const quer = porUF[uf];
  if (!quer) { console.log(`${uf}: sem candidaturas em data/candidatos/${ano}`); continue; }
  let zip;
  try { zip = await baixar(url(uf)); } catch (e) { console.log(`${uf}: fotos indisponíveis (${e.message})`); continue; }
  const pasta = join(RAIZ, 'data', 'fotos', ano, uf);
  await mkdir(pasta, { recursive: true });
  let n = 0;
  for (const ent of entradas(zip)) {
    const m = ent.nome.match(/^F[A-Z]{2}(\d+)_div\.jpe?g$/i);
    if (!m || !quer.has(m[1])) continue;
    const dados = ent.dados();
    const dest = join(pasta, `${m[1]}.jpg`);
    if (!existsSync(dest) || (await stat(dest)).size !== dados.length) { await writeFile(dest, dados); novas++; }
    n++; bytes += dados.length;
  }
  total += n;
  console.log(`${uf}: ${n} fotos de ${quer.size} candidaturas`);
}
console.log(`Total: ${total} fotos (${(bytes / 1e6).toFixed(1)} MB), ${novas} novas ou alteradas.`);
