"""Development-only FR/EN catalogue completion. No application data leaves the PC.

Requires CTranslate2 and SentencePiece installed under .codex-tools/argos, and
the official Argos fr_en 1.9 model under .codex-tools/argos-model. Neither the
model nor the translation runtime is shipped with the website.
"""
import json
import os
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / '.codex-tools/argos'))
os.environ.setdefault('OMP_NUM_THREADS', '2')
import ctranslate2
import sentencepiece

model = ROOT / '.codex-tools/argos-model/translate-fr_en-1_9'
tokenizer = sentencepiece.SentencePieceProcessor(model_file=str(model / 'sentencepiece.model'))
translator = ctranslate2.Translator(str(model / 'model'), device='cpu', compute_type='int8', inter_threads=1, intra_threads=2)
catalog_path = ROOT / 'lib/i18n/generated-fr-en.json'
catalog = json.loads(catalog_path.read_text(encoding='utf-8'))
candidates = json.loads((ROOT / '.codex-tools/i18n-candidates.json').read_text(encoding='utf-8'))
review_path = ROOT / 'lib/i18n/reviewed-fr-en.json'
reviewed = json.loads(review_path.read_text(encoding='utf-8')) if review_path.exists() else {}
missing = [text for text in candidates if text not in catalog and text not in reviewed]
placeholder_pattern = re.compile(r'\{\{(?:\d+|[A-Za-z]\w*)\}\}|%(?:\d+\$)?[sIL]')

def prepare(text):
    placeholders = []
    def protect(match):
        placeholders.append(match[0])
        return f'ZXQ{len(placeholders)-1}QXZ'
    return placeholder_pattern.sub(protect, text), placeholders

def restore(text, placeholders):
    for index, original in enumerate(placeholders):
        marker = rf'ZXQ\s*{index}\s*QXZ'
        if not re.search(marker, text, flags=re.I):
            return None
        text = re.sub(marker, lambda _: original, text, flags=re.I)
    return text

def postprocess(value):
    value = value.replace('▁', ' ')
    value = re.sub(r'\b(?:Cyclostrategist|Cyclo Strategist)\b', 'Cyclo Stratège', value, flags=re.I)
    value = re.sub(r'\bSports Directors?\b', lambda m: 'Sporting Directors' if m[0].endswith('s') else 'Sporting Director', value)
    value = re.sub(r'\brunners\b', 'riders', value, flags=re.I)
    value = re.sub(r'\brunner\b', 'rider', value, flags=re.I)
    return ' '.join(value.split()).strip()

print(f'Completing {len(missing)} entries offline with two CPU threads.', flush=True)
for start in range(0, len(missing), 32):
    batch = missing[start:start+32]
    prepared = [prepare(text) for text in batch]
    tokens = [tokenizer.encode(text, out_type=str) for text, _ in prepared]
    results = translator.translate_batch(tokens, beam_size=3, max_batch_size=32, max_decoding_length=512, repetition_penalty=1.1)
    for text, (_, placeholders), result in zip(batch, prepared, results):
        translated = restore(postprocess(''.join(result.hypotheses[0])), placeholders)
        if translated:
            catalog[text] = translated
    catalog_path.write_text(json.dumps(catalog, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    print(f'Completed {min(start+32,len(missing))}/{len(missing)}', flush=True)
