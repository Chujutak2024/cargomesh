-- Native route/plan/opportunity recipe follows v2-full-flow-qa/workflow-seed.sql.
select pg_temp.put('window',pg_temp.win());
select pg_temp.put('request',public.create_v2_freight_request(
    'e4400000-0000-4000-8000-000000000001','e4420000-0000-4000-8000-000000000001',gen_random_uuid(),
    private.hash_v2_freight_payload(v),v)) from (select jsonb_build_object(
        'schemaVersion','2.0','origin',jsonb_build_object('label','[SYNTHETIC] Lima pickup','countryCode','PE','city','Lima','lat',null,'lng',null),
        'destination',jsonb_build_object('label','[SYNTHETIC] Arequipa delivery','countryCode','PE','city','Arequipa','lat',null,'lng',null),
        'pickupWindow',jsonb_build_object('startsAt',now()-interval '1 hour','endsAt',now()+interval '4 hours'),
        'deliveryWindow',jsonb_build_object('startsAt',now(),'endsAt',now()+interval '8 hours'),
        'acceptedModes',jsonb_build_array('ROAD'),'requiredEquipment',null,
        'cargoSpecification',jsonb_build_object('categoryCode','GENERAL','description','[SYNTHETIC] Portal cargo',
            'packaging','PALLET','totalWeightKg',1000,'totalVolumeM3',2,'divisible',true,'requirements','[]'::jsonb,
            'units',jsonb_build_array(jsonb_build_object('packageType','PALLET','quantity',1,'weightPerUnitKg',1000,
                'volumePerUnitM3',2,'dimensionsCm',jsonb_build_object('length',100,'width',100,'height',200),
                'indivisible',false,'stackable',true))),
        'contacts',jsonb_build_object('pickup',jsonb_build_object('name','Synthetic pickup','phoneE164','+51911111111'),
            'recipient',jsonb_build_object('name','Synthetic recipient','phoneE164','+51922222222')),
        'budget',jsonb_build_object('amount',500,'currency','USD')) v) payload;
select public.command_v2_freight_request('e4400000-0000-4000-8000-000000000001',
    'e4420000-0000-4000-8000-000000000001',gen_random_uuid(),pg_temp.id('request'),1,'SUBMIT',null);
select pg_temp.w('origin','nodes.publish',jsonb_build_object('schemaVersion','2.0','active',true,'kind','HUB',
    'name','[SYNTHETIC] Portal origin','location',(select v2_snapshot->'origin' from public.freight_requests where id=pg_temp.id('request'))-'facilityId',
    'jurisdiction','PE','source',pg_temp.ev(),'verifiedAt',now()-interval '1 day'));
select pg_temp.w('destination','nodes.publish',jsonb_build_object('schemaVersion','2.0','active',true,'kind','HUB',
    'name','[SYNTHETIC] Portal destination','location',(select v2_snapshot->'destination' from public.freight_requests where id=pg_temp.id('request'))-'facilityId',
    'jurisdiction','PE','source',pg_temp.ev(),'verifiedAt',now()-interval '1 day'));
select pg_temp.w('corridor','corridors.publish',jsonb_build_object('schemaVersion','2.0','active',true,
    'originNodeId',pg_temp.id('origin'),'destinationNodeId',pg_temp.id('destination'),'mode','ROAD',
    'estimatedDistanceKm',100,'estimatedDurationSeconds',3600,'restrictions','[]'::jsonb,'source',pg_temp.ev(),
    'version','CP-1','validUntil',now()+interval '30 days','grossWeightLimitKg',15000,'payloadLimitKg',10000,
    'usableDimensions',jsonb_build_object('length',500,'width',240,'height',250),'limitsEvidence',pg_temp.ev(),'waypoints','[]'::jsonb));
select pg_temp.w('policy','route-policies.publish',jsonb_build_object('schemaVersion','2.0','active',true,'version','CP-1',
    'objective','SHORTEST','constraints','[]'::jsonb,'weights',jsonb_build_object('distance',1,'duration',0),'missingDataRule','UNKNOWN'));
select pg_temp.w('scorepolicy','scoring-policies.publish',jsonb_build_object('schemaVersion','2.0','active',true,
    'policy',jsonb_build_object('version','CP-1','objective','LOWEST_COST','weights',jsonb_build_object('cost',1,'transit',0,'reliability',0),
        'missingDataRule','EXCLUDE','tieBreaker','OFFER_ID_ASC')));
