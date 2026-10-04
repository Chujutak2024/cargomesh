"""Register additive HAC-40 migrations and the already merged HAC-11 delta.

Does not modify any SQL source or historical V1 migration. Hashes normalize LF,
matching the existing gate's provenance format.
"""
from pathlib import Path
import hashlib
import json

ROOT = Path(__file__).resolve().parents[1]
path = ROOT / 'supabase-v2/migration-manifest.json'
manifest = json.loads(path.read_text(encoding='utf-8'))
known = {entry['version'] for entry in manifest['migrations']}
for sql in sorted((ROOT / 'supabase-v2/supabase/migrations').glob('*.sql')):
    version = sql.name.split('_', 1)[0]
    if version in known:
        continue
    if '_hac11_' not in sql.name and '_hac40_' not in sql.name:
        raise ValueError(f'Unapproved missing entry: {sql.name}')
    preceding = [entry['version'] for entry in manifest['migrations'] if entry['version'] < version]
    manifest['migrations'].append({
        'issue': 'HAC-11' if '_hac11_' in sql.name else 'HAC-40',
        'path': sql.relative_to(ROOT).as_posix(), 'version': version,
        'sha256': hashlib.sha256(sql.read_text(encoding='utf-8-sig').encode()).hexdigest(),
        'type': 'schema', 'profile': 'v2-clean', 'dependencies': [max(preceding)] if preceding else [],
    })
manifest['migrations'].sort(key=lambda entry: entry['version'])
path.write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
profiles_path = ROOT / 'supabase-v2/test-profiles.json'
profiles = json.loads(profiles_path.read_text())
for test in ['12_hac11_mcp_account_links.test.sql','15_v2_hac40_facility_commands.test.sql', '16_v2_hac40_request_lifecycle.test.sql', '17_v2_hac40_organization_commands.test.sql']:
    name = 'supabase/tests/' + test
    if name not in profiles['v2']:
        profiles['v2'].append(name)
profiles_path.write_text(json.dumps(profiles, indent=2) + '\n', encoding='utf-8')
print(f'Registered {len(manifest["migrations"])} V2 migrations; {len(profiles["v2"])} V2 test files.')
