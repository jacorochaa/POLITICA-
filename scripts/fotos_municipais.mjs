#!/usr/bin/env node
/*
 * Fotos das eleições municipais (o pacote do TSE passa de 10 GB, então não
 * baixamos o arquivo inteiro: lemos só o índice do zip e as fotos pedidas,
 * com requisições Range).
 *
 *  --indice    grava data/fotos/<ano>/idx/<UF>/<município>.json com a posição
 *              de cada foto dentro do zip do TSE ({ sq: [offset, tamanho] }),
 *              usado pelo proxy (cloudflare/fotos-worker.js) para os vereadores.
 *  --prefeitos baixa as fotos de prefeito para data/fotos/<ano>/<UF>/<sq>.jpg
 *              (depois rode scripts/reduzir_fotos.ps1 para deixá-las leves).
 *
 * Uso: node scripts/fotos_municipais.mjs 2024 --indice --prefeitos [UF ...]
 * Sem dependências: só Node 18+.
 */
import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateRawSync } from 'node:zlib';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const ano = args.find(a => /^\d{4}$/.test(a)) || '2024';
const comIndice = args.includes('--indice');
const comPrefeitos = args.includes('--prefeitos');
const pedidos = args.filter(a => /^[A-Za-z]{2}$/.test(a)).map(s => s.toUpperCase());
const url = uf => `https://cdn.tse.jus.br/estatistica/sead/eleicoes/eleicoes${ano}/fotos/foto_cand${ano}_${uf}_div.zip`;
const UA = { 'User-Agent': 'colinha-site/1.0 (fotos de candidaturas)' };

async function faixa(u, range, tentativas = 4) {
  for (let t = 1; ; t++) {
    try {
      const r = await fetch(u, { headers: { ...UA, Range: `bytes=${range}` } });
      if (r.status !== 206 && r.status !== 200) throw new Error('HTTP ' + r.status);
      return Buffer.from(await r.arrayBuffer());
    } catch (e) {
      if (t >= tentativas) throw e;
      await new Promise(res => setTimeout(res, 800 * t));
    }
  }
}

/** índice do zip: nome -> { off, size, method } */
async function indiceZip(u) {
  const fim = await faixa(u, '-65558');
  let p = fim.length - 22;
  while (p >= 0 && fim.readUInt32LE(p) !== 0x06054b50) p--;
  if (p < 0) throw new Error('zip inválido');
  const size = fim.readUInt32LE(p + 12), off = fim.readUInt32LE(p + 16);
  const cd = await faixa(u, `${off}-${off + size - 1}`);
  const map = new Map();
  for (let i = 0; i + 46 <= cd.length && cd.readUInt32LE(i) === 0x02014b50;) {
    const method = cd.readUInt16LE(i + 10);
    let csize = cd.readUInt32LE(i + 20), usize = cd.readUInt32LE(i + 24), off = cd.readUInt32LE(i + 42);
    const n = cd.readUInt16LE(i + 28), e = cd.readUInt16LE(i + 30), k = cd.readUInt16LE(i + 32);
    // ZIP64: valores 0xFFFFFFFF vêm no campo extra 0x0001, nesta ordem
    if (usize === 0xffffffff || csize === 0xffffffff || off === 0xffffffff) {
      let x = i + 46 + n;
      const fimExtra = x + e;
      while (x + 4 <= fimExtra) {
        const id = cd.readUInt16LE(x), len = cd.readUInt16LE(x + 2);
        if (id === 0x0001) {
          let y = x + 4;
          if (usize === 0xffffffff) { usize = Number(cd.readBigUInt64LE(y)); y += 8; }
          if (csize === 0xffffffff) { csize = Number(cd.readBigUInt64LE(y)); y += 8; }
          if (off === 0xffffffff) { off = Number(cd.readBigUInt64LE(y)); }
          break;
        }
        x += 4 + len;
      }
    }
    map.set(cd.toString('utf8', i + 46, i + 46 + n), { off, size: csize, method });
    i += 46 + n + e + k;
  }
  return map;
}

async function extrair(u, ent) {
  const b = await faixa(u, `${ent.off}-${ent.off + 30 + 400 + ent.size}`);
  const ini = 30 + b.readUInt16LE(26) + b.readUInt16LE(28);
  const raw = b.subarray(ini, ini + ent.size);
  return ent.method === 8 ? inflateRawSync(raw) : raw;
}

async function emParalelo(itens, n, fn) {
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < itens.length) await fn(itens[i++]); }));
}

const dir = join(RAIZ, 'data', 'candidatos', ano);
const meta = JSON.parse(await readFile(join(dir, 'index.json'), 'utf8'));
if (meta.tipo !== 'municipal') { console.log(`${ano} não é eleição municipal.`); process.exit(1); }
const iSq = meta.campos.indexOf('sq'), iCargo = meta.campos.indexOf('cargo');
const ufs = pedidos.length ? pedidos : Object.keys(meta.indice).sort();

let totFotos = 0, totIdx = 0;
for (const uf of ufs) {
  const u = url(uf);
  let zip;
  try { zip = await indiceZip(u); } catch (e) { console.log(`${uf}: fotos indisponíveis (${e.message})`); continue; }
  const nome = sq => zip.get(`F${uf}${sq}_div.jpg`) || zip.get(`F${uf}${sq}_div.jpeg`);
  const prefeitos = [];
  let nIdx = 0;
  for (const f of await readdir(join(dir, uf))) {
    const recs = JSON.parse(await readFile(join(dir, uf, f), 'utf8'));
    if (comIndice) {
      const idx = {};
      recs.forEach(r => { const e = nome(r[iSq]); if (e && e.method === 0) { idx[r[iSq]] = [e.off, e.size]; nIdx++; } });
      const pasta = join(RAIZ, 'data', 'fotos', ano, 'idx', uf);
      await mkdir(pasta, { recursive: true });
      await writeFile(join(pasta, f), JSON.stringify(idx));
    }
    if (comPrefeitos) recs.forEach(r => { if (meta.cargos[r[iCargo]] === 'prefeito') prefeitos.push(String(r[iSq])); });
  }
  let nFotos = 0;
  if (comPrefeitos) {
    const pasta = join(RAIZ, 'data', 'fotos', ano, uf);
    await mkdir(pasta, { recursive: true });
    await emParalelo(prefeitos, 8, async sq => {
      const dest = join(pasta, `${sq}.jpg`);
      if (existsSync(dest)) { nFotos++; return; }   // já baixada (e talvez já reduzida)
      const e = nome(sq);
      if (!e) return;
      try { await writeFile(dest, await extrair(u, e)); nFotos++; } catch (err) { console.log(`${uf} ${sq}: ${err.message}`); }
    });
  }
  totFotos += nFotos; totIdx += nIdx;
  console.log(`${uf}: ${comIndice ? nIdx + ' no índice' : ''}${comIndice && comPrefeitos ? ', ' : ''}${comPrefeitos ? nFotos + ' de ' + prefeitos.length + ' prefeitos' : ''}`);
}
console.log(`Total: ${totIdx} no índice, ${totFotos} fotos de prefeito.`);
