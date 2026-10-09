-- Local synthetic identities. All writes are rolled back; no hosted provisioning.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path=extensions,public;
select no_plan();
update public.organization_members set role='OWNER' where id='c2320000-0000-4000-8000-000000000001';
insert into auth.users(id,email,email_confirmed_at,aud,role)
 values('c2410000-0000-4000-8000-000000000001','hac41-carrier@example.invalid',now(),'authenticated','authenticated'),
 ('c2410000-0000-4000-8000-000000000002','hac41-invite@example.invalid',now(),'authenticated','authenticated');
insert into public.carrier_operators(id,carrier_id,auth_user_id,display_name,role,status,verified_at)
 values('c2420000-0000-4000-8000-000000000001','c2340000-0000-4000-8000-000000000001',
 'c2410000-0000-4000-8000-000000000001','[SYNTHETIC] independent carrier','ADMIN','ACTIVE',now());
insert into private.v2_catalog_grants(auth_user_id,carrier_id,permission)
 values('c2410000-0000-4000-8000-000000000001','c2340000-0000-4000-8000-000000000001','CARRIER_EDITOR');
insert into private.mcp_oauth_clients(client_id,provider,enabled,maximum_lifetime_seconds)
 values('hac41-local-client','OTHER',true,600),('hac41-other-client','OTHER',true,600);
