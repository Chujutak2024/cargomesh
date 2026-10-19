"""Create three optional local Auth demo profiles. Secrets stay outside all repositories."""
from pathlib import Path
import base64
import hashlib
import hmac
import http.client
import json
import os
import secrets
import subprocess
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid

HERE=Path(__file__).resolve().parent
manifest=json.loads((HERE/'manifest.json').read_text(encoding='utf-8'))
DB='hac50_scenario_fleet80_global_v1'
BANK='supabase_db_hac45-carrier-local'
AUTH='cargomesh_hac50_demo_auth'
PORT=59731
BASE=f'http://127.0.0.1:{PORT}'
PRIVATE=Path(tempfile.gettempdir())/'CargoMesh-demo-access-20261016'
PRIVATE.mkdir(exist_ok=True)
assert not PRIVATE.is_relative_to(HERE.parents[2]), 'Credentials must stay outside the checkout'
FILE=PRIVATE/'accounts.private.json'

def run(command,data=None,check=True):
    p=subprocess.run(command,input=data,capture_output=True)
    if check and p.returncode: raise RuntimeError('Local Docker operation failed; no secret output emitted')
    return p

def sql(query,database=DB,user='postgres'):
    p=run(['docker','exec','-i',BANK,'psql','-X','-At','-v','ON_ERROR_STOP=1','-U',user,'-d',database],query.encode())
    return p.stdout.decode()

assert sql("select shobj_description(oid,'pg_database') from pg_database where datname=current_database();").strip()=='LOCAL_ONLY:v2-carrier-fleet-80'
assert sql('select count(*) from public.carriers;').strip()=='10'
source=json.loads(run(['docker','inspect','supabase_auth_hac45-carrier-local']).stdout)[0]
env=dict(value.split('=',1) for value in source['Config']['Env'] if '=' in value)
dburl=urllib.parse.urlsplit(env['GOTRUE_DB_DATABASE_URL'])
assert dburl.hostname==BANK and dburl.path=='/postgres', 'Expected dedicated local Auth source'
env['GOTRUE_DB_DATABASE_URL']=urllib.parse.urlunsplit(dburl._replace(path='/'+DB))
env['API_EXTERNAL_URL']=BASE
env['GOTRUE_SITE_URL']='http://127.0.0.1:8080'
env['GOTRUE_JWT_ISSUER']=BASE
env['GOTRUE_DISABLE_SIGNUP']='true'
env['GOTRUE_EXTERNAL_EMAIL_ENABLED']='true'
env['GOTRUE_MAILER_AUTOCONFIRM']='true'
secret=env['GOTRUE_JWT_SECRET'].encode()
def auth_schema(database):
    dump=run(['docker','exec',BANK,'pg_dump','-U','postgres','-d',database,
        '--schema-only','--schema=auth','--no-owner','--no-privileges']).stdout.decode()
    return '\n'.join(line.rstrip() for line in dump.splitlines()
        if line.strip() and not line.startswith(('--','\\restrict','\\unrestrict')))

# Copy authentic system migration metadata only if the complete Auth DDL matches.
# The schema-only scenario source intentionally contains no migration-history rows.
reference=auth_schema('postgres')
target=auth_schema(DB)
if reference!=target:
    old_comment="COMMENT ON TABLE auth.flow_state IS 'stores metadata for pkce logins';"
    new_comment="COMMENT ON TABLE auth.flow_state IS 'Stores metadata for all OAuth/SSO login flows';"
    unique="ALTER TABLE ONLY auth.identities\n    ADD CONSTRAINT identities_provider_id_provider_unique"
    primary="ALTER TABLE ONLY auth.identities\n    ADD CONSTRAINT identities_pkey PRIMARY KEY (id);\n"
    prospective=target.replace(old_comment,new_comment).replace(unique,primary+unique)
    assert prospective==reference, 'Unexpected Auth schema drift; do not manufacture migration history'
    sql("begin;alter table auth.identities add constraint identities_pkey primary key(id);"+new_comment+'commit;',user='supabase_admin')
assert auth_schema('postgres')==auth_schema(DB), 'Auth DDL must match the genuine local service'
versions=json.loads(sql("select coalesce(json_agg(version order by version),'[]') from auth.schema_migrations;",'postgres'))
assert versions and all(str(version).isdigit() for version in versions)
values=','.join("('"+str(version)+"')" for version in versions)
sql('insert into auth.schema_migrations(version) values '+values+' on conflict(version) do nothing;',user='supabase_admin')

existing=run(['docker','inspect',AUTH],check=False)
if existing.returncode:
    envpath=PRIVATE/'auth.private.env'
    envpath.write_text('\n'.join(k+'='+v for k,v in sorted(env.items()))+'\n',encoding='utf-8')
    networks=list(source['NetworkSettings']['Networks'])
    assert len(networks)==1
    run(['docker','run','--detach','--pull=never','--name',AUTH,
         '--label','com.cargomesh.scenario=v2-carrier-fleet-80',
         '--label','com.cargomesh.database='+DB,'--network',networks[0],
         '--publish',f'127.0.0.1:{PORT}:9999','--env-file',str(envpath),source['Config']['Image']])
else:
    info=json.loads(existing.stdout)[0]
    assert info['Config']['Labels'].get('com.cargomesh.database')==DB, 'Unexpected Auth container owner'
    assert info['Config']['Labels'].get('com.cargomesh.scenario')=='v2-carrier-fleet-80'
    if not info['State']['Running']:run(['docker','start',AUTH])

