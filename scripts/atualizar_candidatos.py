#!/usr/bin/env python3
"""
Baixa as candidaturas registradas no TSE (Portal de Dados Abertos) e gera
arquivos JSON leves em data/candidatos/ para o site buscar candidatos.

Fonte oficial: https://dadosabertos.tse.jus.br  (arquivo consulta_cand_<ano>.zip)

Só são publicados dados públicos de campanha: nome de urna, número, cargo,
partido, federação/coligação, CNPJ de campanha e resultado. CPF, e-mail,
título de eleitor, data de nascimento etc. NÃO são exportados.

Uso:
    python3 scripts/atualizar_candidatos.py            # anos padrão
    python3 scripts/atualizar_candidatos.py 2024 2026  # anos escolhidos
Só usa a biblioteca padrão do Python.
"""
import csv
import io
import json
import os
import sys
import urllib.request
import zipfile
from collections import defaultdict
from datetime import datetime, timezone

ANOS_PADRAO = [2026, 2024]
URL = 'https://cdn.tse.jus.br/estatistica/sead/odsele/consulta_cand/consulta_cand_{ano}.zip'
RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data', 'candidatos')

# cargos que entram (sem vices e suplentes): código TSE -> chave do site
CARGOS = {1: 'presidente', 3: 'governador', 5: 'senador', 6: 'dep_federal',
          7: 'dep_estadual', 8: 'dep_distrital', 11: 'prefeito', 13: 'vereador'}

RESULTADO = {'ELEITO': 'E', 'ELEITO POR QP': 'E', 'ELEITO POR MÉDIA': 'E',
             'SUPLENTE': 'S', 'NÃO ELEITO': 'N', '2º TURNO': '2'}

# ordem dos campos em cada registro (arrays para economizar espaço)
CAMPOS = ['sq', 'nome', 'num', 'cargo', 'pnum', 'psigla', 'agremiacao', 'cnpj', 'res']


def nulo(v):
    v = (v or '').strip()
    return '' if v in ('#NULO', '#NE', '#NULO#', '-1', '-3') else v


def agremiacao(r):
    """Texto de coligação/federação exigido na propaganda (com os partidos)."""
    col = nulo(r['NM_COLIGACAO'])
    if col and col not in ('PARTIDO ISOLADO', 'FEDERAÇÃO'):
        comp = nulo(r['DS_COMPOSICAO_COLIGACAO'])
        return f'{col} ({comp})' if comp else col
    fed = nulo(r['NM_FEDERACAO'])
    if fed:
        comp = nulo(r['DS_COMPOSICAO_FEDERACAO'])
        comp = '/'.join(p.split('-', 1)[-1].strip() for p in comp.split('/')) if comp else ''
        return f'{fed} ({comp})' if comp else fed
    return ''


def baixar(ano):
    url = URL.format(ano=ano)
    print(f'Baixando {url} ...', flush=True)
    req = urllib.request.Request(url, headers={'User-Agent': 'colinha-moldura/1.0 (dados abertos)'})
    with urllib.request.urlopen(req, timeout=600) as resp:
        return zipfile.ZipFile(io.BytesIO(resp.read()))


def ler(zf):
    for nome in zf.namelist():
        if not nome.lower().endswith('.csv') or 'BRASIL' in nome.upper():
            continue
        with zf.open(nome) as f:
            yield from csv.DictReader(io.TextIOWrapper(f, encoding='latin-1'), delimiter=';')


def gravar(caminho, obj):
    os.makedirs(os.path.dirname(caminho), exist_ok=True)
    txt = json.dumps(obj, ensure_ascii=False, separators=(',', ':'))
    if os.path.exists(caminho) and open(caminho, encoding='utf-8').read() == txt:
        return False
    with open(caminho, 'w', encoding='utf-8') as f:
        f.write(txt)
    return True


