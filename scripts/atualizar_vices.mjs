#!/usr/bin/env node
/*
 * Vices e suplentes das candidaturas (TSE, Portal de Dados Abertos, consulta_cand).
 * O vice usa o mesmo número do titular; os suplentes de senador, o do senador.
 *
 * Grava data/vices/<ano>/<UF>.json:
 *   eleição geral:     { "governador:11": [["Vice-governador", "NOME", "sq"]], "senador:222": [...] }
 *                      (vice-presidente fica em BR.json)
 *   eleição municipal: { "<código do município>": { "prefeito:15": [["Vice-prefeito", "NOME", "sq"]] } }
 *
 * Uso: node scripts/atualizar_vices.mjs 2026 2024
 * Sem dependências: só Node 18+.
 */
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateRawSync } from 'node:zlib';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const anos = process.argv.slice(2).filter(a => /^\d{4}$/.test(a));
if (!anos.length) anos.push('2026', '2024');

// código do cargo de vice -> [cargo do titular, rótulo, ordem]
const VICES = {
  2: ['presidente', 'Vice-presidente', 1],
  4: ['governador', 'Vice-governador', 1],
  9: ['senador', '1º suplente', 1],
  10: ['senador', '2º suplente', 2],
  12: ['prefeito', 'Vice-prefeito', 1],
};

const nulo = v => { v = (v || '').trim(); return ['#NULO', '#NE', '#NULO#', '-1', '-3'].includes(v) ? '' : v; };

function* entradas(zip) {
  let p = zip.length - 22;
  while (p >= 0 && zip.readUInt32LE(p) !== 0x06054b50) p--;
  let i = zip.readUInt32LE(p + 16);
  const fim = i + zip.readUInt32LE(p + 12);
  while (i < fim && zip.readUInt32LE(i) === 0x02014b50) {
    const method = zip.readUInt16LE(i + 10), size = zip.readUInt32LE(i + 20);
    const n = zip.readUInt16LE(i + 28), e = zip.readUInt16LE(i + 30), k = zip.readUInt16LE(i + 32);
    const off = zip.readUInt32LE(i + 42);
    const nome = zip.toString('latin1', i + 46, i + 46 + n);
    const ini = off + 30 + zip.readUInt16LE(off + 26) + zip.readUInt16LE(off + 28);
    yield { nome, dados: () => { const raw = zip.subarray(ini, ini + size); return method === 8 ? inflateRawSync(raw) : raw; } };
    i += 46 + n + e + k;
  }
}

/** CSV do TSE: ';', aspas duplas, latin-1 */
function* linhas(texto) {
  let campo = '', linha = [], aspas = false;
  for (let i = 0; i < texto.length; i++) {
    const ch = texto[i];
    if (aspas) {
      if (ch === '"') { if (texto[i + 1] === '"') { campo += '"'; i++; } else aspas = false; } else campo += ch;
    } else if (ch === '"') aspas = true;
    else if (ch === ';') { linha.push(campo); campo = ''; }
    else if (ch === '\n') { linha.push(campo.replace(/\r$/, '')); yield linha; linha = []; campo = ''; }
    else campo += ch;
  }
  if (campo || linha.length) { linha.push(campo); yield linha; }
}

async function gravar(caminho, obj) {
  await mkdir(dirname(caminho), { recursive: true });
  const txt = JSON.stringify(obj);
  if (existsSync(caminho) && (await readFile(caminho, 'utf8')) === txt) return false;
  await writeFile(caminho, txt);
  return true;
}

for (const ano of anos) {
  const url = `https://cdn.tse.jus.br/estatistica/sead/odsele/consulta_cand/consulta_cand_${ano}.zip`;
  console.log(`Baixando ${url} ...`);
  const r = await fetch(url, { headers: { 'User-Agent': 'colinha-site/1.0 (dados abertos)' } });
  if (!r.ok) { console.log(`${ano}: HTTP ${r.status}`); continue; }
  const zip = Buffer.from(await r.arrayBuffer());

  const vices = new Map();   // sq -> registro (fica a linha do último turno)
  for (const ent of entradas(zip)) {
    if (!ent.nome.toLowerCase().endsWith('.csv') || ent.nome.toUpperCase().includes('BRASIL')) continue;
    const texto = ent.dados().toString('latin1');
    let cab = null, ix = {};
    for (const l of linhas(texto)) {
      if (!cab) { cab = l; cab.forEach((c, i) => { ix[c] = i; }); continue; }
      const cod = parseInt(l[ix.CD_CARGO], 10);
      if (!VICES[cod]) continue;
      const sq = l[ix.SQ_CANDIDATO];
      const turno = parseInt(l[ix.NR_TURNO] || '1', 10);
      const ant = vices.get(sq);
      if (ant && ant.turno > turno) continue;
      vices.set(sq, {
        turno, sq, cod, uf: l[ix.SG_UF], ue: l[ix.SG_UE], num: l[ix.NR_CANDIDATO],
        nome: nulo(l[ix.NM_URNA_CANDIDATO]) || nulo(l[ix.NM_CANDIDATO]),
      });
    }
  }

  const municipal = [...vices.values()].some(v => v.cod === 12);
  const porUF = {};
  for (const v of vices.values()) {
    const [titular, rotulo, ordem] = VICES[v.cod];
    const uf = v.cod === 2 ? 'BR' : v.uf;
    const chave = `${titular}:${v.num}`;
    porUF[uf] = porUF[uf] || {};
    const alvo = municipal ? (porUF[uf][v.ue] = porUF[uf][v.ue] || {}) : porUF[uf];
    (alvo[chave] = alvo[chave] || []).push([rotulo, v.nome, v.sq, ordem]);
  }
  let alterados = 0;
  for (const [uf, obj] of Object.entries(porUF)) {
    const ordenar = m => { for (const k of Object.keys(m)) m[k] = m[k].sort((a, b) => a[3] - b[3]).map(x => x.slice(0, 3)); };
    if (municipal) Object.values(obj).forEach(ordenar); else ordenar(obj);
    alterados += await gravar(join(RAIZ, 'data', 'vices', ano, `${uf}.json`), obj);
  }
  console.log(`${ano}: ${vices.size} vices/suplentes em ${Object.keys(porUF).length} arquivos (${alterados} alterados)`);
}
