'use strict';

/* Fotos oficiais das candidaturas, servidas pelo próprio site:
   data/fotos/<ano>/<UF>/<sq>.jpg (geradas por scripts/atualizar_fotos.mjs). */
const Fotos = (() => {
  const cache = {};
  /** Promise<Image|null> */
  function get(ano, uf, sq) {
    if (!ano || !uf || !sq) return Promise.resolve(null);
    const src = `data/fotos/${ano}/${uf}/${sq}.jpg`;
    if (!cache[src]) {
      cache[src] = new Promise(res => {
        const img = new Image();
        img.onload = () => res(img);
        img.onerror = () => res(null);
        img.src = src;
      });
    }
    return cache[src];
  }
  return { get };
})();