def b64(data):return base64.urlsafe_b64encode(data).rstrip(b'=')
header=b64(json.dumps({'alg':'HS256','typ':'JWT'},separators=(',',':')).encode())
payload=b64(json.dumps({'role':'service_role','aud':'authenticated','iss':BASE,
    'iat':int(time.time()),'exp':int(time.time())+3600},separators=(',',':')).encode())
unsigned=header+b'.'+payload
admin=(unsigned+b'.'+b64(hmac.new(secret,unsigned,hashlib.sha256).digest())).decode()

def api(path,method='GET',data=None,token=None):
    request=urllib.request.Request(BASE+path,data=json.dumps(data).encode() if data is not None else None,
        method=method,headers={'Content-Type':'application/json',**({'Authorization':'Bearer '+token} if token else {})})
    try:
        with urllib.request.urlopen(request,timeout=10) as response:
            raw=response.read();return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as error:
        raise RuntimeError(f'Local Auth {method} {path}: HTTP {error.code}') from None

ready=False
for attempt in range(30):
    try:api('/health');ready=True;break
    except (RuntimeError,urllib.error.URLError,TimeoutError,http.client.RemoteDisconnected):time.sleep(.5)
assert ready, 'Dedicated Auth not ready; existing app services were not changed'
profiles=[('admin','demo-carrier-admin@example.invalid','ADMIN',[1,2,5]),
          ('dispatch','demo-carrier-dispatch@example.invalid','DISPATCHER',[2]),
          ('operations','demo-carrier-ops@example.invalid','OPERATOR',[5])]
stored=json.loads(FILE.read_text(encoding='utf-8')) if FILE.exists() else {'localOnly':True,'authUrl':BASE,'database':DB,'accounts':[]}
assert stored['database']==DB and stored['authUrl']==BASE
for label,email,role,carriers in profiles:
    entry=next((p for p in stored['accounts'] if p['profile']==label),None)
    if entry is None:
        entry={'profile':label,'email':email,'password':secrets.token_urlsafe(24),'role':role,'carrierLabels':[f'C{n:02d}' for n in carriers]}
        stored['accounts'].append(entry)
        FILE.write_text(json.dumps(stored,indent=2)+'\n',encoding='utf-8')
    if 'userId' in entry:
        user=api('/admin/users/'+entry['userId'],token=admin)
    else:
        user=api('/admin/users','POST',{'email':email,'password':entry['password'],'email_confirm':True,
            'app_metadata':{'scenario':'v2-carrier-fleet-80','demo_profile':label}},admin)
        entry['userId']=user['id']
        FILE.write_text(json.dumps(stored,indent=2)+'\n',encoding='utf-8')
    assert user['email']==email
    uid=str(uuid.UUID(entry['userId']))
    query='begin;\n'
    for n in carriers:
        carrier=manifest['carriers'][n-1]
        operator=f'e500005a-0000-4000-8000-{(profiles.index((label,email,role,carriers))+1)*100+n:012d}'
        query+=f"insert into public.carrier_operators(id,carrier_id,auth_user_id,display_name,role,email,status,verified_at) values('{operator}','{carrier['id']}','{uid}','[SYNTHETIC] Demo {label}','{role}','{email}','ACTIVE',now()) on conflict(id) do nothing;\n"
        query+=f"insert into private.v2_catalog_grants(auth_user_id,carrier_id,permission,expires_at) values('{uid}','{carrier['id']}','CARRIER_EDITOR','{manifest['horizon']['endsAt']}') on conflict do nothing;\n"
    sql(query+'commit;')
    session=api('/token?grant_type=password','POST',{'email':email,'password':entry['password']})
    token=session['access_token']
    assert api('/user',token=token)['id']==uid
    claims=json.loads(base64.urlsafe_b64decode(token.split('.')[1]+'==='))
    assert claims['sub']==uid and claims.get('session_id'), 'Real Auth session required'
    claims_sql=json.dumps(claims,separators=(',',':')).replace("'","''")
    result=sql(f"begin;set local role authenticated;set local request.jwt.claims='{claims_sql}';select public.read_v2_carrier_portal_access();rollback;")
    access=json.loads(next(line for line in result.splitlines() if line.startswith('[')))
    assert {p['carrierId'] for p in access}=={manifest['carriers'][n-1]['id'] for n in carriers}
    assert all(p['role']==role for p in access)
    if role!='ADMIN':
        own=access[0]
        check=sql(f"""begin;set local role authenticated;set local request.jwt.claims='{claims_sql}';
do $$begin
 begin
  perform public.command_v2_carrier_catalog('{own['operatorId']}','depots','{own['carrierId']}',null,null,gen_random_uuid(),null,'{{}}');
  raise exception 'DEMO_ROLE_CHECK_FAILED';
 exception when sqlstate 'PT403' then
  if sqlerrm<>'FORBIDDEN_CARRIER_ROLE' then raise;end if;
 end;
end$$;rollback;""")
    api('/logout','POST',token=token)

result={'localOnly':True,'database':DB,'authUrl':BASE,'profiles':[
    {k:p[k] for k in ('profile','role','carrierLabels')} for p in stored['accounts']],
    'realPasswordLogins':3,'authorizedCarrierMemberships':5,'nonAdminCatalogWritesDenied':2,'appConfigurationChanged':False,
    'credentialsPath':str(FILE),'secretsPrinted':False}
(PRIVATE/'RESULTS.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
print(json.dumps(result,indent=2))
