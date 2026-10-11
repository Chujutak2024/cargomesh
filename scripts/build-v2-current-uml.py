"""Derive the current contractual UML without rewriting historical QA evidence."""
from pathlib import Path
import argparse
import hashlib
import importlib.util
import json
import sys
import xml.etree.ElementTree as ET

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs/v2-amazon/diagrams/review-2026-09-24/08-complete-classes-contract-reconciled-2026-10-09.drawio'
ALLOWED = {
    35: ('O3AsrRVXhiO8iDlZrkKS-248', ['0..*', '1']),
    40: ('O3AsrRVXhiO8iDlZrkKS-263', ['1..*', '0..*']),
    73: ('rg1mzH5NKyUcr1gneQok-1', ['1', '1']),
    83: ('TTPNMglXCn0O7Q35afVn-1', ['1', '0..*']),
    90: ('cm-v2fix-3', ['1', '1']),
}

def expected():
    spec = importlib.util.spec_from_file_location('historical_uml', Path(__file__).with_name('check-v2-full-model.py'))
    inventory = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(inventory)
    model = inventory.extract()  # Also checks the frozen source hash and topology.
    tree = ET.fromstring(inventory.SOURCE.read_text(encoding='utf-8-sig'))
    cells = list(tree.iter('mxCell'))
    current = json.loads((ROOT / 'docs/v2-amazon/models/FULL_MODEL_CURRENT_RELATIONS.json').read_text(encoding='utf-8'))
    updates = {row['number']: row for row in current['relations'] if 'currentEndLabels' in row}
    if set(updates) != set(ALLOWED):
        raise ValueError('Derived UML must reconcile exactly the five authorized relationships')
    changes = []
    for number, (edge_id, ends) in ALLOWED.items():
        row, original = updates[number], model['relations'][number]
        if (row['umlId'], row['source'], row['target'], row['currentEndLabels']) != (
                edge_id, original['source'], original['target'], ends) or original['umlId'] != edge_id:
            raise ValueError(f'Unexpected reconciliation: {number}')
        labels = [cell for cell in cells if cell.get('parent') == edge_id]
        if len(labels) != 2 or [cell.get('value') for cell in labels] != original['endLabels']:
            raise ValueError(f'Unexpected original endpoints: {number}')
        # Preserve child order, geometry, edge IDs and all class/attribute/method cells.
        for cell, value in zip(labels, ends):
            cell.set('value', value)
        changes.append({'number': number, 'umlId': edge_id, 'source': row['source'],
            'target': row['target'], 'historicalEndLabels': original['endLabels'],
            'currentEndLabels': ends})
    tree.find('diagram').set('name', 'UML 08 contractual - main 42a4fde - derived 2026-10-09')
    text = ET.tostring(tree, encoding='unicode') + '\n'
    return text, {'path': OUT.relative_to(ROOT).as_posix(), 'baseCommit': current['sourceCommit'],
        'historicalSource': model['source'], 'historicalSha256': model['sourceSha256'],
        'sha256': hashlib.sha256(text.encode('utf-8')).hexdigest(), 'counts': model['counts'],
        'changes': changes, 'implementationCertified': False}

def verify():
    text, metadata = expected()
    if not OUT.is_file() or OUT.read_text(encoding='utf-8') != text:
        raise ValueError('Current derived UML drift; regenerate build-v2-current-uml.py')
    return metadata

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    if args.check:
        metadata = verify()
    else:
        text, metadata = expected()
        OUT.write_text(text, encoding='utf-8', newline='\n')
    print(json.dumps({'result': 'PASS', **metadata}, ensure_ascii=False))
