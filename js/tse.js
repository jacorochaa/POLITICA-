'use strict';

/* ==========================================================
   Busca de candidaturas registradas no TSE
   Dados: data/candidatos/ (gerados por scripts/atualizar_candidatos.py
   a partir do Portal de Dados Abertos do TSE, atualizados diariamente)
   ========================================================== */
const TSE = (() => {
  const BASE = 'data/candidatos';
  const UFS = {
    AC: 'Acre', AL: 'Alagoas', AM: 'Amazonas', AP: 'Amapá', BA: 'Bahia', CE: 'Ceará', DF: 'Distrito Federal',
    ES: 'Espírito Santo', GO: 'Goiás', MA: 'Maranhão', MG: 'Minas Gerais', MS: 'Mato Grosso do Sul',
    MT: 'Mato Grosso', PA: 'Pará', PB: 'Paraíba', PE: 'Pernambuco', PI: 'Piauí', PR: 'Paraná',
    RJ: 'Rio de Janeiro', RN: 'Rio Grande do Norte', RO: 'Rondônia', RR: 'Roraima', RS: 'Rio Grande do Sul',
    SC: 'Santa Catarina', SE: 'Sergipe', SP: 'São Paulo', TO: 'Tocantins',
  };
  const RES = { E: 'Eleito(a)', S: 'Suplente', N: 'Não eleito(a)', 2: '2º turno' };
  const cache = {};

  const getJSON = url => {
    if (!cache[url]) {
      cache[url] = fetch(url).then(r => {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      }).catch(e => { delete cache[url]; throw e; });
    }
    return cache[url];
  };
  const norm = s => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /** "MARIA DA SILVA" -> "Maria da Silva" (mantém siglas curtas como "PM", "DR.") */
  function titulo(s) {
    const minus = new Set(['da', 'de', 'do', 'das', 'dos', 'e', 'di', 'du']);
    return s.toLowerCase().split(/(\s+|-)/).map((w, i) => {
      if (!w.trim() || w === '-') return w;
      if (i > 0 && minus.has(w)) return w;
      return w.charAt(0).toUpperCase() + w.slice(1);
    }).join('');
  }
  const cnpjFmt = c => (c && c.length === 14) ? c.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') : c;

  /** converte o registro bruto em dados prontos para colinha/moldura */
  function montar(rec, meta, ctx) {
    const o = {};
    meta.campos.forEach((k, i) => { o[k] = rec[i]; });
    const cargo = meta.cargos[o.cargo];
    const partido = (typeof PARTIDOS !== 'undefined') ? PARTIDOS.find(p => p.num === String(o.pnum)) : null;
    let cid = '';
    if (meta.tipo === 'municipal') cid = `${ctx.cidade} - ${ctx.uf}`;
    else if (cargo !== 'presidente') cid = UFS[ctx.uf] || ctx.uf;
    else cid = 'Brasil';
    const legal = [o.agremiacao, o.cnpj ? 'CNPJ ' + cnpjFmt(o.cnpj) : ''].filter(Boolean).join(' · ');
    return {
      sq: String(o.sq),
      nome: titulo(o.nome),
      urna: o.nome,
      num: String(o.num),
      cargo,
      pid: partido ? partido.id : '',
      partido: partido ? partido.sigla : o.psigla,
      cid,
      legal,
      ano: String(meta.ano),
      uf: cargo === 'presidente' ? 'BR' : ctx.uf,
      ue: ctx.ue || '',
      res: o.res,
    };
  }

  /**
   * Monta o painel (eleição, estado, município e busca) dentro de `el`.
   * opts.onSelect(candidato): clique num resultado.
   * opts.onData(api): a lista de candidaturas mudou (api.find, api.lugar, api.meta).
   */
  function mount(el, opts) {
    if (typeof opts === 'function') opts = { onSelect: opts };
    const onSelect = opts.onSelect || (() => {});
    const onData = opts.onData || (() => {});
    const pref = U.store.get('tse-pref', {});
    el.innerHTML = `
      <div class="row">
        <div class="field"><label for="tse-eleicao">Eleição</label><select id="tse-eleicao"><option>Carregando…</option></select></div>
        <div class="field"><label for="tse-uf">Estado</label><select id="tse-uf"></select></div>
      </div>
      <div class="field hidden" id="tse-mun-box"><label for="tse-mun">Município</label><select id="tse-mun"></select></div>
      <div class="search">${U.icon('search', 'i')}<input type="search" id="tse-q" placeholder="Buscar por nome ou número" autocomplete="off" aria-label="Buscar candidato por nome ou número"></div>
      <div class="tse-results" id="tse-results" role="listbox" aria-label="Candidaturas encontradas"></div>`;

    const $e = U.$('#tse-eleicao', el), $uf = U.$('#tse-uf', el), $mun = U.$('#tse-mun', el);
    const $munBox = U.$('#tse-mun-box', el), $q = U.$('#tse-q', el), $res = U.$('#tse-results', el);
    let meta = null, lista = [], ctx = {};
    let vices = {};   // "cargo:número" -> [[rótulo, nome, sq], ...] do lugar escolhido

    /** junta vice/suplentes ao candidato (c.vices = [{ rotulo, nome, sq }]) */
    function comVices(c) {
      if (!c) return c;
      const v = vices[`${c.cargo}:${c.num}`] || [];
      c.vices = v.map(([rotulo, nome, sq]) => ({ rotulo, nome, sq }));
      return c;
    }
    const lerVices = uf => getJSON(`data/vices/${meta.ano}/${uf}.json`).catch(() => ({}));

    // bandeira do estado escolhido dentro do campo (mantém a setinha do select)
    const seta = getComputedStyle($uf).backgroundImage;
    function mostrarBandeira() {
      const uf = $uf.value;
      $uf.classList.toggle('com-bandeira', !!uf);
      $uf.style.backgroundImage = uf ? `url("img/estados/${uf}.png"), ${seta}` : '';
    }

    const api = {
      get meta() { return meta; },
      get ctx() { return ctx; },
      pronto: () => lista.length > 0,
      /** candidatura com esse cargo e número, ou null */
      find(cargo, num) {
        if (!meta || !lista.length || !num) return null;
        const iC = meta.campos.indexOf('cargo'), iN = meta.campos.indexOf('num');
        const r = lista.find(x => meta.cargos[x[iC]] === cargo && String(x[iN]) === String(num));
        return r ? comVices(montar(r, meta, ctx)) : null;
      },
      /** "Distrito Federal · DF" ou "Campinas · SP" */
      lugar() {
        if (!ctx.uf) return '';
        return meta && meta.tipo === 'municipal' && ctx.cidade ? `${ctx.cidade} · ${ctx.uf}` : `${UFS[ctx.uf] || ctx.uf} · ${ctx.uf}`;
      },
    };

    const salvarPref = () => U.store.set('tse-pref', { ano: $e.value, uf: $uf.value, ue: $mun.value });
    function status(msg) { $res.innerHTML = msg ? `<div class="tse-empty">${msg}</div>` : ''; }
    function pronto() { buscar(); onData(api); }

    async function carregarEleicao() {
      meta = await getJSON(`${BASE}/${$e.value}/index.json`);
      const ufs = Object.keys(meta.indice).filter(u => u !== 'BR').sort();
      $uf.innerHTML = '<option value="">Selecione</option>' + ufs.map(u => `<option value="${u}">${UFS[u] || u}</option>`).join('');
      if (pref.uf && ufs.includes(pref.uf)) $uf.value = pref.uf;
      mostrarBandeira();
      await carregarUF();
    }

    async function carregarUF() {
      lista = [];
      vices = {};
      ctx = { uf: $uf.value };
      const uf = $uf.value;
      if (meta.tipo === 'municipal') {
        $munBox.classList.remove('hidden');
        const muns = uf ? meta.indice[uf] || [] : [];
        $mun.innerHTML = '<option value="">Selecione</option>' + muns.map(m => `<option value="${m[0]}">${esc(m[1])}</option>`).join('');
        if (pref.ue && muns.some(m => m[0] === pref.ue)) $mun.value = pref.ue;
        await carregarMun();
      } else {
        $munBox.classList.add('hidden');
        if (!uf) { status(''); onData(api); return; }
        try {
          const [a, br, va, vbr] = await Promise.all([getJSON(`${BASE}/${meta.ano}/${uf}.json`), getJSON(`${BASE}/${meta.ano}/BR.json`).catch(() => []), lerVices(uf), lerVices('BR')]);
          lista = br.concat(a);
          vices = { ...vbr, ...va };
          pronto();
        } catch (e) { status('Não foi possível carregar os dados deste estado.'); }
      }
    }

    async function carregarMun() {
      lista = [];
      vices = {};
      const uf = $uf.value, ue = $mun.value;
      if (!uf || !ue) { status(''); onData(api); return; }
      try {
        lista = meta.layout === 'uf'
          ? ((await getJSON(`${BASE}/${meta.ano}/${uf}.json`))[ue] || [])
          : await getJSON(`${BASE}/${meta.ano}/${uf}/${ue}.json`);
        vices = (await lerVices(uf))[ue] || {};
        ctx = { uf, ue, cidade: $mun.selectedOptions[0].textContent };
        pronto();
      } catch (e) { status('Não foi possível carregar os dados deste município.'); }
    }

    function buscar() {
      const q = norm($q.value.trim());
      if (!q) { status(''); return; }
      if (!lista.length) { status(meta && meta.tipo === 'municipal' ? 'Escolha o estado e o município.' : 'Escolha o estado.'); return; }
      const iNome = meta.campos.indexOf('nome'), iNum = meta.campos.indexOf('num');
      const achados = lista.filter(r => norm(r[iNome]).includes(q) || String(r[iNum]).startsWith(q));
      const mostrar = achados.slice(0, 40);
      if (!achados.length) { status('Nenhuma candidatura encontrada.'); return; }
      $res.innerHTML = mostrar.map(r => {
        const c = montar(r, meta, ctx);
        const p = typeof Partidos !== 'undefined' ? Partidos.get(c.pid) : null;
        const cor = p ? p.cor : '#71717a';
        return `<button type="button" class="tse-item" data-i="${lista.indexOf(r)}" role="option">
          ${U.digitsHTML(esc(c.num), 'sm')}
          <span class="tse-info"><b>${esc(c.urna)}</b><small>${esc(CARGOS[c.cargo] ? CARGOS[c.cargo].nome : '')}</small></span>
          <span class="tse-party" style="background:${cor};color:${U.textOn(cor)}">${esc(c.partido)}</span>
        </button>`;
      }).join('') + (achados.length > mostrar.length
        ? `<div class="tse-empty">Mais ${(achados.length - mostrar.length).toLocaleString('pt-BR')}. Digite mais para filtrar.</div>` : '');
    }

    $res.addEventListener('click', e => {
      const b = e.target.closest('.tse-item');
      if (!b) return;
      const c = comVices(montar(lista[+b.dataset.i], meta, ctx));
      $q.value = '';
      status('');
      onSelect(c);
    });
    $e.addEventListener('change', () => { salvarPref(); carregarEleicao().catch(() => status('Erro ao carregar a eleição.')); });
    $uf.addEventListener('change', () => { salvarPref(); mostrarBandeira(); carregarUF(); });
    $mun.addEventListener('change', () => { salvarPref(); carregarMun(); });
    let t = 0;
    $q.addEventListener('input', () => { clearTimeout(t); t = setTimeout(buscar, 120); });

    getJSON(`${BASE}/eleicoes.json`).then(d => {
      $e.innerHTML = d.eleicoes.map(x => `<option value="${x.ano}">${x.ano} · ${x.tipo === 'municipal' ? 'Municipal' : 'Geral'}</option>`).join('');
      if (pref.ano && d.eleicoes.some(x => String(x.ano) === String(pref.ano))) $e.value = pref.ano;
      return carregarEleicao();
    }).catch(() => {
      el.querySelector('.row').classList.add('hidden');
      status('Dados do TSE indisponíveis. Abra o site por um servidor (veja o README).');
    });

    return api;
  }

  return { mount, montar, UFS, RES };
})();
