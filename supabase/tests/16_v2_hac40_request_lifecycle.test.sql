begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;
select no_plan();
create function pg_temp.hac40_payload() returns jsonb language sql as $$
select '{"schemaVersion":"2.0",
 "origin":{"facilityId":"c2330000-0000-4000-8000-000000000001"},
 "destination":{"facilityId":"c2330000-0000-4000-8000-000000000002"},
 "pickupWindow":{"startsAt":"2026-10-05T08:00:00Z","endsAt":"2026-10-05T18:00:00Z"},
 "deliveryWindow":{"startsAt":"2026-10-07T08:00:00Z","endsAt":"2026-10-07T20:00:00Z"},
 "acceptedModes":["ROAD"],"requiredEquipment":null,
 "cargoSpecification":{"categoryCode":"GENERAL","description":"QA original","packaging":"PALLET",
  "totalWeightKg":1000,"totalVolumeM3":2,"divisible":true,"requirements":[],
  "units":[{"packageType":"PALLET","quantity":1,"weightPerUnitKg":1000,"volumePerUnitM3":2,
   "dimensionsCm":{"length":100,"width":100,"height":200},"indivisible":false,"stackable":true}]},
 "contacts":{"pickup":{"name":"QA","phoneE164":"+51911111111"},
  "recipient":{"name":"QA","phoneE164":"+51922222222"}},"budget":{"amount":500,"currency":"USD"}}'::jsonb;
$$;
create temporary table request_result(value jsonb);
grant select,insert on request_result to authenticated;
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"c2310000-0000-4000-8000-000000000001","role":"authenticated"}';
insert into request_result select public.create_v2_freight_request(
 'c2300000-0000-4000-8000-000000000001','c2320000-0000-4000-8000-000000000001',
 'd0410000-0000-4000-8000-000000000001',private.hash_v2_freight_payload(pg_temp.hac40_payload()),pg_temp.hac40_payload());
select lives_ok($$select public.command_v2_freight_request(
 'c2300000-0000-4000-8000-000000000001','c2320000-0000-4000-8000-000000000001',
 'd0410000-0000-4000-8000-000000000002',(select (value->>'id')::uuid from request_result),1,'REVISE',
 jsonb_set(pg_temp.hac40_payload(),'{cargoSpecification,description}','"QA revised"'))$$,'canonical revision succeeds');
select is((select draft_version from public.freight_requests where creation_idempotency_key='d0410000-0000-4000-8000-000000000001'),2,'revision increments version once');
select is((select cargo_description from public.freight_requests where creation_idempotency_key='d0410000-0000-4000-8000-000000000001'),'QA revised','flat fields reflect revised snapshot');
select is((select creation_payload_hash from public.freight_requests where creation_idempotency_key='d0410000-0000-4000-8000-000000000001'),private.hash_v2_freight_payload(pg_temp.hac40_payload()),'creation hash preserved');
select is((select v2_creation_payload->'cargoSpecification'->>'description' from public.freight_requests where creation_idempotency_key='d0410000-0000-4000-8000-000000000001'),'QA original','creation payload preserved');
select is((public.command_v2_freight_request(
 'c2300000-0000-4000-8000-000000000001','c2320000-0000-4000-8000-000000000001',
 'd0410000-0000-4000-8000-000000000002',(select (value->>'id')::uuid from request_result),1,'REVISE',
 jsonb_set(pg_temp.hac40_payload(),'{cargoSpecification,description}','"QA revised"'))->>'replay'),'true','exact revision replay bypasses outdated expected version');
select throws_ok($$select public.command_v2_freight_request(
 'c2300000-0000-4000-8000-000000000001','c2320000-0000-4000-8000-000000000001',
 'd0410000-0000-4000-8000-000000000003',(select (value->>'id')::uuid from request_result),1,'REVISE',pg_temp.hac40_payload())$$,
 'PT409','STALE_DRAFT','new stale revision rejected');
select throws_ok($$select public.command_v2_freight_request(
 'c2300000-0000-4000-8000-000000000001','c2320000-0000-4000-8000-000000000001',
 'd0410000-0000-4000-8000-000000000003',(select (value->>'id')::uuid from request_result),2,'REVISE',
 jsonb_set(pg_temp.hac40_payload(),'{cargoSpecification,totalWeightKg}','9999'))$$,
 'PT400','VALIDATION_ERROR','bad revised totals roll back native writer');
select is((select draft_version from public.freight_requests where creation_idempotency_key='d0410000-0000-4000-8000-000000000001'),2,'failed revision leaves previous version');
select throws_ok($$update public.freight_requests set cargo_description='Bypass'
 where creation_idempotency_key='d0410000-0000-4000-8000-000000000001'$$,
 'PT409','V2_DRAFT_MUTATION_UNSUPPORTED','direct UPDATE still rejected');
select throws_ok($$select public.command_v2_freight_request(
 'c2300000-0000-4000-8000-000000000001','c2320000-0000-4000-8000-000000000001',
 'd0410000-0000-4000-8000-000000000002',(select (value->>'id')::uuid from request_result),2,'SUBMIT',null)$$,
 'PT409','IDEMPOTENCY_CONFLICT','cannot reuse revision key for submission');
select lives_ok($$select public.command_v2_freight_request(
 'c2300000-0000-4000-8000-000000000001','c2320000-0000-4000-8000-000000000001',
 'd0410000-0000-4000-8000-000000000003',(select (value->>'id')::uuid from request_result),2,'SUBMIT',null)$$,'submission after invalid attempt succeeds');
select is((select status from public.freight_requests where creation_idempotency_key='d0410000-0000-4000-8000-000000000001'),'PENDING','submission does not claim offer or booking');
select is((select draft_version from public.freight_requests where creation_idempotency_key='d0410000-0000-4000-8000-000000000001'),3,'submission increments version');
select is((public.command_v2_freight_request(
 'c2300000-0000-4000-8000-000000000001','c2320000-0000-4000-8000-000000000001',
 'd0410000-0000-4000-8000-000000000003',(select (value->>'id')::uuid from request_result),2,'SUBMIT',null)->>'replay'),'true','submission retry does not increment twice');
select throws_ok($$select public.command_v2_freight_request(
 'c2300000-0000-4000-8000-000000000001','c2320000-0000-4000-8000-000000000001',
 'd0410000-0000-4000-8000-000000000004',(select (value->>'id')::uuid from request_result),3,'REVISE',pg_temp.hac40_payload())$$,
 'PT409','INVALID_TRANSITION','submitted request cannot be edited as a draft');
set local "request.jwt.claims" to '{"sub":"c2310000-0000-4000-8000-000000000002","role":"authenticated"}';
select throws_ok($$select public.command_v2_freight_request(
 'c2300000-0000-4000-8000-000000000001','c2320000-0000-4000-8000-000000000001',
 'd0410000-0000-4000-8000-000000000005',(select (value->>'id')::uuid from request_result),3,'SUBMIT',null)$$,
 'PT403','FORBIDDEN_TENANT','foreign authenticated actor cannot mutate');
reset role;
select is((select count(*)::integer from private.v2_request_command_receipts),2,'only successful logical commands have receipts');
select is((select count(*)::integer from public.freight_requests where v2_contract_version='2.0'),1,'scratch rows do not escape transaction');
select * from finish();
rollback;
