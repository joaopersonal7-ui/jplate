#!/usr/bin/env python3
"""Gera src/kb-dicas.js a partir do "Banco de Dicas Nutricionais da Sá" (JSON enviado pelo Joao em 05/11/2026).

Uso: python3 scripts/kbdicas-from-json.py /caminho/Banco_Dicas_Nutricionais_Sa_JPLATE.json
Original guardado em /mnt/project-files/jplate-sa/banco-dicas-nutricionais.json. O texto das dicas não é alterado.
"""
import json
import sys
from pathlib import Path

dados = json.loads(Path(sys.argv[1]).read_text(encoding='utf-8'))
dicas = [{
    'id': d['id'],
    'categoria': d['categoria'],
    'conceito': d['conceito_origem'],
    'titulo': d['titulo'].strip(),
    'dica': d['dica'].strip(),
    'palavras_chave': [t.replace('_', ' ') for t in d['tags']],
} for d in dados['dicas']]

saida = Path(__file__).resolve().parent.parent / 'src' / 'kb-dicas.js'
saida.write_text(
    '// Gerado por scripts/kbdicas-from-json.py a partir do "Banco de Dicas Nutricionais da Sá" (não editar à mão).\n'
    f'export const KB_DICAS = {json.dumps(dicas, ensure_ascii=False, indent=1)};\n',
    encoding='utf-8')
print(f'{len(dicas)} dicas → {saida}')
