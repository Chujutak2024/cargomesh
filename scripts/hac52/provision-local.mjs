import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const PROJECT = 'cargomesh-hac52-local';
export const CONTAINER = 'supabase_db_' + PROJECT;
export const API = 'http://127.0.0.1:64621';
export const APP = 'http://127.0.0.1:59580';
export function command(exe, args, input) {
  try { return execFileSync(exe, args, {input, encoding:'utf8', stdio:['pipe','pipe','pipe'], timeout:300000}); }
  catch { throw new Error('Local command failed: ' + exe + ' ' + args[0] + ' (output suppressed to protect local credentials).'); }
}
export function sql(source) {
  return command('docker', ['exec','-i',CONTAINER,'psql','-X','-At','-v','ON_ERROR_STOP=1','-v','local_only=1','-U','postgres','-d','postgres'], source);
}
export async function privateFile(filename, value) {
  await fs.mkdir(path.dirname(filename), {recursive:true});
  await fs.writeFile(filename, JSON.stringify(value,null,2)+'\n', {mode:0o600});
  if (process.platform === 'win32') command('icacls', [filename,'/inheritance:r','/grant:r',os.userInfo().username+':(F)']);
  const readback = JSON.parse(await fs.readFile(filename,'utf8'));
  if (JSON.stringify(readback) !== JSON.stringify(value)) throw new Error('Private file readback failed.');
}
export function outsideRepo(filename) {
  const resolved = path.resolve(filename), relative = path.relative(ROOT,resolved);
  if (!path.isAbsolute(filename) || relative === '' || (!relative.startsWith('..'+path.sep) && relative !== '..' && !path.isAbsolute(relative)))
    throw new Error('Use an absolute private path outside the repository.');
  return resolved;
}
export async function provision(bankDir, accessFile) {
  bankDir = outsideRepo(bankDir); accessFile = outsideRepo(accessFile);
  const configDir = path.join(bankDir,'supabase');
  await fs.mkdir(configDir,{recursive:true});
  let config = await fs.readFile(path.join(ROOT,'supabase-v2/supabase/config.toml'),'utf8');
  config = config.replace('project_id = "cargomesh-v2-local"','project_id = "'+PROJECT+'"')
    .replaceAll('5832','6462').replaceAll('8183','64619').replaceAll('127.0.0.1:3000','127.0.0.1:59580');
  const existing = await fs.readFile(path.join(configDir,'config.toml'),'utf8').catch(()=>null);
  if (existing && !existing.includes('project_id = "'+PROJECT+'"')) throw new Error('Foreign bank directory.');
  await fs.writeFile(path.join(configDir,'config.toml'),config);
  await fs.cp(path.join(ROOT,'supabase-v2/supabase/migrations'),path.join(configDir,'migrations'),{recursive:true});
  console.log('Starting own HAC-52 local bank on API 64621 / DB 64622. CLI credentials are suppressed.');
  command('supabase',['start','--workdir',bankDir,'-x','realtime,storage-api,imgproxy,studio,mailpit,edge-runtime,logflare,vector,supavisor']);
  command('supabase',['migration','up','--local','--workdir',bankDir]);
  const status = JSON.parse(command('supabase',['status','--workdir',bankDir,'-o','json']));
  if (status.API_URL !== API || !status.ANON_KEY) throw new Error('Unexpected local bank endpoint.');
  sql("comment on database postgres is 'LOCAL_ONLY:HAC52_CLIENT_BASE';");
  const old = JSON.parse(await fs.readFile(accessFile,'utf8').catch(()=>'null'));
  if (old && (old.profile !== 'hac52-client' || old.url !== API)) throw new Error('Foreign private access file.');
  const password = old?.password ?? randomBytes(30).toString('base64url');
  const email = 'hac52-client-pe@example.invalid';
  const account = {profile:'hac52-client',url:API,appOrigin:APP,anonKey:status.ANON_KEY,email,password};
  // Save before signup so a restart can reuse the same local credential, never rotate it implicitly.
  await privateFile(accessFile,account);
  const headers = {apikey:status.ANON_KEY,'Content-Type':'application/json'};
  let response = await fetch(API+'/auth/v1/token?grant_type=password',{method:'POST',headers,body:JSON.stringify({email,password})});
  if (!response.ok) response = await fetch(API+'/auth/v1/signup',{method:'POST',headers,body:JSON.stringify({email,password})});
  const auth = await response.json();
  const userId = auth.user?.id;
  if (!response.ok || !/^[0-9a-f-]{36}$/i.test(userId??'')) throw new Error('Local synthetic account provisioning failed.');
  sql(`begin;
    insert into public.organizations(id,code,name,country_code,default_currency,status)
    values('52000000-0000-4000-8000-000000000001','HAC52_PE','[SYNTHETIC] Pacific Produce','PE','USD','ACTIVE')
    on conflict(id) do nothing;
    insert into public.organization_members(id,organization_id,auth_user_id,display_name,corporate_email,role,status)
    values('52020000-0000-4000-8000-000000000001','52000000-0000-4000-8000-000000000001','${userId}',
      'Synthetic Client Peru','${email}','OWNER','ACTIVE') on conflict(id) do nothing;
    do $$ begin if not exists(select 1 from public.organization_members where id='52020000-0000-4000-8000-000000000001'
      and auth_user_id='${userId}' and status='ACTIVE' and role='OWNER') then raise exception 'LOCAL_MEMBERSHIP_MISMATCH'; end if; end $$;
    commit;`);
  console.log('H1 provisioned: active synthetic Client owner, isolated organization; private access file verified outside Git.');
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [bankDir,accessFile] = process.argv.slice(2);
  if (!bankDir || !accessFile) throw new Error('Usage: node scripts/hac52/provision-local.mjs ABS_BANK_DIR ABS_PRIVATE_ACCESS_FILE');
  provision(bankDir,accessFile).catch(error=>{console.error(error.message);process.exitCode=1;});
}
