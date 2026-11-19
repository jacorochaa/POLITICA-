/*
 * Proxy de fotos de candidaturas (Cloudflare Worker, plano gratuito).
 *
 * Por que existe: o TSE publica as fotos em .zip por estado, mas o servidor de
 * lá envia o cabeçalho CORS duplicado e o navegador recusa ler. Este Worker lê
 * só o pedaço do zip com a foto pedida (Range) e devolve o JPEG com CORS certo.
 * A posição de cada foto vem do índice gerado por scripts/fotos_municipais.mjs
 * (data/fotos/<ano>/idx/...), então aqui não há processamento pesado.
 *
 * Endereço: GET /<ano>/<UF>/<offset>/<tamanho>.jpg
 * Só acessa os arquivos de fotos do TSE; não serve para mais nada.
 */
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS' };

export default {
  async fetch(req, env, ctx) {
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
    if (req.method !== 'GET') return new Response('método não permitido', { status: 405, headers: CORS });

    const url = new URL(req.url);
    const m = url.pathname.match(/^\/(20\d\d)\/([A-Z]{2})\/(\d{1,10})\/(\d{1,6})\.jpg$/);
    if (!m) return new Response('não encontrado', { status: 404, headers: CORS });
    const [, ano, uf] = m;
    const off = Number(m[3]), size = Number(m[4]);
    if (size < 100 || size > 400000) return new Response('tamanho inválido', { status: 400, headers: CORS });

    const cache = caches.default;
    const chave = new Request(url.origin + url.pathname);
    const salvo = await cache.match(chave);
    if (salvo) return salvo;

    const tse = `https://cdn.tse.jus.br/estatistica/sead/eleicoes/eleicoes${ano}/fotos/foto_cand${ano}_${uf}_div.zip`;
    const r = await fetch(tse, { headers: { Range: `bytes=${off}-${off + 30 + 512 + size}` } });
    if (r.status !== 206) return new Response('falha no TSE', { status: 502, headers: CORS });
    const b = new Uint8Array(await r.arrayBuffer());
    const dv = new DataView(b.buffer);
    if (b.length < 30 || dv.getUint32(0, true) !== 0x04034b50) return new Response('posição inválida', { status: 502, headers: CORS });
    if (dv.getUint16(8, true) !== 0) return new Response('formato não suportado', { status: 415, headers: CORS });
    const ini = 30 + dv.getUint16(26, true) + dv.getUint16(28, true);
    const jpg = b.slice(ini, ini + size);
    if (jpg[0] !== 0xff || jpg[1] !== 0xd8) return new Response('não é JPEG', { status: 502, headers: CORS });

    const res = new Response(jpg, {
      headers: { ...CORS, 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=2592000, immutable' },
    });
    ctx.waitUntil(cache.put(chave, res.clone()));
    return res;
  },
};
