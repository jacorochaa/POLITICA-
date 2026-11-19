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
      sq: o.sq,
      nome: titulo(o.nome),
      num: String(o.num),
      cargo,
      pid: partido ? partido.id : '',
      partido: partido ? partido.sigla : o.psigla,
      cid,
      legal,
      ano: String(meta.ano),
      res: o.res,
    };
  }

  /**
   * Monta o painel de busca dentro de `el`.
   * onSelect(candidato) é chamado com os dados prontos.
   */
  function mount(el, onSelect) {
    const pref = U.store.get('tse-pref', {});
    el.innerHTML = `
      <h2 class="card-title"><span class="n" style="background:var(--accent)">${U.icon('search', 'i i-sm')}</span>Puxar candidatura do TSE</h2>
      <div class="row">
        <div class="field"><label for="tse-eleicao">Eleição</label><select id="tse-eleicao"><option>Carregando…</option></select></div>
        <div class="field"><label for="tse-uf">Estado</label><select id="tse-uf"></select></div>
      </div>
      <div class="field hidden" id="tse-mun-box"><label for="tse-mun">Município</label><select id="tse-mun"></select></div>
      <div class="field">
        <label for="tse-q">Nome ou número</label>
        <div class="tse-search">${U.icon('search', 'i')}<input type="text" id="tse-q" placeholder="Ex.: Maria ou 12345" autocomplete="off"></div>
      </div>
      <div class="tse-results" id="tse-results" role="listbox" aria-label="Candidaturas encontradas"></div>
      <p class="hint tse-src" id="tse-src"></p>`;

    const $e = U.$('#tse-eleicao', el), $uf = U.$('#tse-uf', el), $mun = U.$('#tse-mun', el);
    const $munBox = U.$('#tse-mun-box', el), $q = U.$('#tse-q', el), $res = U.$('#tse-results', el), $src = U.$('#tse-src', el);
    let meta = null, lista = [], ctx = {};

    const salvarPref = () => U.store.set('tse-pref', { ano: $e.value, uf: $uf.value, ue: $mun.value });

    function status(msg) { $res.innerHTML = msg ? `<div class="tse-empty">${msg}</div>` : ''; }

    async function carregarEleicao() {
      meta = await getJSON(`${BASE}/${$e.value}/index.json`);
      const ufs = Object.keys(meta.indice).filter(u => u !== 'BR').sort();
      $uf.innerHTML = '<option value="">Selecione</option>' + ufs.map(u => `<option value="${u}">${u} · ${UFS[u] || u}</option>`).join('');
      if (pref.uf && ufs.includes(pref.uf)) $uf.value = pref.uf;
      $src.textContent = `Fonte: TSE (Dados Abertos), ${meta.total.toLocaleString('pt-BR')} candidaturas. Dados de ${meta.geracao_tse}.`;
      await carregarUF();
    }

    async function carregarUF() {
      lista = [];
      const uf = $uf.value;
      if (meta.tipo === 'municipal') {
        $munBox.classList.remove('hidden');
        const muns = uf ? meta.indice[uf] || [] : [];
        $mun.innerHTML = '<option value="">Selecione</option>' + muns.map(m => `<option value="${m[0]}">${esc(m[1])}</option>`).join('');
        if (pref.ue && muns.some(m => m[0] === pref.ue)) $mun.value = pref.ue;
        await carregarMun();
      } else {
        $munBox.classList.add('hidden');
        if (!uf) { status('Escolha o estado para buscar.'); return; }
        status('Carregando candidaturas…');
        try {
          const [a, br] = await Promise.all([getJSON(`${BASE}/${meta.ano}/${uf}.json`), getJSON(`${BASE}/${meta.ano}/BR.json`).catch(() => [])]);
          lista = br.concat(a);
          ctx = { uf };
          buscar();
        } catch (e) { status('Não foi possível carregar os dados deste estado.'); }
      }
    }

    async function carregarMun() {
      lista = [];
      const uf = $uf.value, ue = $mun.value;
      if (!uf || !ue) { status(uf ? 'Escolha o município.' : 'Escolha o estado e o município.'); return; }
      status('Carregando candidaturas…');
      try {
        lista = await getJSON(`${BASE}/${meta.ano}/${uf}/${ue}.json`);
        ctx = { uf, cidade: $mun.selectedOptions[0].textContent };
        buscar();
      } catch (e) { status('Não foi possível carregar os dados deste município.'); }
    }

    function buscar() {
      if (!lista.length) return;
      const q = norm($q.value.trim());
      const iNome = meta.campos.indexOf('nome'), iNum = meta.campos.indexOf('num');
      const achados = !q ? lista : lista.filter(r => norm(r[iNome]).includes(q) || String(r[iNum]).startsWith(q));
      const mostrar = achados.slice(0, 60);
      if (!achados.length) { status('Nenhuma candidatura encontrada.'); return; }
      $res.innerHTML = mostrar.map((r, i) => {
        const c = montar(r, meta, ctx);
        const p = typeof Partidos !== 'undefined' ? Partidos.get(c.pid) : null;
        const cor = p ? p.cor : '#71717a';
        return `<button type="button" class="tse-item" data-i="${lista.indexOf(r)}" role="option">
          <span class="tse-num" style="background:${cor};color:${U.textOn(cor)}">${esc(c.num)}</span>
          <span class="tse-info"><b>${esc(c.nome)}</b><small>${esc(CARGOS[c.cargo] ? CARGOS[c.cargo].nome : '')} · ${esc(c.partido)}</small></span>
          ${c.res === 'E' ? '<span class="tse-tag">Eleito(a)</span>' : ''}
        </button>`;
      }).join('') + (achados.length > mostrar.length
        ? `<div class="tse-empty">Mostrando ${mostrar.length} de ${achados.length.toLocaleString('pt-BR')}. Digite para filtrar.</div>` : '');
    }

    $res.addEventListener('click', e => {
      const b = e.target.closest('.tse-item');
      if (!b) return;
      U.$$('.tse-item', $res).forEach(x => x.classList.toggle('active', x === b));
      const c = montar(lista[+b.dataset.i], meta, ctx);
      onSelect(c);
      U.toast(`${c.nome} · ${c.num} carregado(a) do TSE`);
    });
    $e.addEventListener('change', () => { salvarPref(); carregarEleicao().catch(() => status('Erro ao carregar a eleição.')); });
    $uf.addEventListener('change', () => { salvarPref(); carregarUF(); });
    $mun.addEventListener('change', () => { salvarPref(); carregarMun(); });
    let t = 0;
    $q.addEventListener('input', () => { clearTimeout(t); t = setTimeout(buscar, 120); });

    getJSON(`${BASE}/eleicoes.json`).then(d => {
      $e.innerHTML = d.eleicoes.map(x => `<option value="${x.ano}">${x.ano} · ${x.tipo === 'municipal' ? 'Municipal' : 'Geral'}</option>`).join('');
      if (pref.ano && d.eleicoes.some(x => String(x.ano) === String(pref.ano))) $e.value = pref.ano;
      return carregarEleicao();
    }).catch(() => {
      el.querySelector('.row').classList.add('hidden');
      status('Dados do TSE indisponíveis. Abra o site por um servidor (veja o README) ou preencha manualmente.');
    });
  }

  return { mount, montar, UFS, RES };
})();
