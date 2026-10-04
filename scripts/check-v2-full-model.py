"""Extract every UML attribute/operation/association, without editing the UML.

Targets describe the complete authorized scope. Existing dictionary treatments
remain baseline evidence; an inventory check never claims implemented endpoints.
"""
from pathlib import Path
import argparse
import hashlib
import html
import json
import re
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'docs/v2-amazon/diagrams/review-2026-09-24/07-complete-classes-sprint2-reviewed.drawio'
TARGETS = ROOT / 'docs/v2-amazon/models/FULL_MODEL_TARGETS.json'
EXPECTED_HASH = '104b126cc17565b57064fca0c6a8efd5cf43a076c1cb041355e5174cbe68dc88'

def extract():
    source = SOURCE.read_text(encoding='utf-8-sig').replace('\r\n', '\n')
    digest = hashlib.sha256(source.encode()).hexdigest()
    if digest != EXPECTED_HASH:
        raise ValueError(f'Unexpected UML source hash: {digest}')
    cells = {c.attrib['id']: c for c in ET.fromstring(source).iter('mxCell')}
    classes = {}
    for cell in cells.values():
        if 'swimlane;' not in cell.get('style', ''):
            continue
        label = re.search(r'<b>([^<]+)</b>', cell.get('value', ''))
        if label:
            classes[cell.attrib['id']] = {'umlId': cell.attrib['id'], 'name': label[1], 'attributes': [], 'operations': []}
    for cell in cells.values():
        parent = classes.get(cell.get('parent', ''))
        if not parent:
            continue
        for raw in re.split(r'<br\s*/?>', cell.get('value', '')):
            value = html.unescape(re.sub(r'<[^>]+>', '', raw)).strip()
            if not value.startswith('+ '):
                continue
            value = value[2:]
            if '(' in value.split(':')[0]:
                parent['operations'].append(value)
            else:
                match = re.fullmatch(r'(\w+)(\?)?:\s*(.+)', value)
                if not match:
                    raise ValueError(f'Unparsed UML field: {parent["name"]}.{value}')
                parent['attributes'].append({'name': match[1], 'optional': bool(match[2]), 'type': match[3]})
    targets = json.loads(TARGETS.read_text(encoding='utf-8'))['classes']
    by_name = {t['name']: t for t in targets}
    if set(by_name) != {c['name'] for c in classes.values()}:
        raise ValueError('Target map differs from the actual UML classes')
    relations = []
    for cell in cells.values():
        if cell.get('edge') != '1':
            continue
        src, dst = cell.get('source'), cell.get('target')
        if src not in classes or dst not in classes:
            raise ValueError(f'Dangling UML relation: {cell.attrib["id"]}')
        children = [c.get('value', '') for c in cells.values() if c.get('parent') == cell.attrib['id']]
        relations.append({'umlId': cell.attrib['id'], 'source': classes[src]['name'],
            'target': classes[dst]['name'], 'label': cell.get('value', ''), 'endLabels': children,
            'style': cell.get('style', '')})
    items = [{**c, 'target': by_name[c['name']]} for c in classes.values()]
    count = sum(len(c['attributes']) for c in items)
    if (len(items), count, len(relations)) != (57, 397, 93):
        raise ValueError(f'Unexpected UML topology: {len(items)}/{count}/{len(relations)}')
    return {'source': SOURCE.relative_to(ROOT).as_posix(), 'sourceSha256': digest,
        'counts': {'classes': len(items), 'attributes': count, 'relations': len(relations)},
        'implementationCertified': False, 'classes': items, 'relations': relations}

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    result = extract()
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'result': 'PASS', **result['counts'], 'sourceSha256': result['sourceSha256'],
        'implementationCertified': False}))
