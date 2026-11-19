'use strict';

(() => {
  const canvas = U.$('#preview');
  const ctx = canvas.getContext('2d');
  const formC = U.$('#form-candidato');
  const BRAND = '#4f46e5';

  const state = {
    modo: 'candidato',          // 'candidato' | 'eleitor'
    formato: 'feed',            // 'feed' | 'stories' | 'folha'
    foto: null,
    logoCustom: null,           // logo enviada pelo usuário
    logoPartido: null,          // logo do site (img/partidos)
    eleitor: U.store.get('colinha-eleitor', {
      eleicao: 'municipal', ano: '2028', df: false, sen2: false, votos: {},
    }),
  };

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
    };
  }

  function preencherCandidato(d) {
    const set = (id, val) => { if (val !== undefined && val !== null) U.$('#' + id).value = val; };
    if (d.cargo && CARGOS[d.cargo]) set('c-cargo', d.cargo);
    if (d.pid && Partidos.get(d.pid)) { set('c-pid', d.pid); carregarLogoPartido(); }
    if (d.lg !== undefined) U.$('#c-showlogo').checked = !!d.lg;
    set('c-nome', d.nome); set('c-num', d.num); set('c-partido', d.partido);
    set('c-ano', d.ano); set('c-cid', d.cid); set('c-slogan', d.slogan);
    set('c-legal', d.legal);
    if (/^#[0-9a-f]{6}$/i.test(d.cor || '')) set('c-cor', d.cor);
    atualizarDicaNumero();
  }

  function atualizarDicaNumero() {
    const cargo = CARGOS[U.$('#c-cargo').value];
    const inp = U.$('#c-num');
    inp.maxLength = cargo.digitos;
    inp.value = U.onlyDigits(inp.value, cargo.digitos);
    U.$('#c-num-hint').textContent = `${cargo.digitos} dígitos`;
  }

  /* ---------- partido ---------- */
  function partidoAtual() { return Partidos.get(U.$('#c-pid').value); }

  /** logo a desenhar (enviada > do site > selo com sigla) ou null se desligada */
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

  /* =====================================================
     Desenho — colinha do candidato (feed / stories)
     ===================================================== */
  function drawCandidato(c, W, H, d) {
    const cargo = CARGOS[d.cargo];
    const cor = d.cor;
    const onCor = U.textOn(cor);
    const corTxt = onCor === '#111827' ? U.shade(cor, -0.55) : cor;
    const tall = H / W > 1.5;

    // fundo
    const g = c.createLinearGradient(0, 0, W * 0.4, H);
    g.addColorStop(0, U.shade(cor, 0.06));
    g.addColorStop(1, U.shade(cor, -0.42));
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);
    c.save();
    c.globalAlpha = 0.09;
    c.fillStyle = '#fff';
    c.beginPath(); c.arc(W * 0.96, H * 0.04, W * 0.36, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(W * 0.02, H * 0.98, W * 0.3, 0, Math.PI * 2); c.fill();
    c.restore();

    // cabeçalho
    const top = tall ? 150 : 70;
    c.textAlign = 'center';
    c.textBaseline = 'alphabetic';
    c.fillStyle = onCor;
    U.setSpacing(c, 10);
    c.font = U.font(900, tall ? 58 : 50);
    c.fillText('COLINHA', W / 2, top + 50);
    U.setSpacing(c, 0);
    c.globalAlpha = 0.9;
    U.fitFont(c, `Eleições ${d.ano || ''}${d.cid ? ' · ' + d.cid : ''}`, W - 160, 30, 600);
    c.fillText(`Eleições ${d.ano || ''}${d.cid ? ' · ' + d.cid : ''}`, W / 2, top + 96);
    c.globalAlpha = 1;

    // cartão branco
    const footerH = tall ? 300 : 170;
    const cardX = 60, cardW = W - 120;
    const cardY = top + 135;
    const cardH = H - cardY - footerH;
    c.save();
    c.shadowColor = 'rgba(0,0,0,.28)';
    c.shadowBlur = 40;
    c.shadowOffsetY = 16;
    U.roundRect(c, cardX, cardY, cardW, cardH, 46);
    c.fillStyle = '#fff';
    c.fill();
    c.restore();

    // medidas dos blocos
    const inner = cardW - 100;
    const n = cargo.digitos;
    const gap = n >= 5 ? 16 : 22;
    const boxW = Math.min(tall ? 170 : 150, (inner - gap * (n - 1)) / n);
    const boxH = boxW * 1.3;
    const photoD = state.foto ? (tall ? 360 : 250) : 0;
    const nome = d.nome || 'Nome do candidato';
    const nameSize = U.fitFont(c, nome, inner, tall ? 104 : 88, 900, 40);

    const H_photo = photoD ? photoD + 40 : 0;
    const H_name = nameSize * 1.02;
    const H_cargo = 64;
    const H_label = 74;
    const H_boxes = boxH + 40;
    const H_conf = 72 + (d.partido ? 44 : 0);
    const logo = logoInfo(d);
    const logoH = logo ? (tall ? 130 : 96) : 0;
    const H_part = (d.partido ? 46 : 0) + (logo ? logoH + 20 : 0);
    const total = H_photo + H_name + H_cargo + H_label + H_boxes + H_conf + H_part;
    let y = cardY + Math.max(40, (cardH - total) / 2);
    const cx = W / 2;

    // foto
    if (photoD) {
      c.save();
      c.beginPath();
      c.arc(cx, y + photoD / 2, photoD / 2, 0, Math.PI * 2);
      c.clip();
      U.drawCover(c, state.foto, cx - photoD / 2, y, photoD, photoD);
      c.restore();
      c.lineWidth = 12;
      c.strokeStyle = cor;
      c.beginPath();
      c.arc(cx, y + photoD / 2, photoD / 2, 0, Math.PI * 2);
      c.stroke();
      y += H_photo;
    }

    // nome
    c.fillStyle = '#111827';
    c.textAlign = 'center';
    c.textBaseline = 'alphabetic';
    c.font = U.font(900, nameSize);
    c.fillText(nome, cx, y + nameSize * 0.82);
    y += H_name;

    // cargo
    c.fillStyle = corTxt;
    U.setSpacing(c, 4);
    U.fitFont(c, cargo.nome.toUpperCase(), inner, 38, 800);
    c.fillText(cargo.nome.toUpperCase(), cx, y + 42);
    U.setSpacing(c, 0);
    y += H_cargo;

    // instrução
    c.fillStyle = '#6b7280';
    c.font = U.font(600, 32);
    c.fillText('Na urna, digite:', cx, y + 46);
    y += H_label;

    // caixinhas
    U.digitBoxes(c, d.num, n, cx, y, boxW, boxH, gap, { bg: '#f9fafb', border: '#111827', color: '#111827' });
    y += H_boxes;

    // e aperte CONFIRMA
    c.font = U.font(600, 30);
    const pre = 'e aperte';
    const preW = c.measureText(pre).width;
    const btnW = 270, btnH = 66, sp = 18;
    const startX = cx - (preW + sp + btnW) / 2;
    c.textAlign = 'left';
    c.textBaseline = 'middle';
    c.fillStyle = '#6b7280';
    c.fillText(pre, startX, y + btnH / 2);
    U.roundRect(c, startX + preW + sp, y, btnW, btnH, 14);
    c.fillStyle = '#16a34a';
    c.fill();
    c.fillStyle = '#fff';
    c.font = U.font(900, 30);
    c.textAlign = 'center';
    c.fillText('CONFIRMA', startX + preW + sp + btnW / 2, y + btnH / 2 + 2);
    y += H_conf;

    // partido (logo + sigla)
    if (logo) {
      const lw = logo.img ? Math.min(inner, logoH * Math.max(1, logo.img.width / logo.img.height)) : logoH;
      Partidos.draw(c, logo.img, logo.p, cx - lw / 2, y - 14, lw, logoH);
      y += logoH + 20;
    }
    if (d.partido) {
      c.textAlign = 'center';
      c.textBaseline = 'alphabetic';
      c.fillStyle = '#374151';
      U.fitFont(c, d.partido, inner, 34, 800);
      c.fillText(d.partido, cx, y + 10);
    }

    // rodapé
    c.textAlign = 'center';
    c.textBaseline = 'alphabetic';
    c.fillStyle = onCor;
    const fy = cardY + cardH;
    if (d.slogan) {
      U.fitFont(c, d.slogan, W - 140, tall ? 50 : 42, 800);
      c.fillText(d.slogan, cx, fy + (tall ? 110 : 78));
    }
    if (d.legal) {
      c.globalAlpha = 0.85;
      drawWrapped(c, d.legal, cx, H - (tall ? 70 : 48), W - 140, 22, 500, 2);
      c.globalAlpha = 1;
    }
  }

  /** texto pequeno em até `maxLines` linhas, ancorado pela última linha em `yBottom` */
  function drawWrapped(c, text, cx, yBottom, maxW, size, weight, maxLines) {
    c.font = U.font(weight, size);
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
    // linhas de corte
    c.save();
    c.setLineDash([18, 14]);
    c.strokeStyle = '#9ca3af';
    c.lineWidth = 3;
    for (let k = 0; k <= cols; k++) { c.beginPath(); c.moveTo(m + k * cw, m - 30); c.lineTo(m + k * cw, H - m + 30); c.stroke(); }
    for (let r = 0; r <= rows; r++) { c.beginPath(); c.moveTo(m - 30, m + r * ch); c.lineTo(W - m + 30, m + r * ch); c.stroke(); }
    c.restore();
  }

  function drawMini(c, x, y, w, h, d) {
    const cargo = CARGOS[d.cargo];
    const cor = d.cor;
    const corTxt = U.textOn(cor) === '#111827' ? U.shade(cor, -0.55) : cor;
    const pad = 70;
    c.fillStyle = cor;
    c.fillRect(x, y, 34, h);
    const cx = x + 17 + w / 2;
    const inner = w - pad * 2;
    c.textAlign = 'center';
    c.textBaseline = 'alphabetic';

    c.fillStyle = '#6b7280';
    U.setSpacing(c, 6);
    c.font = U.font(800, 30);
    U.fitFont(c, `COLINHA · ELEIÇÕES ${d.ano || ''}`, inner - 300, 30, 800);
    c.fillText(`COLINHA · ELEIÇÕES ${d.ano || ''}`, cx, y + 70);
    U.setSpacing(c, 0);

    c.fillStyle = '#111827';
    const ns = U.fitFont(c, d.nome || 'Nome do candidato', inner, 78, 900, 34);
    c.fillText(d.nome || 'Nome do candidato', cx, y + 90 + ns * 0.9);

    c.fillStyle = corTxt;
    U.fitFont(c, cargo.nome.toUpperCase() + (d.partido ? ' · ' + d.partido : ''), inner, 38, 800);
    c.fillText(cargo.nome.toUpperCase() + (d.partido ? ' · ' + d.partido : ''), cx, y + 236);

    const n = cargo.digitos, gap = 18;
    const bw = Math.min(118, (inner - gap * (n - 1)) / n), bh = bw * 1.25;
    U.digitBoxes(c, d.num, n, cx, y + 270, bw, bh, gap, { bg: '#fff', border: '#111827' });

    c.fillStyle = '#374151';
    c.font = U.font(700, 32);
    c.fillText('Digite o número e aperte CONFIRMA', cx, y + 270 + bh + 62);

    const logo = logoInfo(d);
    if (logo) Partidos.draw(c, logo.img, logo.p, x + w - 150, y + 24, 120, 90);

    if (d.legal) {
      c.fillStyle = '#6b7280';
      U.fitFont(c, d.legal, inner, 22, 500, 14);
      c.fillText(d.legal, cx, y + h - 34);
    }
  }

  /* =====================================================
     Desenho — colinha do eleitor
     ===================================================== */
  function linhasEleitor() {
    const e = state.eleitor;
    if (e.eleicao === 'municipal') {
      return [
        { key: 'vereador', ...CARGOS.vereador },
        { key: 'prefeito', ...CARGOS.prefeito },
      ];
    }
    const L = [
      { key: 'dep_federal', ...CARGOS.dep_federal },
      e.df ? { key: 'dep_distrital', ...CARGOS.dep_distrital } : { key: 'dep_estadual', ...CARGOS.dep_estadual },
      { key: 'senador', ...CARGOS.senador, nome: e.sen2 ? '1º Senador(a)' : 'Senador(a)' },
    ];
    if (e.sen2) L.push({ key: 'senador2', ...CARGOS.senador, nome: '2º Senador(a)' });
    L.push({ key: 'governador', ...CARGOS.governador });
    L.push({ key: 'presidente', ...CARGOS.presidente });
    return L;
  }

  function alturaEleitor() {
    return 300 + linhasEleitor().length * 176 + 190;
  }

  function drawEleitor(c, W, H) {
    const e = state.eleitor;
    const rows = linhasEleitor();
    c.fillStyle = '#fff';
    c.fillRect(0, 0, W, H);

    const tall = H / W > 1.5;
    const headH = tall ? 420 : 260;
    const g = c.createLinearGradient(0, 0, W, headH);
    g.addColorStop(0, BRAND);
    g.addColorStop(1, '#7c3aed');
    c.fillStyle = g;
    c.fillRect(0, 0, W, headH);

    c.fillStyle = '#fff';
    c.textAlign = 'center';
    c.textBaseline = 'alphabetic';
    U.setSpacing(c, 8);
    c.font = U.font(900, 66);
    c.fillText('MINHA COLINHA', W / 2, headH - 130);
    U.setSpacing(c, 0);
    c.font = U.font(600, 30);
    c.globalAlpha = 0.92;
    c.fillText(`Eleições ${e.ano || ''} · na ordem da urna`, W / 2, headH - 75);
    c.globalAlpha = 1;

    const rowH = 176;
    const footH = 190;
    const avail = H - headH - footH;
    let y = headH + Math.max(40, (avail - rows.length * rowH) / 2);

    rows.forEach((r, i) => {
      const v = e.votos[r.key] || {};
      const x = 50, w = W - 100, h = rowH - 26;
      U.roundRect(c, x, y, w, h, 26);
      c.fillStyle = '#f3f4f8';
      c.fill();

      // número da etapa
      c.fillStyle = BRAND;
      c.beginPath();
      c.arc(x + 58, y + h / 2, 30, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#fff';
      c.font = U.font(900, 30);
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(String(i + 1), x + 58, y + h / 2 + 1);

      // caixinhas (direita)
      const bw = 74, gap = 10, bh = 96;
      const boxesW = r.digitos * bw + (r.digitos - 1) * gap;
      const bcx = x + w - 30 - boxesW / 2;
      U.digitBoxes(c, v.num, r.digitos, bcx, y + (h - bh) / 2, bw, bh, gap, { bg: '#fff', border: '#111827' });

      // textos (esquerda)
      const tx = x + 110;
      const tw = (bcx - boxesW / 2) - tx - 24;
      c.textAlign = 'left';
      c.textBaseline = 'alphabetic';
      c.fillStyle = '#111827';
      U.fitFont(c, r.nome, tw, 38, 800, 22);
      c.fillText(r.nome, tx, y + h / 2 - 4);
      c.fillStyle = v.nome ? '#4b5563' : '#9ca3af';
      const sub = v.nome || `${r.digitos} dígitos`;
      U.fitFont(c, sub, tw, 28, 600, 18);
      c.fillText(sub, tx, y + h / 2 + 38);

      y += rowH;
    });

    // rodapé
    c.textAlign = 'center';
    c.textBaseline = 'alphabetic';
    c.fillStyle = '#111827';
    c.font = U.font(800, 32);
    c.fillText('Digite o número e aperte CONFIRMA', W / 2, H - 110);
    c.fillStyle = '#6b7280';
    c.font = U.font(600, 24);
    c.fillText('Celular não é permitido na cabine: leve esta colinha impressa.', W / 2, H - 62);
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
      for (let k = 0; k < 2; k++) {
        c.drawImage(off, m + k * cw + (cw - dw) / 2, m + r * ch + (ch - dh) / 2, dw, dh);
      }
    }
    c.save();
    c.setLineDash([18, 14]);
    c.strokeStyle = '#9ca3af';
    c.lineWidth = 3;
    c.beginPath(); c.moveTo(W / 2, m - 30); c.lineTo(W / 2, H - m + 30); c.stroke();
    c.beginPath(); c.moveTo(m - 30, H / 2); c.lineTo(W - m + 30, H / 2); c.stroke();
    c.restore();
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

      if (state.modo === 'candidato') {
        const d = dadosCandidato();
        if (f === 'folha') drawFolhaCandidato(ctx, W, H, d);
        else drawCandidato(ctx, W, H, d);
      } else if (f === 'folha') {
        drawFolhaEleitor(ctx, W, H);
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
     Formulário do eleitor
     ===================================================== */
  function salvarEleitor() {
    U.store.set('colinha-eleitor', state.eleitor);
  }

  function montarFormEleitor() {
    const e = state.eleitor;
    U.$('#e-eleicao').value = e.eleicao;
    U.$('#e-ano').value = e.ano;
    U.$('#e-df').checked = !!e.df;
    U.$('#e-sen2').checked = !!e.sen2;
    U.$('#e-opts-geral').classList.toggle('hidden', e.eleicao !== 'geral');

    const box = U.$('#e-rows');
    box.innerHTML = '';
    linhasEleitor().forEach((r, i) => {
      const v = e.votos[r.key] || {};
      const div = document.createElement('div');
      div.className = 'voter-row';
      div.innerHTML = `
        <div class="title"><span>${i + 1}. ${r.nome}</span><small>${r.digitos} dígitos</small></div>
        <input type="tel" inputmode="numeric" class="num" maxlength="${r.digitos}" placeholder="${'_'.repeat(r.digitos)}" aria-label="Número para ${r.nome}">
        <input type="text" maxlength="40" placeholder="Nome (opcional)" aria-label="Nome do candidato para ${r.nome}">`;
      const [num, nome] = U.$$('input', div);
      num.value = v.num || '';
      nome.value = v.nome || '';
      const upd = () => {
        num.value = U.onlyDigits(num.value, r.digitos);
        e.votos[r.key] = { num: num.value, nome: nome.value.trim() };
        salvarEleitor();
        render();
      };
      num.addEventListener('input', upd);
      nome.addEventListener('input', upd);
      box.appendChild(div);
    });
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
    e.votos[key] = { num: d.num, nome: d.nome };
    salvarEleitor();
    setModo('eleitor');
    U.toast(`${d.nome || 'Candidato'} adicionado(a) à sua colinha ✔`);
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

  formC.addEventListener('input', e => {
    if (e.target.id === 'c-num') e.target.value = U.onlyDigits(e.target.value, CARGOS[U.$('#c-cargo').value].digitos);
    if (e.target.id === 'c-ano') e.target.value = U.onlyDigits(e.target.value, 4);
    render();
  });
  U.$('#c-cargo').addEventListener('change', () => {
    atualizarDicaNumero();
    const p = partidoAtual();
    if (p) U.$('#c-num').value = Partidos.numeroComPrefixo(U.$('#c-num').value, p, CARGOS[U.$('#c-cargo').value].digitos);
    render();
  });
  U.$('#c-pid').addEventListener('change', aplicarPartido);
  U.$('#c-logo').addEventListener('change', async e => {
    try { state.logoCustom = e.target.files[0] ? await U.loadImage(e.target.files[0]) : null; } catch (err) { U.toast(err.message); }
    render();
  });
  U.$$('.swatch').forEach(s => s.addEventListener('click', () => {
    U.$('#c-cor').value = s.dataset.color;
    render();
  }));
  U.$('#c-foto').addEventListener('change', async e => {
    try {
      state.foto = e.target.files[0] ? await U.loadImage(e.target.files[0]) : null;
    } catch (err) { U.toast(err.message); }
    render();
  });

  U.$('#e-eleicao').addEventListener('change', e => { state.eleitor.eleicao = e.target.value; salvarEleitor(); montarFormEleitor(); render(); });
  U.$('#e-ano').addEventListener('input', e => { e.target.value = U.onlyDigits(e.target.value, 4); state.eleitor.ano = e.target.value; salvarEleitor(); render(); });
  U.$('#e-df').addEventListener('change', e => { state.eleitor.df = e.target.checked; salvarEleitor(); montarFormEleitor(); render(); });
  U.$('#e-sen2').addEventListener('change', e => { state.eleitor.sen2 = e.target.checked; salvarEleitor(); montarFormEleitor(); render(); });

  U.$('#btn-download').addEventListener('click', () => U.download(canvas, nomeArquivo()));
  U.$('#btn-share').addEventListener('click', () => {
    const d = dadosCandidato();
    const txt = state.modo === 'candidato'
      ? `Na urna, ${d.nome}: ${d.num} ✅ ${linkCandidato()}`
      : 'Minha colinha para o dia da eleição ✅';
    U.share(canvas, nomeArquivo(), txt);
  });
  U.$('#btn-print').addEventListener('click', () => U.printCanvas(canvas, state.formato === 'folha' ? 'sheet' : 'small'));

  function linkCandidato() {
    const d = dadosCandidato();
    return `${U.pageUrl()}#c=${U.encode(d)}`;
  }
  U.$('#btn-link').addEventListener('click', () => U.copy(linkCandidato()));

  U.$('#btn-add-mine').addEventListener('click', () => adicionarAMinha(dadosCandidato()));
  U.$('#btn-edit').addEventListener('click', () => {
    document.body.classList.remove('view-mode');
    history.replaceState(null, '', location.pathname);
  });
  window.addEventListener('hashchange', () => location.reload());

  /* ---------- início ---------- */
  Partidos.fillSelect(U.$('#c-pid'));
  const pidHash = U.hashParam('p');
  if (pidHash && Partidos.get(pidHash)) {
    U.$('#c-pid').value = pidHash;
    aplicarPartido();
  }
  const shared = U.hashParam('c');
  if (shared) {
    const d = U.decode(shared);
    if (d && CARGOS[d.cargo]) {
      preencherCandidato(d);
      document.body.classList.add('view-mode');
      U.$('#view-title').textContent = `Colinha de ${d.nome || 'candidato'} · ${d.num}`;
      document.title = `Colinha: ${d.nome} ${d.num}`;
    }
  }
  atualizarDicaNumero();
  render();
  U.fontsReady().then(render);
})();
