'use strict';

/* ==========================================================
   Vídeo da colinha: simulação da urna, em formato stories (9:16).
   Para cada cargo: digita o número (com bipe), mostra foto, nome e
   partido, aperta CONFIRMA. No fim, a tela FIM e a colinha completa.
   Gravado no próprio navegador (canvas + MediaRecorder). Nada sai do aparelho.
   ========================================================== */
const Video = (() => {
  const W = 1080, H = 1920, FPS = 30;
  const FAM = 'Inter, "Segoe UI", Roboto, Arial, sans-serif';
  const fnt = (w, s) => `${w} ${Math.round(s)}px ${FAM}`;
  const ease = x => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);

  function fit(c, text, maxW, size, weight, min = 18) {
    let s = size;
    c.font = fnt(weight, s);
    while (s > min && c.measureText(text).width > maxW) { s -= 1; c.font = fnt(weight, s); }
    return s;
  }
  function espacado(c, text, x, y, size, weight, color, sp) {
    c.fillStyle = color; c.font = fnt(weight, size);
    if ('letterSpacing' in c) c.letterSpacing = sp + 'px';
    c.fillText(text, x, y);
    if ('letterSpacing' in c) c.letterSpacing = '0px';
  }

  /* ---------- linha do tempo ---------- */
  function montar(votos) {
    const cenas = [];
    let t = 0;
    cenas.push({ tipo: 'intro', ini: t, dur: 1.1 }); t += 1.1;
    votos.forEach(v => {
      const dig = v.num.length;
      const c = { tipo: 'voto', v, ini: t, cargo: 0.5, tecla: 0.32, revela: 1.15, confirma: 0.5 };
      c.digitar = dig * c.tecla;
      c.dur = c.cargo + c.digitar + c.revela + c.confirma + 0.2;
      cenas.push(c); t += c.dur;
    });
    cenas.push({ tipo: 'fim', ini: t, dur: 1.3 }); t += 1.3;
    cenas.push({ tipo: 'final', ini: t, dur: 2.8 }); t += 2.8;
    return { cenas, total: t };
  }

  /* ---------- som (bipes gerados na hora) ---------- */
  function sons(ac, destino, linha) {
    const bip = (quando, freq, dur, vol = 0.18) => {
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = 'square'; o.frequency.value = freq;
      g.gain.setValueAtTime(0, quando);
      g.gain.linearRampToValueAtTime(vol, quando + 0.005);
      g.gain.setValueAtTime(vol, quando + dur - 0.01);
      g.gain.linearRampToValueAtTime(0, quando + dur);
      o.connect(g); g.connect(destino);
      o.start(quando); o.stop(quando + dur + 0.02);
    };
    const t0 = ac.currentTime + 0.05;
    linha.cenas.forEach(c => {
      if (c.tipo === 'voto') {
        for (let i = 0; i < c.v.num.length; i++) bip(t0 + c.ini + c.cargo + i * c.tecla, 1046, 0.07);
        const tc = t0 + c.ini + c.cargo + c.digitar + c.revela;
        bip(tc, 1318, 0.09); bip(tc + 0.11, 1568, 0.14);
      } else if (c.tipo === 'fim') {
        for (let i = 0; i < 4; i++) bip(t0 + c.ini + i * 0.13, 1175, 0.08);
        bip(t0 + c.ini + 0.52, 1175, 0.45);
      }
    });
    return t0;
  }

  /* ---------- desenho de cada quadro ---------- */
  function quadro(c, linha, t, o) {
    const T = o.tema;
    const cena = linha.cenas.find(x => t >= x.ini && t < x.ini + x.dur) || linha.cenas[linha.cenas.length - 1];
    const lt = t - cena.ini;
    c.fillStyle = T.bg; c.fillRect(0, 0, W, H);

    if (cena.tipo === 'final') {
      const a = ease(lt / 0.5);
      c.globalAlpha = a;
      o.final(c, W, H);
      c.globalAlpha = 1;
      return;
    }

    // cabeçalho
    c.textAlign = 'center'; c.textBaseline = 'alphabetic';
    espacado(c, (o.subtitulo || '').toUpperCase(), W / 2, 150, 26, 600, T.grey, 6);
    c.fillStyle = T.ink; fit(c, o.titulo || 'Minha colinha', W - 160, 60, 800, 30);
    c.fillText(o.titulo || 'Minha colinha', W / 2, 226);

    // visor
    const vx = 60, vy = 290, vw = W - 120, vh = 1150;
    U.roundRect(c, vx, vy, vw, vh, 34);
    c.fillStyle = T.visor || T.soft; c.fill();
    c.lineWidth = 3; c.strokeStyle = T.line; c.stroke();

    let tecla = '';
    if (cena.tipo === 'intro') {
      const a = ease(lt / 0.6);
      c.globalAlpha = a;
      espacado(c, 'SIMULAÇÃO DA URNA', W / 2, vy + vh / 2 - 40, 34, 700, T.grey, 8);
      c.fillStyle = T.ink; c.font = fnt(800, 76);
      c.fillText('Vamos votar', W / 2, vy + vh / 2 + 60);
      c.globalAlpha = 1;
    } else if (cena.tipo === 'voto') {
      const v = cena.v;
      const tDig = lt - cena.cargo;
      const nDig = Math.max(0, Math.min(v.num.length, Math.floor(tDig / cena.tecla) + 1));
      const digitos = tDig < 0 ? '' : v.num.slice(0, nDig);
      const tRev = lt - cena.cargo - cena.digitar;
      const rev = tRev >= 0 ? ease(tRev / 0.35) : 0;
      if (lt >= cena.cargo + cena.digitar + cena.revela && lt < cena.cargo + cena.digitar + cena.revela + 0.3) tecla = 'CONFIRMA';

      c.textAlign = 'left';
      espacado(c, 'SEU VOTO PARA', vx + 50, vy + 80, 26, 700, T.grey, 4);
      c.textAlign = 'center';
      c.fillStyle = T.ink; fit(c, v.cargo, vw - 100, 58, 800, 30);
      c.fillText(v.cargo, W / 2, vy + 170);

      // foto (entra quando o número fecha)
      const pw = 292, ph = 390, px = W / 2 - pw / 2, py = vy + 210;
      c.save();
      c.globalAlpha = 0.25 + 0.75 * rev;
      const s = 0.92 + 0.08 * rev;
      c.translate(W / 2, py + ph / 2); c.scale(s, s); c.translate(-W / 2, -(py + ph / 2));
      U.roundRect(c, px, py, pw, ph, 26);
      c.clip();
      if (rev > 0 && v.foto) U.drawCover(c, v.foto, px, py, pw, ph);
      else {
        c.fillStyle = T.ph; c.fillRect(px, py, pw, ph);
        c.fillStyle = T.phf;
        c.beginPath(); c.arc(W / 2, py + ph * 0.4, pw * 0.2, 0, Math.PI * 2); c.fill();
        c.beginPath(); c.ellipse(W / 2, py + ph * 1.02, pw * 0.42, ph * 0.36, 0, Math.PI, 0); c.fill();
      }
      c.restore();

      // caixinhas
      const n = v.digitos, gap = 18, bw = Math.min(124, (vw - 160 - gap * (n - 1)) / n), bh = bw * 1.2;
      let x = W / 2 - (n * bw + (n - 1) * gap) / 2;
      const by = vy + 640;
      for (let i = 0; i < n; i++) {
        const atual = i === digitos.length && tDig >= 0 && digitos.length < n;
        U.roundRect(c, x, by, bw, bh, bw * 0.2);
        c.fillStyle = T.soft === (T.visor || T.soft) ? T.bg : T.soft; c.fill();
        c.lineWidth = atual ? 6 : 4; c.strokeStyle = atual ? '#1f8f4e' : T.dig; c.stroke();
        if (digitos[i]) {
          const ti = tDig - i * cena.tecla;
          const pop = 1 + 0.18 * Math.max(0, 1 - ti / 0.15);
          c.save();
          c.translate(x + bw / 2, by + bh / 2); c.scale(pop, pop);
          c.fillStyle = T.ink; c.font = fnt(600, bh * 0.62); c.textAlign = 'center'; c.textBaseline = 'middle';
          c.fillText(digitos[i], 0, bh * 0.03);
          c.restore();
        }
        x += bw + gap;
      }

      // nome e partido
      if (rev > 0) {
        c.globalAlpha = rev;
        c.textAlign = 'center'; c.textBaseline = 'alphabetic';
        c.fillStyle = T.ink; fit(c, (v.nome || '').toUpperCase(), vw - 120, 58, 800, 28);
        c.fillText((v.nome || '').toUpperCase(), W / 2, by + bh + 88 + (1 - rev) * 20);
        // logo e sigla lado a lado
        const temLogo = !!(v.p || v.logo), s2 = 96, ly = by + bh + 122;
        c.font = fnt(700, 32);
        const sw = v.partido ? c.measureText(v.partido).width : 0;
        const larg = (temLogo ? s2 : 0) + (temLogo && sw ? 22 : 0) + sw;
        let lx = W / 2 - larg / 2;
        if (temLogo) {
          U.roundRect(c, lx, ly, s2, s2, 20); c.fillStyle = '#fff'; c.fill();
          c.lineWidth = 2; c.strokeStyle = T.line; c.stroke();
          Partidos.draw(c, v.logo, v.p, lx + 10, ly + 10, s2 - 20, s2 - 20);
          lx += s2 + 22;
        }
        if (v.partido) {
          c.fillStyle = T.grey; c.textAlign = 'left'; c.textBaseline = 'middle';
          c.fillText(v.partido, lx, ly + s2 / 2 + 1);
          c.textAlign = 'center'; c.textBaseline = 'alphabetic';
        }
        c.globalAlpha = 1;
      }
      if (tRev > 0.4) {
        c.globalAlpha = ease((tRev - 0.4) / 0.3);
        c.fillStyle = T.grey; c.font = fnt(500, 26); c.textAlign = 'center';
        c.fillText('Aperte a tecla verde CONFIRMA', W / 2, vy + vh - 40);
        c.globalAlpha = 1;
      }
    } else if (cena.tipo === 'fim') {
      const a = ease(lt / 0.25);
      c.globalAlpha = a;
      c.fillStyle = T.ink; c.font = fnt(900, 260); c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('FIM', W / 2, vy + vh / 2);
      c.globalAlpha = 1;
    }

    // teclas da urna
    o.teclas(c, W / 2, 1520, 1.65, tecla);

    // rodapé
    c.textAlign = 'center'; c.textBaseline = 'alphabetic';
    c.fillStyle = T.grey; c.font = fnt(500, 26);
    c.fillText('Celular não entra na cabine: leve a colinha impressa.', W / 2, H - 90);
  }

  /* ---------- janela de gravação ---------- */
  function janela() {
    let m = U.$('#vmodal');
    if (m) return m;
    m = document.createElement('div');
    m.id = 'vmodal';
    m.className = 'vmodal';
    m.setAttribute('role', 'dialog');
    m.setAttribute('aria-modal', 'true');
    m.setAttribute('aria-label', 'Vídeo da colinha');
    m.innerHTML = `
      <div class="vbox">
        <canvas class="vcanvas" width="${W}" height="${H}"></canvas>
        <div class="vside">
          <h2>Vídeo da colinha</h2>
          <p class="vstatus" aria-live="polite">Preparando…</p>
          <div class="vbar"><div class="vprog"></div></div>
          <div class="btns vbtns">
            <button class="btn" data-acao="baixar" disabled>${U.icon('download')}Baixar vídeo</button>
            <button class="btn ghost" data-acao="compartilhar" disabled>${U.icon('share')}Compartilhar</button>
            <button class="btn ghost" data-acao="fechar">Fechar</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(m);
    return m;
  }

  function formato() {
    const tipos = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
    return tipos.find(t => window.MediaRecorder && MediaRecorder.isTypeSupported(t)) || '';
  }

  /**
   * o: { votos:[{cargo, digitos, num, nome, partido, foto, logo, p}], titulo, subtitulo,
   *      tema, teclas(c,cx,y,s,destaque), final(c,W,H), arquivo }
   */
  async function gravar(o) {
    if (!o.votos.length) { U.toast('Digite pelo menos um número para fazer o vídeo.'); return; }
    const tipo = formato();
    if (!tipo || !HTMLCanvasElement.prototype.captureStream) { U.toast('Este navegador não grava vídeo. Tente o Chrome ou o Edge.'); return; }
    if (document.fonts) { try { await Promise.all([600, 700, 800, 900].map(w => document.fonts.load(`${w} 40px Inter`))); } catch (e) { /* segue */ } }

    const m = janela();
    const cv = U.$('.vcanvas', m), c = cv.getContext('2d');
    const st = U.$('.vstatus', m), prog = U.$('.vprog', m);
    const bBaixar = U.$('[data-acao=baixar]', m), bComp = U.$('[data-acao=compartilhar]', m), bFechar = U.$('[data-acao=fechar]', m);
    bBaixar.disabled = bComp.disabled = true;
    m.classList.add('open');
    document.body.style.overflow = 'hidden';

    const linha = montar(o.votos);
    let cancelado = false, arquivo = null, raf = 0;
    const fechar = () => { cancelado = true; cancelAnimationFrame(raf); m.classList.remove('open'); document.body.style.overflow = ''; };
    bFechar.onclick = fechar;

    // áudio
    let ac = null, destino = null;
    try { ac = new (window.AudioContext || window.webkitAudioContext)(); destino = ac.createMediaStreamDestination(); } catch (e) { ac = null; }
    const stream = cv.captureStream(FPS);
    if (destino) destino.stream.getAudioTracks().forEach(tr => stream.addTrack(tr));
    const rec = new MediaRecorder(stream, { mimeType: tipo, videoBitsPerSecond: 6_000_000 });
    const partes = [];
    rec.ondataavailable = e => { if (e.data && e.data.size) partes.push(e.data); };
    const pronto = new Promise(res => { rec.onstop = res; });

    quadro(c, linha, 0, o);
    rec.start(250);
    const t0audio = ac ? sons(ac, destino, linha) : 0;
    const t0 = performance.now() + (ac ? (t0audio - ac.currentTime) * 1000 : 0);
    st.textContent = 'Gravando… deixe esta janela aberta.';

    await new Promise(res => {
      const passo = () => {
        if (cancelado) { res(); return; }
        const t = Math.max(0, (performance.now() - t0) / 1000);
        quadro(c, linha, Math.min(t, linha.total - 0.001), o);
        prog.style.width = `${Math.min(100, (t / linha.total) * 100)}%`;
        if (t >= linha.total + 0.15) { res(); return; }
        raf = requestAnimationFrame(passo);
      };
      raf = requestAnimationFrame(passo);
    });
    rec.stop();
    await pronto;
    if (ac) ac.close();
    if (cancelado) return;

    const ext = tipo.startsWith('video/mp4') ? 'mp4' : 'webm';
    const blob = new Blob(partes, { type: tipo.split(';')[0] });
    arquivo = new File([blob], `${o.arquivo || 'colinha'}.${ext}`, { type: blob.type });
    st.textContent = `Pronto: ${(blob.size / 1e6).toFixed(1)} MB, ${Math.round(linha.total)} segundos (${ext.toUpperCase()}).`;
    prog.style.width = '100%';
    bBaixar.disabled = false;
    bComp.disabled = !(navigator.canShare && navigator.canShare({ files: [arquivo] }));
    bBaixar.onclick = () => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(arquivo);
      a.download = arquivo.name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    };
    bComp.onclick = () => navigator.share({ files: [arquivo], title: 'Minha colinha' }).catch(() => {});
  }

  return { gravar };
})();
