# Colinha & Moldura 🗳️

Site estático (HTML + CSS + JavaScript puro, sem servidor) para campanhas políticas:

- **Gerador de Colinha** (`colinha.html`)
  - **Candidato:** nome, cargo, número (com a quantidade certa de dígitos por cargo), partido, cidade, slogan, cor, foto e texto legal.
    Formatos: **Feed 4:5** (1080×1350), **Stories 9:16** (1080×1920) e **folha A4 com 10 colinhas** para recortar.
  - **Link para eleitores:** quem abre o link vê a colinha do candidato, baixa/compartilha e pode **adicionar à própria colinha**.
  - **Eleitor:** monta a colinha completa na ordem da urna (municipal ou geral, DF, 2 vagas ao Senado). Fica salva no aparelho.
- **Partidos** (`partidos.html`): os 30 partidos do TSE com número, cores e logo; atalhos para moldura e colinha de cada um.
- **Gerador de Moldura** (`moldura.html`), estilo Twibbonize
  - Modelos: **Partido, Faixa, Círculo, Selo, Moderno** ou **arte própria em PNG**.
  - O candidato configura e copia o **link para apoiadores**.
  - O apoiador envia a foto, **arrasta, dá zoom (pinça no celular) e gira**, e baixa em **Perfil 1:1** ou **Stories 9:16**.

Privacidade: tudo é processado no navegador. Fotos não são enviadas a nenhum servidor; os dados do
candidato vão dentro do próprio link (depois do `#`).

## Candidaturas do TSE (preenchimento automático)

Na colinha e na moldura, o painel **“Puxar candidatura do TSE”** busca por eleição, estado, município
e nome/número e preenche tudo: nome de urna, número, cargo, partido (cores e logo), cidade e o
**texto legal** (coligação/federação com os partidos + CNPJ da campanha).

- Fonte: [Portal de Dados Abertos do TSE](https://dadosabertos.tse.jus.br) — arquivo `consulta_cand_<ano>.zip`.
- `scripts/atualizar_candidatos.py` baixa e gera `data/candidatos/` (só dados públicos de campanha;
  CPF, e-mail, título e data de nascimento **não** são exportados).
- O workflow `.github/workflows/atualizar-candidatos.yml` roda **todo dia** e faz commit quando há mudança.
  Também pode ser rodado manualmente em *Actions → Atualizar candidaturas do TSE → Run workflow*
  (informe anos, ex.: `2028`). Para incluir uma eleição nova, rode com o ano ou edite `ANOS_PADRAO` no script.
- Rodar localmente: `python3 scripts/atualizar_candidatos.py 2026 2024`
- Fotos: `node scripts/atualizar_fotos.mjs 2026` baixa as fotos oficiais e salva uma por arquivo em `data/fotos/<ano>/<UF>/<sq>.jpg` (cerca de 115 MB para 2026). O site não busca direto no TSE porque o servidor de lá manda o cabeçalho CORS duplicado e o navegador recusa.

## Como publicar (grátis) no GitHub Pages

1. No GitHub, abra **Settings → Pages**.
2. Em *Source*, escolha **Deploy from a branch**, selecione a branch e a pasta `/ (root)`.
3. Salve. Em 1–2 minutos o site fica em `https://<usuario>.github.io/<repositorio>/`.

Também funciona em Netlify, Vercel ou qualquer hospedagem de arquivos estáticos.

## Rodar no computador

Precisa do [Python](https://www.python.org/downloads/) (no Windows, marque *Add python.exe to PATH*) **ou** do
[Node.js](https://nodejs.org/) instalado. Os atalhos usam o Python e, se ele não existir, o Node.

- **Windows:** dois cliques em `iniciar-windows.bat`
- **Mac:** dois cliques em `iniciar-mac-linux.command` (na 1ª vez: botão direito → Abrir)
- **Linux:** `./iniciar-mac-linux.command`

O navegador abre em http://localhost:8000. Não abra o `index.html` direto com dois cliques: o navegador
bloqueia o download das artes e a busca do TSE fora de um servidor. Ou, no terminal, dentro da pasta:

```bash
python3 -m http.server 8000      # com Python
node scripts/servidor.mjs 8000   # com Node
```

e abra http://localhost:8000.

## Estrutura

```
index.html      página inicial
colinha.html    gerador de colinha
moldura.html    gerador de moldura
partidos.html   galeria de partidos
css/style.css   estilos
img/icons.svg   ícones SVG (sprite)
img/partidos/   logos dos partidos + CREDITOS.md
js/common.js    utilidades (cargos, desenho, links, download, compartilhar)
js/partidos.js  lista de partidos, cores e desenho das logos
js/colinha.js   lógica e desenho das colinhas
js/moldura.js   modelos de moldura e editor de foto
```

## Personalizar

- **Novos modelos de moldura:** adicione uma função em `TEMPLATES` (`js/moldura.js`) e um botão `.tpl` em `moldura.html`.
- **Cargos / dígitos:** objeto `CARGOS` em `js/common.js`.

> ⚖️ Respeite a legislação eleitoral (Lei 9.504/97 e Res. TSE 23.610/2019): use o campo *texto legal*
> para coligação/federação, CNPJ e demais informações obrigatórias.
