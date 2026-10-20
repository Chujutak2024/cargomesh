import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const dir=path.dirname(fileURLToPath(import.meta.url));
const manifest=JSON.parse(await fs.readFile(path.join(dir,'manifest.json'),'utf8'));
const quote=v=>v===null?'null':"'"+String(v).replaceAll("'","''")+"'";
const clock=quote(manifest.clock),schedule=zone=>JSON.stringify({timezone:zone,weekly:[1,2,3,4,5].map(dayOfWeek=>({dayOfWeek,opensAt:'08:00',closesAt:'18:00'}))});
const orgs=manifest.organizations.map(v=>'('+[v.id,v.code,v.name,v.countryCode].map(quote).join(',')+",'USD','ACTIVE',"+clock+','+clock+')').join(',\n');
const facilities=manifest.facilities.map(v=>'('+[v.id,v.organizationId,v.code,v.name,'WAREHOUSE',v.countryCode,v.region,v.city,v.address].map(quote).join(',')+','+v.lat+','+v.lng+",true,'[]'::jsonb,"+(v.hoursKnown?quote(schedule(v.timezone))+'::jsonb':'null')+','+clock+','+clock+')').join(',\n');
const units=quote(JSON.stringify([{packageType:'PALLET',quantity:4,weightPerUnitKg:250,volumePerUnitM3:1.2,dimensionsCm:{length:120,width:100,height:100},indivisible:false,stackable:true,unitsPerPackage:1}]));
const profiles=manifest.organizations.map(v=>`(${quote(v.profileId)},${quote(v.id)},(select id from public.cargo_categories where code='GENERAL'),${quote('[SYNTHETIC] '+v.countryCode+' standard pallets')},'PALLETS',4,250,1,120,100,100,${units}::jsonb,'[]'::jsonb,'BOX_TRUCK',true,${clock},${clock})`).join(',\n');
const preferences=manifest.organizations.map(v=>`(${quote(v.preferenceId)},${quote(v.id)},false,'WEIGHTED',120,'ROAD','BOX_TRUCK',null,'2026-11-02T12:00:00Z',${clock},${clock})`).join(',\n');
const body=`\\set ON_ERROR_STOP on
\\if :{?local_only}
\\else
 \\set local_only 0
\\endif
\\if :local_only
\\else
 do $$ begin raise exception 'HAC52_LOCAL_ONLY: pass psql -v local_only=1'; end $$;
\\endif
-- Generated from manifest.json. Part of HAC-52. Fictitious addresses, approximate city coordinates.
-- Insert-only reruns preserve manual edits and command versions; no deletes or Carrier data.
begin;
do $$ begin
 if shobj_description((select oid from pg_database where datname=current_database()),'pg_database') is distinct from 'LOCAL_ONLY:HAC52_CLIENT_BASE'
 then raise exception 'HAC52_OWN_BANK_REQUIRED'; end if;
 if not exists(select 1 from public.cargo_categories where code='GENERAL' and active) then raise exception 'HAC52_CATEGORY_CATALOG_REQUIRED'; end if;
end $$;
insert into public.organizations(id,code,name,country_code,default_currency,status,created_at,updated_at) values
${orgs}
on conflict(id) do nothing;
insert into public.facilities(id,organization_id,code,name,facility_type,country_code,region_code,city,address_line,latitude,longitude,active,access_restrictions,operating_hours,created_at,updated_at) values
${facilities}
on conflict(id) do nothing;
insert into public.organization_cargo_profiles(id,organization_id,cargo_category_id,profile_name,default_entry_method,typical_entry_quantity,typical_unit_weight_kg,typical_units_per_entry,typical_length_cm,typical_width_cm,typical_height_cm,typical_units,requirements,preferred_equipment,active,created_at,updated_at) values
${profiles}
on conflict(id) do nothing;
insert into public.organization_preferences(id,organization_id,allow_auto_booking,objective,maximum_wait_minutes,preferred_mode,preferred_equipment,usual_budget,valid_until,created_at,updated_at) values
${preferences}
on conflict(id) do nothing;
do $$ begin
 if (select count(*) from public.organizations where id=any(array[${manifest.organizations.map(v=>quote(v.id)).join(',')}]::uuid[]))<>3 then raise exception 'HAC52_ORGANIZATION_IDS_MISSING';end if;
 if (select count(*) from public.facilities where id=any(array[${manifest.facilities.map(v=>quote(v.id)).join(',')}]::uuid[]))<>8 then raise exception 'HAC52_FACILITY_IDS_MISSING';end if;
 ${manifest.facilities.map(v=>`if not exists(select 1 from public.facilities where id=${quote(v.id)} and organization_id=${quote(v.organizationId)}) then raise exception 'HAC52_FACILITY_SCOPE_MISMATCH';end if;`).join('\n ')}
end $$;
commit;
`;
await fs.writeFile(path.join(dir,'seed.sql'),body);
if(await fs.readFile(path.join(dir,'seed.sql'),'utf8')!==body)throw new Error('Seed readback mismatch');
console.log('Generated and read back v2-client-base seed: 3 organizations, 8 Facilities, 3 profiles, 3 preferences. No credentials.');
