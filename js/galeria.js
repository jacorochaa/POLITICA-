'use strict';

/* Galeria de partidos (partidos.html e aba "Partidos" do app) */
(() => {
  const grid = U.$('#grid');
  if (!grid) return;
  const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  const cards = PARTIDOS.map(p => {
    const el = document.createElement('article');
    el.className = 'party';
    el.dataset.q = norm(`${p.sigla} ${p.nome} ${p.num}`);
    el.innerHTML = `
      <div class="logo"><canvas width="480" height="240"></canvas></div>
      <div class="body">
        <div class="head">
          <div class="num" style="background:${p.cor};color:${U.textOn(p.cor)}">${p.num}</div>
          <div><div class="sigla">${p.sigla}</div><div class="nome">${p.nome}</div></div>
        </div>
        <div class="meta"><span class="c" style="background:${p.cor}"></span><span class="c" style="background:${p.cor2}"></span>
          <span>${p.logo ? 'Logo oficial' : 'Selo gerado'}</span></div>
        <div class="acts">
          <a class="btn" href="moldura.html#p=${p.id}" data-tool="moldura" data-pid="${p.id}">${U.icon('moldura', 'i i-sm')}Moldura</a>
          <a class="btn ghost" href="colinha.html#p=${p.id}" data-tool="colinha" data-pid="${p.id}">${U.icon('colinha', 'i i-sm')}Colinha</a>
        </div>
      </div>`;
    grid.appendChild(el);
    const cv = U.$('canvas', el);
    const draw = img => {
      const c = cv.getContext('2d');
      c.clearRect(0, 0, cv.width, cv.height);
      if (img) Partidos.draw(c, img, p, 60, 40, 360, 160);
      else Partidos.draw(c, null, p, 170, 30, 140, 180);
    };
    Partidos.loadLogo(p.id).then(draw);
    U.fontsReady().then(() => Partidos.loadLogo(p.id).then(draw));
    return el;
  });

  // no app de página única, abre a ferramenta na própria página
  grid.addEventListener('click', e => {
    const a = e.target.closest('a[data-tool]');
    if (!a || !window.APP_MODE) return;
    e.preventDefault();
    window.APP_PARAMS = { p: a.dataset.pid };
    location.hash = a.dataset.tool;
  });

  const busca = U.$('#busca');
  const filtrar = () => {
    const q = norm(busca.value).trim();
    let n = 0;
    cards.forEach(el => { const ok = !q || el.dataset.q.includes(q); el.classList.toggle('hidden', !ok); n += ok; });
    U.$('#contagem').textContent = `${n} partido${n === 1 ? '' : 's'}`;
  };
  busca.addEventListener('input', filtrar);
  filtrar();
})();
