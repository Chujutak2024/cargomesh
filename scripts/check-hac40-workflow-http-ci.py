"""Authenticated HTTP against the dedicated local V2 stack; never hosted."""
from pathlib import Path
import json, os, secrets, subprocess, sys, time, urllib.request, urllib.parse, urllib.error

ROOT = Path(__file__).resolve().parents[1]
CONTAINER = 'supabase_db_cargomesh-v2-local'

def run(args, **kwargs):
    result = subprocess.run(args, cwd=ROOT, text=True, capture_output=True, **kwargs)
    if result.returncode:
        # CLI output can contain local keys; do not copy it into CI evidence.
        raise RuntimeError(f'Local HTTP prerequisite failed: {args[0]} (exit {result.returncode})')
    return result.stdout

if __name__ == '__main__':
    cli = ['npx', '--yes', 'supabase@2.117.0']
    # The database gate leaves a DB-only stack running. Stop that dedicated
    # local project (preserving its volume) before starting Auth and the API.
    run(cli + ['stop', '--workdir', 'supabase-v2'], timeout=120)
    run(cli + ['start', '--workdir', 'supabase-v2'], timeout=600)
    status = json.loads(run(cli + ['status', '--workdir', 'supabase-v2', '-o', 'json'], timeout=60))
    required = {'API_URL', 'ANON_KEY', 'SERVICE_ROLE_KEY'}
    if any(not status.get(key) for key in required):
        # Names are safe diagnostics; never print local credential values.
        raise RuntimeError('Local Auth/API stack incomplete; status keys: ' + ', '.join(sorted(status)))
    url = status['API_URL']
    assert urllib.parse.urlparse(url).hostname in ('127.0.0.1', 'localhost')
    seed = (ROOT/'supabase/scenarios/v2-road-baseline/seed.sql').read_text(encoding='utf-8')
    run(['docker','exec','-i',CONTAINER,'psql','-X','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-v','local_only=1'], input=seed, timeout=60)
    password = secrets.token_urlsafe(24)
    # Only the two synthetic local actors; no credential is written or logged.
    run(['docker','exec','-i',CONTAINER,'psql','-X','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'],
        input="update auth.users set encrypted_password=extensions.crypt('"+password+"',extensions.gen_salt('bf')) where id in ('c2310000-0000-4000-8000-000000000001','c2310000-0000-4000-8000-000000000002');", timeout=60)
    env = os.environ | {'NEXT_PUBLIC_SUPABASE_URL':url,'NEXT_PUBLIC_SUPABASE_ANON_KEY':status['ANON_KEY'],
        'SUPABASE_SERVICE_ROLE_KEY':status['SERVICE_ROLE_KEY'], 'HAC12_LOCAL_QA_PASSWORD':password,
        'HAC40_PYTHON':sys.executable,'HAC40_APP_URL':'http://127.0.0.1:3172'}
    (ROOT/'tmp').mkdir(exist_ok=True)
    server = subprocess.Popen(['pnpm','--dir','cargomesh','exec','next','dev','--hostname','127.0.0.1','--port','3172'],
        cwd=ROOT,env=env,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    try:
        for _ in range(90):
            if server.poll() is not None: raise RuntimeError('Local Next server exited before HTTP smoke')
            try:
                urllib.request.urlopen('http://127.0.0.1:3172/api/v2/routing/nodes',timeout=2)
                break
            except urllib.error.HTTPError: break
            except (OSError,TimeoutError): time.sleep(1)
        else: raise RuntimeError('Local Next readiness timeout')
        result = run(['pnpm','--dir','cargomesh','exec','tsx','scripts/hac40-workflow-http-smoke.mjs'],env=env,timeout=240)
        print(result.strip())
        result = run(['pnpm','--dir','cargomesh','exec','tsx','scripts/hac40-model-closure-http-smoke.mjs'],env=env,timeout=240)
        print(result.strip())
    finally:
        server.terminate()
        try: server.wait(timeout=15)
        except subprocess.TimeoutExpired: server.kill()