create temp table identity_refs(name text primary key,value jsonb);
grant all on identity_refs to authenticated;
create function pg_temp.key(n integer) returns uuid language sql as $$select ('c2430000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid;$$;
create function pg_temp.link(v jsonb,k integer default 1) returns jsonb language sql as $$
 select public.command_v2_mcp_link('c2300000-0000-4000-8000-000000000001','consent',null,pg_temp.key(k),v);$$;
create function pg_temp.ctx(c uuid default null) returns jsonb language sql as $$
 select jsonb_build_object('carrierId',c,'requestId',null,'parentId',null,'id',null);$$;
set local role authenticated;
set local "request.jwt.claims"='{"sub":"c2410000-0000-4000-8000-000000000001","role":"authenticated"}';
select is(public.get_v2_carrier_identity('c2340000-0000-4000-8000-000000000001')->>'operatorId',
 'c2420000-0000-4000-8000-000000000001','carrier without shipper membership is independently authorized');
select is(jsonb_array_length(public.read_v2_carrier_workflow('c2420000-0000-4000-8000-000000000001','offers',
 pg_temp.ctx('c2340000-0000-4000-8000-000000000001'),10,0)),0,'positive carrier workflow read needs no invented tenant');
select throws_ok($$select public.get_v2_carrier_identity('c2390000-0000-4000-8000-000000000001')$$,
 'PT403','FORBIDDEN_WORKFLOW','foreign carrier identity is denied');
select throws_ok($$select count(*) from private.v2_catalog_grants$$,'42501',null,'bearer cannot manufacture server-owned grants');
insert into identity_refs values('integration',public.command_v2_response_integration('c2340000-0000-4000-8000-000000000001',pg_temp.key(2),
 '{"serviceId":"c2360000-0000-4000-8000-000000000001","channel":"API","endpointRef":"env://HAC41_RESPONSE_URL","enabled":true,"expectedVersion":0}'));
select is((select value#>>'{record,value,status}' from identity_refs where name='integration'),'PENDING','API reference never asserts a live connection');
select is((select value#>>'{record,value,verifiedAt}' from identity_refs where name='integration'),null,'caller cannot verify an external adapter');
select is(public.diagnose_v2_response_integration('c2340000-0000-4000-8000-000000000001',
 (select (value#>>'{record,value,id}')::uuid from identity_refs where name='integration'))->>'liveIntegrationConfirmed','false','diagnostic reports configuration only');
select throws_ok($$select public.command_v2_response_integration('c2340000-0000-4000-8000-000000000001',pg_temp.key(3),
 '{"serviceId":"c2360000-0000-4000-8000-000000000001","channel":"API","endpointRef":"https://host.test/?token=secret","enabled":true,"expectedVersion":0}')$$,
 'PT400','VALIDATION_ERROR','raw URL/secret is rejected at the database boundary');
select throws_ok($$select public.command_v2_response_integration('c2340000-0000-4000-8000-000000000001',pg_temp.key(4),
 '{"serviceId":"c23a0000-0000-4000-8000-000000000001","channel":"MANUAL","endpointRef":null,"enabled":true,"expectedVersion":0}')$$,
 'PT404','IDENTITY_NOT_FOUND','foreign service cannot be configured');
select lives_ok($$set constraints all immediate$$,'carrier positive controls evaluate deferred constraints as authenticated');
reset role;
update public.carrier_operators set verified_at=now()+interval '1 day' where id='c2420000-0000-4000-8000-000000000001';
set local role authenticated;
select throws_ok($$select public.get_v2_carrier_identity('c2340000-0000-4000-8000-000000000001')$$,
 'PT403','FORBIDDEN_CARRIER_IDENTITY','future verification cannot activate carrier permissions');
reset role;
update public.carrier_operators set verified_at=now() where id='c2420000-0000-4000-8000-000000000001';
set local role authenticated;
select lives_ok($$select public.get_v2_carrier_identity('c2340000-0000-4000-8000-000000000001')$$,'current verification restores the positive carrier control');
reset role;
update public.carrier_operators set status='INACTIVE' where id='c2420000-0000-4000-8000-000000000001';
set local role authenticated;
select throws_ok($$select public.get_v2_carrier_identity('c2340000-0000-4000-8000-000000000001')$$,
 'PT403','FORBIDDEN_CARRIER_IDENTITY','revoked operator loses its existing grant');
set local "request.jwt.claims"='{"sub":"c2310000-0000-4000-8000-000000000001","role":"authenticated","client_id":"hac41-local-client"}';
select throws_ok($$select pg_temp.link('{"oauthClientId":"hac41-local-client","expectedVersion":0}')$$,
 'PT400','CONSENT_REQUIRED','missing consent is denied in SQL, independently of HTTP');
select throws_ok($$select pg_temp.link('{"oauthClientId":"hac41-other-client","expectedVersion":0,"consent":true}')$$,
 'PT403','OAUTH_CLIENT_NOT_VERIFIED','body client cannot replace the verified JWT client');
insert into identity_refs values('link',pg_temp.link('{"oauthClientId":"hac41-local-client","expectedVersion":0,"consent":true}'));
select is((select value#>>'{record,value,externalSubjectRef}' from identity_refs where name='link'),
 'c2310000-0000-4000-8000-000000000001','subject derives from authenticated user');
select is((select value#>>'{record,value,provider}' from identity_refs where name='link'),'OTHER','provider derives from private registered client');
select is(pg_temp.link('{"oauthClientId":"hac41-local-client","expectedVersion":0,"consent":true}')->>'replay','true','identical consent retry is stable');
select throws_ok($$select pg_temp.link('{"oauthClientId":"hac41-local-client","expectedVersion":1,"consent":true}')$$,
 'PT409','IDEMPOTENCY_CONFLICT','same consent key cannot authorize a different payload');
select is((select count(*)::integer from public.mcp_account_links),1,'own verified link is visible through RLS');
select is(public.check_v2_mcp_actor('c2300000-0000-4000-8000-000000000001','c2320000-0000-4000-8000-000000000001'),true,'linked client passes per-call validation');
select is(jsonb_array_length(public.read_v2_location_candidates('c2300000-0000-4000-8000-000000000001','c2320000-0000-4000-8000-000000000001',
 '{"kind":"TEXT","text":"Lima"}')),1,'text resolution returns the authorized saved location');
select is(jsonb_array_length(public.read_v2_location_candidates('c2300000-0000-4000-8000-000000000001','c2320000-0000-4000-8000-000000000001',
 '{"kind":"TEXT","text":"not-a-location"}')),0,'no match is not fabricated');
select throws_ok($$select public.read_v2_location_candidates('c2300000-0000-4000-8000-000000000002','c2320000-0000-4000-8000-000000000002',
 '{"kind":"TEXT","text":"Lima"}')$$,'PT403','FORBIDDEN_WORKFLOW','foreign tenant location resolution is denied');
insert into identity_refs values('invitation',public.command_v2_identity_directory('members','invite',
 'c2300000-0000-4000-8000-000000000001',null,null,pg_temp.key(6),'{"email":"hac41-invite@example.invalid","role":"REQUESTER"}'));
select is((select value#>>'{record,value,status}' from identity_refs where name='invitation'),'INVITED','owner creates an invitation, not an active identity');
select throws_ok($$select public.command_v2_identity_directory('members','invite','c2300000-0000-4000-8000-000000000001',null,null,
 pg_temp.key(7),'{"email":"hac41-invite@example.invalid","role":"OWNER"}')$$,'PT400','VALIDATION_ERROR','invitation cannot manufacture an owner');
set local "request.jwt.claims"='{"sub":"c2410000-0000-4000-8000-000000000002","role":"authenticated"}';
select is(public.command_v2_identity_directory('members','accept','c2300000-0000-4000-8000-000000000001',null,
 (select (value#>>'{record,value,id}')::uuid from identity_refs where name='invitation'),pg_temp.key(8),'{"expectedVersion":1,"consent":true}')#>>'{record,value,status}',
 'ACTIVE','only the invited verified Auth user accepts membership');
select throws_ok($$select public.command_v2_identity_directory('members','invite','c2300000-0000-4000-8000-000000000001',null,null,
 pg_temp.key(9),'{"email":"hac41-carrier@example.invalid","role":"REQUESTER"}')$$,'PT403','FORBIDDEN_TENANT','requester cannot invite another identity');
set local "request.jwt.claims"='{"sub":"c2310000-0000-4000-8000-000000000001","role":"authenticated","client_id":"hac41-local-client"}';
select is(public.command_v2_mcp_link(null,'revoke',(select (value#>>'{record,value,id}')::uuid from identity_refs where name='link'),
 pg_temp.key(5),'{"expectedVersion":1,"reason":"Local revocation test"}')#>>'{record,value,status}','REVOKED','user atomically revokes its own consent');
select throws_ok($$select pg_temp.link('{"oauthClientId":"hac41-local-client","expectedVersion":0,"consent":true}')$$,
 'PT403','LINK_REVOKED_OR_EXPIRED','receipt replay cannot resurrect revoked consent');
select throws_ok($$select public.check_v2_mcp_actor('c2300000-0000-4000-8000-000000000001','c2320000-0000-4000-8000-000000000001')$$,
 'PT403','LINK_REVOKED_OR_EXPIRED','MCP tools recheck revocation on every call');
select is((select count(*)::integer from public.mcp_account_links),0,'RLS hides the revoked link');
select lives_ok($$set constraints all immediate$$,'identity mutations reach deferred constraint evaluation without reset role');
select is(current_user::text,'authenticated','final identity checks still run under authenticated');
select * from finish();rollback;
