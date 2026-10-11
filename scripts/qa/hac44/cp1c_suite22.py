"""Compare the two suite-22 sources on the owned native scenario with real Auth.

The unchanged historical pgTAP assertions are preserved. The SQL transport adds
the mandatory flush before each RESET ROLE and replaces literal claims in memory.
These adaptations are explicit; they do not prove the old initial boundary.
"""
import hashlib
import json
import re
import subprocess
import sys
from common import ROOT, OUT, save, write

PATH='supabase/tests/22_v2_hac40_workflow.test.sql'

def boundary_instrument(source):
    marker="select 'CP1C_BOUNDARY:'||jsonb_build_object('role',current_user,'subject',auth.uid(),'actualSession',current_setting('request.jwt.claims')::jsonb ? 'session_id')::text;\n"
    return re.sub(r'(?im)^set constraints all immediate;',marker+'set constraints all immediate;',source)

def read_source(sha):
    """Keep source distinct from the redacted command-output channel."""
    result=subprocess.run(['git','show',sha+':'+PATH],cwd=ROOT,
        capture_output=True,encoding='utf-8',check=False)
    if result.returncode:raise RuntimeError('Cannot preserve suite22 source')
    return result.stdout

def assess_output(output, exit_code):
    boundaries=[json.loads(l.split('CP1C_BOUNDARY:',1)[1]) for l in output.splitlines() if l.startswith('CP1C_BOUNDARY:')]
    positive=bool(boundaries) and all(x['role']=='authenticated' and x['subject']=='c2310000-0000-4000-8000-000000000001' and x['actualSession'] for x in boundaries)
    bad_tap=[l for l in output.splitlines() if re.match(r'^\s*(?:not ok\b|Bail out!)',l)]
    status='BLOQUEADO' if not positive else 'FAIL' if exit_code or bad_tap else 'PASS'
    return status,boundaries,bad_tap

def main():
    from local import script, BANK, CLI
    # The native gate explicitly cleans its baseline. Reconstruct its actual
    # named scenario before these historical tests; never reuse stale IDs.
    seeded=script('cp1c-suite22-baseline-seed','supabase/scenarios/v2-road-baseline/seed.sql')
    if seeded.returncode:raise RuntimeError('Suite22 native baseline prerequisite failed')
    try:
        return measure()
    finally:
        from auth_cleanup import clean_auth_ids
        clean_auth_ids(BANK)
        BANK.reset(CLI)
        BANK.own('suite22-after-owned-reset')
        counts=BANK.raw_sql('suite22-cleanup-zero',"select jsonb_build_object('organizations',(select count(*) from public.organizations),'users',(select count(*) from auth.users),'sessions',(select count(*) from auth.sessions));")
        if counts.returncode or any(json.loads(counts.stdout).values()):raise RuntimeError('Suite22 cleanup is not zero')

def measure():
    from local import sql, HEAD
    records=[]
    for name,sha in [('original','42a4fde4ac2e9242d8f0ed46029101a4e44d90ed'),('reinforced',HEAD)]:
        # common.run deliberately redacts claims in its returned output. Read
        # the Git blob in memory so those redactions cannot become SQL input.
        raw=read_source(sha);write(OUT/'repro/suite22'/('22-'+name+'.sql'),raw)
        current=sql('suite22-'+name,boundary_instrument(raw))
        status,boundaries,bad_tap=assess_output(current.stdout,current.returncode)
        records.append({'case':'suite22 '+name,'status':status,
                        'exit':current.returncode,'sourceSha':sha,'sourceSha256':hashlib.sha256(raw.encode()).hexdigest(),
                        'nativeExplicitBoundaries':boundaries,'tapFailures':bad_tap,
                        'initialNativeCoverage':bool(re.search(r'set constraints all immediate;[\s\S]*?reset role;',raw.split('reset role;',1)[0]+'reset role;',re.I)),
                        'adaptations':['Issuer/getUser-verified claims substituted in memory','Mandatory ALL IMMEDIATE before RESET ROLE by local SQL transport','Read-only boundary trace before native flush'],
                        'limit':'Original initial native assertion absent; transport safety flush is instrumentation, not evidence of its original coverage'})
    passed=all(r['status']=='PASS' for r in records)
    save('cp1c-suite22.json',{'status':'PASS' if passed else 'BLOQUEADO' if any(r['status']=='BLOQUEADO' for r in records) else 'FAIL','productSha':HEAD,
        'cases':records,'D04':'No reproducido en el boundary final original; cobertura inicial añadida' if passed else 'BLOQUEADO: no afirmar no reproducción sin ambos controles y TAP válidos'})
    return 0 if passed else 2 if any(r['status']=='BLOQUEADO' for r in records) else 1

if __name__=='__main__':sys.exit(main())
