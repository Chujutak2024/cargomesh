-- Independent request/plan/booking prerequisites for occupied-resource controls.
select pg_temp.put('conflict-request',public.create_v2_freight_request(
    'e4400000-0000-4000-8000-000000000001','e4420000-0000-4000-8000-000000000001',gen_random_uuid(),
    private.hash_v2_freight_payload(v),v)) from (select jsonb_object_agg(x.key,x.value) v
    from public.freight_requests q cross join lateral jsonb_each(q.v2_snapshot) x
    where q.id=pg_temp.id('request') and x.key=any(array['schemaVersion','origin','destination','pickupWindow','deliveryWindow',
        'acceptedModes','requiredEquipment','cargoSpecification','contacts','budget'])) payload;
select public.command_v2_freight_request('e4400000-0000-4000-8000-000000000001',
    'e4420000-0000-4000-8000-000000000001',gen_random_uuid(),pg_temp.id('conflict-request'),1,'SUBMIT',null);
select pg_temp.w('conflict-route','routes.create',jsonb_build_object('schemaVersion','2.0','corridorIds',jsonb_build_array(pg_temp.id('corridor')),
    'policyId',pg_temp.id('policy')),pg_temp.ctx(pg_temp.id('conflict-request')));
select pg_temp.w('conflict-plan','plans.create',jsonb_build_object('schemaVersion','2.0','routeId',pg_temp.id('conflict-route'),
    'assignments',jsonb_build_array(jsonb_build_object('legSequence',1,'serviceId',pg_temp.id('C1-service'),'laneId',pg_temp.id('C1-lane'),
        'calendarId',pg_temp.id('C1-calendar'),'assetId',pg_temp.id('C1-asset'),'capacityPoolId',null,'combinationId',null,
        'role','LOAD_BEARING','window',(select value from carrier_portal_qa.refs where run_id=hac44_qa.current_run() and name='window'),
        'allocations',jsonb_build_array(jsonb_build_object('unitIndex',0,'quantity',1))))),pg_temp.ctx(pg_temp.id('conflict-request')));
select pg_temp.put('conflict-assignment',jsonb_build_object('id',value#>>'{data,assignments,0,id}'))
from carrier_portal_qa.refs where run_id=hac44_qa.current_run() and name='conflict-plan';
select pg_temp.w('conflict-opportunity','opportunities.create',jsonb_build_object('schemaVersion','2.0','planId',pg_temp.id('conflict-plan'),
    'carrierId',pg_temp.id('C1'),'assignmentIds',jsonb_build_array(pg_temp.id('conflict-assignment')),
    'responseDeadline',now()+interval '2 hours','responseChannel','MANUAL'),pg_temp.ctx(pg_temp.id('conflict-request')));
