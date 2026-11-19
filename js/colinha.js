'use strict';

(() => {
  const canvas = U.$('#preview');
  const ctx = canvas.getContext('2d');
  const formC = U.$('#form-candidato');

  /* tipografia da arte: Inter (limpa, legível), com reservas do sistema */
  const FAM = 'Inter, "Segoe UI", Roboto, Arial, sans-serif';
  const fnt = (w, s) => `${w} ${Math.round(s)}px ${FAM}`;
  function fit(c, text, maxW, size, weight, min = 16) {
    let s = size;
    c.font = fnt(weight, s);
    while (s > min && c.measureText(text).width > maxW) { s -= 1; c.font = fnt(weight, s); }
    return s;
  }
  /* temas da arte (a folha A4 usa sempre o clássico, para economizar tinta) */
  const CLASSICO = { bg: '#ffffff', ink: '#151515', grey: '#5f5f5f', line: '#e6e6e6', soft: '#f4f4f4', dig: '#2b2b2b', ph: '#eeeeee', phf: '#d4d4d4', fino: '#8a8a8a' };
  const TEMAS = {
    classico: CLASSICO,
    urna: { bg: '#e6e0d1', ink: '#151515', grey: '#57524a', line: '#d2cab7', soft: '#ffffff', dig: '#2b2b2b', ph: '#dcd5c4', phf: '#c2b9a4', fino: '#6f695c', urna: true, visor: '#fbfaf5' },
    partido: { ...CLASSICO, partido: true },
    escuro: { bg: '#121212', ink: '#f4f4f4', grey: '#a6a6a6', line: '#2b2b2b', soft: '#1d1d1d', dig: '#e6e6e6', ph: '#222222', phf: '#3a3a3a', fino: '#8f8f8f', escuro: true },
  };
  let T = CLASSICO, INK, GREY, LINE, SOFT;
  function usarTema(nome) { T = TEMAS[nome] || CLASSICO; ({ ink: INK, grey: GREY, line: LINE, soft: SOFT } = T); }
  usarTema('classico');
  /** cor de destaque legível no fundo do tema */
  const corNoFundo = cor => (T.escuro ? (U.textOn(cor) === '#ffffff' ? U.shade(cor, 0.45) : cor) : (U.textOn(cor) === '#111827' ? U.shade(cor, -0.55) : cor));

  const state = {
    modo: 'eleitor',            // 'eleitor' | 'candidato'
    formato: 'feed',            // 'feed' | 'stories' | 'folha'
    tema: U.store.get('colinha-tema', 'classico'),
    foto: null,                 // foto do candidato (modo candidato)
    fotoUser: false,            // true se a foto veio do aparelho
    sq: '',                     // candidatura do TSE carregada no modo candidato
    logoCustom: null,
    logoPartido: null,
    imgs: {},                   // fotos do TSE já carregadas, por sq
    logos: {},                  // logos de partido já carregadas, por id
    tse: null,                  // api do painel do TSE
    eleitor: U.store.get('colinha-eleitor2', {
      eleicao: 'geral', ano: '2026', df: false, sen2: true, lugar: '', votos: {},
    }),
  };

  /* =====================================================
     Imagens (fotos do TSE e logos), carregadas sob demanda
     ===================================================== */
  function pedirFoto(v) {
    if (!v || !v.sq || state.imgs[v.sq] !== undefined) return;
    state.imgs[v.sq] = null;
    Fotos.get(v.ano, v.uf, v.sq, v.ue).then(img => { state.imgs[v.sq] = img; render(); atualizarFotosLinhas(); });
  }
  function pedirLogo(pid) {
    if (!pid || state.logos[pid] !== undefined) return;
    state.logos[pid] = null;
    Partidos.loadLogo(pid).then(img => { state.logos[pid] = img; render(); });
  }

  /* =====================================================
     Dados do candidato
     ===================================================== */
  function dadosCandidato() {
    const v = id => (U.$('#' + id).value || '').trim();
    const cargo = v('c-cargo') || 'vereador';
    return {
      nome: v('c-nome'),
      cargo,
      pid: v('c-pid'),
      lg: U.$('#c-showlogo').checked ? 1 : 0,
      num: U.onlyDigits(v('c-num'), CARGOS[cargo].digitos),
      partido: v('c-partido'),
      ano: U.onlyDigits(v('c-ano'), 4),
      cid: v('c-cid'),
      slogan: v('c-slogan'),
      cor: U.$('#c-cor').value || '#1d4ed8',
      legal: v('c-legal'),
      sq: state.sq || undefined,
      uf: state.uf || undefined,
      ue: state.ue || undefined,
    };
  }

  function preencherCandidato(d) {
    const set = (id, val) => { if (val !== undefined && val !== null) U.$('#' + id).value = val; };
    if (d.cargo && CARGOS[d.cargo]) set('c-cargo', d.cargo);
    if (d.pid && Partidos.get(d.pid)) { set('c-pid', d.pid); carregarLogoPartido(); }
    if (d.lg !== undefined) U.$('#c-showlogo').checked = !!d.lg;
    atualizarDicaNumero();
    set('c-nome', d.nome); set('c-num', d.num); set('c-partido', d.partido);
    set('c-ano', d.ano); set('c-cid', d.cid); set('c-slogan', d.slogan);
    set('c-legal', d.legal);
    if (/^#[0-9a-f]{6}$/i.test(d.cor || '')) set('c-cor', d.cor);
    if (d.sq && d.uf && d.ano) carregarFotoCandidato(d);
  }

  function atualizarDicaNumero() {
    const cargo = CARGOS[U.$('#c-cargo').value];
    const inp = U.$('#c-num');
    inp.maxLength = cargo.digitos;
    inp.value = U.onlyDigits(inp.value, cargo.digitos);
    U.$('#c-num-hint').textContent = `${cargo.digitos} dígitos`;
  }

  function partidoAtual() { return Partidos.get(U.$('#c-pid').value); }

  function logoInfo(d) {
    const p = Partidos.get(d.pid);
    if (!d.lg || (!p && !state.logoCustom)) return null;
    return { img: state.logoCustom || state.logoPartido, p };
  }

  async function carregarLogoPartido() {
    state.logoPartido = await Partidos.loadLogo(U.$('#c-pid').value);
    render();
  }

  function aplicarPartido() {
    const p = partidoAtual();
    if (p) {
      U.$('#c-partido').value = p.sigla;
      U.$('#c-cor').value = p.cor;
      const dig = CARGOS[U.$('#c-cargo').value].digitos;
      U.$('#c-num').value = Partidos.numeroComPrefixo(U.$('#c-num').value, p, dig);
    }
    carregarLogoPartido();
  }

  function carregarFotoCandidato(c) {
    state.sq = c.sq; state.uf = c.uf; state.ue = c.ue;
    if (state.fotoUser) return;
    state.foto = null;
    Fotos.get(c.ano, c.uf, c.sq, c.ue).then(img => {
      if (state.sq === c.sq && !state.fotoUser) { state.foto = img; render(); }
    });
  }

  /* =====================================================
     Desenho — peças comuns
     ===================================================== */
  function caixinhas(c, num, n, cx, y, bw, bh, gap) {
    const total = n * bw + (n - 1) * gap;
    let x = cx - total / 2;
    const ch = String(num || '').split('');
    for (let i = 0; i < n; i++) {
      U.roundRect(c, x, y, bw, bh, bw * 0.2);
      c.fillStyle = SOFT; c.fill();
      c.lineWidth = Math.max(2.5, bw * 0.045); c.strokeStyle = T.dig; c.stroke();
      if (ch[i]) {
        c.fillStyle = INK; c.font = fnt(600, bh * 0.62);
        c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText(ch[i], x + bw / 2, y + bh / 2 + bh * 0.03);
      }
      x += bw + gap;
    }
  }

  /** foto em retângulo arredondado; sem foto, silhueta cinza */
  function retrato(c, img, x, y, w, h, r) {
    c.save();
    U.roundRect(c, x, y, w, h, r);
    c.clip();
    if (img) {
      U.drawCover(c, img, x, y, w, h);
    } else {
      c.fillStyle = T.ph; c.fillRect(x, y, w, h);
      c.fillStyle = T.phf;
      c.beginPath(); c.arc(x + w / 2, y + h * 0.4, w * 0.2, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.ellipse(x + w / 2, y + h * 1.02, w * 0.42, h * 0.36, 0, Math.PI, 0); c.fill();
    }
    c.restore();
  }

  /** logo do partido numa caixa branca com borda leve + sigla embaixo */
  function seloPartido(c, img, p, sigla, x, y, s) {
    if (img || p) {
      U.roundRect(c, x, y, s, s, s * 0.2);
      c.fillStyle = '#fff'; c.fill();
      c.lineWidth = 2; c.strokeStyle = LINE; c.stroke();
      Partidos.draw(c, img, p, x + s * 0.1, y + s * 0.1, s * 0.8, s * 0.8);
    }
    if (sigla) {
      c.fillStyle = GREY; c.textAlign = 'center'; c.textBaseline = 'alphabetic';
      fit(c, sigla, s + 40, 20, 700, 12);
      c.fillText(sigla, x + s / 2, y + s + 30);
    }
  }

  function espacado(c, text, x, y, size, weight, color, sp) {
    c.fillStyle = color; c.font = fnt(weight, size);
    U.setSpacing(c, sp);
    c.fillText(text, x, y);
    U.setSpacing(c, 0);
  }

  /* =====================================================
     Colinha do candidato (imagem / stories)
     ===================================================== */
  function drawCandidato(c, W, H, d) {
    const cargo = CARGOS[d.cargo];
    const cor = d.cor;
    const corTxt = corNoFundo(cor);
    const tall = H / W > 1.5;
    const cx = W / 2;

    c.fillStyle = T.bg;
    c.fillRect(0, 0, W, H);

    // cabeçalho
    c.textAlign = 'center'; c.textBaseline = 'alphabetic';
    const cab = [`ELEIÇÕES ${d.ano || ''}`, d.cid ? d.cid.toUpperCase() : ''].filter(Boolean).join(' · ');
    if (T.partido) {
      // faixa larga na cor do partido/campanha
      const fh = tall ? 230 : 150;
      c.fillStyle = cor; c.fillRect(0, 0, W, fh);
      espacado(c, cab, cx, fh / 2 + 10, 26, 700, U.textOn(cor), 4);
    } else {
      c.fillStyle = T.urna ? '#2b2b2b' : cor;
      c.fillRect(0, 0, W, 18);
      espacado(c, cab, cx, tall ? 150 : 104, 24, 600, GREY, 4);
    }

    // blocos
    const n = cargo.digitos;
    const gap = n >= 5 ? 14 : 18;
    const bw = Math.min(tall ? 150 : 132, (W - 200 - gap * (n - 1)) / n);
    const bh = bw * 1.18;
    const ph = state.foto ? (tall ? 560 : 400) : 0;
    const pw = ph * 0.75;
    const nome = (d.nome || 'Nome do candidato').toUpperCase();
    const logo = logoInfo(d);
    const logoS = logo ? (tall ? 132 : 112) : 0;

    const hFoto = ph ? ph + 56 : 0;
    const hCargo = 54;
    const hBoxes = bh + 44;
    const hNome = 84;
    const hConf = 96;
    const hPart = logo || d.partido ? (logoS ? logoS + 50 : 40) : 0;
    const hSlogan = d.slogan ? 80 : 0;
    const topo = T.partido ? (tall ? 290 : 190) : (tall ? 220 : 150);
    const base = H - (d.legal ? (tall ? 170 : 120) : (tall ? 120 : 70));
    const total = hFoto + hCargo + hBoxes + hNome + hConf + hPart + hSlogan;
    let y = topo + Math.max(0, (base - topo - total) / 2);

    if (T.urna) {
      // visor da urna atrás do conteúdo
      U.roundRect(c, 50, y - 40, W - 100, Math.min(base, y + total + 20) - y + 60, 28);
      c.fillStyle = T.visor; c.fill();
      c.lineWidth = 3; c.strokeStyle = T.line; c.stroke();
    }

    if (ph) { retrato(c, state.foto, cx - pw / 2, y, pw, ph, 28); y += hFoto; }

    c.textAlign = 'center'; c.textBaseline = 'alphabetic';
    espacado(c, cargo.nome.toUpperCase(), cx, y + 34, 32, 700, corTxt, 5);
    y += hCargo;

    caixinhas(c, d.num, n, cx, y, bw, bh, gap);
    y += hBoxes;

    c.fillStyle = INK; c.textAlign = 'center';
    fit(c, nome, W - 160, 64, 800, 30);
    c.fillText(nome, cx, y + 56);
    y += hNome;

    // "digite e aperte CONFIRMA"
    c.font = fnt(500, 26);
    const pre = 'Na urna, digite e aperte';
    const preW = c.measureText(pre).width;
    const btnW = 196, btnH = 52, sp = 14;
    const sx = cx - (preW + sp + btnW) / 2;
    c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillStyle = GREY;
    c.fillText(pre, sx, y + btnH / 2);
    U.roundRect(c, sx + preW + sp, y, btnW, btnH, 10);
    c.fillStyle = '#1f8f4e'; c.fill();
    c.fillStyle = '#fff'; c.font = fnt(800, 22); c.textAlign = 'center';
    c.fillText('CONFIRMA', sx + preW + sp + btnW / 2, y + btnH / 2 + 1);
    y += hConf;

    if (logo) {
      seloPartido(c, logo.img, logo.p, d.partido, cx - logoS / 2, y, logoS);
      y += hPart;
    } else if (d.partido) {
      c.fillStyle = GREY; c.textAlign = 'center'; c.textBaseline = 'alphabetic';
      fit(c, d.partido, W - 200, 30, 700);
      c.fillText(d.partido, cx, y + 24);
      y += hPart;
    }

    if (d.slogan) {
      c.fillStyle = corTxt; c.textAlign = 'center'; c.textBaseline = 'alphabetic';
      fit(c, d.slogan, W - 160, 40, 700, 22);
      c.fillText(d.slogan, cx, y + 44);
    }

    if (d.legal) {
      c.fillStyle = T.fino; c.textAlign = 'center'; c.textBaseline = 'alphabetic';
      drawWrapped(c, d.legal, cx, H - (tall ? 80 : 46), W - 140, d.legal.length > 160 ? 18 : 21, 500, 3);
    }
  }

  /** teclas BRANCO / CORRIGE / CONFIRMA, como na urna */
  function teclasUrna(c, cx, y, s = 1, destaque = '') {
    const w = 170 * s, h = 58 * s, gap = 18 * s;
    const teclas = [['BRANCO', '#f4f4f4', '#151515'], ['CORRIGE', '#e8742c', '#151515'], ['CONFIRMA', '#1f8f4e', '#ffffff']];
    let x = cx - (w * 3 + gap * 2) / 2;
    teclas.forEach(([t, bg, fg]) => {
      const on = destaque === t;
      U.roundRect(c, x, y + (on ? 4 * s : 0), w, h, 10 * s);
      c.fillStyle = bg; c.fill();
      c.lineWidth = 2 * s; c.strokeStyle = 'rgba(0,0,0,.25)'; c.stroke();
      if (!on) { c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(x + 8 * s, y + h, w - 16 * s, 4 * s); }
      c.fillStyle = fg; c.font = fnt(800, 20 * s); c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(t, x + w / 2, y + h / 2 + (on ? 4 * s : 0) + 1);
      x += w + gap;
    });
  }

  /** texto pequeno em até `maxLines` linhas, ancorado pela última linha em `yBottom` */
  function drawWrapped(c, text, cx, yBottom, maxW, size, weight, maxLines) {
    c.font = fnt(weight, size);
    const words = text.split(/\s+/);
    const lines = [];
    let line = '';
    words.forEach(w => {
      const t = line ? line + ' ' + w : w;
      if (c.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t;
    });
    if (line) lines.push(line);
    const shown = lines.slice(0, maxLines);
    shown.forEach((l, i) => c.fillText(l, cx, yBottom - (shown.length - 1 - i) * size * 1.3));
  }

  /* ---------- folha A4 com 10 colinhas para recortar ---------- */
  function drawFolhaCandidato(c, W, H, d) {
    c.fillStyle = '#fff';
    c.fillRect(0, 0, W, H);
    const m = 70, cols = 2, rows = 5;
    const cw = (W - m * 2) / cols, ch = (H - m * 2) / rows;
    for (let r = 0; r < rows; r++) {
      for (let k = 0; k < cols; k++) drawMini(c, m + k * cw, m + r * ch, cw, ch, d);
    }
    cortes(c, W, H, m, cols, rows);
  }

  function cortes(c, W, H, m, cols, rows) {
    const cw = (W - m * 2) / cols, ch = (H - m * 2) / rows;
    c.save();
    c.setLineDash([18, 14]);
    c.strokeStyle = '#b5b5b5';
    c.lineWidth = 3;
    for (let k = 0; k <= cols; k++) { c.beginPath(); c.moveTo(m + k * cw, m - 30); c.lineTo(m + k * cw, H - m + 30); c.stroke(); }
    for (let r = 0; r <= rows; r++) { c.beginPath(); c.moveTo(m - 30, m + r * ch); c.lineTo(W - m + 30, m + r * ch); c.stroke(); }
    c.restore();
  }

  function drawMini(c, x, y, w, h, d) {
    const cargo = CARGOS[d.cargo];
    const pad = 60;
    const fotoW = state.foto ? 200 : 0, fotoH = fotoW * 1.33;
    if (fotoW) retrato(c, state.foto, x + pad, y + (h - fotoH) / 2, fotoW, fotoH, 22);
    const logo = logoInfo(d);
    const logoS = logo ? 150 : 0;
    if (logo) seloPartido(c, logo.img, logo.p, d.partido, x + w - pad - logoS, y + (h - logoS) / 2 - 20, logoS);
    const l = x + pad + (fotoW ? fotoW + 40 : 0);
    const r = x + w - pad - (logoS ? logoS + 40 : 0);
    const cx = (l + r) / 2, inner = r - l;

    c.textAlign = 'center'; c.textBaseline = 'alphabetic';
    espacado(c, cargo.nome.toUpperCase(), cx, y + 120, 30, 700, GREY, 4);
    const n = cargo.digitos, gap = 14;
    const bw = Math.min(104, (inner - gap * (n - 1)) / n), bh = bw * 1.18;
    caixinhas(c, d.num, n, cx, y + 150, bw, bh, gap);
    c.fillStyle = INK; c.textAlign = 'center';
    fit(c, (d.nome || 'Nome do candidato').toUpperCase(), inner, 50, 800, 24);
    c.fillText((d.nome || 'Nome do candidato').toUpperCase(), cx, y + 150 + bh + 70);
    if (d.legal) {
      c.fillStyle = '#8a8a8a';
      drawWrapped(c, d.legal, x + w / 2, y + h - 26, w - pad * 2, d.legal.length > 120 ? 17 : 20, 500, 2);
    }
  }

  /* =====================================================
     Colinha do eleitor (lista na ordem da urna)
     ===================================================== */
  function linhasEleitor() {
    const e = state.eleitor;
    if (e.eleicao === 'municipal') {
      return [
        { key: 'vereador', cargo: 'vereador', ...CARGOS.vereador },
        { key: 'prefeito', cargo: 'prefeito', ...CARGOS.prefeito },
      ];
    }
    const L = [
      { key: 'dep_federal', cargo: 'dep_federal', ...CARGOS.dep_federal },
      e.df ? { key: 'dep_distrital', cargo: 'dep_distrital', ...CARGOS.dep_distrital }
        : { key: 'dep_estadual', cargo: 'dep_estadual', ...CARGOS.dep_estadual },
      { key: 'senador', cargo: 'senador', ...CARGOS.senador, nome: e.sen2 ? 'Senador(a) · 1ª vaga' : 'Senador(a)' },
    ];
    if (e.sen2) L.push({ key: 'senador2', cargo: 'senador', ...CARGOS.senador, nome: 'Senador(a) · 2ª vaga' });
    L.push({ key: 'governador', cargo: 'governador', ...CARGOS.governador });
    L.push({ key: 'presidente', cargo: 'presidente', ...CARGOS.presidente });
    return L;
  }

  const E = { head: 210, row: 180, foot: 120 };
  function alturaEleitor() { return E.head + linhasEleitor().length * E.row + E.foot; }

  function drawEleitor(c, W, H) {
    const e = state.eleitor;
    const rows = linhasEleitor();
    c.fillStyle = T.bg;
    c.fillRect(0, 0, W, H);
    const L = 72, R = W - 72, cx = W / 2;

    // cabeçalho: lugar e eleição
    c.textAlign = 'center'; c.textBaseline = 'alphabetic';
    espacado(c, `${T.urna ? 'URNA' : 'COLINHA'} · ELEIÇÕES ${e.ano || ''}`, cx, 82, 22, 600, GREY, 5);
    c.fillStyle = INK;
    fit(c, e.lugar || 'Minha colinha', W - 200, 46, 800, 26);
    c.fillText(e.lugar || 'Minha colinha', cx, 142);

    if (T.urna) {
      // visor da urna atrás da lista
      U.roundRect(c, L - 36, E.head - 34, R - L + 72, rows.length * E.row + 28, 26);
      c.fillStyle = T.visor; c.fill();
      c.lineWidth = 3; c.strokeStyle = T.line; c.stroke();
    }

    let y = E.head - 20;
    rows.forEach((r, i) => {
      const v = e.votos[r.key] || {};
      const top = y + 14;
      const p = Partidos.get(v.pid);
      // faixa na cor do partido
      if (T.partido && v.num && p) {
        U.roundRect(c, L - 34, top, 10, 150, 5);
        c.fillStyle = p.cor; c.fill();
      }
      // foto
      retrato(c, v.sq ? state.imgs[v.sq] : null, L, top, 112, 150, 18);
      // partido
      if (v.num && (p || v.partido)) seloPartido(c, p ? state.logos[p.id] : null, p, v.partido, R - 96, top + 14, 96);
      // cargo, número, nome
      c.textAlign = 'center'; c.textBaseline = 'alphabetic';
      espacado(c, r.nome.toUpperCase(), cx, top + 22, 22, 600, T.partido && v.num && p ? corNoFundo(p.cor) : GREY, 4);
      const n = r.digitos, gap = 9, bw = 58, bh = 68;
      caixinhas(c, v.num, n, cx, top + 38, bw, bh, gap);
      if (v.nome) {
        c.fillStyle = INK;
        fit(c, v.nome.toUpperCase(), R - L - 2 * 150, 30, 700, 16);
        c.fillText(v.nome.toUpperCase(), cx, top + 142);
      }
      if (i < rows.length - 1) {
        c.fillStyle = LINE;
        c.fillRect(L, y + E.row - 1, R - L, 2);
      }
      y += E.row;
    });

    if (T.urna) {
      teclasUrna(c, cx, H - E.foot + 28, 0.95);
      return;
    }
    c.fillStyle = LINE;
    c.fillRect(L, H - E.foot + 10, R - L, 2);
    c.fillStyle = GREY; c.textAlign = 'center'; c.textBaseline = 'alphabetic';
    c.font = fnt(500, 24);
    c.fillText('Digite o número e aperte CONFIRMA. Celular não entra na cabine.', cx, H - 48);
  }

  function drawFolhaEleitor(c, W, H) {
    c.fillStyle = '#fff';
    c.fillRect(0, 0, W, H);
    const off = document.createElement('canvas');
    off.width = 1080;
    off.height = alturaEleitor();
    drawEleitor(off.getContext('2d'), off.width, off.height);
    const m = 70, cw = (W - m * 2) / 2, ch = (H - m * 2) / 2;
    const s = Math.min((cw - 60) / off.width, (ch - 60) / off.height);
    const dw = off.width * s, dh = off.height * s;
    for (let r = 0; r < 2; r++) {
      for (let k = 0; k < 2; k++) c.drawImage(off, m + k * cw + (cw - dw) / 2, m + r * ch + (ch - dh) / 2, dw, dh);
    }
    cortes(c, W, H, m, 2, 2);
  }

  /* =====================================================
     Render
     ===================================================== */
  let raf = 0;
  function render() {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      const f = state.formato;
      let W = 1080, H;
      if (f === 'folha') { W = 2480; H = 3508; }
      else if (f === 'stories') H = 1920;
      else H = state.modo === 'eleitor' ? alturaEleitor() : 1350;
      canvas.width = W;
      canvas.height = H;
      usarTema(f === 'folha' ? 'classico' : state.tema);
      if (state.modo === 'candidato') {
        const d = dadosCandidato();
        if (f === 'folha') drawFolhaCandidato(ctx, W, H, d);
        else drawCandidato(ctx, W, H, d);
      } else if (f === 'folha') {
        drawFolhaEleitor(ctx, W, H);
      } else if (f === 'stories') {
        // stories: a lista centralizada numa tela 9:16
        ctx.fillStyle = T.bg; ctx.fillRect(0, 0, W, H);
        const off = document.createElement('canvas');
        off.width = 1080; off.height = alturaEleitor();
        drawEleitor(off.getContext('2d'), off.width, off.height);
        const s = Math.min(1, (H - 160) / off.height);
        ctx.drawImage(off, (W - off.width * s) / 2, (H - off.height * s) / 2, off.width * s, off.height * s);
      } else {
        drawEleitor(ctx, W, H);
      }
    });
  }

  function nomeArquivo() {
    const base = state.modo === 'candidato'
      ? `colinha-${U.slug(dadosCandidato().nome)}-${dadosCandidato().num}`
      : 'minha-colinha';
    return `${base}-${state.formato}.png`;
  }

  /* =====================================================
     Minha colinha: uma linha por cargo; o número puxa os dados
     ===================================================== */
  function salvarEleitor() { U.store.set('colinha-eleitor2', state.eleitor); }

  /** completa o voto com os dados do TSE (ou limpa se o número não existe) */
  function resolverVoto(r, num) {
    const e = state.eleitor;
    const v = { num };
    if (num.length === r.digitos && state.tse && state.tse.pronto()) {
      const c = state.tse.find(r.cargo, num);
      if (c) Object.assign(v, { nome: c.urna, partido: c.partido, pid: c.pid, sq: c.sq, uf: c.uf, ue: c.ue, ano: c.ano });
      else v.naoAchou = true;
    } else if (!state.tse || !state.tse.pronto()) {
      const ant = e.votos[r.key];
      if (ant && ant.num === num) return ant;   // sem dados: mantém o que havia
    }
    e.votos[r.key] = v;
    pedirFoto(v);
    pedirLogo(v.pid);
    return v;
  }

  function linhaHTML(r, v) {
    const foto = v.sq && state.imgs[v.sq] ? state.imgs[v.sq].src : '';
    let info;
    if (v.nome) info = `<b>${esc(v.nome)}</b><small>${esc(v.partido || '')}</small>`;
    else if (v.naoAchou) info = '<small class="warn">Número não encontrado</small>';
    else info = `<small>${r.digitos} dígitos</small>`;
    return `
      <div class="vr-photo">${foto ? `<img src="${foto}" alt="">` : ''}</div>
      <div class="vr-main">
        <span class="vr-label">${r.nome}</span>
        <input type="tel" inputmode="numeric" class="num" maxlength="${r.digitos}" aria-label="Número para ${r.nome}">
        <span class="vr-info">${info}</span>
      </div>`;
  }
  const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

  function montarFormEleitor() {
    const e = state.eleitor;
    const box = U.$('#e-rows');
    box.innerHTML = '';
    linhasEleitor().forEach(r => {
      const v = e.votos[r.key] || {};
      const div = document.createElement('div');
      div.className = 'voter-row';
      div.dataset.key = r.key;
      div.innerHTML = linhaHTML(r, v);
      const num = U.$('input', div);
      num.value = v.num || '';
      num.addEventListener('input', () => {
        num.value = U.onlyDigits(num.value, r.digitos);
        const nv = resolverVoto(r, num.value);
        salvarEleitor();
        atualizarLinha(div, r, nv);
        render();
      });
      box.appendChild(div);
    });
  }

  function atualizarLinha(div, r, v) {
    const foto = U.$('.vr-photo', div);
    const src = v.sq && state.imgs[v.sq] ? state.imgs[v.sq].src : '';
    const img = U.$('img', foto);
    if (!src) foto.innerHTML = '';
    else if (!img || img.src !== src) foto.innerHTML = `<img src="${src}" alt="">`;
    const info = U.$('.vr-info', div);
    const achouAgora = v.nome && !U.$('b', info);
    if (v.nome) info.innerHTML = `<b>${esc(v.nome)}</b><small>${esc(v.partido || '')}</small>`;
    else if (v.naoAchou) info.innerHTML = '<small class="warn">Número não encontrado</small>';
    else info.innerHTML = `<small>${r.digitos} dígitos</small>`;
    // destaque rápido quando o candidato aparece, como o visor da urna
    if (achouAgora) { div.classList.remove('achou'); void div.offsetWidth; div.classList.add('achou'); }
  }
  /** uma foto terminou de carregar (do site ou do proxy): atualiza as linhas que a usam */
  function atualizarFotosLinhas() {
    if (state.modo !== 'eleitor') return;
    const e = state.eleitor;
    U.$$('#e-rows .voter-row').forEach(div => {
      const v = e.votos[div.dataset.key];
      const img = v && v.sq && state.imgs[v.sq];
      const box = U.$('.vr-photo', div);
      if (img && !U.$('img', box)) box.innerHTML = `<img src="${img.src}" alt="">`;
    });
  }

  /** o painel do TSE mudou de eleição/estado/município */
  function aoMudarDados(api) {
    const e = state.eleitor;
    const m = api.meta;
    if (!m) return;
    const muda = e.eleicao !== m.tipo;
    e.eleicao = m.tipo;
    e.ano = String(m.ano);
    e.df = api.ctx.uf === 'DF';
    e.sen2 = m.tipo === 'geral' && (m.ano - 2018) % 8 === 0;
    e.lugar = api.lugar();
    if (muda) e.votos = {};
    if (api.pronto()) linhasEleitor().forEach(r => { const v = e.votos[r.key]; if (v && v.num) resolverVoto(r, v.num); });
    salvarEleitor();
    if (state.modo === 'eleitor') montarFormEleitor();
    // modo candidato: ajusta o ano e completa pelo número, se der
    if (!U.$('#c-ano').value || state.modo === 'candidato') U.$('#c-ano').value = e.ano;
    render();
  }

  function adicionarAMinha(d) {
    const e = state.eleitor;
    const info = CARGOS[d.cargo];
    if (e.eleicao !== info.eleicao) e.votos = {};
    e.eleicao = info.eleicao;
    if (d.ano) e.ano = d.ano;
    let key = d.cargo;
    if (key === 'dep_distrital') e.df = true;
    if (key === 'dep_estadual') e.df = false;
    if (key === 'senador' && e.sen2 && e.votos.senador && e.votos.senador.num && e.votos.senador.num !== d.num) key = 'senador2';
    const v = { num: d.num, nome: (d.urna || d.nome || '').toUpperCase(), partido: d.partido, pid: d.pid, sq: d.sq, uf: d.uf, ue: d.ue, ano: d.ano };
    e.votos[key] = v;
    pedirFoto(v); pedirLogo(v.pid);
    salvarEleitor();
    setModo('eleitor');
    U.toast(`${d.nome || 'Candidato'} está na sua colinha`);
  }

  /* =====================================================
     Modos, formatos e eventos
     ===================================================== */
  function setModo(m) {
    state.modo = m;
    U.$$('.tabs button').forEach(b => b.classList.toggle('active', b.dataset.mode === m));
    formC.classList.toggle('hidden', m !== 'candidato');
    U.$('#form-eleitor').classList.toggle('hidden', m !== 'eleitor');
    U.$('#btn-link').classList.toggle('hidden', m !== 'candidato');
    if (m === 'eleitor') montarFormEleitor();
    render();
  }

  function setFormato(f) {
    state.formato = f;
    U.$$('#formatos button').forEach(b => b.classList.toggle('active', b.dataset.f === f));
    render();
  }

  U.$$('.tabs button').forEach(b => b.addEventListener('click', () => setModo(b.dataset.mode)));
  U.$$('#formatos button').forEach(b => b.addEventListener('click', () => setFormato(b.dataset.f)));

  function setTema(t) {
    state.tema = TEMAS[t] ? t : 'classico';
    U.store.set('colinha-tema', state.tema);
    U.$$('#temas button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.tema === state.tema)));
    render();
  }
  U.$$('#temas button').forEach(b => b.addEventListener('click', () => setTema(b.dataset.tema)));
  setTema(state.tema);

  /** modo candidato: número completo + cargo => puxa nome, partido e foto */
  function completarPeloNumero() {
    const cargo = U.$('#c-cargo').value;
    const num = U.$('#c-num').value;
    if (num.length !== CARGOS[cargo].digitos || !state.tse || !state.tse.pronto()) return;
    const c = state.tse.find(cargo, num);
    if (c && c.sq !== state.sq) aplicarTSE(c);
  }

  formC.addEventListener('input', e => {
    if (e.target.id === 'c-num') {
      e.target.value = U.onlyDigits(e.target.value, CARGOS[U.$('#c-cargo').value].digitos);
      completarPeloNumero();
    }
    if (e.target.id === 'c-ano') e.target.value = U.onlyDigits(e.target.value, 4);
    if (e.target.id === 'c-nome') state.sq = '';
    render();
  });
  U.$('#c-cargo').addEventListener('change', () => {
    atualizarDicaNumero();
    const p = partidoAtual();
    if (p) U.$('#c-num').value = Partidos.numeroComPrefixo(U.$('#c-num').value, p, CARGOS[U.$('#c-cargo').value].digitos);
    completarPeloNumero();
    render();
  });
  U.$('#c-pid').addEventListener('change', aplicarPartido);
  U.$('#c-logo').addEventListener('change', async e => {
    try { state.logoCustom = e.target.files[0] ? await U.loadImage(e.target.files[0]) : null; } catch (err) { U.toast(err.message); }
    render();
  });
  U.$$('.swatch').forEach(s => s.addEventListener('click', () => { U.$('#c-cor').value = s.dataset.color; render(); }));
  U.$('#c-foto').addEventListener('change', async e => {
    try {
      const f = e.target.files[0];
      state.foto = f ? await U.loadImage(f) : null;
      state.fotoUser = !!f;
    } catch (err) { U.toast(err.message); }
    render();
  });

  U.$('#btn-download').addEventListener('click', () => U.download(canvas, nomeArquivo()));
  U.$('#btn-share').addEventListener('click', () => {
    const d = dadosCandidato();
    const txt = state.modo === 'candidato' ? `Na urna, ${d.nome}: ${d.num}. ${linkCandidato()}` : 'Minha colinha para o dia da eleição';
    U.share(canvas, nomeArquivo(), txt);
  });
  /* vídeo: simulação da urna com os números da colinha */
  U.$('#btn-video').addEventListener('click', () => {
    const tema = TEMAS[state.tema] || CLASSICO;
    const comum = { tema, teclas: teclasUrna };
    if (state.modo === 'eleitor') {
      const e = state.eleitor;
      const votos = linhasEleitor().map(r => {
        const v = e.votos[r.key] || {};
        if (!v.num || v.num.length !== r.digitos) return null;
        const p = Partidos.get(v.pid);
        return { cargo: r.nome, digitos: r.digitos, num: v.num, nome: v.nome || '', partido: v.partido || '', foto: (v.sq && state.imgs[v.sq]) || null, logo: p ? state.logos[p.id] || null : null, p };
      }).filter(Boolean);
      Video.gravar({
        ...comum, votos, titulo: e.lugar || 'Minha colinha', subtitulo: `Eleições ${e.ano || ''}`, arquivo: 'minha-colinha-video',
        final: (c, W, H) => {
          usarTema(state.tema);
          const off = document.createElement('canvas');
          off.width = 1080; off.height = alturaEleitor();
          drawEleitor(off.getContext('2d'), off.width, off.height);
          const s = Math.min(1, (H - 160) / off.height);
          c.fillStyle = T.bg; c.fillRect(0, 0, W, H);
          c.drawImage(off, (W - off.width * s) / 2, (H - off.height * s) / 2, off.width * s, off.height * s);
        },
      });
    } else {
      const d = dadosCandidato();
      const cargo = CARGOS[d.cargo];
      const p = Partidos.get(d.pid);
      const logo = logoInfo(d);
      const votos = d.num.length === cargo.digitos
        ? [{ cargo: cargo.nome, digitos: cargo.digitos, num: d.num, nome: d.nome, partido: d.partido, foto: state.foto, logo: logo ? logo.img : null, p: logo ? p : null }] : [];
      Video.gravar({
        ...comum, votos, titulo: d.nome || 'Colinha', subtitulo: [`Eleições ${d.ano || ''}`, d.cid].filter(Boolean).join(' · '),
        arquivo: `colinha-${U.slug(d.nome)}-${d.num}-video`,
        final: (c, W, H) => { usarTema(state.tema); drawCandidato(c, W, H, d); },
      });
    }
  });

  U.$('#btn-print').addEventListener('click', () => U.printCanvas(canvas, state.formato === 'folha' ? 'sheet' : 'small'));

  function linkCandidato() { return `${U.pageUrl()}#c=${U.encode(dadosCandidato())}`; }
  U.$('#btn-link').addEventListener('click', () => U.copy(linkCandidato()));

  U.$('#btn-add-mine').addEventListener('click', () => adicionarAMinha({ ...dadosCandidato(), urna: dadosCandidato().nome }));
  U.$('#btn-edit').addEventListener('click', () => {
    document.body.classList.remove('view-mode');
    history.replaceState(null, '', location.pathname);
  });
  if (!window.APP_MODE) window.addEventListener('hashchange', () => location.reload());

  /* ---------- dados do TSE ---------- */
  function aplicarTSE(c) {
    const set = (id, v) => { U.$('#' + id).value = v; };
    set('c-pid', c.pid || '');
    set('c-cargo', c.cargo);
    atualizarDicaNumero();
    set('c-num', c.num);
    set('c-nome', c.nome);
    set('c-partido', c.partido);
    set('c-ano', c.ano);
    set('c-cid', c.cid);
    set('c-legal', c.legal);
    const p = Partidos.get(c.pid);
    if (p) set('c-cor', p.cor);
    carregarLogoPartido();
    carregarFotoCandidato(c);
    render();
  }

  /* ---------- início ---------- */
  Partidos.fillSelect(U.$('#c-pid'), 'Outro');
  state.tse = TSE.mount(U.$('#tse-box'), {
    onSelect: c => (state.modo === 'eleitor' ? adicionarAMinha(c) : aplicarTSE(c)),
    onData: aoMudarDados,
  });
  Object.values(state.eleitor.votos).forEach(v => { pedirFoto(v); pedirLogo(v.pid); });

  const AP = window.APP_PARAMS || {};
  window.APP_PARAMS = {};
  const pidHash = AP.p || U.hashParam('p');
  let modoInicial = 'eleitor';
  if (pidHash && Partidos.get(pidHash)) {
    U.$('#c-pid').value = pidHash;
    aplicarPartido();
    modoInicial = 'candidato';
  }
  const shared = U.hashParam('c');
  if (shared) {
    const d = U.decode(shared);
    if (d && CARGOS[d.cargo]) {
      preencherCandidato(d);
      document.body.classList.add('view-mode');
      U.$('#view-title').textContent = `${d.nome || 'Candidato'} · ${d.num}`;
      document.title = `Colinha: ${d.nome} ${d.num}`;
      modoInicial = 'candidato';
    }
  }
  atualizarDicaNumero();
  setModo(modoInicial);
  const fontes = document.fonts ? Promise.race([
    Promise.all([500, 600, 700, 800].map(w => document.fonts.load(`${w} 40px Inter`))),
    new Promise(r => setTimeout(r, 2500)),
  ]).catch(() => {}) : Promise.resolve();
  fontes.then(render);
  U.fontsReady().then(render);
})();
