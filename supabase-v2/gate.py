"""Local-only HAC-29 gates. Python 3.11+, Docker, Node/npx; no hosted operations."""
from pathlib import Path
import argparse
import hashlib
import json
import os
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
PROFILE = ROOT / 'supabase-v2'
SCENARIO = ROOT / 'supabase/scenarios/v2-road-baseline'
CLI = ['npx.cmd' if os.name == 'nt' else 'npx', '--yes', 'supabase@2.117.0']
V2 = 'supabase_db_cargomesh-v2-local'
V1 = 'supabase_db_hac29-v1-reference'
BASELINE = 'supabase_db_hac29-baseline-reference'
MANIFEST = json.loads((PROFILE / 'migration-manifest.json').read_text())
BASELINE_VERSIONS = ('20260927042808', '20260927042811')


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def safe(text):
    text = re.sub(r'eyJ[\w-]+\.[\w-]+\.[\w-]+', '[REDACTED_JWT]', text)
    text = re.sub(r'(postgres(?:ql)?://[^:\s]+:)[^@\s]+@', r'\1[REDACTED]@', text)
    return re.sub(r'(?im)^.*(?:secret key|service_role key|anon key|publishable key|secret_key|access key|password|sb_secret_|sb_publishable_).*$', '[REDACTED_CREDENTIAL_LINE]', text)


def write(path, text):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding='utf-8', newline='\n')
    require(path.read_text(encoding='utf-8') == text, f'Read-back mismatch: {path}')


def run(label, args, data=None):
    result = subprocess.run([str(a) for a in args], input=data, cwd=ROOT,
                            capture_output=True, encoding='utf-8', errors='replace')
    output = safe(result.stdout + result.stderr)
    write(EVIDENCE / (label + '.log'), 'COMMAND: ' + subprocess.list2cmdline([str(a) for a in args])
          + '\nCWD: ' + str(ROOT) + '\n' + output + f'\nEXIT_CODE: {result.returncode}\n')
    print(f'{label}: exit={result.returncode}\n{output[-2500:]}', flush=True)
    require(result.returncode == 0, f'{label} failed; see {EVIDENCE}')
    return result.stdout


