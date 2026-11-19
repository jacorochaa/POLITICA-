# Colinha & Moldura 🗳️

Site estático (HTML + CSS + JavaScript puro, sem servidor) para campanhas políticas:

- **Gerador de Colinha** (`colinha.html`)
  - **Candidato:** nome, cargo, número (com a quantidade certa de dígitos por cargo), partido, cidade, slogan, cor, foto e texto legal.
    Formatos: **Feed 4:5** (1080×1350), **Stories 9:16** (1080×1920) e **folha A4 com 10 colinhas** para recortar.
  - **Link para eleitores:** quem abre o link vê a colinha do candidato, baixa/compartilha e pode **adicionar à própria colinha**.
  - **Eleitor:** monta a colinha completa na ordem da urna (municipal ou geral, DF, 2 vagas ao Senado). Fica salva no aparelho.
- **Gerador de Moldura** (`moldura.html`), estilo Twibbonize
  - Modelos: **Faixa, Círculo, Selo, Moderno** ou **arte própria em PNG**.
  - O candidato configura e copia o **link para apoiadores**.
  - O apoiador envia a foto, **arrasta, dá zoom (pinça no celular) e gira**, e baixa em **Perfil 1:1** ou **Stories 9:16**.

Privacidade: tudo é processado no navegador. Fotos não são enviadas a nenhum servidor; os dados do
candidato vão dentro do próprio link (depois do `#`).

## Como publicar (grátis) no GitHub Pages

1. No GitHub, abra **Settings → Pages**.
2. Em *Source*, escolha **Deploy from a branch**, selecione a branch e a pasta `/ (root)`.
3. Salve. Em 1–2 minutos o site fica em `https://<usuario>.github.io/<repositorio>/`.

Também funciona em Netlify, Vercel ou qualquer hospedagem de arquivos estáticos. Para testar localmente:

```bash
python3 -m http.server 8000
```

e abra http://localhost:8000.

## Estrutura

```
index.html      página inicial
colinha.html    gerador de colinha
moldura.html    gerador de moldura
css/style.css   estilos
js/common.js    utilidades (cargos, desenho, links, download, compartilhar)
js/colinha.js   lógica e desenho das colinhas
js/moldura.js   modelos de moldura e editor de foto
```

## Personalizar

- **Novos modelos de moldura:** adicione uma função em `TEMPLATES` (`js/moldura.js`) e um botão `.tpl` em `moldura.html`.
- **Cargos / dígitos:** objeto `CARGOS` em `js/common.js`.

> ⚖️ Respeite a legislação eleitoral (Lei 9.504/97 e Res. TSE 23.610/2019): use o campo *texto legal*
> para coligação/federação, CNPJ e demais informações obrigatórias.
