-- HAC-45. Synthetic identities and native commands; transaction is rolled back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path=extensions,public;
select no_plan();
insert into auth.users(id,email,email_confirmed_at,aud,role)
values('c4510000-0000-4000-8000-000000000001','hac45-admin@example.invalid',now(),'authenticated','authenticated'),
('c4510000-0000-4000-8000-000000000002','hac45-operator@example.invalid',now(),'authenticated','authenticated'),
('c4510000-0000-4000-8000-000000000003','hac45-dispatcher@example.invalid',now(),'authenticated','authenticated');
insert into public.carrier_operators(id,carrier_id,auth_user_id,display_name,role,status,verified_at)
select ('c4520000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'c2340000-0000-4000-8000-000000000001',
('c4510000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'[SYNTHETIC] HAC45',r,'ACTIVE',now()
from (values(1,'ADMIN'),(2,'OPERATOR'),(3,'DISPATCHER')) v(n,r);
insert into private.v2_catalog_grants(auth_user_id,carrier_id,permission)
select ('c4510000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'c2340000-0000-4000-8000-000000000001','CARRIER_EDITOR'
from generate_series(1,3) n;
create temp table portal_refs(name text primary key,value jsonb);
grant all on portal_refs to authenticated;
create function pg_temp.catalog(k text,v jsonb,i uuid default null,ver integer default null,key uuid default 'c4530000-0000-4000-8000-000000000001') returns jsonb language sql as $$
select public.command_v2_carrier_catalog('c4520000-0000-4000-8000-000000000001',k,'c2340000-0000-4000-8000-000000000001',null,i,key,ver,v);$$;
set local role authenticated;
set local "request.jwt.claims"='{"sub":"c4510000-0000-4000-8000-000000000001","role":"authenticated"}';
select is(current_user,'authenticated','test executes as authenticated');
select is((select count(*)::integer from public.organization_members where auth_user_id=auth.uid()),0,'carrier has no shipper member');
select is(jsonb_array_length(public.read_v2_carrier_portal_access()),1,'carrier discovers only its authorized identity');
select is(public.read_v2_carrier_portal_access()#>>'{0,role}','ADMIN','role comes from the server');
select is(jsonb_array_length(public.read_v2_carrier_catalog('c4520000-0000-4000-8000-000000000001','carriers','c2340000-0000-4000-8000-000000000001',null,'c2340000-0000-4000-8000-000000000001',1,0)),1,'own profile needs no organization');
select throws_ok($$select public.read_v2_carrier_catalog('c4520000-0000-4000-8000-000000000001','carriers','c2390000-0000-4000-8000-000000000001',null,'c2390000-0000-4000-8000-000000000001',1,0)$$,'PT403',null,'foreign carrier denied');
select throws_ok($$select public.read_v2_carrier_catalog('c4520000-0000-4000-8000-000000000002','carriers','c2340000-0000-4000-8000-000000000001',null,'c2340000-0000-4000-8000-000000000001',1,0)$$,'PT403',null,'forged operator denied');
select throws_ok($$select public.read_v2_carrier_catalog('c4520000-0000-4000-8000-000000000001','preferences','c2340000-0000-4000-8000-000000000001',null,null,1,0)$$,'PT403','FORBIDDEN_CATALOG','shipper preferences excluded');
insert into portal_refs values('depot',pg_temp.catalog('depots','{"schemaVersion":"2.0","code":"HAC45_DEPOT","name":"[SYNTHETIC] HAC45 depot","location":{"label":"Synthetic","countryCode":"PE","region":"LIM","city":"Lima","lat":-12,"lng":-77},"active":true,"handling":["BOX_TRUCK"]}'));
select ok((select value#>>'{record,id}' is not null from portal_refs where name='depot'),'ADMIN writes using CarrierOperator');
select is(pg_temp.catalog('depots',(select value#>'{record,value}' from portal_refs where name='depot'))->>'replay','true','same carrier receipt replays');
select throws_ok($$select pg_temp.catalog('depots',(select value#>'{record,value}' from portal_refs where name='depot')||'{"name":"different"}')$$,'PT409','IDEMPOTENCY_CONFLICT','key collision rejected');
select throws_ok($$select pg_temp.catalog('depots',(select value#>'{record,value}' from portal_refs where name='depot'),(select (value#>>'{record,id}')::uuid from portal_refs where name='depot'),99,'c4530000-0000-4000-8000-000000000002')$$,'PT409','STALE_DRAFT','stale revision rejected');
select lives_ok($$select pg_temp.catalog('depots',(select value#>'{record,value}' from portal_refs where name='depot')||'{"name":"updated"}',(select (value#>>'{record,id}')::uuid from portal_refs where name='depot'),1,'c4530000-0000-4000-8000-000000000003')$$,'current revision succeeds');
select throws_ok($$select count(*) from private.v2_carrier_catalog_receipts$$,'42501',null,'private receipts cannot be read directly');
select lives_ok($$select public.read_v2_carrier_portal_routing('c4520000-0000-4000-8000-000000000001','nodes','c2340000-0000-4000-8000-000000000001',100,0)$$,'carrier routing read uses independent identity');
select throws_ok($$select public.read_v2_carrier_portal_routing('c4520000-0000-4000-8000-000000000001','bookings','c2340000-0000-4000-8000-000000000001',100,0)$$,'PT400','VALIDATION_ERROR','routing reader vocabulary closed');
select throws_ok($$select public.read_v2_carrier_catalog('c4520000-0000-4000-8000-000000000001','assets','c2340000-0000-4000-8000-000000000001',null,null,101,0)$$,'PT400','VALIDATION_ERROR','bounded pagination');
set local "request.jwt.claims"='{"sub":"c4510000-0000-4000-8000-000000000002","role":"authenticated"}';
select lives_ok($$select public.read_v2_carrier_catalog('c4520000-0000-4000-8000-000000000002','depots','c2340000-0000-4000-8000-000000000001',null,null,10,0)$$,'OPERATOR reads own catalog');
select throws_ok($$select public.command_v2_carrier_catalog('c4520000-0000-4000-8000-000000000002','depots','c2340000-0000-4000-8000-000000000001',null,null,gen_random_uuid(),null,(select value#>'{record,value}' from portal_refs where name='depot'))$$,'PT403','FORBIDDEN_CARRIER_ROLE','OPERATOR write denied in DB');
set local "request.jwt.claims"='{"sub":"c4510000-0000-4000-8000-000000000003","role":"authenticated"}';
select is(public.read_v2_carrier_portal_access()#>>'{0,role}','DISPATCHER','DISPATCHER discovers own carrier');
select lives_ok($$select public.read_v2_carrier_catalog('c4520000-0000-4000-8000-000000000003','assets','c2340000-0000-4000-8000-000000000001',null,null,10,0)$$,'DISPATCHER reads own fleet');
select throws_ok($$select public.command_v2_carrier_catalog('c4520000-0000-4000-8000-000000000003','depots','c2340000-0000-4000-8000-000000000001',null,null,gen_random_uuid(),null,(select value#>'{record,value}' from portal_refs where name='depot'))$$,'PT403','FORBIDDEN_CARRIER_ROLE','DISPATCHER catalog write denied in DB');
select lives_ok($$set constraints all immediate$$,'constraints checked as authenticated');
select is(current_user,'authenticated','boundary keeps authenticated role');
reset role;
update private.v2_catalog_grants set revoked_at=now() where auth_user_id='c4510000-0000-4000-8000-000000000001';
set local role authenticated;
set local "request.jwt.claims"='{"sub":"c4510000-0000-4000-8000-000000000001","role":"authenticated"}';
select is(jsonb_array_length(public.read_v2_carrier_portal_access()),0,'revoked grant hides carrier from discovery');
select throws_ok($$select public.read_v2_carrier_catalog('c4520000-0000-4000-8000-000000000001','depots','c2340000-0000-4000-8000-000000000001',null,null,10,0)$$,'PT403',null,'revocation blocks existing session reads');
set local role anon;
select throws_ok($$select public.read_v2_carrier_portal_access()$$,'42501',null,'anonymous cannot invoke discovery RPC');
select * from finish();
rollback;