def sql(label, db, query):
    require(db in (V1, V2, BASELINE), 'Only dedicated local containers are allowed')
    # Claims are synthetic test subjects, never live JWTs.
    write(EVIDENCE / (label + '.sql'), safe(query))
    return run(label, ['docker', 'exec', '-i', db, 'psql', '-X', '-A', '-t',
               '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'postgres'], query).strip()


def script(label, db, filename, backup=False):
    args = ['docker', 'exec', '-i', db, 'psql', '-X', '-v', 'ON_ERROR_STOP=1',
            '-v', 'local_only=1', '-U', 'postgres', '-d', 'postgres']
    if backup:
        args += ['-v', 'backup_confirmed=1']
    # Do not copy Auth fixture credentials into evidence. Record source path/hash only.
    source = filename.read_text(encoding='utf-8-sig')
    write(EVIDENCE / (label + '-source.txt'), str(filename) + '\nsha256=' + digest(source) + '\n')
    return run(label, args, source)


def digest(text):
    return hashlib.sha256(text.encode()).hexdigest()


def manifest():
    sources = MANIFEST['sources']
    for item in sources + MANIFEST['migrations']:
        path = ROOT / item['path']
        require(path.is_file(), f'Missing manifest path: {path}')
        require(digest(path.read_text(encoding='utf-8-sig')) == item['sha256'], f'Hash mismatch: {path}')
    entries = MANIFEST['migrations']
    require({x['path'] for x in entries} == {p.relative_to(ROOT).as_posix() for p in (PROFILE/'supabase/migrations').glob('*.sql')}, 'Every V2 migration must be manifested')
    seen = set()
    for item in sorted(entries, key=lambda x: x['version']):
        require(item['version'] not in seen, 'Duplicate migration version')
        require(Path(item['path']).name.startswith(item['version'] + '_'), 'Version/path mismatch')
        require(set(item['dependencies']) <= seen, 'Dependencies must precede migration')
        require(item['profile'] == 'v2-clean', 'Unexpected migration profile')
        seen.add(item['version'])
    require(set(BASELINE_VERSIONS) <= seen, 'Frozen baseline pair missing')
    for item in entries:
        if item['version'] not in BASELINE_VERSIONS:
            require(item['version'] > max(BASELINE_VERSIONS), 'Delta must follow the frozen baseline pair')
    print('PASS: source/migration provenance, dependencies and inventory', flush=True)


def prepare_reference(kind):
    folder = EVIDENCE / ('workdir-' + kind)
    project, ports = ('hac29-v1-reference', '593') if kind == 'v1' else ('hac29-baseline-reference', '603')
    config = (ROOT / 'supabase/config.toml').read_text()
    config = config.replace('project_id = "cargomesh"', f'project_id = "{project}"')
    config = re.sub(r'\b563(\d\d)\b', lambda m: ports + m[1], config)
    config = config.replace('inspector_port = 8083', 'inspector_port = ' + ('8283' if kind == 'v1' else '8383'))
    config = config.replace('port = 54327', 'port = ' + ports + '27')
    if kind == 'v1':
        # Use the historical seed in place, without copying credentials to evidence.
        config = config.replace('sql_paths = ["./seed.sql"]', 'sql_paths = [' + json.dumps((ROOT/'supabase/seed.sql').as_posix()) + ']')
        paths = [ROOT/x['path'] for x in MANIFEST['sources']]
    else:
        config = config.replace('[db.seed]\n# If enabled, seeds the database after migrations during a db reset.\nenabled = true', '[db.seed]\nenabled = false')
        config = config.replace('sql_paths = ["./seed.sql"]', 'sql_paths = []')
        paths = [ROOT/x['path'] for x in MANIFEST['migrations'] if x['version'] in BASELINE_VERSIONS]
    write(folder / 'supabase/config.toml', config)
    expected = {p.name for p in paths}
    existing = {p.name for p in (folder/'supabase/migrations').glob('*.sql')}
    require(existing <= expected, 'Unexpected migration in reference workspace; use a fresh evidence directory')
    for path in paths:
        write(folder / 'supabase/migrations' / path.name, path.read_text(encoding='utf-8-sig'))
    return folder


def reset(label, folder):
    run(label+'-start', CLI + ['db', 'start', '--workdir', folder])
    run(label+'-reset', CLI + ['db', 'reset', '--local', '--yes', '--workdir', folder])


def tests(profile, folder):
    paths = json.loads((PROFILE/'test-profiles.json').read_text())[profile]
    require(all((ROOT/p).is_file() for p in paths), 'Missing suite')
    run(profile+'-pgtap', CLI + ['test', 'db', '--local', '--workdir', folder] + [ROOT/p for p in paths])


def categories(db, label):
    query = """select coalesce(jsonb_agg(jsonb_build_object('id',id,'code',code,
      'methods',recommended_entry_methods,'spec',intake_specification_schema,
      'requirements',suggested_requirements,'vehicles',recommended_vehicle_classes) order by id),'[]')
      from public.cargo_categories;"""
    rows = json.loads(sql(label, db, query))
    codes = ['GENERAL','FOOD','PHARMA','CHEMICAL','MACHINERY','CONSTRUCTION','AGRICULTURAL','LIQUID']
    require(len(rows) == 8, 'Expected exactly eight reference categories')
    for i, (row, code) in enumerate(zip(rows,codes),1):
        require(row['id'] == f'c0000000-0000-0000-0000-{i:012d}' and row['code'] == code, 'Reference identity mismatch')
        require(row['methods'] and row['spec'].get('fields') and row['requirements'] and row['vehicles'], 'Empty reference guidance')
    return rows


def absence():
    query = (PROFILE/'checks/v1-fixtures.sql').read_text()
    positive = json.loads(sql('v1-positive-control', V1, query))
    negative = json.loads(sql('v2-absence', V2, query))
    require(positive.keys() == negative.keys() and all(n > 0 for n in positive.values()), 'BLOCKED: V1 positive control failed')
    require(all(n == 0 for n in negative.values()), 'V1 fixtures leaked into V2')
    print(f'PASS: V1 absence with positive controls {len(negative)}/{len(positive)}')


def drift():
    folder = prepare_reference('baseline')
    reset('baseline-reference', folder)
    dumps = []
    for label, db in [('v1',V1),('baseline',BASELINE)]:
        dump = run(label+'-schema-dump', ['docker','exec',db,'pg_dump','-U','postgres','--schema-only','--schema=public','--schema=private','postgres'])
        normalized = '\n'.join(line.rstrip() for line in dump.splitlines()
            if line.strip() and not line.startswith(('--','\\restrict','\\unrestrict'))) + '\n'
        write(EVIDENCE / (label+'-schema.sql'), normalized)
        dumps.append(normalized)
    require(dumps[0] == dumps[1], 'Schema drift: compare saved dumps (includes owners, ACL, RLS, constraints, functions)')
    require(categories(V1,'v1-reference-categories') == categories(BASELINE,'baseline-reference-categories'), 'Reference guidance drift')
    print('PASS: frozen baseline replay equals historical replay; sha256=' + digest(dumps[0]))
    print('Future V2 deltas are intentionally excluded from this frozen-baseline comparison.')


def backup_and_cleanup():
    script('before-cleanup-counts',V2,SCENARIO/'counts.sql')
    # Only public scenario data; never export auth credentials or keys.
    dump = run('public-backup', ['docker','exec',V2,'pg_dump','-U','postgres','--data-only','--schema=public','postgres'])
    write(EVIDENCE/'before-cleanup-public.sql',dump)
    sql('before-cleanup-auth-nonsecret',V2,"select jsonb_agg(jsonb_build_object('id',id,'email',email) order by id) from auth.users;")
    sql('incoming-fk-audit',V2,"select conrelid::regclass, confrelid::regclass, conname, pg_get_constraintdef(oid) from pg_constraint where contype='f' order by 1,2,3;")
    print('Auth recovery: re-run the unchanged synthetic scenario seed; no credential backup is exported.')
    script('cleanup',V2,SCENARIO/'cleanup.sql',backup=True)
    script('after-cleanup-counts',V2,SCENARIO/'counts.sql')
    tables = ['auth.users','auth.identities','public.organizations','public.organization_members','public.facilities',
              'public.carriers','public.carrier_depots','public.carrier_services','public.service_areas','public.service_lanes']
    counts = json.loads(sql('cleanup-zero-assertion',V2,'select jsonb_build_object('+','.join(f"'{t}',(select count(*) from {t})" for t in tables)+');'))
    require(all(x == 0 for x in counts.values()), 'Cleanup left scenario data')
    categories(V2,'after-cleanup-categories')


def blocked():
    for item in json.loads((SCENARIO/'manifest.json').read_text())['blocked']:
        print('BLOCKED ' + item['owner'] + ': ' + item['scope'], flush=True)


def main():
    manifest()
    run('cli-version',CLI+['--version'])
    if ARGS.action == 'manifest':
        return
    if ARGS.action == 'cleanup':
        backup_and_cleanup()
        return
    if ARGS.action in ('v1','v2'):
        v1_folder = prepare_reference('v1')
        reset('v1',v1_folder)
        if ARGS.action == 'v1':
            tests('v1',v1_folder)
            return
        reset('v2',PROFILE)
        categories(V2,'v2-categories')
        absence()
        drift()
        script('seed',V2,SCENARIO/'seed.sql')
        script('verify',V2,SCENARIO/'verify.sql')
        tests('v2',PROFILE)
        backup_and_cleanup()


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action',choices=['manifest','v1','v2','cleanup'])
    parser.add_argument('--evidence-dir',required=True,type=Path)
    ARGS = parser.parse_args()
    EVIDENCE = ARGS.evidence_dir.resolve()
    require(not EVIDENCE.is_relative_to(ROOT), 'Evidence/backups must be outside the repository')
    EVIDENCE.mkdir(parents=True,exist_ok=True)
    try:
        main()
    finally:
        blocked()
