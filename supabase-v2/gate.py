"""Local-only HAC-29 gates. Python 3.11+, Docker, Node/npx; no hosted operations."""
from pathlib import Path
import argparse
import errno
import hashlib
import json
import os
import re
import socket
import subprocess
import sys
import tomllib

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


def reference_config(kind):
    project = 'hac29-v1-reference' if kind == 'v1' else 'hac29-baseline-reference'
    base = getattr(ARGS, kind + '_replay_port_base')
    inspector = getattr(ARGS, kind + '_replay_inspector_port')
    analytics = getattr(ARGS, kind + '_replay_analytics_port')
    if analytics is None:
        analytics = base + 27
    config = (ROOT / 'supabase/config.toml').read_text(encoding='utf-8-sig')
    config = config.replace('project_id = "cargomesh"', f'project_id = "{project}"')
    config = re.sub(r'\b563(\d\d)\b', lambda m: str(base + int(m[1])), config)
    config = config.replace('inspector_port = 8083', f'inspector_port = {inspector}')
    config = config.replace('port = 54327', f'port = {analytics}')
    return config


def configured_ports(config, prefix=''):
    """Include configured ports even for disabled services; ignore TOML comments."""
    ports = {}
    for key, value in config.items():
        path = prefix + key
        if isinstance(value, dict):
            ports.update(configured_ports(value, path + '.'))
        elif key == 'port' or key.endswith('_port'):
            require(type(value) is int, f'{path} must be an integer TCP port')
            ports[path] = value
    return ports


def port_option(kind, setting):
    suffix = 'inspector-port' if setting == 'edge_runtime.inspector_port' else (
        'analytics-port' if setting == 'analytics.port' else 'port-base')
    flag = f'--{kind}-replay-{suffix}'
    env = f'HAC29_{kind.upper()}_REPLAY_{suffix.upper().replace("-", "_")}'
    return f'{flag} (or {env})'


def docker_tcp_bindings():
    """Read only running containers' identity/bindings; never inspect credentials."""
    ids = run('replay-port-docker-ps', ['docker', 'ps', '--quiet', '--no-trunc']).split()
    if not ids:
        return []
    template = ('{"id":{{json .Id}},"labels":{{json .Config.Labels}},'
                '"ports":{{json .NetworkSettings.Ports}}}')
    rows = run('replay-port-docker-inspect', ['docker', 'inspect', '--format', template] + ids)
    bindings = []
    for line in rows.splitlines():
        container = json.loads(line)
        labels = container['labels'] or {}
        for target, published in (container['ports'] or {}).items():
            if not target.endswith('/tcp'):
                continue
            for binding in published or []:
                bindings.append({'container_id': container['id'],
                                 'project': labels.get('com.supabase.cli.project'),
                                 'compose_project': labels.get('com.docker.compose.project'),
                                 'host': binding['HostIp'], 'port': int(binding['HostPort'])})
    return bindings


def replay_owns_port(bindings, project, port, host):
    publishers = [binding for binding in bindings if binding['port'] == port]
    # Require an explicit Supabase project label, consistent Compose identity and
    # a wildcard binding for the failed address family. Names are never evidence.
    return (any(binding['host'] == host for binding in publishers)
            and all(binding['project'] == project
                    and binding['compose_project'] in (None, project) for binding in publishers))


