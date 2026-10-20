import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {ROOT,sql} from './provision-local.mjs';
const dir=path.join(ROOT,'supabase/scenarios/v2-client-base'),m=JSON.parse(await fs.readFile(path.join(dir,'manifest.json'),'utf8'));
const ids=values=>values.map(v=>{assert.match(v,/^[0-9a-f-]{36}$/);return "'"+v+"'";}).join(',');
const snapshot=()=>sql(`select encode(extensions.digest(jsonb_build_object(
 'organizations',(select jsonb_agg(to_jsonb(r) order by id) from public.organizations r where id in (${ids(m.organizations.map(v=>v.id))})),
 'facilities',(select jsonb_agg(to_jsonb(r) order by id) from public.facilities r where id in (${ids(m.facilities.map(v=>v.id))})),
 'profiles',(select jsonb_agg(to_jsonb(r) order by id) from public.organization_cargo_profiles r where id in (${ids(m.organizations.map(v=>v.profileId))})),
 'preferences',(select jsonb_agg(to_jsonb(r) order by id) from public.organization_preferences r where id in (${ids(m.organizations.map(v=>v.preferenceId))}))
 )::text,'sha256'),'hex');`).trim();
try{
 const seed=await fs.readFile(path.join(dir,'seed.sql'),'utf8'),before=snapshot();sql(seed);const first=snapshot();sql(seed);const second=snapshot();
 assert.equal(first,before,'insert-only seed must preserve edits, timestamps and versions');assert.equal(second,before);
 const report={scenario:m.scenario,manifestOrganizations:m.organizations.length,manifestFacilities:m.facilities.length,insertOnlyReruns:2,persistedContentHash:before,editsAndVersionsPreserved:true,authCredentialsAccessed:false,hostedAccess:false};
 if(process.argv[2])await fs.writeFile(process.argv[2],JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}catch(error){console.error('Seed verification failed: '+error.message);process.exitCode=1;}
