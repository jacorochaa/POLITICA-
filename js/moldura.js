'use strict';

(() => {
  const canvas = U.$('#preview');
  const ctx = canvas.getContext('2d');

  const state = {
    cfg: { t: 'faixa', nome: 'Maria da Saúde', cargo: 'vereador', num: '12345', partido: 'PARTIDO', slogan: '#EuApoio', cor: '#1d4ed8', cor2: '#facc15' },
    formato: 'perfil',
    photo: null,
    zoom: 1, ox: 0, oy: 0, rot: 0,
    custom: null,
  };

  const size = () => (state.formato === 'perfil' ? [1080, 1080] : [1080, 1920]);

  /* =====================================================
     Modelos de moldura — desenhados por cima da foto
     ===================================================== */
  const TEMPLATES = {
    /* Faixa inferior com nome + selo "VOTE 12345" (seguro p/ recorte redondo) */
    faixa(c, W, H, d) {
      const u = W / 1080;
      const tall = H > W;
      const on = U.textOn(d.cor);
      const cargo = CARGOS[d.cargo] || CARGOS.vereador;

      // borda
      c.lineWidth = 18 * u;
      c.strokeStyle = d.cor;
      c.strokeRect(9 * u, 9 * u, W - 18 * u, H - 18 * u);

      const bandH = (tall ? 430 : 300) * u;
      const top = H - bandH;
      const tilt = 46 * u;
      // faixa de destaque
      c.fillStyle = d.cor2;
      c.beginPath();
      c.moveTo(0, top + tilt - 24 * u); c.lineTo(W, top - 24 * u);
      c.lineTo(W, top + 4 * u); c.lineTo(0, top + tilt + 4 * u);
      c.closePath(); c.fill();
      // faixa principal
      const g = c.createLinearGradient(0, top, 0, H);
      g.addColorStop(0, d.cor);
      g.addColorStop(1, U.shade(d.cor, -0.35));
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(0, top + tilt); c.lineTo(W, top); c.lineTo(W, H); c.lineTo(0, H);
      c.closePath(); c.fill();

      // selo VOTE + número
      const pillH = 120 * u;
      c.font = U.font(800, 34 * u);
      const voteW = c.measureText('VOTE').width;
      c.font = U.font(900, 92 * u);
      const numW = c.measureText(d.num || '').width;
      const pillW = Math.min(W * 0.8, voteW + numW + 110 * u);
      const pillY = top - pillH * 0.75;
      const px = (W - pillW) / 2;
      c.save();
      c.shadowColor = 'rgba(0,0,0,.3)'; c.shadowBlur = 20 * u; c.shadowOffsetY = 6 * u;
      U.roundRect(c, px, pillY, pillW, pillH, pillH / 2);
      c.fillStyle = '#fff'; c.fill();
      c.restore();
      c.lineWidth = 8 * u; c.strokeStyle = d.cor2;
      U.roundRect(c, px, pillY, pillW, pillH, pillH / 2); c.stroke();
      c.textBaseline = 'middle'; c.textAlign = 'left';
      let x = px + 46 * u;
      c.fillStyle = U.textOn(d.cor) === '#111827' ? U.shade(d.cor, -0.55) : d.cor;
      c.font = U.font(800, 34 * u);
      c.fillText('VOTE', x, pillY + pillH / 2 + 2 * u);
      x += voteW + 18 * u;
      c.font = U.font(900, 92 * u);
      U.fitFont(c, d.num || '', px + pillW - 46 * u - x, 92 * u, 900);
      c.fillText(d.num || '', x, pillY + pillH / 2 + 6 * u);

      // nome e cargo
      c.textAlign = 'center';
      c.textBaseline = 'alphabetic';
      c.fillStyle = on;
      const nameY = pillY + pillH + (tall ? 130 : 105) * u;
      U.fitFont(c, d.nome, (tall ? 940 : 760) * u, (tall ? 96 : 80) * u, 900, 30 * u);
      c.fillText(d.nome, W / 2, nameY);
      c.globalAlpha = 0.92;
      const sub = cargo.nome + (d.partido ? ' · ' + d.partido : '');
      U.fitFont(c, sub.toUpperCase(), (tall ? 900 : 560) * u, 32 * u, 700, 16 * u);
      U.setSpacing(c, 3 * u);
      c.fillText(sub.toUpperCase(), W / 2, nameY + 52 * u);
      U.setSpacing(c, 0);
      c.globalAlpha = 1;

      // frase no topo
      if (d.slogan) slogan(c, W, d, (tall ? 90 : 52) * u, tall ? 900 * u : 460 * u, u);
    },

    /* Anel com texto curvo — ideal para foto de perfil */
    circulo(c, W, H, d) {
      const u = W / 1080;
      const tall = H > W;
      const cx = W / 2;
      const cy = tall ? H * 0.38 : H / 2;
      const R = (tall ? 400 : 418) * u;
      const ringW = tall ? 120 * u : (540 * u - R);
      const on = U.textOn(d.cor);
      const cargo = CARGOS[d.cargo] || CARGOS.vereador;

      // fundo fora do círculo
      c.save();
      c.beginPath();
      c.rect(0, 0, W, H);
      c.arc(cx, cy, R, 0, Math.PI * 2, true);
      const g = c.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, d.cor);
      g.addColorStop(1, U.shade(d.cor, -0.35));
      c.fillStyle = g;
      c.fill('evenodd');
      c.restore();

      // anéis
      c.lineWidth = 14 * u; c.strokeStyle = d.cor2;
      c.beginPath(); c.arc(cx, cy, R + 7 * u, 0, Math.PI * 2); c.stroke();
      c.lineWidth = 4 * u; c.strokeStyle = U.rgba(on === '#ffffff' ? '#ffffff' : '#111827', 0.5);
      c.beginPath(); c.arc(cx, cy, R + ringW - 14 * u, 0, Math.PI * 2); c.stroke();

      // texto curvo
      const tr = R + 14 * u + (ringW - 28 * u) / 2;
      c.fillStyle = on;
      U.setSpacing(c, 0);
      const topTxt = (d.nome || '').toUpperCase();
      let fs = 62 * u;
      c.font = U.font(900, fs);
      while (fs > 28 * u && c.measureText(topTxt).width > tr * Math.PI * 0.85) { fs -= 2; c.font = U.font(900, fs); }
      U.arcText(c, topTxt, cx, cy, tr, true);
      c.fillStyle = d.cor2;
      fs = 60 * u;
      const botTxt = `VOTE ${d.num || ''}`;
      c.font = U.font(900, fs);
      while (fs > 28 * u && c.measureText(botTxt).width > tr * Math.PI * 0.7) { fs -= 2; c.font = U.font(900, fs); }
      U.arcText(c, botTxt, cx, cy, tr, false);

      // estrelinhas nas laterais
      c.fillStyle = d.cor2;
      [Math.PI, 0].forEach(a => star(c, cx + tr * Math.cos(a), cy + tr * Math.sin(a), 18 * u));

      if (tall) {
        // bloco inferior nos stories
        let y = cy + R + ringW + 120 * u;
        c.textAlign = 'center'; c.textBaseline = 'alphabetic';
        c.fillStyle = on;
        U.fitFont(c, d.nome, 940 * u, 92 * u, 900, 30 * u);
        c.fillText(d.nome, cx, y);
        y += 60 * u;
        c.globalAlpha = 0.9;
        const sub = (cargo.nome + (d.partido ? ' · ' + d.partido : '')).toUpperCase();
        U.fitFont(c, sub, 900 * u, 34 * u, 700);
        c.fillText(sub, cx, y);
        c.globalAlpha = 1;
        y += 50 * u;
        const bh = 170 * u, bw = 560 * u;
        U.roundRect(c, cx - bw / 2, y, bw, bh, 30 * u);
        c.fillStyle = d.cor2; c.fill();
        c.fillStyle = U.textOn(d.cor2);
        c.textBaseline = 'middle';
        U.fitFont(c, d.num || '', bw - 60 * u, 130 * u, 900);
        c.fillText(d.num || '', cx, y + bh / 2 + 8 * u);
        if (d.slogan) {
          c.fillStyle = on;
          c.textBaseline = 'alphabetic';
          U.fitFont(c, d.slogan, 900 * u, 48 * u, 800);
          c.fillText(d.slogan, cx, y + bh + 100 * u);
        }
      }
    },

    /* Borda fina + selo redondo com o número */
    selo(c, W, H, d) {
      const u = W / 1080;
      const tall = H > W;
      const cargo = CARGOS[d.cargo] || CARGOS.vereador;
      c.lineWidth = 26 * u;
      c.strokeStyle = d.cor;
      c.strokeRect(13 * u, 13 * u, W - 26 * u, H - 26 * u);
      c.lineWidth = 6 * u;
      c.strokeStyle = d.cor2;
      c.strokeRect(36 * u, 36 * u, W - 72 * u, H - 72 * u);

      const r = 170 * u;
      const bx = tall ? W - 240 * u : W * 0.73;
      const by = tall ? H - 330 * u : H * 0.73;
      c.save();
      c.shadowColor = 'rgba(0,0,0,.35)'; c.shadowBlur = 30 * u; c.shadowOffsetY = 8 * u;
      c.beginPath(); c.arc(bx, by, r, 0, Math.PI * 2);
      c.fillStyle = d.cor; c.fill();
      c.restore();
      c.lineWidth = 10 * u; c.strokeStyle = d.cor2;
      c.beginPath(); c.arc(bx, by, r - 16 * u, 0, Math.PI * 2); c.stroke();

      const on = U.textOn(d.cor);
      c.fillStyle = on;
      c.font = U.font(800, 30 * u);
      U.setSpacing(c, 2 * u);
      U.arcText(c, 'EU VOTO', bx, by, r - 52 * u, true);
      U.setSpacing(c, 0);
      c.font = U.font(700, 22 * u);
      U.arcText(c, (cargo.nome).toUpperCase(), bx, by, r - 50 * u, false);
      c.textAlign = 'center'; c.textBaseline = 'middle';
      U.fitFont(c, d.num || '', r * 1.35, 96 * u, 900);
      c.fillText(d.num || '', bx, by + 6 * u);

      // nome numa etiqueta
      c.font = U.font(900, 50 * u);
      const label = d.nome || '';
      const maxLW = tall ? 640 * u : 380 * u;
      const fs = U.fitFont(c, label, maxLW, 50 * u, 900, 24 * u);
      const lw = c.measureText(label).width + 60 * u, lh = fs + 46 * u;
      const lx = tall ? 70 * u : 130 * u;
      const ly = tall ? H - 260 * u : H * 0.64;
      U.roundRect(c, lx, ly, lw, lh, 18 * u);
      c.fillStyle = '#fff'; c.fill();
      c.fillStyle = U.textOn(d.cor) === '#ffffff' ? d.cor : U.shade(d.cor, -0.55);
      c.textAlign = 'left'; c.textBaseline = 'middle';
      c.fillText(label, lx + 30 * u, ly + lh / 2 + 3 * u);
      if (d.partido) {
        U.roundRect(c, lx, ly + lh + 10 * u, Math.min(lw, 300 * u), 52 * u, 14 * u);
        c.fillStyle = d.cor2; c.fill();
        c.fillStyle = U.textOn(d.cor2);
        U.fitFont(c, d.partido, Math.min(lw, 300 * u) - 40 * u, 28 * u, 800);
        c.fillText(d.partido, lx + 20 * u, ly + lh + 36 * u + 2 * u);
      }
      if (d.slogan) slogan(c, W, d, (tall ? 90 : 76) * u, tall ? 900 * u : 520 * u, u);
    },

    /* Gradiente escuro embaixo, nome grande e número em destaque */
    moderno(c, W, H, d) {
      const u = W / 1080;
      const tall = H > W;
      const cargo = CARGOS[d.cargo] || CARGOS.vereador;
      const gh = H * (tall ? 0.5 : 0.6);
      const g = c.createLinearGradient(0, H - gh, 0, H);
      g.addColorStop(0, U.rgba(d.cor, 0));
      g.addColorStop(0.55, U.rgba(U.shade(d.cor, -0.4), 0.85));
      g.addColorStop(1, U.rgba(U.shade(d.cor, -0.6), 0.98));
      c.fillStyle = g;
      c.fillRect(0, H - gh, W, gh);

      // fitas no canto superior direito
      c.save();
      c.translate(W, 0);
      c.rotate(Math.PI / 4);
      c.fillStyle = d.cor;
      c.fillRect(-W, 150 * u, W * 2, 78 * u);
      c.fillStyle = d.cor2;
      c.fillRect(-W, 238 * u, W * 2, 16 * u);
      if (d.slogan) {
        c.fillStyle = U.textOn(d.cor);
        c.textAlign = 'center'; c.textBaseline = 'middle';
        U.fitFont(c, d.slogan.toUpperCase(), 300 * u, 34 * u, 900, 16 * u);
        c.fillText(d.slogan.toUpperCase(), 0, 189 * u + 2 * u);
      }
      c.restore();

      const left = (tall ? 80 : 140) * u;
      const maxW = W - left * 2;
      let y = H - (tall ? 260 : 170) * u;
      // número
      c.textAlign = 'left'; c.textBaseline = 'alphabetic';
      c.fillStyle = '#fff';
      c.font = U.font(800, 36 * u);
      U.setSpacing(c, 6 * u);
      c.fillText('VOTE', left, y - (tall ? 150 : 120) * u);
      U.setSpacing(c, 0);
      c.fillStyle = d.cor2;
      U.fitFont(c, d.num || '', maxW, (tall ? 190 : 150) * u, 900);
      c.fillText(d.num || '', left - 6 * u, y);
      // nome
      y = y - (tall ? 230 : 190) * u;
      c.fillStyle = '#fff';
      U.fitFont(c, d.nome, maxW, (tall ? 96 : 76) * u, 900, 30 * u);
      c.fillText(d.nome, left, y);
      // cargo
      c.globalAlpha = 0.9;
      const sub = (cargo.nome + (d.partido ? ' · ' + d.partido : '')).toUpperCase();
      U.fitFont(c, sub, maxW, 30 * u, 700);
      c.fillText(sub, left, H - (tall ? 200 : 115) * u);
      c.globalAlpha = 1;
      // barra lateral
      c.fillStyle = d.cor2;
      c.fillRect(left - 34 * u, y - 70 * u, 12 * u, H - (tall ? 200 : 115) * u - (y - 70 * u));
    },

    custom(c, W, H) {
      if (state.custom) U.drawCover(c, state.custom, 0, 0, W, H);
      else {
        c.fillStyle = 'rgba(17,24,39,.55)';
        c.fillRect(0, H / 2 - 60, W, 120);
        c.fillStyle = '#fff';
        c.font = U.font(800, 40);
        c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText('Envie a sua arte em PNG', W / 2, H / 2);
      }
    },
  };

  /** etiqueta com a frase/hashtag, centralizada no topo */
  function slogan(c, W, d, y, maxW, u) {
    c.textAlign = 'center'; c.textBaseline = 'middle';
    const fs = U.fitFont(c, d.slogan, maxW - 60 * u, 40 * u, 800, 18 * u);
    const w = c.measureText(d.slogan).width + 60 * u, h = fs + 36 * u;
    U.roundRect(c, (W - w) / 2, y, w, h, h / 2);
    c.fillStyle = d.cor2; c.fill();
    c.fillStyle = U.textOn(d.cor2);
    c.fillText(d.slogan, W / 2, y + h / 2 + 2 * u);
  }

  function star(c, x, y, r) {
    c.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 5;
      const rr = i % 2 ? r * 0.45 : r;
      c.lineTo(x + rr * Math.cos(a), y + rr * Math.sin(a));
    }
    c.closePath();
    c.fill();
  }

  /** onde o rosto deve ficar em cada modelo (para centralizar a foto) */
  function focusY(W, H) {
    if (state.cfg.t === 'circulo' && H > W) return H * 0.38 - H / 2;
    if (state.cfg.t === 'faixa' || state.cfg.t === 'moderno') return -(H > W ? 160 : 90);
    return 0;
  }

  /* =====================================================
     Render
     ===================================================== */
  function drawPhoto(c, W, H) {
    const img = state.photo;
    if (!img) {
      const g = c.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#d7dbe8'); g.addColorStop(1, '#aeb4c7');
      c.fillStyle = g;
      c.fillRect(0, 0, W, H);
      // silhueta
      const cx = W / 2, cy = H / 2 + focusY(W, H), s = Math.min(W, H) / 1080;
      c.fillStyle = '#eef0f6';
      c.beginPath(); c.arc(cx, cy - 90 * s, 150 * s, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.ellipse(cx, cy + 300 * s, 320 * s, 240 * s, 0, Math.PI, 0); c.fill();
      return;
    }
    const base = Math.max(W / img.width, H / img.height);
    const s = base * state.zoom;
    c.save();
    c.translate(W / 2 + state.ox, H / 2 + state.oy);
    c.rotate(state.rot * Math.PI / 180);
    c.drawImage(img, -img.width * s / 2, -img.height * s / 2, img.width * s, img.height * s);
    c.restore();
  }

  let raf = 0;
  function render() {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      const [W, H] = size();
      canvas.width = W;
      canvas.height = H;
      ctx.clearRect(0, 0, W, H);
      drawPhoto(ctx, W, H);
      (TEMPLATES[state.cfg.t] || TEMPLATES.faixa)(ctx, W, H, state.cfg);
      canvas.classList.toggle('round', state.formato === 'perfil' && U.$('#m-round').checked);
    });
  }

  /* =====================================================
     Configuração (lado do candidato)
     ===================================================== */
  function lerForm() {
    const v = id => (U.$('#' + id).value || '').trim();
    const cargo = v('m-cargo');
    state.cfg = {
      t: state.cfg.t,
      nome: v('m-nome'),
      cargo,
      num: U.onlyDigits(v('m-num'), CARGOS[cargo].digitos),
      partido: v('m-partido'),
      slogan: v('m-slogan'),
      cor: U.$('#m-cor').value,
      cor2: U.$('#m-cor2').value,
    };
  }

  function preencherForm(cfg) {
    const set = (id, val) => { if (val !== undefined) U.$('#' + id).value = val; };
    set('m-nome', cfg.nome); set('m-num', cfg.num); set('m-partido', cfg.partido);
    set('m-slogan', cfg.slogan);
    if (CARGOS[cfg.cargo]) set('m-cargo', cfg.cargo);
    if (/^#[0-9a-f]{6}$/i.test(cfg.cor || '')) set('m-cor', cfg.cor);
    if (/^#[0-9a-f]{6}$/i.test(cfg.cor2 || '')) set('m-cor2', cfg.cor2);
    setTemplate(cfg.t);
  }

  function setTemplate(t) {
    if (!TEMPLATES[t]) t = 'faixa';
    state.cfg.t = t;
    U.$$('.tpl').forEach(b => b.classList.toggle('active', b.dataset.t === t));
    U.$('#custom-box').classList.toggle('hidden', t !== 'custom');
    U.$('#fields-box').classList.toggle('hidden', t === 'custom');
    if (state.photo) resetPhoto(false);
    render();
  }

  U.$$('.tpl').forEach(b => b.addEventListener('click', () => setTemplate(b.dataset.t)));
  U.$('#form-moldura').addEventListener('input', e => {
    if (e.target.id === 'm-num') e.target.value = U.onlyDigits(e.target.value, CARGOS[U.$('#m-cargo').value].digitos);
    lerForm();
    render();
  });
  U.$('#m-cargo').addEventListener('change', () => {
    const inp = U.$('#m-num');
    inp.maxLength = CARGOS[U.$('#m-cargo').value].digitos;
    inp.value = U.onlyDigits(inp.value, inp.maxLength);
    lerForm();
    render();
  });
  U.$$('#combos .swatch').forEach(s => s.addEventListener('click', () => {
    const [a, b] = s.dataset.c.split(',');
    U.$('#m-cor').value = a;
    U.$('#m-cor2').value = b;
    lerForm();
    render();
  }));
  U.$('#m-custom').addEventListener('change', async e => {
    try { state.custom = e.target.files[0] ? await U.loadImage(e.target.files[0]) : null; } catch (err) { U.toast(err.message); }
    render();
  });

  U.$('#btn-link').addEventListener('click', () => {
    if (state.cfg.t === 'custom') {
      U.toast('Arte própria não cabe no link: envie o PNG para os apoiadores ou escolha um modelo.');
      return;
    }
    lerForm();
    U.copy(`${U.pageUrl()}#m=${U.encode(state.cfg)}`);
  });

  /* =====================================================
     Foto do apoiador: enviar, arrastar, zoom, girar
     ===================================================== */
  function resetPhoto(rerender = true) {
    const [W, H] = size();
    state.zoom = 1; state.rot = 0; state.ox = 0;
    state.oy = 0;
    if (state.photo) {
      // só desloca se a foto for maior que a tela nessa direção
      const base = Math.max(W / state.photo.width, H / state.photo.height);
      const ph = state.photo.height * base;
      const want = focusY(W, H) * 0.6;
      state.oy = Math.max(-(ph - H) / 2, Math.min((ph - H) / 2, want));
    }
    U.$('#m-zoom').value = 1;
    U.$('#m-rot').value = 0;
    if (rerender) render();
  }

  U.$('#m-foto').addEventListener('change', async e => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      state.photo = await U.loadImage(f);
      U.$('#panel-foto').classList.remove('hidden');
      U.$('#btn-foto').textContent = '📷 Trocar foto';
      canvas.classList.add('draggable');
      resetPhoto();
    } catch (err) { U.toast(err.message); }
  });
  U.$('#m-zoom').addEventListener('input', e => { state.zoom = +e.target.value; render(); });
  U.$('#m-rot').addEventListener('input', e => { state.rot = +e.target.value; render(); });
  U.$('#btn-reset').addEventListener('click', () => resetPhoto());

  const pointers = new Map();
  let pinch = null;
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  canvas.addEventListener('pointerdown', e => {
    if (!state.photo) return;
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = { d: dist(a, b), zoom: state.zoom };
    }
  });
  canvas.addEventListener('pointermove', e => {
    if (!pointers.has(e.pointerId)) return;
    const prev = pointers.get(e.pointerId);
    const cur = { x: e.clientX, y: e.clientY };
    pointers.set(e.pointerId, cur);
    if (pointers.size === 1) {
      const ratio = canvas.width / canvas.getBoundingClientRect().width;
      state.ox += (cur.x - prev.x) * ratio;
      state.oy += (cur.y - prev.y) * ratio;
    } else if (pointers.size === 2 && pinch) {
      const [a, b] = [...pointers.values()];
      state.zoom = Math.min(4, Math.max(1, pinch.zoom * dist(a, b) / pinch.d));
      U.$('#m-zoom').value = state.zoom;
    }
    render();
  });
  const endPointer = e => { pointers.delete(e.pointerId); if (pointers.size < 2) pinch = null; };
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  canvas.addEventListener('wheel', e => {
    if (!state.photo) return;
    e.preventDefault();
    state.zoom = Math.min(4, Math.max(1, state.zoom * Math.exp(-e.deltaY * 0.0015)));
    U.$('#m-zoom').value = state.zoom;
    render();
  }, { passive: false });

  /* =====================================================
     Formato, download, compartilhar
     ===================================================== */
  U.$$('#formatos button').forEach(b => b.addEventListener('click', () => {
    state.formato = b.dataset.f;
    U.$$('#formatos button').forEach(x => x.classList.toggle('active', x === b));
    U.$('#round-toggle').classList.toggle('hidden', state.formato !== 'perfil');
    if (state.photo) resetPhoto(false);
    render();
  }));
  U.$('#m-round').addEventListener('change', render);

  const fileName = () => `moldura-${U.slug(state.cfg.nome)}-${state.formato}.png`;
  U.$('#btn-download').addEventListener('click', () => {
    if (!state.photo) U.toast('Dica: escolha sua foto antes de baixar 😉');
    U.download(canvas, fileName());
  });
  U.$('#btn-share').addEventListener('click', () => {
    const link = state.cfg.t !== 'custom' ? ` ${U.pageUrl()}#m=${U.encode(state.cfg)}` : '';
    U.share(canvas, fileName(), `Eu apoio ${state.cfg.nome} ${state.cfg.num}! Faça a sua:${link}`);
  });

  U.$('#btn-create-own').addEventListener('click', e => {
    e.preventDefault();
    location.href = location.pathname;
  });
  window.addEventListener('hashchange', () => location.reload());

  /* ---------- início ---------- */
  const shared = U.hashParam('m');
  if (shared) {
    const cfg = U.decode(shared);
    if (cfg && TEMPLATES[cfg.t] && cfg.t !== 'custom') {
      preencherForm(cfg);
      lerForm();
      document.body.classList.add('view-mode');
      U.$('#view-title').textContent = `Moldura de apoio: ${cfg.nome} ${cfg.num || ''}`;
      document.title = `Moldura: ${cfg.nome} ${cfg.num || ''}`;
    }
  }
  lerForm();
  render();
  U.fontsReady().then(render);
})();
