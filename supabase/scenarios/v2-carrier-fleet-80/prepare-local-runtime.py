from pathlib import Path
import subprocess,json,urllib.parse,base64,hashlib,hmac,time,os,tempfile

bank='supabase_db_hac45-carrier-local';db='hac50_scenario_fleet80_global_v1';name='cargomesh_hac50_demo_rest'
private=Path(os.environ['LOCALAPPDATA'])/'CargoMeshV2Local'/'fleet-scenario-20261018'
private.mkdir(parents=True,exist_ok=True)
def run(args,data=None):
    p=subprocess.run(args,input=data,capture_output=True)
    if p.returncode: raise RuntimeError('Local runtime operation failed; output withheld to protect credentials')
    return p.stdout
marker=run(['docker','exec',bank,'psql','-X','-At','-U','postgres','-d',db,'-c',"select shobj_description(oid,'pg_database') from pg_database where datname=current_database();"]).decode().strip()
assert marker=='LOCAL_ONLY:v2-carrier-fleet-80'
source=json.loads(run(['docker','inspect','supabase_rest_hac45-carrier-local']))[0]
env=dict(x.split('=',1) for x in source['Config']['Env'] if '=' in x)
uri=urllib.parse.urlsplit(env['PGRST_DB_URI'])
assert uri.hostname==bank
env['PGRST_DB_URI']=urllib.parse.urlunsplit(uri._replace(path='/'+db))
env['PGRST_JWT_AUD']='authenticated'
envpath=private/'rest.private.env'
envpath.write_text('\n'.join(k+'='+v for k,v in env.items())+'\n',encoding='utf-8')
probe=subprocess.run(['docker','inspect',name],capture_output=True)
if probe.returncode:
    network=list(source['NetworkSettings']['Networks']);assert len(network)==1
    run(['docker','run','--detach','--pull=never','--name',name,'--label','com.cargomesh.database='+db,'--network',network[0],'--publish','127.0.0.1:59732:3000','--env-file',str(envpath),source['Config']['Image']])
else:
    info=json.loads(probe.stdout)[0]
    assert info['Config']['Labels'].get('com.cargomesh.database')==db
    if not info['State']['Running']:run(['docker','start',name])
auth=json.loads(run(['docker','inspect','cargomesh_hac50_demo_auth']))[0]
authenv=dict(x.split('=',1) for x in auth['Config']['Env'] if '=' in x)
b64=lambda b:base64.urlsafe_b64encode(b).rstrip(b'=')
enc=lambda v:b64(json.dumps(v,separators=(',',':')).encode())
stamp=int(time.time());unsigned=enc({'alg':'HS256','typ':'JWT'})+b'.'+enc({'role':'anon','iss':'supabase-local','iat':stamp,'exp':stamp+86400*30})
anon=(unsigned+b'.'+b64(hmac.new(authenv['GOTRUE_JWT_SECRET'].encode(),unsigned,hashlib.sha256).digest())).decode()
accounts=json.loads((Path(tempfile.gettempdir())/'CargoMesh-demo-access-20261016/accounts.private.json').read_text(encoding='utf-8'))
admin=next(a for a in accounts['accounts'] if a['profile']=='admin')
config={'profile':'fleet80','url':'http://127.0.0.1:59730','anonKey':anon,'email':admin['email'],'password':admin['password'],'database':db}
(private/'runtime.private.json').write_text(json.dumps(config,indent=2),encoding='utf-8')
print(json.dumps({'database':db,'restPort':59732,'authPort':59731,'gatewayPort':59730,'frontPort':8083,'privateConfigPath':str(private/'runtime.private.json'),'hostedChanged':False}))
