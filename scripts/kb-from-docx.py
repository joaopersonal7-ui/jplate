"""Gera src/kb-base.js a partir da base de conhecimento .docx da ConsultoriaJP.

Uso: python3 -I scripts/kb-from-docx.py caminho/base.docx
Cada título de nível 2 vira uma pergunta; os parágrafos seguintes, a resposta (texto como veio).
Seções de regras internas da assistente e listas de referências não entram como respostas.
Frases que são instruções para a IA ("A assistente deve...", "A IA ...") são retiradas da resposta.
"""
import json, re, sys
import docx

SKIP_H1 = ('Referências', 'Regras', '20.', '23.')
SKIP_H2 = ('21.20.', '21.21.', 'Como manter o conteúdo do banco atualizado')
META = re.compile(r'^(A assistente|A IA)\b')

def clean_title(t):
    return re.sub(r'^\d+(\.\d+)*\.\s*', '', t).strip()

def strip_meta(text):
    lines = text.split('\n')
    if META.match(lines[0]) and lines[0].rstrip().endswith(':'):
        return ''
    out = []
    for line in lines:
        parts = re.split(r'(?<=[.!?])\s+', line)
        kept = ' '.join(x for x in parts if not META.match(x)).strip()
        if kept:
            out.append(kept)
    return '\n'.join(out)

# Ajustes de rótulo para o aluno (o texto das respostas não muda).
RENAME_H1 = {'Segurança e regras para a assistente': 'Segurança e cuidados'}
RENAME_H2 = {'A assistente pode montar dieta para diabetes?': 'Pode me passar uma dieta para diabetes?'}

def main(path):
    d = docx.Document(path)
    items, refs_by_h1 = [], {}
    h1, cur = '', None
    def close():
        if cur and cur['resposta']:
            items.append(cur)
    for p in d.paragraphs:
        s, t = p.style.name, p.text.strip()
        if not t:
            continue
        if s == 'Title':
            close(); cur = None; h1 = ''
            continue
        if s == 'Heading 1':
            close(); cur = None; h1 = t
            continue
        if s == 'Heading 2':
            close(); cur = None
            if h1.startswith(SKIP_H1) or t.startswith(SKIP_H2):
                if t.startswith('21.21.'):
                    h1_refs = refs_by_h1.setdefault(h1, [])
                    cur_refs = h1_refs
                continue
            cur = {'categoria': RENAME_H1.get(clean_title(h1), clean_title(h1)), 'pergunta': RENAME_H2.get(clean_title(t), clean_title(t)), 'resposta': ''}
            continue
        # referências do módulo 21 (lista após o título 21.21)
        if s == 'List Bullet' and cur is None and h1.startswith('21.'):
            refs_by_h1.setdefault(h1, []).append(t)
            continue
        if h1.startswith('22.') and s == 'List Bullet' and ':' in t:
            term, desc = t.split(':', 1)
            items.append({'categoria': 'Glossário de energia e exercício', 'pergunta': f'O que é {term.strip()}?', 'resposta': desc.strip()})
            continue
        if cur is None:
            continue
        body = strip_meta(t)
        if body:
            sep = '\n' if s == 'List Bullet' or cur['resposta'].endswith(':') else '\n\n'
            prefix = '• ' if s == 'List Bullet' else ''
            cur['resposta'] = (cur['resposta'] + sep if cur['resposta'] else '') + prefix + body
    close()
    for it in items:
        refs = refs_by_h1.get(next((h for h in refs_by_h1 if clean_title(h) == it['categoria']), ''), [])
        if refs:
            it['referencias'] = refs
    out = '// Gerado por scripts/kb-from-docx.py a partir da base de conhecimento da ConsultoriaJP (não editar à mão).\n'
    out += 'export const KB_BASE = ' + json.dumps(items, ensure_ascii=False, indent=1) + ';\n'
    open('src/kb-base.js', 'w', encoding='utf-8').write(out)
    print(len(items), 'itens')

main(sys.argv[1])
