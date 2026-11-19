'use strict';

/* ==========================================================
   Partidos com registro no TSE (30 — atualizado em nov/2026).
   Cores aproximadas da identidade visual de cada partido:
   ajuste à vontade no editor.
   `logo: true` => existe img/partidos/<id>.png (ver img/partidos/CREDITOS.md)
   ========================================================== */
const PARTIDOS = [
  { id: 'republicanos',  sigla: 'REPUBLICANOS', nome: 'Republicanos',                                    num: '10', cor: '#1c75bc', cor2: '#4dbce7' },
  { id: 'pp',            sigla: 'PP',           nome: 'Progressistas',                                   num: '11', cor: '#1f3f8f', cor2: '#3fa9f5' },
  { id: 'pdt',           sigla: 'PDT',          nome: 'Partido Democrático Trabalhista',                 num: '12', cor: '#e30613', cor2: '#ffffff' },
  { id: 'pt',            sigla: 'PT',           nome: 'Partido dos Trabalhadores',                       num: '13', cor: '#da1208', cor2: '#ffffff' },
  { id: 'missao',        sigla: 'MISSÃO',       nome: 'Missão',                                          num: '14', cor: '#111111', cor2: '#ffc700' },
  { id: 'mdb',           sigla: 'MDB',          nome: 'Movimento Democrático Brasileiro',                num: '15', cor: '#00843d', cor2: '#ffd100' },
  { id: 'pstu',          sigla: 'PSTU',         nome: 'Partido Socialista dos Trabalhadores Unificado',  num: '16', cor: '#e10000', cor2: '#111111' },
  { id: 'rede',          sigla: 'REDE',         nome: 'Rede Sustentabilidade',                           num: '18', cor: '#00877a', cor2: '#f58220' },
  { id: 'podemos',       sigla: 'PODE',         nome: 'Podemos',                                         num: '20', cor: '#1e73be', cor2: '#2eb872' },
  { id: 'pcb',           sigla: 'PCB',          nome: 'Partido Comunista Brasileiro',                    num: '21', cor: '#c8102e', cor2: '#ffd700' },
  { id: 'pl',            sigla: 'PL',           nome: 'Partido Liberal',                                 num: '22', cor: '#0f0073', cor2: '#ffcc00' },
  { id: 'cidadania',     sigla: 'CIDADANIA',    nome: 'Cidadania',                                       num: '23', cor: '#b43104', cor2: '#f2a900' },
  { id: 'prd',           sigla: 'PRD',          nome: 'Partido Renovação Democrática',                   num: '25', cor: '#003c71', cor2: '#00a859' },
  { id: 'dc',            sigla: 'DC',           nome: 'Democracia Cristã',                               num: '27', cor: '#293490', cor2: '#f7c600' },
  { id: 'prtb',          sigla: 'PRTB',         nome: 'Partido Renovador Trabalhista Brasileiro',        num: '28', cor: '#1f9e3a', cor2: '#0055a4' },
  { id: 'pco',           sigla: 'PCO',          nome: 'Partido da Causa Operária',                       num: '29', cor: '#9f030a', cor2: '#ffd600' },
  { id: 'novo',          sigla: 'NOVO',         nome: 'Partido Novo',                                    num: '30', cor: '#ff7a00', cor2: '#1d2d50' },
  { id: 'mobiliza',      sigla: 'MOBILIZA',     nome: 'Mobilização Nacional',                            num: '33', cor: '#da010a', cor2: '#1a1a1a' },
  { id: 'democrata',     sigla: 'DEMOCRATA',    nome: 'Democrata',                                       num: '35', cor: '#002e68', cor2: '#e30613' },
  { id: 'agir',          sigla: 'AGIR',         nome: 'Agir',                                            num: '36', cor: '#0066bb', cor2: '#f7b500' },
  { id: 'psb',           sigla: 'PSB',          nome: 'Partido Socialista Brasileiro',                   num: '40', cor: '#f5a800', cor2: '#e30613' },
  { id: 'pv',            sigla: 'PV',           nome: 'Partido Verde',                                   num: '43', cor: '#006b2d', cor2: '#ffd700' },
  { id: 'uniao',         sigla: 'UNIÃO',        nome: 'União Brasil',                                    num: '44', cor: '#003da5', cor2: '#ffc20e' },
  { id: 'psdb',          sigla: 'PSDB',         nome: 'Partido da Social Democracia Brasileira',         num: '45', cor: '#084b8a', cor2: '#ffd200' },
  { id: 'psol',          sigla: 'PSOL',         nome: 'Partido Socialismo e Liberdade',                  num: '50', cor: '#d7261e', cor2: '#ffd400' },
  { id: 'psd',           sigla: 'PSD',          nome: 'Partido Social Democrático',                      num: '55', cor: '#00843d', cor2: '#ffc400' },
  { id: 'pcdob',         sigla: 'PCdoB',        nome: 'Partido Comunista do Brasil',                     num: '65', cor: '#c4122f', cor2: '#ffd700' },
  { id: 'avante',        sigla: 'AVANTE',       nome: 'Avante',                                          num: '70', cor: '#ed5f36', cor2: '#1d3c78' },
  { id: 'solidariedade', sigla: 'SOLIDARIEDADE', nome: 'Solidariedade',                                  num: '77', cor: '#e5671f', cor2: '#1e4e9c' },
  { id: 'up',            sigla: 'UP',           nome: 'Unidade Popular',                                 num: '80', cor: '#d10a11', cor2: '#ffd700' },
];

