"""Gera src/kb-conceitos.js a partir do PDF "Banco de Conhecimento da Sá: 50 conceitos fundamentais de nutrição".

Uso: pdftotext -layout Banco_Conhecimento_Sa_50.pdf /tmp/out.txt && python3 -I scripts/kb50-from-pdf.py /tmp/out.txt
Cada conceito vira um item: a pergunta principal é a primeira das "Perguntas relacionadas", as outras viram
perguntas alternativas; a resposta junta Definição, Contexto e Exemplo prático com o texto como veio.
A parte "Orientação para uso da Sá" é instrução para a assistente e não entra; as referências vão em cada item.
"""
import json, re, sys

SECTIONS = {'Definição': 'def', 'Contexto e importância': 'ctx', 'Exemplo prático': 'ex', 'Perguntas relacionadas': 'rel'}

def main(path):
    lines = [l.rstrip() for l in open(path, encoding='utf-8').read().replace('\f', '\n').split('\n')]
    lines = [l for l in lines if not l.strip().startswith('ConsultoriaJP | Banco de Conhecimento da Sá')]
    items, cat, cur, part = [], '', None, None
    refs, in_refs = [], False
    nonempty = [i for i, l in enumerate(lines) if l.strip()]
    def next_text(i):
        for j in nonempty:
            if j > i:
                return lines[j].strip()
        return ''
    for i, raw in enumerate(lines):
        t = raw.strip()
        if not t:
            continue
        if t == 'Referências consultadas':
            in_refs, cur = True, None
            continue
        if in_refs:
            if t.startswith('As definições foram'):
                break
            if t.startswith('http'):
                refs[-1] += ' ' + t
            elif refs and not refs[-1].split()[-1].startswith('http') and not refs[-1].endswith('.'):
                refs[-1] += ' ' + t
            else:
                refs.append(t)
            continue
        if t.startswith('Orientação para uso da Sá'):
            cur = None
            continue
        m = re.match(r'^(\d)\. (.+)$', t)
        if m and re.match(r'^\d{2}\. ', next_text(i)):
            cat = m.group(2).strip()
            continue
        m = re.match(r'^(\d{2})\. (.+)$', t)
        if m and next_text(i) == 'Definição':
            cur = {'n': int(m.group(1)), 'categoria': cat, 'conceito': m.group(2).strip(), 'def': '', 'ctx': '', 'ex': '', 'rel': ''}
            items.append(cur)
            continue
        if cur is None:
            continue
        if t in SECTIONS:
            part = SECTIONS[t]
            continue
        cur[part] = (cur[part] + ' ' + t).strip()
    out = []
    for it in items:
        qs = [q.strip() + '?' for q in it['rel'].split('?') if q.strip()]
        out.append({
            'id': f"CONCEITO-{it['n']:02d}",
            'categoria': it['categoria'],
            'conceito': it['conceito'],
            'pergunta': qs[0],
            'perguntas_alternativas': qs[1:],
            'resposta': '\n\n'.join(x for x in (it['def'], it['ctx'], it['ex']) if x),
            'palavras_chave': [it['conceito'].lower()],
            'referencias': refs,
        })
    js = '// Gerado por scripts/kb50-from-pdf.py a partir do "Banco de Conhecimento da Sá: 50 conceitos" (não editar à mão).\n'
    js += 'export const KB_CONCEITOS = ' + json.dumps(out, ensure_ascii=False, indent=1) + ';\n'
    open('src/kb-conceitos.js', 'w', encoding='utf-8').write(js)
    print(len(out), 'conceitos;', len(refs), 'referências')

if __name__ == '__main__':
    main(sys.argv[1])
