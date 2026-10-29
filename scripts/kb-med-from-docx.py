"""Gera src/kb-med.js a partir da base "Medicamentos para emagrecimento, nutrição e treinamento" da ConsultoriaJP.

Uso: python3 -I scripts/kb-med-from-docx.py caminho/base_medicamentos.docx
O documento não tem subtítulos: cada seção (título 1) vira uma pergunta com o texto como veio; listas no formato
"Termo: explicação" das seções 3, 4 e 7 viram também perguntas próprias; os mitos da seção 15 viram uma pergunta cada.
Regras internas da IA (seções 1, 16, 17, 20 e Apêndice A) não entram, e frases dirigidas à IA são retiradas.
"""
import json, re, sys
import docx

CAT = 'Medicamentos para emagrecimento'
# Frases que são instruções para a IA ou para o app, não para o aluno.
META = re.compile(r'^(A IA|A assistente|O aplicativo deve|Não deve elogiar|Não orientar|Não sugerir|Não recomendar automaticamente|Me conte)\b')

# Pergunta do aluno para cada seção (o texto da resposta não muda).
SECTIONS = {
    '1': 'Remédio para emagrecer substitui a dieta?',
    '2': 'Como funcionam os remédios para emagrecer?',
    '3': 'Quais são as canetas emagrecedoras e quais as diferenças?',
    '4': 'Quais outros remédios são usados para emagrecer?',
    '5': 'Posso usar caneta manipulada, importada ou "peptídeos"?',
    '6': 'Uso caneta e quase não sinto fome. Como devo comer?',
    '7': 'A caneta pode dar náusea, vômito, refluxo, intestino preso ou diarreia?',
    '8': 'Quais são os sinais de alerta para quem usa caneta ou remédio para emagrecer?',
    '9': 'Como deve ser a alimentação de quem usa remédio para emagrecer?',
    '10': 'Como não perder massa muscular usando caneta para emagrecer?',
    '11': 'Como fica o treino de quem usa caneta para emagrecer?',
    '12': 'Uso outros remédios ou tenho alguma doença. O que muda com a caneta?',
    '13': 'Quanto peso vou perder com a caneta?',
    '14': 'O que acontece quando paro a caneta ou o remédio para emagrecer?',
    '18': 'Precisa de receita para comprar caneta emagrecedora?',
    'Apêndice B': 'Uso caneta para emagrecer. O que preciso cuidar na alimentação?',
}
SKIP = ('16', '17', '19', '20', 'Apêndice A')
# Na seção 1 só o parágrafo para o aluno; as regras da IA ficam de fora.
ONLY_PARAS = {'1': [2]}
# Perguntas próprias para os itens "Termo: explicação".
TERMS = {
    'Semaglutida': 'O que é semaglutida?',
    'Liraglutida': 'O que é liraglutida?',
    'Tirzepatida': 'O que é tirzepatida?',
    'Dulaglutida': 'O que é dulaglutida?',
    'Exenatida e lixisenatida': 'O que são exenatida e lixisenatida?',
    'Orlistate': 'O que é orlistate?',
    'Sibutramina': 'O que é sibutramina?',
    'Naltrexona/bupropiona': 'O que é naltrexona com bupropiona?',
    'Náusea': 'Estou com náusea por causa da caneta. O que fazer?',
    'Vômitos': 'Vomitei usando a caneta. O que fazer?',
    'Refluxo e sensação de estômago cheio': 'A caneta pode dar refluxo ou sensação de estômago cheio?',
    'Constipação': 'A caneta pode deixar o intestino preso?',
    'Diarreia': 'A caneta pode dar diarreia?',
}
# Nomes comerciais conhecidos, só para a busca (não aparecem no texto).
KEYS = {
    'O que é semaglutida?': ['semaglutida', 'ozempic', 'wegovy', 'rybelsus'],
    'O que é liraglutida?': ['liraglutida', 'saxenda', 'victoza'],
    'O que é tirzepatida?': ['tirzepatida', 'mounjaro'],
    'O que é dulaglutida?': ['dulaglutida', 'trulicity'],
    'O que acontece quando paro a caneta ou o remédio para emagrecer?': ['parar a caneta', 'parar o remédio', 'interromper', 'suspender', 'desmame', 'reganho', 'efeito rebote'],
    'Quais são as canetas emagrecedoras e quais as diferenças?': ['caneta emagrecedora', 'glp 1', 'ozempic', 'mounjaro', 'wegovy', 'saxenda'],
}
OTHER_DRUGS = 'Metformina'  # último item da seção 4 vira pergunta própria
OTHER_DRUGS_Q = 'Posso usar metformina, diurético ou laxante para emagrecer?'

def sec_id(h1):
    m = re.match(r'^(\d+)\.', h1)
    return m.group(1) if m else re.match(r'^(Apêndice [A-Z])', h1).group(1) if h1.startswith('Apêndice') else h1

def strip_meta(text):
    parts = re.split(r'(?<=[.!?])\s+', text)
    return ' '.join(x for x in parts if not META.match(x)).replace(' pela IA', '').strip()

def first_is_meta(text):
    return bool(META.match(re.split(r'(?<=[.!?])\s+', text)[0]))

def cap(t):
    t = t.strip()
    return t[:1].upper() + t[1:]

def unquote(t):
    return t.strip().strip('“”"').strip()

def main(path):
    d = docx.Document(path)
    sections, order, h1 = {}, [], None
    for p in d.paragraphs:
        t = p.text.strip()
        if not t:
            continue
        if p.style.name == 'Heading 1':
            h1 = sec_id(t); order.append(h1); sections[h1] = []
            continue
        if h1:
            sections[h1].append((p.style.name == 'List Bullet', t))
    refs = [t for _, t in sections.get('19', [])]
    items = []
    def add(q, a):
        a = a.strip()
        if a:
            it = {'categoria': CAT, 'pergunta': q, 'resposta': a}
            if q in KEYS:
                it['palavras_chave'] = KEYS[q]
            items.append(it)
    for sid in order:
        if sid in SKIP:
            continue
        paras = sections[sid]
        if sid == '15':
            for _, t in paras:
                m = re.match(r'^“([^”]+)”\s*(.*)$', t)
                add(m.group(1).strip(), strip_meta(m.group(2)))
            continue
        lines = []
        for i, (bullet, t) in enumerate(paras):
            if sid in ONLY_PARAS and i not in ONLY_PARAS[sid]:
                continue
            # Parágrafo que começa com instrução para a IA: o resto depende dela, então sai inteiro.
            if first_is_meta(t):
                continue
            body = unquote(strip_meta(t)) if sid == 'Apêndice B' else strip_meta(t)
            if not body:
                continue
            lines.append(('• ' if bullet else '') + body)
            term = t.split(':', 1)[0] if bullet and ':' in t else None
            if term in TERMS:
                add(TERMS[term], cap(strip_meta(t.split(':', 1)[1])))
            elif bullet and t.startswith(OTHER_DRUGS):
                add(OTHER_DRUGS_Q, body)
        text = ''
        for line in lines:
            text += ('\n' if line.startswith('• ') and text else '\n\n' if text else '') + line
        add(SECTIONS[sid], text)
    for it in items:
        it['referencias'] = refs
    out = '// Gerado por scripts/kb-med-from-docx.py a partir da base de medicamentos da ConsultoriaJP (não editar à mão).\n'
    out += 'export const KB_MED = ' + json.dumps(items, ensure_ascii=False, indent=1) + ';\n'
    open('src/kb-med.js', 'w', encoding='utf-8').write(out)
    print(len(items), 'itens')

if __name__ == '__main__':
    main(sys.argv[1])