/* preenchido automaticamente: partidos com logo em img/partidos/ */
const PARTIDOS_COM_LOGO = ['agir', 'avante', 'cidadania', 'dc', 'democrata', 'mdb', 'missao', 'mobiliza', 'novo', 'pcb', 'pcdob', 'pco', 'pdt', 'pl', 'podemos', 'pp', 'prd', 'prtb', 'psb', 'psd', 'psdb', 'psol', 'pstu', 'pt', 'pv', 'rede', 'republicanos', 'solidariedade', 'uniao', 'up'];

PARTIDOS.forEach(p => { p.logo = PARTIDOS_COM_LOGO.includes(p.id); });

const Partidos = {
  get(id) { return PARTIDOS.find(p => p.id === id) || null; },

  /** preenche um <select> com os partidos (por número) */
  fillSelect(sel, emptyLabel = 'Sem partido / outro') {
    sel.innerHTML = `<option value="">${emptyLabel}</option>` +
      PARTIDOS.map(p => `<option value="${p.id}">${p.num} · ${p.sigla}</option>`).join('');
  },

  _cache: {},
  /** carrega a logo do partido (Promise<Image|null>) */
  loadLogo(id) {
    const p = Partidos.get(id);
    if (!p || !p.logo) return Promise.resolve(null);
    if (!Partidos._cache[id]) {
      Partidos._cache[id] = new Promise(res => {
        const img = new Image();
        img.onload = () => res(img);
        img.onerror = () => res(null);
        img.src = `img/partidos/${id}.png`;
      });
    }
    return Partidos._cache[id];
  },

  /** número do candidato começa com o número do partido */
  numeroComPrefixo(num, partido, digitos) {
    if (!partido) return num;
    const resto = String(num || '').slice(2);
    return (partido.num + resto).slice(0, digitos);
  },

  /**
   * Desenha a logo do partido "contida" num retângulo.
   * Sem logo: um selo redondo com sigla e número nas cores do partido.
   * box: true => fundo branco arredondado atrás da logo.
   */
  draw(c, img, p, x, y, w, h, o = {}) {
    if (o.box) {
      U.roundRect(c, x, y, w, h, o.radius != null ? o.radius : Math.min(w, h) * 0.18);
      c.fillStyle = o.boxColor || '#ffffff';
      c.fill();
      const pad = o.pad != null ? o.pad : Math.min(w, h) * 0.12;
      x += pad; y += pad; w -= pad * 2; h -= pad * 2;
    }
    if (img) {
      const s = Math.min(w / img.width, h / img.height);
      const iw = img.width * s, ih = img.height * s;
      c.drawImage(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
      return;
    }
    if (!p) return;
    // selo de fallback
    const r = Math.min(w, h) / 2, cx = x + w / 2, cy = y + h / 2;
    c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2);
    c.fillStyle = p.cor; c.fill();
    c.lineWidth = r * 0.1; c.strokeStyle = p.cor2;
    c.beginPath(); c.arc(cx, cy, r * 0.9, 0, Math.PI * 2); c.stroke();
    c.fillStyle = U.textOn(p.cor);
    c.textAlign = 'center'; c.textBaseline = 'middle';
    U.fitFont(c, p.sigla, r * 1.5, r * 0.62, 900, 8);
    c.fillText(p.sigla, cx, cy - r * 0.12);
    c.font = U.font(800, r * 0.36);
    c.fillStyle = p.cor2 === '#ffffff' || U.textOn(p.cor) === '#111827' ? U.textOn(p.cor) : p.cor2;
    c.fillText(p.num, cx, cy + r * 0.42);
  },
};
