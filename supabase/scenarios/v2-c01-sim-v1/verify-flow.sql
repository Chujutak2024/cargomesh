-- One focal native case against the actual prepared dataset, not four gate reruns.
begin;
set local search_path=extensions,public;
select no_plan();
create temporary table refs(name text primary key,value jsonb);
insert into refs select name,jsonb_build_object('id',id) from c01_verification.refs;
grant select,insert,update on refs to authenticated;
create function pg_temp.id(n text) returns uuid language sql as $$select (value->>'id')::uuid from refs where name=n;$$;
create function pg_temp.ev() returns jsonb language sql as $$select '{"reference":"simulation:C01-SIM-v1","provider":"CargoMesh C01 fixture","observedAt":"2026-10-21T00:00:00Z","validUntil":"2026-11-04T00:00:00Z","provenanceStatus":"SIMULATED"}'::jsonb;$$;
create function pg_temp.ctx(q uuid default null,c uuid default null,p uuid default null,i uuid default null) returns jsonb language sql as $$select jsonb_build_object('requestId',q,'carrierId',c,'parentId',p,'id',i);$$;
create function pg_temp.actor(a text) returns text language sql security definer as $$select set_config('request.jwt.claims',jsonb_build_object('sub',case when a='client' then(select auth_user_id from public.organization_members where id='__MEMBER__') else(select auth_user_id from public.carrier_operators where id='__OPERATOR__') end,'role','authenticated')::text,true);$$;
create function pg_temp.client_command(a text,v jsonb) returns jsonb language sql as $$select public.command_v2_workflow('__ORG__','__MEMBER__',a,pg_temp.ctx(pg_temp.id('request')),gen_random_uuid(),v)->'record';$$;
create function pg_temp.carrier_command(a text,id uuid,v jsonb) returns jsonb language sql as $$select public.command_v2_carrier_workflow('__OPERATOR__',a,pg_temp.ctx(null,'__CARRIER__',null,id),gen_random_uuid(),v)->'record';$$;
select is((select count(*)::int from public.carrier_services where carrier_id='__CARRIER__'),1,'isolated C01 service is created once across two activations');
select is((select count(*)::int from public.transport_assets where carrier_service_id=pg_temp.id('service')),2,'two resource records, no duplicates after activation replay');
select is((select count(*)::int from public.drivers where carrier_service_id=pg_temp.id('service')),2,'two distinct synthetic driver identities');
select is((select count(*)::int from private.carrier_quote_policies where service_id=pg_temp.id('service')),1,'one native cost policy after activation replay');
select is((select value#>>'{dispatch,autoConfirm}' from private.carrier_quote_policies where service_id=pg_temp.id('service')),'false','prepared policy does not enable delegated confirmation');
select is((select count(*)::int from public.route_resource_limits where carrier_service_id=pg_temp.id('service') and data#>>'{admission,decision}'='ALLOWED'),2,'each truck has explicit simulated admission');
create temporary table history_delta(n integer);insert into history_delta values(0);
do $h$declare t text;delta integer;begin
 for t in select distinct table_name from c01_verification.history loop
  execute format('select count(*)::int from c01_verification.history h left join public.%I x on x.id=h.id where h.table_name=%L and (x.id is null or to_jsonb(x) is distinct from h.snapshot)',t,t) into delta;
  update history_delta set n=n+delta;
 end loop;end;$h$;
select is((select n from history_delta),0,'all historical rows remain byte-for-byte equivalent in their JSON projection');

set local role authenticated;
select pg_temp.actor('client');
insert into refs select 'request',public.create_v2_freight_request('__ORG__','__MEMBER__',gen_random_uuid(),private.hash_v2_freight_payload('__REQUEST__'::jsonb),'__REQUEST__'::jsonb);
select public.command_v2_freight_request('__ORG__','__MEMBER__',gen_random_uuid(),pg_temp.id('request'),1,'SUBMIT',null);
insert into refs values('dispatchOptions',public.read_v2_dispatch_options_with_admission('__ORG__','__MEMBER__',pg_temp.id('request'),2));
select is((select jsonb_array_length(value) from refs where name='dispatchOptions'),1,'new dataset yields one native scoped dispatch option');
insert into refs select 'candidate',jsonb_build_object('serviceId',pg_temp.id('service'),'laneId',pg_temp.id('lane'),'calendarId',pg_temp.id('calendar1'),'assetId',pg_temp.id('truck1'),'poolId',null,
 'resources',jsonb_build_array(jsonb_build_object('calendarId',pg_temp.id('calendar1'),'assetId',pg_temp.id('truck1'),'poolId',null,'allocations',jsonb_build_array(jsonb_build_object('unitIndex',0,'quantity',1))),jsonb_build_object('calendarId',pg_temp.id('calendar2'),'assetId',pg_temp.id('truck2'),'poolId',null,'allocations',jsonb_build_array(jsonb_build_object('unitIndex',0,'quantity',1)))),
 'schedule',jsonb_build_object('policyVersion',1,'pickupAt','2026-11-02T08:00:00-05:00','deliveryAt','2026-11-02T14:00:00-05:00','operationWindow',jsonb_build_object('startsAt','2026-11-02T08:00:00-05:00','endsAt','2026-11-02T14:30:00-05:00'),'routeId',pg_temp.id('corridor'),'transitSeconds',(select value#>'{0,transitSeconds}' from refs where name='dispatchOptions')));
insert into refs select 'preview',public.preview_v2_dispatch_costs('__ORG__','__MEMBER__',pg_temp.id('request'),2,jsonb_build_array(value)) from refs where name='candidate';
select is((select value#>>'{0,status}' from refs where name='preview'),'READY','fixed Nov 2 pickup/delivery windows are feasible under native validations');
insert into refs select 'quote',public.request_v2_carrier_quote('__ORG__','__MEMBER__',pg_temp.id('request'),2,gen_random_uuid(),now()+interval '1 hour',value) from refs where name='candidate';
select is((select value->>'status' from refs where name='quote'),'OFFERED','native Carrier authority issues the computed COST_PLUS offer');
insert into refs select 'decision',pg_temp.client_command('decisions.create',jsonb_build_object('schemaVersion','2.0','planId',value->>'planId','selectedOfferIds',jsonb_build_array(value->>'offerId'),'consideredOfferIds',jsonb_build_array(value->>'offerId'),'policyId',null,'rationale','Explicit C01-SIM synthetic Client authorization','evidence',jsonb_build_array(pg_temp.ev()))) from refs where name='quote';
insert into refs select 'booking',pg_temp.client_command('bookings.create',jsonb_build_object('schemaVersion','2.0','decisionId',pg_temp.id('decision'),'offerId',value->>'offerId','authorization','AUTHORIZE','evidence',pg_temp.ev())) from refs where name='quote';
select is(public.prepare_v2_delegated_booking('__ORG__','__MEMBER__',pg_temp.id('booking'),1,gen_random_uuid(),'PREPARE_AUTHORIZED_CAPACITY'),null::jsonb,'autoConfirm remains disabled; delegated path returns to Carrier review');
insert into refs select 'execution',pg_temp.client_command('executions.create',jsonb_build_object('schemaVersion','2.0','bookingId',pg_temp.id('booking'),'serviceId',pg_temp.id('service')));
insert into refs select 'plan',public.read_v2_workflow('__ORG__','__MEMBER__','plans',pg_temp.ctx(null,null,null,(select (value->>'planId')::uuid from refs where name='quote')),100,0)->0;
insert into refs select 'hold-'||n,pg_temp.client_command('holds.create',jsonb_build_object('schemaVersion','2.0','bookingId',pg_temp.id('booking'),'assignmentId',value#>>'{data,legAssignments,0,id}','planResourceId',resource->'resourceId','expiresAt',now()+interval '20 minutes','consolidationId',null,'evidence',resource#>'{resource,verificationSource,source}')) from refs cross join lateral jsonb_array_elements(value#>'{data,legAssignments,0,resources}') with ordinality rs(resource,n) where name='plan';
select pg_temp.actor('carrier');
select pg_temp.carrier_command('holds.confirm',pg_temp.id(name),jsonb_build_object('schemaVersion','2.0','expectedVersion',1,'note','Explicit simulated Carrier resource confirmation','evidence',pg_temp.ev())) from refs where name in('hold-1','hold-2') order by name;
select pg_temp.carrier_command('bookings.confirm',pg_temp.id('booking'),jsonb_build_object('schemaVersion','2.0','expectedVersion',1,'note','Explicit Carrier approval of both synthetic resources','evidence',pg_temp.ev(),'carrierReference','C01-SIM-v1','confirmation','CONFIRMED'));
reset role;
insert into refs select 'reservation'||n,jsonb_build_object('id',r.id) from generate_series(1,2) n join public.capacity_reservations r on r.booking_id=pg_temp.id('booking') and r.capacity_calendar_id=pg_temp.id('calendar'||n);
create function pg_temp.resolve(v jsonb) returns jsonb language plpgsql as $f$
declare answer jsonb;k text;x jsonb;begin
 if jsonb_typeof(v)='object' and v?'$ref' then if pg_temp.id(v->>'$ref') is null then raise exception 'UNRESOLVED_CREW_REF';end if;return to_jsonb(pg_temp.id(v->>'$ref'));
 elsif jsonb_typeof(v)='object' then answer:='{}';for k,x in select * from jsonb_each(v) loop answer:=answer||jsonb_build_object(k,pg_temp.resolve(x));end loop;return answer;
 elsif jsonb_typeof(v)='array' then answer:='[]';for x in select value from jsonb_array_elements(v) loop answer:=answer||jsonb_build_array(pg_temp.resolve(x));end loop;return answer;
 end if;return v;end;$f$;
set local role authenticated;
select pg_temp.actor('carrier');
insert into refs select item->>'ref',public.command_v2_carrier_catalog('__OPERATOR__',item->>'kind','__CARRIER__',null,null,gen_random_uuid(),null,pg_temp.resolve(item->'value'))->'record' from jsonb_array_elements('__CREW_TEMPLATES__'::jsonb) item;
reset role;
select is((select count(*)::int from public.driver_assignments where execution_id=pg_temp.id('execution') and status='CONFIRMED' and role='PRIMARY'),2,'two qualified synthetic primary drivers assigned without starting execution');
select is((select count(*)::int from public.vehicle_assignments where execution_id=pg_temp.id('execution') and status='CONFIRMED'),2,'two vehicle assignments point at the exact confirmed reservations');
select is((select count(*)::int from public.v2_carrier_offers where freight_request_id=pg_temp.id('request')),1,'one attributable native Carrier offer');
select is((select count(*)::int from public.v2_bookings where freight_request_id=pg_temp.id('request')),1,'one booking for the complete request');
select is((select count(*)::int from public.capacity_reservations where booking_id=pg_temp.id('booking') and status='CONFIRMED'),2,'two physical reservations confirmed in that booking');
select is((select count(distinct pr.asset_id)::int from public.plan_resource_bindings b join public.plan_resources pr on pr.id=b.resource_id where b.plan_id=(select (value->>'planId')::uuid from refs where name='quote')),2,'two different trucks retain their assignments');
select is((select sum(a.assigned_weight_kg) from public.load_allocations a join public.plan_resource_bindings b on b.id=a.assignment_id where b.plan_id=(select (value->>'planId')::uuid from refs where name='quote')),12000::numeric,'twelve tonnes are conserved across the two whole crates');
select is((select status from public.transport_executions where id=pg_temp.id('execution')),'PLANNED','no synthetic transport start event');
select is((select (data#>>'{price,amount}')::numeric*100 from public.v2_carrier_offers where id=(select (value->>'offerId')::uuid from refs where name='quote')),(select (value#>>'{0,totalCents}')::numeric from refs where name='preview'),'native quote agrees with recomputed preview, no hardcoded USD310.80');
select is((select jsonb_array_length(calculation_snapshot#>'{calculation,resources}') from private.quote_issued_offers where offer_id=(select (value->>'offerId')::uuid from refs where name='quote')),2,'both exact heterogeneous truck cost profiles are preserved');
select jsonb_build_object('C01_RESULT',jsonb_build_object('requestId',pg_temp.id('request'),'offerId',(select value->>'offerId' from refs where name='quote'),'bookingId',pg_temp.id('booking'),'reservationIds',(select jsonb_agg(id order by id) from public.capacity_reservations where booking_id=pg_temp.id('booking')),'driverAssignmentIds',(select jsonb_agg(id order by id) from public.driver_assignments where execution_id=pg_temp.id('execution')),'vehicleAssignmentIds',(select jsonb_agg(id order by id) from public.vehicle_assignments where execution_id=pg_temp.id('execution')),'executionStatus',(select status from public.transport_executions where id=pg_temp.id('execution')),'weightKg',12000,'computedPrice',(select data->'price' from public.v2_carrier_offers where id=(select (value->>'offerId')::uuid from refs where name='quote')),'schedule',(select value->'schedule' from refs where name='candidate'),'calculation',(select calculation_snapshot->'calculation' from private.quote_issued_offers where offer_id=(select (value->>'offerId')::uuid from refs where name='quote'))));
select * from finish();
rollback;
