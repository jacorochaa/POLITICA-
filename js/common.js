'use strict';

/* ==========================================================
   Utilidades compartilhadas — Colinha & Moldura
   Tudo roda no navegador: nenhuma foto é enviada a servidores.
   ========================================================== */

const CARGOS = {
  vereador:      { nome: 'Vereador(a)',           digitos: 5, eleicao: 'municipal' },
  prefeito:      { nome: 'Prefeito(a)',           digitos: 2, eleicao: 'municipal' },
  dep_federal:   { nome: 'Deputado(a) Federal',   digitos: 4, eleicao: 'geral' },
  dep_estadual:  { nome: 'Deputado(a) Estadual',  digitos: 5, eleicao: 'geral' },
  dep_distrital: { nome: 'Deputado(a) Distrital', digitos: 5, eleicao: 'geral' },
  senador:       { nome: 'Senador(a)',            digitos: 3, eleicao: 'geral' },
  governador:    { nome: 'Governador(a)',         digitos: 2, eleicao: 'geral' },
  presidente:    { nome: 'Presidente',            digitos: 2, eleicao: 'geral' },
};

const FONT = 'Montserrat, "Segoe UI", Roboto, Arial, sans-serif';

const U = {
  $:  (s, el = document) => el.querySelector(s),
  $$: (s, el = document) => [...el.querySelectorAll(s)],

  /* ---------- link compartilhável (JSON -> base64url no #hash) ---------- */
  encode(obj) {
    const bytes = new TextEncoder().encode(JSON.stringify(obj));
    let bin = '';
    bytes.forEach(b => { bin += String.fromCharCode(b); });
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  },
  decode(str) {
    try {
      let s = str.replace(/-/g, '+').replace(/_/g, '/');
      while (s.length % 4) s += '=';
      const bin = atob(s);
      const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
      return JSON.parse(new TextDecoder().decode(bytes));
    } catch (e) { return null; }
  },
  hashParam(name) {
    return new URLSearchParams(location.hash.slice(1)).get(name);
  },
  pageUrl() {
    return location.origin + location.pathname;
  },

  /* ---------- cores ---------- */
  hexToRgb(hex) {
    let h = (hex || '#000').replace('#', '');
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  },
  rgba(hex, a) {
    const [r, g, b] = U.hexToRgb(hex);
    return `rgba(${r},${g},${b},${a})`;
  },
  /** amt > 0 clareia, amt < 0 escurece (-1..1) */
  shade(hex, amt) {
    const [r, g, b] = U.hexToRgb(hex);
    const t = amt < 0 ? 0 : 255, p = Math.abs(amt);
    const f = v => Math.round((t - v) * p + v);
    return '#' + [f(r), f(g), f(b)].map(v => v.toString(16).padStart(2, '0')).join('');
  },
  /** cor de texto legível sobre um fundo */
  textOn(hex) {
    const [r, g, b] = U.hexToRgb(hex);
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return lum > 0.62 ? '#111827' : '#ffffff';
  },

  /* ---------- canvas ---------- */
  roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  },
  font(weight, size) {
    return `${weight} ${Math.round(size)}px ${FONT}`;
  },
  /** define a fonte no maior tamanho (<= size) que caiba em maxW; retorna o tamanho */
  fitFont(ctx, text, maxW, size, weight = 800, min = 18) {
    let s = size;
    ctx.font = U.font(weight, s);
    while (s > min && ctx.measureText(text).width > maxW) {
      s -= 2;
      ctx.font = U.font(weight, s);
    }
    return s;
  },
  setSpacing(ctx, px) {
    if ('letterSpacing' in ctx) ctx.letterSpacing = px + 'px';
  },
  /** caixinhas estilo urna, centralizadas em cx */
  digitBoxes(ctx, num, digitos, cx, y, boxW, boxH, gap, o = {}) {
    const total = digitos * boxW + (digitos - 1) * gap;
    let x = cx - total / 2;
    const chars = String(num || '').split('');
    for (let i = 0; i < digitos; i++) {
      U.roundRect(ctx, x, y, boxW, boxH, boxW * 0.16);
      ctx.fillStyle = o.bg || '#ffffff';
      ctx.fill();
      ctx.lineWidth = o.lineWidth || Math.max(3, boxW * 0.05);
      ctx.strokeStyle = o.border || '#111827';
      ctx.stroke();
      if (chars[i]) {
        ctx.fillStyle = o.color || '#111827';
        ctx.font = U.font(900, boxH * 0.68);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(chars[i], x + boxW / 2, y + boxH / 2 + boxH * 0.04);
      }
      x += boxW + gap;
    }
    return total;
  },
  /** texto curvado ao longo de um círculo (top = parte de cima, lido da esquerda p/ direita) */
  arcText(ctx, text, cx, cy, r, top = true) {
    const chars = [...text];
    const widths = chars.map(ch => ctx.measureText(ch).width);
    const total = widths.reduce((a, b) => a + b, 0);
    const span = total / r;
    let acc = 0;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    chars.forEach((ch, i) => {
      const mid = (acc + widths[i] / 2) / r;
      const a = top ? (-Math.PI / 2 - span / 2 + mid) : (Math.PI / 2 + span / 2 - mid);
      ctx.save();
      ctx.translate(cx + r * Math.cos(a), cy + r * Math.sin(a));
      ctx.rotate(top ? a + Math.PI / 2 : a - Math.PI / 2);
      ctx.fillText(ch, 0, 0);
      ctx.restore();
      acc += widths[i];
    });
  },
  /** desenha imagem cobrindo a área (object-fit: cover) */
  drawCover(ctx, img, x, y, w, h) {
    const s = Math.max(w / img.width, h / img.height);
    const iw = img.width * s, ih = img.height * s;
    ctx.drawImage(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
  },

  /* ---------- arquivos ---------- */
  loadImage(file) {
    return new Promise((resolve, reject) => {
      if (!file) return reject(new Error('sem arquivo'));
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Não foi possível abrir a imagem'));
      img.src = url;
    });
  },
  canvasBlob(canvas) {
    return new Promise(res => canvas.toBlob(res, 'image/png'));
  },
  async download(canvas, filename) {
    const blob = await U.canvasBlob(canvas);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    U.toast('Imagem baixada ✔');
  },
  async share(canvas, filename, text) {
    try {
      const blob = await U.canvasBlob(canvas);
      const file = new File([blob], filename, { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], text });
        return;
      }
    } catch (e) {
      if (e && e.name === 'AbortError') return;
    }
    U.download(canvas, filename);
    U.toast('Seu aparelho não permite compartilhar direto — a imagem foi baixada.');
  },
  async copy(text) {
    try {
      await navigator.clipboard.writeText(text);
      U.toast('Link copiado! Cole no WhatsApp, Instagram…');
    } catch (e) {
      window.prompt('Copie o link:', text);
    }
  },
  slug(s) {
    return (s || 'arte').normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'arte';
  },
  onlyDigits(s, max) {
    return String(s || '').replace(/\D/g, '').slice(0, max);
  },

  /* ---------- interface ---------- */
  toast(msg) {
    let t = U.$('#toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'toast';
      t.setAttribute('role', 'status');
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(U._tt);
    U._tt = setTimeout(() => t.classList.remove('show'), 2800);
  },
  async fontsReady() {
    if (!document.fonts) return;
    try {
      await Promise.race([
        Promise.all([500, 600, 700, 800, 900].map(w => document.fonts.load(`${w} 40px Montserrat`))),
        new Promise(r => setTimeout(r, 2500)),
      ]);
    } catch (e) { /* segue com a fonte padrão */ }
  },
  store: {
    get(k, def) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch (e) { return def; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ } },
  },
  /** imprime uma imagem (só ela aparece na folha) */
  printCanvas(canvas, mode) {
    let img = U.$('#print-img');
    if (!img) {
      img = document.createElement('img');
      img.id = 'print-img';
      img.alt = '';
      document.body.appendChild(img);
    }
    img.className = mode || '';
    img.onload = () => setTimeout(() => window.print(), 50);
    img.src = canvas.toDataURL('image/png');
  },
};
