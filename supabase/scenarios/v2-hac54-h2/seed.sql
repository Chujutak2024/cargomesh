\set ON_ERROR_STOP on
\if :{?local_only}
\else
  \set local_only 0
\endif
\if :local_only
\else
  do $$ begin raise exception 'HAC54_LOCAL_ONLY: this scenario is never a hosted seed'; end $$;
\endif
-- Read-only fixture recipe. The runner persists everything through authenticated native APIs/RPCs.
begin read only;
with t as (select '2026-10-20T00:00:00Z'::timestamptz as clock),
ev as (select jsonb_build_object('reference','fixture:HAC54-H2-2026-10-20','provider','[SYNTHETIC] HAC54 local QA',
  'observedAt',clock,'validUntil',clock+interval '8 days','provenanceStatus','SIMULATED') as v from t)
select jsonb_build_object(
  'caseKey','HAC54-H2-2026-10-20','clock',t.clock,
  'refs',jsonb_build_object('carrier','c2340000-0000-4000-8000-000000000001','service','c2360000-0000-4000-8000-000000000001',
    'baseRequest','37bbd439-cbb7-41bc-b1a3-ad57451ff12b','lane','c2380000-0000-4000-8000-000000000001',
    'corridor','2cadf297-f5a6-43d2-8f49-7f456f46d954','routePolicy','69a8a7f6-36e1-481a-bba2-cc5239e04c1f'),
  'evidence',ev.v,
  'description','[SYNTHETIC HAC54 H2] Fresh local ROAD quote, no booking',
  'pickupWindow',jsonb_build_object('startsAt',t.clock+interval '3 days 8 hours','endsAt',t.clock+interval '3 days 12 hours'),
  'deliveryWindow',jsonb_build_object('startsAt',t.clock+interval '3 days 14 hours','endsAt',t.clock+interval '3 days 18 hours'),
  'planWindow',jsonb_build_object('startsAt',t.clock+interval '3 days 8 hours','endsAt',t.clock+interval '3 days 18 hours'),
  'responseDeadline',t.clock+interval '2 days',
  'validity',jsonb_build_object('startsAt',t.clock,'endsAt',t.clock+interval '2 days'),
  'asset','{"schemaVersion":"2.0","serviceId":"c2360000-0000-4000-8000-000000000001","code":"HAC54_H2_20261020","mode":"ROAD","equipmentType":"BOX_TRUCK","role":"LOAD_BEARING","usefulCapacityKg":10000,"usableVolumeM3":40,"operatingStatus":"AVAILABLE","homeDepotId":"c2350000-0000-4000-8000-000000000001","provenance":"OWN","partnerId":null,"evidence":"fixture:HAC54-H2-2026-10-20","roadVehicle":{"plate":"H54-LOCAL","registrationCode":"H54-LOCAL","registeredAt":"2026-10-20","brand":"Synthetic","model":"H2 test vehicle","variant":null,"bodyType":"BOX","usableDimensions":{"length":500,"width":240,"height":250},"grossWeightLimitKg":15000,"odometerKm":0,"conditionReason":null,"axleConfig":"2S1"}}'::jsonb,
  'definition',jsonb_build_object('schemaVersion','2.0','serviceId','c2360000-0000-4000-8000-000000000001',
    'categoryId','c0000000-0000-0000-0000-000000000001','requirements','[]'::jsonb,'maxWeightKg',10000,'temperatureRange',null,
    'certifications','[]'::jsonb,'evidence','fixture:HAC54-H2-2026-10-20','verifiedAt',t.clock,'validUntil',t.clock+interval '8 days','active',true),
  'calendar',jsonb_build_object('schemaVersion','2.0','serviceId','c2360000-0000-4000-8000-000000000001','assetId','@asset','capacityPoolId',null,
    'timezone','America/Lima','horizon',jsonb_build_object('startsAt',t.clock,'endsAt',t.clock+interval '8 days'),
    'source','fixture:HAC54-H2-2026-10-20','lastVerifiedAt',t.clock,'freshness','SIMULATED','validUntil',t.clock+interval '8 days','complete',true,
    'availableWindows',jsonb_build_array(jsonb_build_object('startsAt',t.clock,'endsAt',t.clock+interval '8 days')),
    'readyPickupAreaId','c2370000-0000-4000-8000-000000000001'),
  'limits',jsonb_build_object('schemaVersion','2.0','active',true,'serviceId','c2360000-0000-4000-8000-000000000001','assetId','@asset','combinationId',null,
    'corridorId','2cadf297-f5a6-43d2-8f49-7f456f46d954','manufacturerPayloadLimitKg',10000,'routeGrossLimitKg',15000,'combinedTareKg',5000,
    'usableVolumeM3',40,'usableDimensions',jsonb_build_object('length',500,'width',240,'height',250),'compatibilityConfirmed',true,'source',ev.v),
  'scoringPolicy','{"schemaVersion":"2.0","active":true,"policy":{"version":"HAC54-H2-20261020","objective":"LOWEST_COST","weights":{"cost":1,"transit":0,"reliability":0},"missingDataRule":"EXCLUDE","tieBreaker":"OFFER_ID_ASC"}}'::jsonb,
  'quote',jsonb_build_object('schemaVersion','2.0','carrierReference','HAC54-LOCAL-QUOTE','planCandidateId','@plan',
    'coveredServiceIds',jsonb_build_array('c2360000-0000-4000-8000-000000000001'),'coveredAssignmentIds',jsonb_build_array('@assignment'),
    'price',jsonb_build_object('amount',350,'currency','USD'),
    'breakdown',jsonb_build_array(jsonb_build_object('kind','TRANSPORT','amount',jsonb_build_object('amount',350,'currency','USD'),
      'treatment','QUOTED','source',ev.v,'observedAt',t.clock,'details','Synthetic local Carrier quote; not a live price')),
    'validity',jsonb_build_object('startsAt',t.clock,'endsAt',t.clock+interval '2 days'),
    'source',jsonb_build_object('channel','MANUAL','evidence',ev.v),'issuedAt',t.clock,
    'estimatedPickupAt',t.clock+interval '3 days 8 hours','estimatedDeliveryAt',t.clock+interval '3 days 16 hours','transitDurationSeconds',28800,
    'reservableCapacity',jsonb_build_object('weightKg',1000,'volumeM3',2),
    'commercialTerms',jsonb_build_array(jsonb_build_object('code','LOCAL_TEST_ONLY','description','Synthetic local test. Client selection and explicit booking consent are still required.')),
    'evidence',jsonb_build_array(ev.v),'supersedesOfferId',null),
  'revisedAmount',325
) from t,ev;
rollback;
