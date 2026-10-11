\set ON_ERROR_STOP on
\if :{?local_only}
\else
\set local_only 0
\endif
\if :local_only
\else
do $$ begin raise exception 'CARRIER_PORTAL_LOCAL_ONLY'; end $$;
\endif
do $$ begin
    if inet_server_addr() is not null then raise exception 'LOCAL_DOCKER_SOCKET_REQUIRED'; end if;
    if to_regclass('pg_temp.cp_templates') is null then
        raise exception 'Use scripts/qa/carrier_portal.py seed: it loads unchanged baseline JSON templates';
    end if;
end $$;
begin;
-- Reuse the full-flow exact-PK registry/baseline. No existing scenario is changed.
\ir ../v2-full-flow-qa/control.sql
do $$ declare t record; collision boolean; begin
    for t in select table_schema,table_name,column_name from information_schema.columns
        where table_schema in ('public','private','auth') and udt_name='uuid' loop
        execute format('select exists(select 1 from %I.%I where left(%I::text,8) between ''e4400000'' and ''e44f0000'')',
            t.table_schema,t.table_name,t.column_name) into collision;
        if collision then raise exception 'CARRIER_PORTAL_UUID_COLLISION: %.%',t.table_schema,t.table_name; end if;
    end loop;
end $$;
create schema if not exists carrier_portal_qa;
create table if not exists carrier_portal_qa.actors (
    run_id uuid not null, ordinal integer not null, name text not null, auth_user_id uuid not null,
    email text not null, carrier_name text, carrier_id uuid, operator_id uuid, role text not null,
    identity_status text not null, verified boolean not null, grant_state text not null,
    primary key(run_id,name)
);
create table if not exists carrier_portal_qa.refs (
    run_id uuid not null, name text not null, value jsonb not null, primary key(run_id,name)
);
grant usage on schema carrier_portal_qa to authenticated;
grant select,insert,update on carrier_portal_qa.refs to authenticated;
grant select on carrier_portal_qa.actors to authenticated;
grant usage on schema hac44_qa to authenticated;
grant select on hac44_qa.runs to authenticated;
grant execute on function hac44_qa.current_run() to authenticated;
insert into hac44_qa.triggers select hac44_qa.current_run(),t.tgrelid::regclass::text,t.tgname,t.tgenabled
from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
where n.nspname='auth' on conflict do nothing;
insert into carrier_portal_qa.actors
select hac44_qa.current_run(),n,name,('e4410000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
    'local-only-cp-'||n||'@cargomesh.test',carrier,null,null,role,status,verified,grant_state
from (values
    (1,'shipper',null,'OWNER','ACTIVE',true,'NONE'),
    (2,'c1-admin','C1','ADMIN','ACTIVE',true,'VALID'),
    (3,'c1-operator','C1','OPERATOR','ACTIVE',true,'VALID'),
    (4,'c1-dispatcher','C1','DISPATCHER','ACTIVE',true,'VALID'),
    (5,'c2-admin','C2','ADMIN','ACTIVE',true,'VALID'),
    (6,'c2-operator','C2','OPERATOR','ACTIVE',true,'VALID'),
    (7,'inactive','C1','OPERATOR','INACTIVE',true,'VALID'),
    (8,'invited','C1','OPERATOR','INVITED',false,'VALID'),
    (9,'unverified','C1','OPERATOR','ACTIVE',false,'VALID'),
    (10,'expired','C1','OPERATOR','ACTIVE',true,'EXPIRED'),
    (11,'revoked','C1','OPERATOR','ACTIVE',true,'REVOKED'),
    (12,'setup',null,'OWNER','ACTIVE',true,'CATALOG_ADMIN')
) a(n,name,carrier,role,status,verified,grant_state);
-- Bootstrap-only anchors: no tenant/initial owner public onboarding writer.
insert into public.organizations(id,code,name,status,default_currency) values
('e4400000-0000-4000-8000-000000000001','HAC44-CP-SHIPPER','[SYNTHETIC] Carrier portal shipper','ACTIVE','USD'),
('e4400000-0000-4000-8000-000000000012','HAC44-CP-SETUP','[SYNTHETIC] Catalog setup organization','ACTIVE','USD');
-- LOCAL_ONLY_AUTH_PLACEHOLDER: no credential, identity or session.
insert into auth.users(id,instance_id,aud,role,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,
    created_at,updated_at,confirmation_token,email_change,email_change_token_new,recovery_token)
select auth_user_id,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',email,now(),
    '{"fixture":"LOCAL_ONLY_AUTH_PLACEHOLDER","provider":"email","providers":["email"]}','{}',
    now(),now(),'','','','' from carrier_portal_qa.actors where run_id=hac44_qa.current_run();
insert into public.organization_members(id,organization_id,auth_user_id,display_name,corporate_email,role,status,verified_at)
values('e4420000-0000-4000-8000-000000000001','e4400000-0000-4000-8000-000000000001',
    'e4410000-0000-4000-8000-000000000001','[SYNTHETIC] Separate shipper','local-only-cp-1@cargomesh.test','OWNER','ACTIVE',now()),
('e4420000-0000-4000-8000-000000000012','e4400000-0000-4000-8000-000000000012',
    'e4410000-0000-4000-8000-000000000012','[SYNTHETIC] Setup only','local-only-cp-12@cargomesh.test','OWNER','ACTIVE',now());
-- Grants have no public provisioning writer. This explicit grant bootstraps native catalog setup.
insert into private.v2_catalog_grants(auth_user_id,permission)
values('e4410000-0000-4000-8000-000000000012','CATALOG_ADMIN');
create function pg_temp.id(n text) returns uuid language sql as $$
    select (value->>'id')::uuid from carrier_portal_qa.refs where name=n and run_id=hac44_qa.current_run()
$$;
create function pg_temp.put(n text,v jsonb) returns void language sql as $$
    insert into carrier_portal_qa.refs values(hac44_qa.current_run(),n,v)
$$;
create function pg_temp.tpl(k text,updates jsonb default '{}') returns jsonb language sql as $$
    select value||jsonb_build_object('schemaVersion','2.0')||updates from cp_templates where kind=k
$$;
create function pg_temp.cat(n text,k text,c uuid,s uuid,v jsonb) returns void language sql as $$
    select pg_temp.put(n,public.command_v2_catalog('e4400000-0000-4000-8000-000000000012',
        'e4420000-0000-4000-8000-000000000012',k,c,s,null,gen_random_uuid(),null,v)->'record')
$$;
create function pg_temp.win() returns jsonb language sql as $$
    select jsonb_build_object('startsAt',now()-interval '30 minutes','endsAt',now()+interval '3 hours')
$$;
create function pg_temp.ev() returns jsonb language sql as $$
    select jsonb_build_object('reference','fixture:carrier-portal','provider','LOCAL_ONLY / SIMULATED',
        'observedAt',now()-interval '1 day','validUntil',now()+interval '30 days','provenanceStatus','SIMULATED')
$$;
create function pg_temp.ctx(q uuid default null,c uuid default null,p uuid default null,i uuid default null)
returns jsonb language sql as $$ select jsonb_build_object('requestId',q,'carrierId',c,'parentId',p,'id',i) $$;
create function pg_temp.w(n text,a text,v jsonb,ctx jsonb default pg_temp.ctx()) returns void language plpgsql as $$
declare setup_only boolean:=a in ('nodes.publish','corridors.publish','route-policies.publish','scoring-policies.publish');
    prior text:=current_setting('request.jwt.claims',true); anchor text;
begin
    anchor:=case when setup_only then '000000000012' else '000000000001' end;
    perform set_config('request.jwt.claims',jsonb_build_object('sub','e4410000-0000-4000-8000-'||anchor,'role','authenticated')::text,true);
    perform pg_temp.put(n,public.command_v2_workflow(('e4400000-0000-4000-8000-'||anchor)::uuid,
        ('e4420000-0000-4000-8000-'||anchor)::uuid,a,ctx,gen_random_uuid(),v)->'record');
    perform set_config('request.jwt.claims',prior,true);
end
$$;
set local role authenticated;
set local "request.jwt.claims"='{"sub":"e4410000-0000-4000-8000-000000000012","role":"authenticated"}';
do $$ declare name text; c uuid; s uuid; road jsonb; loc jsonb; begin
    foreach name in array array['C1','C2'] loop
        perform pg_temp.cat(name,'carriers',null,null,pg_temp.tpl('carriers',jsonb_build_object(
            'code','HAC44_CP_'||name,'commercialName','[SYNTHETIC] Portal '||name,'businessIdValue',
            case when name='C1' then '10000000001' else '10000000002' end)));
        c:=pg_temp.id(name);
        perform pg_temp.cat(name||'-depot','depots',c,null,pg_temp.tpl('depots',
            jsonb_build_object('code','HAC44_CP_'||name||'_DEPOT','name','[SYNTHETIC] Portal depot')));
        perform pg_temp.cat(name||'-service','services',c,null,pg_temp.tpl('services',jsonb_build_object(
            'admittedCargoTypes',jsonb_build_array('c0000000-0000-0000-0000-000000000001'),
            'requiredCertifications','[]'::jsonb)));
        s:=pg_temp.id(name||'-service');
        perform pg_temp.cat(name||'-pickup','areas',c,s,pg_temp.tpl('areas',jsonb_build_object(
            'geography',jsonb_build_object('granularity','CITY','countryCode','PE','region',null,'city','Lima','postalCode',null),
            'verifiedAt',now()-interval '1 day','validFrom',now()-interval '2 days','validUntil',now()+interval '30 days')));
        perform pg_temp.cat(name||'-delivery','areas',c,s,pg_temp.tpl('areas',jsonb_build_object('role','DELIVERY',
            'geography',jsonb_build_object('granularity','CITY','countryCode','PE','region',null,'city','Arequipa','postalCode',null),
            'verifiedAt',now()-interval '1 day','validFrom',now()-interval '2 days','validUntil',now()+interval '30 days')));
        perform pg_temp.cat(name||'-lane','lanes',c,s,pg_temp.tpl('lanes',jsonb_build_object(
            'pickupAreaId',pg_temp.id(name||'-pickup'),'deliveryAreaId',pg_temp.id(name||'-delivery'),
            'validUntil',now()+interval '30 days')));
        road:=(select value->'roadVehicle' from cp_templates where kind='assets')||
            jsonb_build_object('plate','CP-'||name,'registrationCode','CP-REG-'||name);
        perform pg_temp.cat(name||'-asset','assets',c,null,pg_temp.tpl('assets',jsonb_build_object(
            'serviceId',s,'code','HAC44_CP_ASSET_'||name,'homeDepotId',pg_temp.id(name||'-depot'),'roadVehicle',road)));
        perform pg_temp.cat(name||'-definition','capability-definitions',c,null,pg_temp.tpl('capability-definitions',
            jsonb_build_object('serviceId',s,'validUntil',now()+interval '30 days')));
        perform pg_temp.cat(name||'-capability','asset-capabilities',c,null,pg_temp.tpl('asset-capabilities',
            jsonb_build_object('serviceId',s,'assetId',pg_temp.id(name||'-asset'),
                'definitionId',pg_temp.id(name||'-definition'),'validUntil',now()+interval '30 days')));
        perform pg_temp.cat(name||'-calendar','calendars',c,null,pg_temp.tpl('calendars',jsonb_build_object(
            'serviceId',s,'assetId',pg_temp.id(name||'-asset'),'capacityPoolId',null,'readyPickupAreaId',pg_temp.id(name||'-pickup'),
            'lastVerifiedAt',now()-interval '1 day','horizon',jsonb_build_object('startsAt',now()-interval '1 day','endsAt',now()+interval '2 days'),
            'availableWindows',jsonb_build_array(jsonb_build_object('startsAt',now()-interval '1 day','endsAt',now()+interval '2 days')),
            'validUntil',now()+interval '30 days')));
        perform pg_temp.cat(name||'-driver','drivers',c,null,pg_temp.tpl('drivers',jsonb_build_object(
            'serviceId',s,'fullName','[SYNTHETIC] Driver '||name,'licenseValidUntil','2030-01-01',
            'availableWindows',jsonb_build_array(pg_temp.win()),
            'dutyWindow',jsonb_build_object('startsAt',now()-interval '2 hours','endsAt',now()+interval '8 hours'))));
        -- Separate ROAD LTL resources for consolidation authorization. They do
        -- not occupy or change the primary booking's resource/calendar.
        perform pg_temp.cat(name||'-ltl-service','services',c,null,pg_temp.tpl('services',jsonb_build_object(
            'serviceClass','LTL','admittedCargoTypes',jsonb_build_array('c0000000-0000-0000-0000-000000000001'),
            'requiredCertifications','[]'::jsonb)));
        s:=pg_temp.id(name||'-ltl-service');
        road:=road||jsonb_build_object('plate','CP-LTL-'||name,'registrationCode','CP-LTL-REG-'||name);
        perform pg_temp.cat(name||'-ltl-asset','assets',c,null,pg_temp.tpl('assets',jsonb_build_object(
            'serviceId',s,'code','HAC44_CP_LTL_ASSET_'||name,'homeDepotId',pg_temp.id(name||'-depot'),'roadVehicle',road)));
        perform pg_temp.cat(name||'-ltl-calendar','calendars',c,null,pg_temp.tpl('calendars',jsonb_build_object(
            'serviceId',s,'assetId',pg_temp.id(name||'-ltl-asset'),'capacityPoolId',null,
            'readyPickupAreaId',null,'lastVerifiedAt',now()-interval '1 day',
            'horizon',jsonb_build_object('startsAt',now()-interval '1 day','endsAt',now()+interval '2 days'),
            'availableWindows',jsonb_build_array(jsonb_build_object('startsAt',now()-interval '1 day','endsAt',now()+interval '2 days')),
            'validUntil',now()+interval '30 days')));
    end loop;
end $$;
reset role;
update carrier_portal_qa.actors a set carrier_id=pg_temp.id(a.carrier_name)
where run_id=hac44_qa.current_run() and carrier_name is not null;
-- Initial carrier admins require a bootstrap context. ACTIVE/unverified is a
-- deliberate invalid identity anchor: the public directory cannot create it.
insert into public.carrier_operators(id,carrier_id,auth_user_id,display_name,email,role,status,verified_at)
select ('e44b0000-0000-4000-8000-'||lpad(ordinal::text,12,'0'))::uuid,carrier_id,auth_user_id,
    '[SYNTHETIC] '||name,email,role,identity_status,case when verified then now() else null end
from carrier_portal_qa.actors where run_id=hac44_qa.current_run() and name in ('c1-admin','c2-admin','unverified');
update carrier_portal_qa.actors a set operator_id=o.id from public.carrier_operators o
where a.run_id=hac44_qa.current_run() and o.auth_user_id=a.auth_user_id;
insert into private.v2_catalog_grants(auth_user_id,carrier_id,permission)
select auth_user_id,carrier_id,'CARRIER_EDITOR' from carrier_portal_qa.actors
where run_id=hac44_qa.current_run() and carrier_id is not null;
-- All other identities use the native invite -> own consent -> revise path.
do $$ declare a record; admin uuid; result jsonb; op uuid; begin
    for a in select * from carrier_portal_qa.actors where run_id=hac44_qa.current_run()
        and carrier_id is not null and operator_id is null order by ordinal loop
        select auth_user_id into admin from carrier_portal_qa.actors where run_id=a.run_id
            and carrier_id=a.carrier_id and role='ADMIN';
        perform set_config('request.jwt.claims',jsonb_build_object('sub',admin,'role','authenticated')::text,true);
        set local role authenticated;
        result:=public.command_v2_identity_directory('operators','invite',null,a.carrier_id,null,gen_random_uuid(),
            jsonb_build_object('email',a.email,'role',a.role,'displayName','[SYNTHETIC] '||a.name));
        op:=(result#>>'{record,value,id}')::uuid;
        if a.identity_status<>'INVITED' then
            perform set_config('request.jwt.claims',jsonb_build_object('sub',a.auth_user_id,'role','authenticated')::text,true);
            result:=public.command_v2_identity_directory('operators','accept',null,a.carrier_id,op,gen_random_uuid(),
                '{"expectedVersion":1,"consent":true}');
            if a.identity_status='INACTIVE' then
                perform set_config('request.jwt.claims',jsonb_build_object('sub',admin,'role','authenticated')::text,true);
                result:=public.command_v2_identity_directory('operators','revise',null,a.carrier_id,op,gen_random_uuid(),
                    jsonb_build_object('expectedVersion',2,'role',a.role,'status','INACTIVE'));
            end if;
        end if;
        reset role;
        update carrier_portal_qa.actors set operator_id=op where run_id=a.run_id and name=a.name;
    end loop;
end $$;
update private.v2_catalog_grants g set expires_at=now()-interval '1 hour'
from carrier_portal_qa.actors a where a.run_id=hac44_qa.current_run() and a.name='expired' and g.auth_user_id=a.auth_user_id;
update private.v2_catalog_grants g set revoked_at=now()-interval '1 hour'
from carrier_portal_qa.actors a where a.run_id=hac44_qa.current_run() and a.name='revoked' and g.auth_user_id=a.auth_user_id;
set local role authenticated;
set local "request.jwt.claims"='{"sub":"e4410000-0000-4000-8000-000000000001","role":"authenticated"}';
\ir open-flow.sql
\ir conflict-flow.sql
reset role;
select hac44_qa.capture_ids();
\ir counts.sql
select 'CARRIER_PORTAL_SEED: open opportunity; no offers, bookings, reservations or executions';
commit;
