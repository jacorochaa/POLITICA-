'use strict';

/* Fotos oficiais das candidaturas.
   1) arquivos do próprio site: data/fotos/<ano>/<UF>/<sq>.jpg
      (2026 inteiro e prefeitos de 2024; scripts/atualizar_fotos.mjs e fotos_municipais.mjs)
   2) se não houver e PROXY estiver configurado: o Worker em cloudflare/fotos-worker.js,
      usando a posição da foto no zip do TSE (data/fotos/<ano>/idx/<UF>/<município>.json). */
const Fotos = (() => {
  // Endereço do Worker publicado na Cloudflare, sem barra no fim.
  // Ex.: 'https://colinha-fotos.seu-usuario.workers.dev'. Vazio = sem proxy.
  const PROXY_PUBLICO = '';
  // No computador (localhost), o servidor local (scripts/servidor.mjs) faz o papel do proxy.
  const local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  const PROXY = PROXY_PUBLICO || (local ? 'proxy-fotos' : '');

  const cache = {}, indices = {};

  function carregar(src, cors) {
    return new Promise(res => {
      const img = new Image();
      if (cors) img.crossOrigin = 'anonymous';   // para poder baixar a arte com a foto
      img.onload = () => res(img);
      img.onerror = () => res(null);
      img.src = src;
    });
  }

  function indice(ano, uf, ue) {
    const u = `data/fotos/${ano}/idx/${uf}/${ue}.json`;
    if (!indices[u]) indices[u] = fetch(u).then(r => (r.ok ? r.json() : null)).catch(() => null);
    return indices[u];
  }

  /** Promise<Image|null>; ue = código do município (eleições municipais) */
  function get(ano, uf, sq, ue) {
    if (!ano || !uf || !sq) return Promise.resolve(null);
    const chave = `${ano}/${uf}/${sq}`;
    if (!cache[chave]) {
      cache[chave] = carregar(`data/fotos/${chave}.jpg`).then(img => {
        if (img || !PROXY || !ue) return img;
        return indice(ano, uf, ue).then(m => (m && m[sq] ? carregar(`${PROXY}/${ano}/${uf}/${m[sq][0]}/${m[sq][1]}.jpg`, true) : null));
      });
    }
    return cache[chave];
  }

  return { get, proxy: () => PROXY };
})();