def replay_port_preflight():
    # Validate both layouts before any Docker start/reset, including for a V1-only run.
    protected = set(range(56320, 56330)) | set(range(58320, 58330))
    for profile in (ROOT/'supabase/config.toml', PROFILE/'supabase/config.toml'):
        protected.update(configured_ports(tomllib.loads(profile.read_text(encoding='utf-8-sig'))).values())
    layouts = {}
    claimed = {}
    for kind in ('v1', 'baseline'):
        base = getattr(ARGS, kind + '_replay_port_base')
        require(1 <= base <= 65506, f'{kind} replay port base must be 1..65506; use {port_option(kind, "db.port")}')
        config = tomllib.loads(reference_config(kind))
        project = config['project_id']
        ports = configured_ports(config)
        layouts[project] = ports
        for setting, port in ports.items():
            remedy = port_option(kind, setting)
            require(1 <= port <= 65535, f'Port {port} for {project} ({setting}) is outside 1..65535; use {remedy}')
            require(port not in protected, f'Port {port} for {project} ({setting}) conflicts with V1/V2; use {remedy}')
            require(port not in claimed, f'Port {port} for {project} ({setting}) conflicts with {claimed.get(port)}; use {remedy}')
            claimed[port] = f'{project} ({setting})'
    bindings = None
    reused = []
    for kind, project in [('v1', 'hac29-v1-reference'), ('baseline', 'hac29-baseline-reference')]:
        for setting, port in layouts[project].items():
            families = [(socket.AF_INET, '0.0.0.0')]
            if socket.has_ipv6:
                families.append((socket.AF_INET6, '::'))
            for family, host in families:
                try:
                    with socket.socket(family, socket.SOCK_STREAM) as probe:
                        if os.name == 'nt':
                            probe.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
                        if family == socket.AF_INET6:
                            probe.setsockopt(socket.IPPROTO_IPV6, socket.IPV6_V6ONLY, 1)
                        probe.bind((host, port))
                        probe.listen(1)
                except OSError as error:
                    if error.errno == errno.EADDRINUSE or getattr(error, 'winerror', None) == 10048:
                        if bindings is None:
                            try:
                                bindings = docker_tcp_bindings()
                            except RuntimeError:
                                # Fail closed with the original port/project/remedy message.
                                bindings = []
                        if replay_owns_port(bindings, project, port, host):
                            reused.append({'project': project, 'setting': setting, 'port': port, 'host': host})
                            print(f'PASS: port {port} on {host} belongs to running replay {project} (Docker labels/bindings)', flush=True)
                            continue
                    raise RuntimeError(f'Port {port} for {project} ({setting}) cannot be opened on {host}: {error}. '
                                       f'Stop an existing replay before changing ports, or choose another port with '
                                       f'{port_option(kind, setting)}. On Windows check: '
                                       'netsh interface ipv4 show excludedportrange protocol=tcp') from error
    write(EVIDENCE/'replay-ports.json', json.dumps(layouts, indent=2) + '\n')
    write(EVIDENCE/'replay-port-reuse.json', json.dumps({'bindings': bindings or [], 'reused': reused}, indent=2) + '\n')
    print('PASS: replay port ranges, isolation and host TCP binds or verified same-project Docker bindings (IPv4/IPv6 where available)', flush=True)


def prepare_reference(kind):
    folder = EVIDENCE / ('workdir-' + kind)
    config = reference_config(kind)
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


def route_condition_checks():
    # Read canonical references after the guarded baseline seed; fixture stays in JSON.
    catalog = sql('routecondition-catalog', V2, """select jsonb_build_object(
      'facilities', coalesce((select jsonb_agg(jsonb_build_object(
        'facilityId', id, 'label', name, 'countryCode', country_code,
        'region', region_code, 'city', city, 'lat', latitude, 'lng', longitude)
        order by id) from public.facilities), '[]'::jsonb),
      'lanes', coalesce((select jsonb_agg(id order by id)
        from public.service_lanes), '[]'::jsonb));""")
    catalog_path = EVIDENCE / 'routecondition-catalog.json'
    write(catalog_path, catalog + '\n')
    run('routecondition-contract', [sys.executable, SCENARIO/'verify_route_conditions.py',
                                  '--catalog-file', catalog_path])


def main():
    manifest()
    if ARGS.action in ('v1', 'v2'):
        replay_port_preflight()
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
        route_condition_checks()
        tests('v2',PROFILE)
        run('hac40-request-race', [sys.executable, ROOT/'scripts/check-hac40-request-race.py'])
        run('hac40-catalog-race', [sys.executable, ROOT/'scripts/check-hac40-catalog-race.py'])
        backup_and_cleanup()


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action',choices=['manifest','v1','v2','cleanup'])
    parser.add_argument('--evidence-dir',required=True,type=Path)
    for kind, base, inspector in [('v1', 59300, 8283), ('baseline', 60300, 8383)]:
        for option, default in [('port-base', base), ('inspector-port', inspector), ('analytics-port', None)]:
            env = f'HAC29_{kind.upper()}_REPLAY_{option.upper().replace("-", "_")}'
            parser.add_argument(f'--{kind}-replay-{option}', type=int, default=os.environ.get(env, default),
                                help=f'{env}; CLI overrides environment; default {default if default is not None else "port base + 27"}')
    ARGS = parser.parse_args()
    EVIDENCE = ARGS.evidence_dir.resolve()
    require(not EVIDENCE.is_relative_to(ROOT), 'Evidence/backups must be outside the repository')
    EVIDENCE.mkdir(parents=True,exist_ok=True)
    try:
        main()
    finally:
        blocked()
