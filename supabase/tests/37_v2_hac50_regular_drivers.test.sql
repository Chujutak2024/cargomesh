-- Requires only the guarded v2-carrier-fleet-80 local scenario. Transaction rolls back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path=extensions,public;
select no_plan();
create temp table rd_ctx as
select op.id op,op.auth_user_id uid,op.carrier_id carrier,a.id asset,a.carrier_service_id service,
 (select d.id from public.drivers d where d.carrier_id=a.carrier_id and d.carrier_service_id=a.carrier_service_id order by d.id limit 1) driver,
 (select d.id from public.drivers d where d.carrier_id=a.carrier_id and d.carrier_service_id<>a.carrier_service_id order by d.id limit 1) wrong_service,
 (select d.id from public.drivers d where d.carrier_id<>a.carrier_id order by d.id limit 1) foreign_driver,
 coalesce((select version from public.vehicle_regular_drivers r where r.asset_id=a.id),0) base_version,
 (select count(*) from public.driver_assignments where carrier_id=a.carrier_id) trip_count
from public.carrier_operators op join public.transport_assets a on a.carrier_id=op.carrier_id
where op.role='ADMIN' and op.carrier_id='e5000001-0000-4000-8000-000000000002' and a.code='HAC50_C02_T01' order by op.id limit 1;
create temp table rd_dispatch as select id op,auth_user_id uid from public.carrier_operators where carrier_id=(select carrier from rd_ctx) and role='DISPATCHER' and status='ACTIVE' order by id limit 1;
grant select on rd_ctx,rd_dispatch to authenticated;
select is((select count(*)::integer from rd_ctx),1,'test has an existing authorized scenario operator');
create function pg_temp.rd(d uuid,ver integer,k uuid) returns jsonb language sql as $$select public.regular_vehicle_driver_v2(op,carrier,asset,jsonb_build_object('schemaVersion','2.0','serviceId',service,'driverId',d,'expectedVersion',ver),k,0) from rd_ctx;$$;
select set_config('request.jwt.claims',jsonb_build_object('sub',uid,'role','authenticated')::text,true) from rd_ctx;
set local role authenticated;
select lives_ok($$select pg_temp.rd(driver,base_version,'e6000000-0000-4000-8000-000000000001') from rd_ctx$$,'ADMIN assigns regular driver');
select is((select (pg_temp.rd(driver,base_version,'e6000000-0000-4000-8000-000000000001')->>'replay')::boolean from rd_ctx),true,'same command replays without another mutation');
select is((select driver_id from public.vehicle_regular_drivers where asset_id=(select asset from rd_ctx)),(select driver from rd_ctx),'saved relation is readable under RLS');
select is((select version from public.vehicle_regular_drivers where asset_id=(select asset from rd_ctx)),(select base_version+1 from rd_ctx),'version advanced once');
select throws_ok($$select pg_temp.rd(null,base_version,'e6000000-0000-4000-8000-000000000001') from rd_ctx$$,'PT409','IDEMPOTENCY_CONFLICT','same key with different payload rejected');
select throws_ok($$select pg_temp.rd(driver,base_version,'e6000000-0000-4000-8000-000000000002') from rd_ctx$$,'PT409','STALE_DRAFT','concurrent stale revision rejected');
select throws_ok($$select pg_temp.rd(wrong_service,base_version+1,'e6000000-0000-4000-8000-000000000003') from rd_ctx$$,'PT400','INVALID_DRIVER_REFERENCE','other service driver rejected');
select throws_ok($$select pg_temp.rd(foreign_driver,base_version+1,'e6000000-0000-4000-8000-000000000004') from rd_ctx$$,'PT400','INVALID_DRIVER_REFERENCE','other carrier driver rejected');
select lives_ok($$select pg_temp.rd(null,base_version+1,'e6000000-0000-4000-8000-000000000005') from rd_ctx$$,'regular driver can be cleared');
select is((select driver_id from public.vehicle_regular_drivers where asset_id=(select asset from rd_ctx)),null::uuid,'cleared association retains a versioned record');
select throws_ok($$insert into public.vehicle_regular_drivers(asset_id,carrier_id,driver_id,version) select asset,carrier,driver,999 from rd_ctx$$,'42501',null,'direct authenticated mutation denied');
select ok(not has_function_privilege('anon','public.regular_vehicle_driver_v2(uuid,uuid,uuid,jsonb,uuid,integer)','execute'),'anon cannot execute the RPC');
select set_config('request.jwt.claims','{"sub":"e6000000-0000-4000-8000-000000000099","role":"authenticated"}',true);
select is((select count(*)::integer from public.vehicle_regular_drivers),0,'nonmember cannot read regular links');
select throws_ok($$select public.regular_vehicle_driver_v2(op,carrier,null,null,null,0) from rd_ctx$$,'PT403',null,'forged operator cannot read RPC');
reset role;
select is((select count(*) from public.driver_assignments where carrier_id=(select carrier from rd_ctx)),(select trip_count from rd_ctx),'regular link does not create trip assignments');
select ok((select relrowsecurity from pg_class where oid='public.vehicle_regular_drivers'::regclass),'RLS enabled on carrier data');
select ok((select relrowsecurity from pg_class where oid='private.regular_driver_receipts'::regclass),'RLS enabled on receipts');
select ok((select relrowsecurity from pg_class where oid='private.regular_driver_events'::regclass),'RLS enabled on audit events');
select set_config('request.jwt.claims',jsonb_build_object('sub',uid,'role','authenticated')::text,true) from rd_dispatch;
set local role authenticated;
select lives_ok($$select public.regular_vehicle_driver_v2(d.op,c.carrier,null,null,null,0) from rd_dispatch d cross join rd_ctx c$$,'DISPATCHER reads regular links');
select throws_ok($$select public.regular_vehicle_driver_v2(d.op,c.carrier,c.asset,jsonb_build_object('schemaVersion','2.0','serviceId',c.service,'driverId',c.driver,'expectedVersion',0),'e6000000-0000-4000-8000-000000000009',0) from rd_dispatch d cross join rd_ctx c$$,'PT403','FORBIDDEN_CARRIER_ROLE','DISPATCHER cannot change regular driver');
reset role;
select * from finish();
rollback;
