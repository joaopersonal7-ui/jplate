"""Gera src/kb-neural.js a partir do PDF "Adaptação neural, força e hipertrofia" (material educativo para a Sá).

Uso: pdftotext -layout Guia_Adaptacao_Neural.pdf /tmp/out.txt && python3 -I scripts/kbneural-from-pdf.py /tmp/out.txt
As seções 1 a 10 viram um item cada (título da seção; subtítulos ficam como "Subtítulo: texto"), as perguntas
da seção 11 viram itens próprios e a síntese da seção 12 vira um resumo. O parágrafo da síntese que é instrução
para a assistente ("A Sá deve responder...") não entra; as referências vão em cada item.
"""
import json, re, sys

CAT = 'Adaptação neural, força e hipertrofia'
FROM = 'Guia de adaptação neural, força e hipertrofia'
RESUMO = 'Resumo: adaptação neural e hipertrofia'

def main(path):
    lines = [l.strip() for l in open(path, encoding='utf-8').read().replace('\f', '\n').split('\n')]
    lines = [l for l in lines if l and not l.startswith('ConsultoriaJP |')]
    start = next(i for i, l in enumerate(lines) if l.startswith('1. O que é adaptação neural'))
    sections, cur, n = [], None, 0
    refs, in_refs = [], False
    for l in lines[start:]:
        m = re.match(r'^(\d+)\. (.+)$', l)
        if m and int(m.group(1)) == n + 1 and (cur is None or len(cur['subs']) or n == 0):
            n += 1
            if m.group(2).startswith('Referências'):
                in_refs = True
                continue
            cur = {'n': n, 'title': m.group(2), 'subs': [], 'wrap': bool(re.search(r' (do|da|de|saber)$', m.group(2)))}
            sections.append(cur)
            continue
        if in_refs:
            if l.startswith('http'):
                refs[-1] += ' ' + l
            elif refs and not refs[-1].split()[-1].startswith('http') and not re.match(r'^[A-Z][a-z]+ [A-Z]{1,3}[ ,]', l):
                refs[-1] += ' ' + l
            else:
                refs.append(l)
            continue
        if cur['wrap'] and not cur['subs']:
            cur['title'] += ' ' + l
            cur['wrap'] = False
            continue
        prev_done = cur['subs'] and cur['subs'][-1][1].endswith(('.', '?'))
        is_q = cur['n'] == 11 and l.endswith('?')
        if not cur['subs'] or (cur['n'] != 11 and prev_done and not l.endswith('.') and len(l) < 60) or is_q:
            cur['subs'].append([l, ''])
        else:
            cur['subs'][-1][1] = (cur['subs'][-1][1] + ' ' + l).strip()
    items = []
    def add(q, a, keys=None):
        it = {'id': f'NEURAL-{len(items) + 1:02d}', 'categoria': CAT, 'pergunta': q, 'resposta': a}
        if keys:
            it['palavras_chave'] = keys
        items.append(it)
    for s in sections:
        if s['n'] == 11:
            for q, a in s['subs']:
                add(q, a)
        elif s['n'] == 12:
            # Síntese: o primeiro "subtítulo" é a linha "Adaptação neural: ..." quebrada; junta tudo e tira a instrução para a Sá.
            text = ' '.join((h + ' ' + b).strip() for h, b in s['subs'])
            text = re.split(r'\s*A Sá deve responder', text)[0]
            paras = re.split(r'\s(?=(?:Hipertrofia|Relação): )', text)
            add(RESUMO, '\n\n'.join(p.strip() for p in paras))
        else:
            add(s['title'], '\n\n'.join(f'{h}: {b}' if b else h for h, b in s['subs']))
    for it in items:
        it['referencias'] = refs
    js = '// Gerado por scripts/kbneural-from-pdf.py a partir do guia "Adaptação neural, força e hipertrofia" (não editar à mão).\n'
    js += f'export const KB_NEURAL_FROM = {json.dumps(FROM, ensure_ascii=False)};\n'
    js += 'export const KB_NEURAL = ' + json.dumps(items, ensure_ascii=False, indent=1) + ';\n'
    open('src/kb-neural.js', 'w', encoding='utf-8').write(js)
    print(len(items), 'itens;', len(refs), 'referências')

if __name__ == '__main__':
    main(sys.argv[1])
