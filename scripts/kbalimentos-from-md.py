"""Gera src/kb-alimentos.js a partir da "Base técnica de alimentos para Sá/JPlate" (fichas de 100 alimentos, em Markdown).

Uso: python3 -I scripts/kbalimentos-from-md.py /mnt/project-files/jplate-sa/base-tecnica-alimentos.md
Cada seção de cada ficha (Identidade, Safra, Cultivo, Composição nutricional...) vira um item "Alimento: seção", com o
texto como veio. Não entram: regras e metadados para a assistente ou para a API, registros de API (blocos de código,
identificadores e etiquetas), frases dirigidas à Sá e fichas que só apontam para outro arquivo (laranja, maçã, mamão;
a banana usa a ficha completa do fim do arquivo). Os links viram referências do alimento.
"""
import json, re, sys

FOOD = re.compile(r'^#{1,3} (?:\d+\. |Ficha \d+\. |Fichas \d+ (?:a|e) \d+\. )(.+)$')
SKIP_SECTION = re.compile(r'API|Metadados|Registro|Proveni|Fontes|Regras|Convenç|Conceitos de consulta|Conteúdo|Parte \d|Parcela|Ficha canônica')
LINK = re.compile(r'\[([^\]]+)\]\((https?://[^)]+)\)')
DROP = re.compile(r'\bAPI\b|\bSá\b|Aliases?:|[Tt]ags?:|`[a-z]+\.[a-z_]+\.|record_id|base_frutas_')
SENT = re.compile(r'(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÂÊÔÃÕÇ“"*])')

def clean(par, refs):
    par = par.replace(' para a Sá', '')
    def link(m):
        refs.append(m.group(2)); return m.group(1)
    par = LINK.sub(link, par)
    keep = [s for s in SENT.split(par) if not DROP.search(s)]
    out = ' '.join(keep)
    out = re.sub(r'`([^`]+)`', r'\1', out).replace('**', '')
    out = re.sub(r'(?<![\w*])\*([^*\n]+)\*(?!\w)', r'\1', out)
    out = re.sub(r'\s+', ' ', out).strip()
    return out if re.search(r'[a-zà-ú]{3}', out) and not re.fullmatch(r'[^:]{1,60}:', out) else ''

def lower_first(s):
    return s[:1].lower() + s[1:] if not s[1:2].isupper() else s

def main(path):
    lines = open(path, encoding='utf-8').read().split('\n')
    foods, food, sec, in_code, para = [], None, None, False, []
    def flush():
        if food is not None and sec is not None and para:
            food['secs'].append((sec, list(para)))
        para.clear()
    for raw in lines:
        l = raw.rstrip()
        if l.startswith('```'):
            in_code = not in_code; continue
        if in_code:
            continue
        m = FOOD.match(l)
        if m and not SKIP_SECTION.search(m.group(1)):
            flush()
            name = m.group(1).strip()
            if l.startswith('### ') and food and food.get('group'):
                # subficha dentro de um grupo (arroz): vira alimento próprio
                pass
            food = {'name': name, 'secs': [], 'refs': [], 'group': l.startswith('## Fichas')}
            foods.append(food); sec = None
            continue
        h = re.match(r'^(#{1,3}) (.+)$', l)
        if h:
            flush()
            t = h.group(2).strip()
            if SKIP_SECTION.search(t) or h.group(1) == '#':
                if h.group(1) != '###':
                    food = None
                sec = None
            else:
                sec = re.sub(r'\s*(?:e|/)\s*API$', '', t)
                if food is not None:
                    food['headers'] = True
            continue
        if food is None or l.strip() in ('', '---'):
            if para and l.strip() == '':
                pass
            continue
        b = re.match(r'^\*\*([^*]{2,60}?):\*\*\s*(.*)$', l)
        if b and not l.startswith('- ') and not food.get('headers'):
            flush(); sec = re.sub(r'\s*(?:e|/)\s*API$', '', b.group(1).strip()); l = b.group(2)
        if sec is None:
            sec = 'Resumo'
        para.append(('• ' if l.startswith('- ') else '') + (l[2:] if l.startswith('- ') else l))
    flush()
    items = []
    for f in foods:
        text0 = ' '.join(p for _, ps in f['secs'] for p in ps)
        if 'Ficha completa na' in text0 or 'Duplicata conceitual' in text0:
            continue  # só aponta para outro arquivo ou para outra ficha (chia)
        name = re.sub(r'^Ficha \d+\. ', '', f['name'])
        merged = {}
        for s, ps in f['secs']:
            txt = '\n'.join(x for x in (clean(p, f['refs']) for p in ps) if x)
            if txt:
                merged.setdefault(s, []).append(txt)
        for s, txts in merged.items():
            items.append({'alimento': name, 'secao': s, 'resposta': '\n\n'.join(txts), 'refs': f['refs']})
    out = []
    for n, it in enumerate(items, 1):
        q = f"{it['alimento']}: {lower_first(it['secao'])}" if it['secao'] != 'Resumo' else it['alimento']
        out.append({'id': f'ALIM-{n:03d}', 'categoria': 'Fichas técnicas de alimentos', 'alimento': it['alimento'],
                    'pergunta': q, 'resposta': it['resposta'], 'palavras_chave': [it['alimento'].lower()],
                    'referencias': list(dict.fromkeys(it['refs']))})
    js = '// Gerado por scripts/kbalimentos-from-md.py a partir da "Base técnica de alimentos para Sá/JPlate" (não editar à mão).\n'
    js += 'export const KB_ALIMENTOS = ' + json.dumps(out, ensure_ascii=False, indent=1) + ';\n'
    open('src/kb-alimentos.js', 'w', encoding='utf-8').write(js)
    print(len(out), 'itens;', len({i['alimento'] for i in out}), 'alimentos')

if __name__ == '__main__':
    main(sys.argv[1])
