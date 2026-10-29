"""Gera src/kb-300.js a partir do PDF "Banco da Sá: 300 perguntas e respostas sobre nutrição".

Uso: pdftotext -layout Banco_Sa_300.pdf /tmp/out.txt && python3 -I scripts/kb300-from-pdf.py /tmp/out.txt
Cada "FAQ-Nxxx. Pergunta" vira um item; as linhas seguintes até a linha em branco são a resposta, com o texto como veio.
As palavras-chave saem da própria pergunta (para a busca), e o código FAQ-Nxxx fica guardado.
"""
import json, re, sys, unicodedata

STOP = set('''a o e de da do das dos em no na nos nas um uma uns umas para pra por com sem que se eu meu minha meus
minhas me mim voce posso pode podem devo deve preciso precisa como qual quais quanto quantos quantas quando onde
porque ou mais menos muito pouco isso esse essa este esta ao aos as os ja tem ter sou estou fazer faz e ne la so
tambem sempre todo toda todos todas dia dias é ser são sao existe vale melhor bom boa ruim'''.split())

def strip_accents(s):
    return ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn')

def keywords(q):
    ws = re.findall(r"[\wÀ-ú-]+", q.lower())
    out = []
    for w in ws:
        if len(w) < 3 or strip_accents(w) in STOP or w.isdigit():
            continue
        if w not in out:
            out.append(w)
    return out

def main(path):
    lines = open(path, encoding='utf-8').read().split('\n')
    items, cat, cur = [], '', None
    def close():
        if cur and cur['resposta']:
            cur['resposta'] = re.sub(r'\s+', ' ', cur['resposta']).strip()
            items.append(cur)
    for raw in lines:
        t = raw.strip()
        if t.startswith('Banco da Sá |') or '\f' in raw and not t:
            continue
        t = t.replace('\f', '').strip()
        m = re.match(r'^(\d{2})\. (.+)$', t)
        if m and not t.startswith('FAQ'):
            close(); cur = None; cat = m.group(2).strip()
            continue
        m = re.match(r'^(FAQ-N\d{3})\. (.+)$', t)
        if m:
            close()
            cur = {'id': m.group(1), 'categoria': cat, 'pergunta': m.group(2).strip(), 'resposta': ''}
            continue
        if not t:
            # Linha em branco fecha a resposta (quebras de página não têm linha em branco no meio do texto).
            if cur and cur['resposta']:
                close(); cur = None
            continue
        if cur is not None:
            cur['resposta'] += ' ' + t
    close()
    for it in items:
        it['palavras_chave'] = keywords(it['pergunta'])
    out = '// Gerado por scripts/kb300-from-pdf.py a partir do "Banco da Sá: 300 perguntas e respostas sobre nutrição" (não editar à mão).\n'
    out += 'export const KB_300 = ' + json.dumps(items, ensure_ascii=False, indent=1) + ';\n'
    open('src/kb-300.js', 'w', encoding='utf-8').write(out)
    print(len(items), 'itens;', len({i['categoria'] for i in items}), 'categorias')

if __name__ == '__main__':
    main(sys.argv[1])
