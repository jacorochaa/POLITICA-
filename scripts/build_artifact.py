#!/usr/bin/env python3
"""
Monta a versão "projeto no Claude" (artefato do claude.ai) em uma pasta de saída:
uma página única (app.html) com as abas Início, Colinha, Moldura e Partidos,
mais css/, js/, img/ e os dados do TSE (municipais agrupados por estado,
para caber no limite de arquivos do artefato).

Uso: python3 scripts/build_artifact.py <pasta_saida>
"""
import json
import os
import re
import shutil
import sys

RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
OUT = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(RAIZ, 'dist-claude'))


def ler(p):
    return open(os.path.join(RAIZ, p), encoding='utf-8').read()


def miolo(pagina):
    """conteúdo de <main> + <footer> da página"""
    s = ler(pagina)
    m = re.search(r'<main[^>]*>.*?</main>\s*<footer.*?</footer>', s, re.S)
    return m.group(0)


def links(s):
    s = s.replace('href="index.html"', 'href="#inicio"')
    for p in ('colinha', 'moldura', 'partidos'):
        s = s.replace(f'href="{p}.html"', f'href="#{p}"')
    s = s.replace('<a href="img/partidos/CREDITOS.md">créditos</a>', 'créditos (arquivo img/partidos/CREDITOS.md do projeto)')
    return s


def main():
    if os.path.exists(OUT):
        shutil.rmtree(OUT)
    os.makedirs(OUT)
    for d in ('css', 'js', 'img'):
        shutil.copytree(os.path.join(RAIZ, d), os.path.join(OUT, d))

    # estilos da galeria (que ficam no <head> de partidos.html)
    m_galeria = re.search(r'<style>(.*?)</style>', ler('partidos.html'), re.S)
    css_galeria = m_galeria.group(1) if m_galeria else ''

    views = {
        'inicio': links(miolo('index.html')),
        'colinha': links(miolo('colinha.html')),
        'moldura': links(miolo('moldura.html')),
        'partidos': links(miolo('partidos.html')),
    }
    templates = '\n'.join(f'<template id="tpl-{k}">\n{v}\n</template>' for k, v in views.items())

    app = f"""<title>Colinha & Moldura</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Montserrat:wght@500;600;700;800;900&display=swap" rel="stylesheet">
<link rel="stylesheet" href="css/style.css">
<script src="js/tema.js"></script>
<style>
body {{ background: var(--bg); color: var(--text); }}
.side-head {{ padding-top: max(12px, env(safe-area-inset-top, 0px)); }}
body::before {{ content: ""; position: fixed; inset: 0 0 auto; height: env(safe-area-inset-top, 0px); z-index: 31; background: var(--bg); }}
/* o artefato não abre impressão nem passa links com dados: esconde esses botões */
body.app #btn-print, body.app #btn-link, body.app #btn-create-own {{ display: none !important; }}
body.app .actions {{ padding-left: max(12px, env(safe-area-inset-left, 0px)); padding-right: max(12px, env(safe-area-inset-right, 0px)); }}
{css_galeria}
</style>

<div id="view"></div>

{templates}

<script>window.APP_MODE = true; window.APP_PARAMS = {{}}; document.body.classList.add('app');</script>
<script src="js/common.js"></script>
<script src="js/partidos.js"></script>
<script src="js/tse.js"></script>
<script src="js/fotos.js"></script>
<script>
(() => {{
  const SCRIPTS = {{ colinha: 'js/colinha.js', moldura: 'js/moldura.js', partidos: 'js/galeria.js' }};
  const view = document.getElementById('view');
  let n = 0;
  function show() {{
    let v = (location.hash || '').slice(1);
    if (!document.getElementById('tpl-' + v)) v = 'inicio';
    view.innerHTML = '';
    view.appendChild(document.getElementById('tpl-' + v).content.cloneNode(true));
    document.body.classList.toggle('has-actions', v === 'colinha' || v === 'moldura');
    document.body.classList.remove('view-mode');
    window.scrollTo(0, 0);
    if (SCRIPTS[v]) {{
      const s = document.createElement('script');
      s.src = SCRIPTS[v] + '?v=' + (++n);
      document.body.appendChild(s);
    }}
  }}
  window.addEventListener('hashchange', show);
  show();
  U.claudeDownloads();
}})();
</script>
"""
    open(os.path.join(OUT, 'app.html'), 'w', encoding='utf-8').write(app)

    # dados do TSE
    src = os.path.join(RAIZ, 'data', 'candidatos')
    dst = os.path.join(OUT, 'data', 'candidatos')
    os.makedirs(dst)
    shutil.copy(os.path.join(src, 'eleicoes.json'), dst)
    for ano in sorted(os.listdir(src)):
        d = os.path.join(src, ano)
        if not os.path.isdir(d):
            continue
        meta = json.load(open(os.path.join(d, 'index.json'), encoding='utf-8'))
        os.makedirs(os.path.join(dst, ano))
        if meta['tipo'] == 'municipal':
            for uf in meta['indice']:
                junto = {}
                for f in sorted(os.listdir(os.path.join(d, uf))):
                    junto[f[:-5]] = json.load(open(os.path.join(d, uf, f), encoding='utf-8'))
                with open(os.path.join(dst, ano, f'{uf}.json'), 'w', encoding='utf-8') as fh:
                    json.dump(junto, fh, ensure_ascii=False, separators=(',', ':'))
            meta['layout'] = 'uf'
        else:
            for f in os.listdir(d):
                if f != 'index.json':
                    shutil.copy(os.path.join(d, f), os.path.join(dst, ano, f))
        with open(os.path.join(dst, ano, 'index.json'), 'w', encoding='utf-8') as fh:
            json.dump(meta, fh, ensure_ascii=False, separators=(',', ':'))

    arquivos = []
    for base, _, fs in os.walk(OUT):
        for f in fs:
            arquivos.append(os.path.relpath(os.path.join(base, f), OUT))
    arquivos = sorted(a for a in arquivos if a != 'app.html')
    json.dump(arquivos, open(os.path.join(OUT, '_files.json'), 'w'), indent=0)
    total = sum(os.path.getsize(os.path.join(OUT, a)) for a in arquivos)
    maior = max(arquivos, key=lambda a: os.path.getsize(os.path.join(OUT, a)))
    print(f'{len(arquivos)} arquivos de apoio, {total / 1e6:.1f} MB; maior: {maior} '
          f'({os.path.getsize(os.path.join(OUT, maior)) / 1e6:.1f} MB)')


if __name__ == '__main__':
    main()