do $$ declare carrier text; actor record; result jsonb; begin
    foreach carrier in array array['C1','C2'] loop
        select * into actor from carrier_portal_qa.actors where run_id=hac44_qa.current_run()
            and carrier_name=carrier and role='ADMIN';
        perform set_config('request.jwt.claims',jsonb_build_object('sub',actor.auth_user_id,'role','authenticated')::text,true);
        result:=public.command_v2_carrier_workflow(actor.operator_id,'limits.publish',pg_temp.ctx(null,actor.carrier_id),
            gen_random_uuid(),jsonb_build_object('schemaVersion','2.0','active',true,
            'serviceId',pg_temp.id(carrier||'-service'),'assetId',pg_temp.id(carrier||'-asset'),'combinationId',null,
            'corridorId',pg_temp.id('corridor'),'manufacturerPayloadLimitKg',10000,'routeGrossLimitKg',15000,
            'combinedTareKg',5000,'usableVolumeM3',40,'usableDimensions',jsonb_build_object('length',500,'width',240,'height',250),
            'compatibilityConfirmed',true,'source',pg_temp.ev()));
        perform pg_temp.put(carrier||'-limits',result->'record');
    end loop;
    perform set_config('request.jwt.claims','{"sub":"e4410000-0000-4000-8000-000000000001","role":"authenticated"}',true);
end $$;
select pg_temp.w('route','routes.create',jsonb_build_object('schemaVersion','2.0','corridorIds',jsonb_build_array(pg_temp.id('corridor')),
    'policyId',pg_temp.id('policy')),pg_temp.ctx(pg_temp.id('request')));
select pg_temp.w('plan','plans.create',jsonb_build_object('schemaVersion','2.0','routeId',pg_temp.id('route'),
    'assignments',jsonb_build_array(jsonb_build_object('legSequence',1,'serviceId',pg_temp.id('C1-service'),'laneId',pg_temp.id('C1-lane'),
        'calendarId',pg_temp.id('C1-calendar'),'assetId',pg_temp.id('C1-asset'),'capacityPoolId',null,'combinationId',null,
        'role','LOAD_BEARING','window',pg_temp.win(),'allocations',jsonb_build_array(jsonb_build_object('unitIndex',0,'quantity',1))))),
    pg_temp.ctx(pg_temp.id('request')));
select pg_temp.put('assignment',jsonb_build_object('id',value#>>'{data,assignments,0,id}'))
from carrier_portal_qa.refs where run_id=hac44_qa.current_run() and name='plan';
select pg_temp.w('opportunity','opportunities.create',jsonb_build_object('schemaVersion','2.0','planId',pg_temp.id('plan'),
    'carrierId',pg_temp.id('C1'),'assignmentIds',jsonb_build_array(pg_temp.id('assignment')),
    'responseDeadline',now()+interval '2 hours','responseChannel','MANUAL'),pg_temp.ctx(pg_temp.id('request')));
-- Separate C2 opportunity is the nonempty control for the foreign-operator denial.
select pg_temp.w('C2-route','routes.create',jsonb_build_object('schemaVersion','2.0','corridorIds',jsonb_build_array(pg_temp.id('corridor')),
    'policyId',pg_temp.id('policy')),pg_temp.ctx(pg_temp.id('request')));
select pg_temp.w('C2-plan','plans.create',jsonb_build_object('schemaVersion','2.0','routeId',pg_temp.id('C2-route'),
    'assignments',jsonb_build_array(jsonb_build_object('legSequence',1,'serviceId',pg_temp.id('C2-service'),'laneId',pg_temp.id('C2-lane'),
        'calendarId',pg_temp.id('C2-calendar'),'assetId',pg_temp.id('C2-asset'),'capacityPoolId',null,'combinationId',null,
        'role','LOAD_BEARING','window',pg_temp.win(),'allocations',jsonb_build_array(jsonb_build_object('unitIndex',0,'quantity',1))))),
    pg_temp.ctx(pg_temp.id('request')));
select pg_temp.put('C2-assignment',jsonb_build_object('id',value#>>'{data,assignments,0,id}'))
from carrier_portal_qa.refs where run_id=hac44_qa.current_run() and name='C2-plan';
select pg_temp.w('C2-opportunity','opportunities.create',jsonb_build_object('schemaVersion','2.0','planId',pg_temp.id('C2-plan'),
    'carrierId',pg_temp.id('C2'),'assignmentIds',jsonb_build_array(pg_temp.id('C2-assignment')),
    'responseDeadline',now()+interval '2 hours','responseChannel','MANUAL'),pg_temp.ctx(pg_temp.id('request')));