def processar(ano):
    zf = baixar(ano)
    cands = {}  # SQ_CANDIDATO -> registro (fica a linha do último turno)
    info = {}
    for r in ler(zf):
        try:
            cargo = int(r['CD_CARGO'])
        except ValueError:
            continue
        if cargo not in CARGOS:
            continue
        sq = r['SQ_CANDIDATO']
        turno = int(r['NR_TURNO'] or 1)
        if sq in cands and cands[sq]['_turno'] > turno:
            continue
        info.setdefault('nome', r['DS_ELEICAO'])
        info.setdefault('data', r['DT_ELEICAO'])
        info['geracao'] = r['DT_GERACAO']
        cands[sq] = {
            '_turno': turno, '_uf': r['SG_UF'], '_ue': r['SG_UE'], '_nue': r['NM_UE'],
            'sq': sq,
            'nome': nulo(r['NM_URNA_CANDIDATO']) or nulo(r['NM_CANDIDATO']),
            'num': r['NR_CANDIDATO'],
            'cargo': cargo,
            'pnum': r['NR_PARTIDO'],
            'psigla': r['SG_PARTIDO'],
            'agremiacao': agremiacao(r),
            'cnpj': nulo(r['NR_CNPJ_CANDIDATO']),
            'res': RESULTADO.get(r['DS_SIT_TOT_TURNO'], ''),
        }

    municipal = any(c['cargo'] in (11, 13) for c in cands.values())
    base = os.path.join(RAIZ, str(ano))
    grupos = defaultdict(list)
    nomes_ue = {}
    for c in cands.values():
        if municipal:
            chave = (c['_uf'], c['_ue'])
            nomes_ue[chave] = c['_nue'].title()
        else:
            chave = ('BR',) if c['cargo'] == 1 else (c['_uf'],)
        grupos[chave].append([c[k] for k in CAMPOS])

    alterados = 0
    indice = {}
    for chave, lista in grupos.items():
        lista.sort(key=lambda x: (x[3], x[1]))
        if municipal:
            uf, ue = chave
            alterados += gravar(os.path.join(base, uf, f'{ue}.json'), lista)
            indice.setdefault(uf, []).append([ue, nomes_ue[chave], len(lista)])
        else:
            alterados += gravar(os.path.join(base, f'{chave[0]}.json'), lista)
            indice[chave[0]] = len(lista)
    if municipal:
        for uf in indice:
            indice[uf].sort(key=lambda x: x[1])

    meta = {
        'ano': ano,
        'tipo': 'municipal' if municipal else 'geral',
        'nome': info.get('nome', f'Eleições {ano}').title(),
        'data': info.get('data', ''),
        'geracao_tse': info.get('geracao', ''),
        'total': len(cands),
        'campos': CAMPOS,
        'cargos': CARGOS,
        'indice': indice,
    }
    gravar(os.path.join(base, 'index.json'), meta)
    print(f'{ano}: {len(cands)} candidaturas, {len(grupos)} arquivos ({alterados} alterados)', flush=True)
    return meta


def main():
    anos = [int(a) for a in sys.argv[1:]] or ANOS_PADRAO
    eleicoes = []
    caminho = os.path.join(RAIZ, 'eleicoes.json')
    if os.path.exists(caminho):
        eleicoes = json.load(open(caminho, encoding='utf-8')).get('eleicoes', [])
    for ano in anos:
        meta = processar(ano)
        eleicoes = [e for e in eleicoes if e['ano'] != ano]
        eleicoes.append({k: meta[k] for k in ('ano', 'tipo', 'nome', 'data', 'geracao_tse', 'total')})
    eleicoes.sort(key=lambda e: -e['ano'])
    gravar(caminho, {
        'fonte': 'TSE - Portal de Dados Abertos (consulta_cand)',
        'atualizado': datetime.now(timezone.utc).strftime('%Y-%m-%d'),
        'eleicoes': eleicoes,
    })


if __name__ == '__main__':
    main()
