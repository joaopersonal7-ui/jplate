"""Gera src/kb-frutas.js a partir do texto "Perguntas sobre frutas e vitaminas" (200 perguntas) que o João mandou.

Uso: python3 -I scripts/kbfrutas-from-text.py /mnt/project-files/jplate-sa/frutas-vitaminas-200.txt
Cada pergunta numerada vira um item com a resposta como veio; a categoria vem da linha "CATEGORIA N. NOME".
"""
import json, re, sys

def cat_name(s):
    s = re.sub(r'\b(vitamina|complexo) ([a-z])\b', lambda m: m.group(1) + ' ' + m.group(2).upper(), s.strip().lower())
    return s[:1].upper() + s[1:]

def main(path):
    blocks = [b.strip() for b in open(path, encoding='utf-8').read().split('\n\n') if b.strip()]
    items, cat, cur = [], '', None
    for b in blocks:
        m = re.match(r'^CATEGORIA \d+\. (.+)$', b)
        if m:
            cat = cat_name(m.group(1)); cur = None
            continue
        if b.startswith(('PARTE ', 'Adicione ')):
            cur = None
            continue
        m = re.match(r'^(\d+)\. (.+\?)$', b)
        if m:
            cur = {'id': f'FRUTAS-{int(m.group(1)):03d}', 'categoria': cat, 'pergunta': m.group(2), 'resposta': ''}
            items.append(cur)
            continue
        cur['resposta'] = (cur['resposta'] + '\n\n' + b).strip()
    assert len(items) == 200 and all(i['resposta'] for i in items), len(items)
    js = '// Gerado por scripts/kbfrutas-from-text.py a partir das 200 perguntas sobre frutas e vitaminas (não editar à mão).\n'
    js += 'export const KB_FRUTAS = ' + json.dumps(items, ensure_ascii=False, indent=1) + ';\n'
    open('src/kb-frutas.js', 'w', encoding='utf-8').write(js)
    print(len(items), 'itens;', len({i['categoria'] for i in items}), 'categorias')

if __name__ == '__main__':
    main(sys.argv[1])
