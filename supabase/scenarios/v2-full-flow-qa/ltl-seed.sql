\if :{?local_only}
\else
\set local_only 0
\endif
\if :local_only
\else
DO $$
BEGIN
    RAISE EXCEPTION 'HAC44_LOCAL_ONLY';
END
$$;
\endif
DO $$
BEGIN
    IF inet_server_addr() IS NOT NULL AND inet_server_addr()::text NOT IN(
        '127.0.0.1',
        '::1'
    ) THEN
        RAISE EXCEPTION 'HAC44_LOCAL_SOCKET_REQUIRED';
    END IF;
END
$$;
\if :{?local_only}
\else
\set local_only 0
\endif
\if :local_only
\else
DO $$
BEGIN
    RAISE EXCEPTION 'HAC44_LOCAL_ONLY';
END
$$;
\endif
DO $$
BEGIN
    IF inet_server_addr() IS NOT NULL AND inet_server_addr()::text NOT IN(
        '127.0.0.1',
        '::1'
    ) THEN
        RAISE EXCEPTION 'HAC44_LOCAL_SOCKET_REQUIRED';
    END IF;
END
$$;
begin;
insert into public.carrier_services select(
    jsonb_populate_record(
        null::public.carrier_services,
        to_jsonb(
            x
        ) ||
        '{
            "id": "d44d0000-0000-4000-8000-000000000001",
            "version": 1,
            "service_type": "LTL"
        }'
        ::jsonb
    )
).* from public.carrier_services x where id = 'd4460000-0000-4000-8000-000000000001';
insert into public.service_areas select(
    jsonb_populate_record(
        null::public.service_areas,
        to_jsonb(
            x
        ) ||
        '{
            "id": "d44e0000-0000-4000-8000-000000000001",
            "version": 1,
            "carrier_service_id": "d44d0000-0000-4000-8000-000000000001"
        }'
        ::jsonb
    )
).* from public.service_areas x where id = 'd4470000-0000-4000-8000-000000000001';
insert into public.service_areas select(
    jsonb_populate_record(
        null::public.service_areas,
        to_jsonb(
            x
        ) ||
        '{
            "id": "d44e0000-0000-4000-8000-000000000002",
            "version": 1,
            "carrier_service_id": "d44d0000-0000-4000-8000-000000000001"
        }'
        ::jsonb
    )
).* from public.service_areas x where id = 'd4470000-0000-4000-8000-000000000002';
insert into public.service_lanes select(
    jsonb_populate_record(
        null::public.service_lanes,
        to_jsonb(
            x
        ) ||
        '{
            "id": "d44f0000-0000-4000-8000-000000000001",
            "version": 1,
            "carrier_service_id": "d44d0000-0000-4000-8000-000000000001",
            "pickup_area_id": "d44e0000-0000-4000-8000-000000000001",
            "delivery_area_id": "d44e0000-0000-4000-8000-000000000002"
        }'
        ::jsonb
    )
).* from public.service_lanes x where id = 'd4480000-0000-4000-8000-000000000001';
commit;
-- Synthetic fixtures through real authenticated native commands; exact IDs are registered for cleanup.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions,
public;
insert into private.v2_catalog_grants(
    auth_user_id,
    permission
) values(
    'd4410000-0000-4000-8000-000000000001',
    'CATALOG_ADMIN'
) on conflict do nothing;
update public.service_areas set valid_from = '2020-01-01',
valid_until = '2030-01-01',
verified_at = '2020-01-01' where carrier_service_id = 'd44d0000-0000-4000-8000-000000000001';
update public.service_lanes set valid_from = '2020-01-01',
valid_until = '2030-01-01',
verified_at = '2020-01-01' where carrier_service_id = 'd44d0000-0000-4000-8000-000000000001';
insert into public.carrier_service_cargo_categories(
    carrier_service_id,
    cargo_category_id
) values(
    'd44d0000-0000-4000-8000-000000000001',
    'c0000000-0000-0000-0000-000000000001'
) on conflict do nothing;
update public.carrier_services set service_type = 'LTL' where id = 'd44d0000-0000-4000-8000-000000000001';
create temporary table refs(
    name text primary key,
    value jsonb
) on commit drop;
create temporary table fixtures(
    kind text primary key,
    value jsonb
) on commit drop;
grant all on refs,
fixtures to authenticated;
insert into fixtures values(
    'capability-definitions',
    '{
        "schemaVersion": "2.0",
        "serviceId": "d44d0000-0000-4000-8000-000000000001",
        "categoryId": "c0000000-0000-0000-0000-000000000001",
        "requirements": [],
        "maxWeightKg": 8000,
        "temperatureRange": null,
        "certifications": [
            "QA_CERT"
        ],
        "evidence": "fixture:inspection",
        "verifiedAt": "2026-01-01T00:00:00Z",
        "validUntil": "2027-03-01T00:00:00Z",
        "active": true
    }'
    ::jsonb
);
insert into fixtures values(
    'assets',
    '{
        "schemaVersion": "2.0",
        "serviceId": "d44d0000-0000-4000-8000-000000000001",
        "code": "FLEET_QA",
        "mode": "ROAD",
        "equipmentType": "BOX_TRUCK",
        "role": "LOAD_BEARING",
        "usefulCapacityKg": 10000,
        "usableVolumeM3": 40,
        "operatingStatus": "AVAILABLE",
        "homeDepotId": "d4450000-0000-4000-8000-000000000001",
        "provenance": "OWN",
        "partnerId": null,
        "evidence": "fixture:asset",
        "roadVehicle": {
            "plate": "HAC44-LTL-001",
            "registrationCode": "QA-REG",
            "registeredAt": "2026-01-01",
            "brand": "Synthetic",
            "model": "Test",
            "variant": null,
            "bodyType": "BOX",
            "usableDimensions": {
                "length": 500,
                "width": 240,
                "height": 250
            },
            "grossWeightLimitKg": 15000,
            "odometerKm": 5000,
            "conditionReason": null,
            "axleConfig": "2S1"
        }
    }'
    ::jsonb
);
insert into fixtures values(
    'capacity-pools',
    '{
        "schemaVersion": "2.0",
        "serviceId": "d44d0000-0000-4000-8000-000000000001",
        "code": "POOL_QA",
        "mode": "ROAD",
        "equipmentType": "BOX_TRUCK",
        "serviceWindow": {
            "startsAt": "2027-01-01T00:00:00Z",
            "endsAt": "2027-02-01T00:00:00Z"
        },
        "declaredCapacity": {
            "weightKg": 10000,
            "volumeM3": 40
        },
        "provenance": "CONTRACTED",
        "partnerId": null,
        "evidence": "fixture:agreement",
        "supportedCargoCategoryIds": [
            "c0000000-0000-0000-0000-000000000001"
        ],
        "active": true
    }'
    ::jsonb
);
insert into fixtures values(
    'calendars',
    '{
        "schemaVersion": "2.0",
        "serviceId": "d44d0000-0000-4000-8000-000000000001",
        "assetId": "ASSET",
        "capacityPoolId": null,
        "timezone": "America/Lima",
        "horizon": {
            "startsAt": "2027-01-01T00:00:00Z",
            "endsAt": "2027-02-01T00:00:00Z"
        },
        "source": "fixture:calendar",
        "lastVerifiedAt": "2026-01-01T00:00:00Z",
        "freshness": "SIMULATED",
        "validUntil": "2027-03-01T00:00:00Z",
        "complete": true,
        "availableWindows": [
            {
                "startsAt": "2027-01-01T00:00:00Z",
                "endsAt": "2027-02-01T00:00:00Z"
            }
        ],
        "readyPickupAreaId": "d44e0000-0000-4000-8000-000000000001"
    }'
    ::jsonb
);
insert into fixtures values(
    'maintenances',
    '{
        "schemaVersion": "2.0",
        "serviceId": "d44d0000-0000-4000-8000-000000000001",
        "assetId": "ASSET",
        "blockedWindow": {
            "startsAt": "2027-01-10T00:00:00Z",
            "endsAt": "2027-01-11T00:00:00Z"
        },
        "kind": "PREVENTIVE",
        "status": "SCHEDULED",
        "source": "fixture:work-order",
        "reason": "Synthetic preventive inspection"
    }'
    ::jsonb
);
insert into fixtures values(
    'repositioning-blocks',
    '{
        "schemaVersion": "2.0",
        "serviceId": "d44d0000-0000-4000-8000-000000000001",
        "calendarId": "CALENDAR",
        "occupiedWindow": {
            "startsAt": "2027-01-12T00:00:00Z",
            "endsAt": "2027-01-13T00:00:00Z"
        },
        "origin": {
            "label": "Synthetic Lima",
            "countryCode": "PE",
            "region": "LIM",
            "city": "Lima",
            "lat": -12,
            "lng": -77
        },
        "nextPickup": {
            "label": "Synthetic Lima",
            "countryCode": "PE",
            "region": "LIM",
            "city": "Lima",
            "lat": -12,
            "lng": -77
        },
        "estimatedTravelSeconds": 3600,
        "status": "PLANNED",
        "source": "fixture:dispatch",
        "reason": "Synthetic positioning"
    }'
    ::jsonb
);
insert into fixtures values(
    'asset-capabilities',
    '{
        "schemaVersion": "2.0",
        "serviceId": "d44d0000-0000-4000-8000-000000000001",
        "assetId": "ASSET",
        "categoryId": "c0000000-0000-0000-0000-000000000001",
        "temperatureRange": null,
        "certifications": [
            "QA_CERT"
        ],
        "evidence": "fixture:inspection",
        "verifiedAt": "2026-01-01T00:00:00Z",
        "validUntil": "2027-03-01T00:00:00Z",
        "active": true,
        "definitionId": "DEFINITION"
    }'
    ::jsonb
);
create or replace function pg_temp.id(
    n text
) returns uuid language sql as
$$
    select(
        value ->> 'id'
    )::uuid from refs where name = n;
$$;
create or replace function pg_temp.win() returns jsonb language sql as
$$
    select jsonb_build_object(
        'startsAt',
        now() - interval '30 minutes',
        'endsAt',
        now() + interval '3 hours'
    );
$$;
create or replace function pg_temp.ev() returns jsonb language sql as
$$
    select jsonb_build_object(
        'reference',
        'fixture:workflow',
        'provider',
        'Synthetic QA',
        'observedAt',
        '2020-01-01T00:00:00Z',
        'validUntil',
        '2030-01-01T00:00:00Z',
        'provenanceStatus',
        'SIMULATED'
    );
$$;
create or replace function pg_temp.ctx(
    q uuid default null,
    c uuid default null,
    p uuid default null,
    i uuid default null
) returns jsonb language sql as
$$
    select jsonb_build_object(
        'requestId',
        q,
        'carrierId',
        c,
        'parentId',
        p,
        'id',
        i
    );
$$;
create or replace function pg_temp.w(
    a text,
    v jsonb,
    ctx jsonb default pg_temp.ctx(),
    key uuid default gen_random_uuid()
) returns jsonb language sql as
$$
    select public.command_v2_workflow(
        'd4400000-0000-4000-8000-000000000001',
        'd4420000-0000-4000-8000-000000000001',
        a,
        ctx,
        key,
        v
    ) -> 'record';
$$;
create or replace function pg_temp.save(
    n text,
    a text,
    v jsonb,
    ctx jsonb default pg_temp.ctx()
) returns void language sql as
$$
    insert into refs values(
        n,
        pg_temp.w(
            a,
            v,
            ctx
        )
    );
$$;
set local role authenticated;
set local "request.jwt.claims" =
'{
    "sub": "d4410000-0000-4000-8000-000000000001",
    "role": "authenticated"
}';
create or replace function pg_temp.req_payload() returns jsonb language sql as
$$
    select
    '{
        "schemaVersion": "2.0",
        "serviceType": "LTL",
        "origin": {
            "facilityId": "d4430000-0000-4000-8000-000000000001"
        },
        "destination": {
            "facilityId": "d4430000-0000-4000-8000-000000000002"
        },
        "pickupWindow": {
            "startsAt": "2027-01-15T08:00:00Z",
            "endsAt": "2027-01-15T18:00:00Z"
        },
        "deliveryWindow": {
            "startsAt": "2027-01-15T08:00:00Z",
            "endsAt": "2027-01-15T20:00:00Z"
        },
        "acceptedModes": [
            "ROAD"
        ],
        "requiredEquipment": null,
        "cargoSpecification": {
            "categoryCode": "GENERAL",
            "description": "QA original",
            "packaging": "PALLET",
            "totalWeightKg": 1000,
            "totalVolumeM3": 2,
            "divisible": true,
            "requirements": [],
            "units": [
                {
                    "packageType": "PALLET",
                    "quantity": 1,
                    "weightPerUnitKg": 1000,
                    "volumePerUnitM3": 2,
                    "dimensionsCm": {
                        "length": 100,
                        "width": 100,
                        "height": 200
                    },
                    "indivisible": false,
                    "stackable": true
                }
            ]
        },
        "contacts": {
            "pickup": {
                "name": "QA",
                "phoneE164": "+51911111111"
            },
            "recipient": {
                "name": "QA",
                "phoneE164": "+51922222222"
            }
        },
        "budget": {
            "amount": 500,
            "currency": "USD"
        }
    }'
    ::jsonb || jsonb_build_object(
        'pickupWindow',
        jsonb_build_object(
            'startsAt',
            now() - interval '1 hour',
            'endsAt',
            now() + interval '4 hours'
        ),
        'deliveryWindow',
        jsonb_build_object(
            'startsAt',
            now(),
            'endsAt',
            now() + interval '8 hours'
        )
    );
$$;
insert into refs values(
    'request',
    public.create_v2_freight_request(
        'd4400000-0000-4000-8000-000000000001',
        'd4420000-0000-4000-8000-000000000001',
        gen_random_uuid(),
        private.hash_v2_freight_payload(
            pg_temp.req_payload()
        ),
        pg_temp.req_payload()
    )
);
select public.command_v2_freight_request(
    'd4400000-0000-4000-8000-000000000001',
    'd4420000-0000-4000-8000-000000000001',
    gen_random_uuid(),
    pg_temp.id(
        'request'
    ),
    1,
    'SUBMIT',
    null
);
insert into refs select 'asset',
public.command_v2_catalog(
    'd4400000-0000-4000-8000-000000000001',
    'd4420000-0000-4000-8000-000000000001',
    'assets',
    'd4440000-0000-4000-8000-000000000001',
    null,
    null,
    gen_random_uuid(),
    null,
    value || jsonb_build_object(
        'code',
        'HAC44_LTL_QA'
    )
) -> 'record' from fixtures where kind = 'assets';
insert into refs select 'definition',
public.command_v2_catalog(
    'd4400000-0000-4000-8000-000000000001',
    'd4420000-0000-4000-8000-000000000001',
    'capability-definitions',
    'd4440000-0000-4000-8000-000000000001',
    null,
    null,
    gen_random_uuid(),
    null,
    value || jsonb_build_object(
        'validUntil',
        '2030-01-01T00:00:00Z'
    )
) -> 'record' from fixtures where kind = 'capability-definitions';
insert into refs select 'capability',
public.command_v2_catalog(
    'd4400000-0000-4000-8000-000000000001',
    'd4420000-0000-4000-8000-000000000001',
    'asset-capabilities',
    'd4440000-0000-4000-8000-000000000001',
    null,
    null,
    gen_random_uuid(),
    null,
    value || jsonb_build_object(
        'assetId',
        pg_temp.id(
            'asset'
        ),
        'definitionId',
        pg_temp.id(
            'definition'
        ),
        'validUntil',
        '2030-01-01T00:00:00Z'
    )
) -> 'record' from fixtures where kind = 'asset-capabilities';
insert into refs select 'calendar',
public.command_v2_catalog(
    'd4400000-0000-4000-8000-000000000001',
    'd4420000-0000-4000-8000-000000000001',
    'calendars',
    'd4440000-0000-4000-8000-000000000001',
    null,
    null,
    gen_random_uuid(),
    null,
    value || jsonb_build_object(
        'assetId',
        pg_temp.id(
            'asset'
        ),
        'horizon',
        jsonb_build_object(
            'startsAt',
            now() - interval '2 hours',
            'endsAt',
            now() + interval '1 day'
        ),
        'availableWindows',
        jsonb_build_array(
            jsonb_build_object(
                'startsAt',
                now() - interval '2 hours',
                'endsAt',
                now() + interval '1 day'
            )
        ),
        'validUntil',
        '2030-01-01T00:00:00Z'
    )
) -> 'record' from fixtures where kind = 'calendars';
select pg_temp.save(
    'origin',
    'nodes.publish',
    jsonb_build_object(
        'schemaVersion',
        '2.0',
        'active',
        true,
        'kind',
        'HUB',
        'name',
        'QA origin',
        'location',
        (
            select(
                v2_snapshot -> 'origin'
            ) - 'facilityId' from public.freight_requests where id = pg_temp.id(
                'request'
            )
        ),
        'jurisdiction',
        'PE',
        'source',
        pg_temp.ev(),
        'verifiedAt',
        '2020-01-01T00:00:00Z'
    )
);
select pg_temp.save(
    'destination',
    'nodes.publish',
    jsonb_build_object(
        'schemaVersion',
        '2.0',
        'active',
        true,
        'kind',
        'HUB',
        'name',
        'QA destination',
        'location',
        (
            select(
                v2_snapshot -> 'destination'
            ) - 'facilityId' from public.freight_requests where id = pg_temp.id(
                'request'
            )
        ),
        'jurisdiction',
        'PE',
        'source',
        pg_temp.ev(),
        'verifiedAt',
        '2020-01-01T00:00:00Z'
    )
);
select pg_temp.save(
    'corridor',
    'corridors.publish',
    jsonb_build_object(
        'schemaVersion',
        '2.0',
        'active',
        true,
        'originNodeId',
        pg_temp.id(
            'origin'
        ),
        'destinationNodeId',
        pg_temp.id(
            'destination'
        ),
        'mode',
        'ROAD',
        'estimatedDistanceKm',
        100,
        'estimatedDurationSeconds',
        3600,
        'restrictions',
        '[]'::jsonb,
        'source',
        pg_temp.ev(),
        'version',
        'HAC44-LTL-1',
        'validUntil',
        '2030-01-01T00:00:00Z',
        'grossWeightLimitKg',
        15000,
        'payloadLimitKg',
        10000,
        'usableDimensions',
        jsonb_build_object(
            'length',
            500,
            'width',
            240,
            'height',
            250
        ),
        'limitsEvidence',
        pg_temp.ev(),
        'waypoints',
        '[]'::jsonb
    )
);
select pg_temp.save(
    'policy',
    'route-policies.publish',
    jsonb_build_object(
        'schemaVersion',
        '2.0',
        'active',
        true,
        'version',
        'HAC44-LTL-1',
        'objective',
        'SHORTEST',
        'constraints',
        '[]'::jsonb,
        'weights',
        jsonb_build_object(
            'distance',
            1,
            'duration',
            0
        ),
        'missingDataRule',
        'UNKNOWN'
    )
);
select pg_temp.save(
    'limits',
    'limits.publish',
    jsonb_build_object(
        'schemaVersion',
        '2.0',
        'active',
        true,
        'serviceId',
        'd44d0000-0000-4000-8000-000000000001',
        'assetId',
        pg_temp.id(
            'asset'
        ),
        'combinationId',
        null,
        'corridorId',
        pg_temp.id(
            'corridor'
        ),
        'manufacturerPayloadLimitKg',
        10000,
        'routeGrossLimitKg',
        15000,
        'combinedTareKg',
        5000,
        'usableVolumeM3',
        40,
        'usableDimensions',
        jsonb_build_object(
            'length',
            500,
            'width',
            240,
            'height',
            250
        ),
        'compatibilityConfirmed',
        true,
        'source',
        pg_temp.ev()
    ),
    pg_temp.ctx(
        null,
        'd4440000-0000-4000-8000-000000000001'
    )
);
select pg_temp.save(
    'route',
    'routes.create',
    jsonb_build_object(
        'schemaVersion',
        '2.0',
        'corridorIds',
        jsonb_build_array(
            pg_temp.id(
                'corridor'
            )
        ),
        'policyId',
        pg_temp.id(
            'policy'
        )
    ),
    pg_temp.ctx(
        pg_temp.id(
            'request'
        )
    )
);
select pg_temp.save(
    'plan',
    'plans.create',
    jsonb_build_object(
        'schemaVersion',
        '2.0',
        'routeId',
        pg_temp.id(
            'route'
        ),
        'assignments',
        jsonb_build_array(
            jsonb_build_object(
                'legSequence',
                1,
                'serviceId',
                'd44d0000-0000-4000-8000-000000000001',
                'laneId',
                'd44f0000-0000-4000-8000-000000000001',
                'calendarId',
                pg_temp.id(
                    'calendar'
                ),
                'assetId',
                pg_temp.id(
                    'asset'
                ),
                'capacityPoolId',
                null,
                'combinationId',
                null,
                'role',
                'LOAD_BEARING',
                'window',
                pg_temp.win(),
                'allocations',
                jsonb_build_array(
                    jsonb_build_object(
                        'unitIndex',
                        0,
                        'quantity',
                        1
                    )
                )
            )
        )
    ),
    pg_temp.ctx(
        pg_temp.id(
            'request'
        )
    )
);
insert into refs select 'assignment',
jsonb_build_object(
    'id',
    value #>> '{data,assignments,0,id}'
) from refs where name = 'plan';
select pg_temp.save(
    'opportunity',
    'opportunities.create',
    jsonb_build_object(
        'schemaVersion',
        '2.0',
        'planId',
        pg_temp.id(
            'plan'
        ),
        'carrierId',
        'd4440000-0000-4000-8000-000000000001',
        'assignmentIds',
        jsonb_build_array(
            pg_temp.id(
                'assignment'
            )
        ),
        'responseDeadline',
        now() + interval '2 hours',
        'responseChannel',
        'MANUAL'
    ),
    pg_temp.ctx(
        pg_temp.id(
            'request'
        )
    )
);
select pg_temp.save(
    'offer',
    'offers.create',
    jsonb_build_object(
        'schemaVersion',
        '2.0',
        'carrierReference',
        'QA-OFFER',
        'planCandidateId',
        pg_temp.id(
            'plan'
        ),
        'coveredServiceIds',
        jsonb_build_array(
            'd44d0000-0000-4000-8000-000000000001'
        ),
        'coveredAssignmentIds',
        jsonb_build_array(
            pg_temp.id(
                'assignment'
            )
        ),
        'price',
        jsonb_build_object(
            'amount',
            100,
            'currency',
            'USD'
        ),
        'breakdown',
        jsonb_build_array(
            jsonb_build_object(
                'kind',
                'TRANSPORT',
                'amount',
                jsonb_build_object(
                    'amount',
                    100,
                    'currency',
                    'USD'
                ),
                'treatment',
                'QUOTED',
                'source',
                pg_temp.ev(),
                'observedAt',
                '2020-01-01T00:00:00Z',
                'details',
                null
            )
        ),
        'validity',
        jsonb_build_object(
            'startsAt',
            now() - interval '1 hour',
            'endsAt',
            now() + interval '8 hours'
        ),
        'source',
        jsonb_build_object(
            'channel',
            'MANUAL',
            'evidence',
            pg_temp.ev()
        ),
        'issuedAt',
        now(),
        'estimatedPickupAt',
        null,
        'estimatedDeliveryAt',
        null,
        'transitDurationSeconds',
        3600,
        'reservableCapacity',
        jsonb_build_object(
            'weightKg',
            1000,
            'volumeM3',
            2
        ),
        'commercialTerms',
        '[]'::jsonb,
        'evidence',
        jsonb_build_array(
            pg_temp.ev()
        ),
        'supersedesOfferId',
        null
    ),
    pg_temp.ctx(
        null,
        'd4440000-0000-4000-8000-000000000001',
        pg_temp.id(
            'opportunity'
        )
    )
);
select pg_temp.save(
    'scorepolicy',
    'scoring-policies.publish',
    jsonb_build_object(
        'schemaVersion',
        '2.0',
        'active',
        true,
        'policy',
        jsonb_build_object(
            'version',
            'HAC44-LTL-1',
            'objective',
            'LOWEST_COST',
            'weights',
            jsonb_build_object(
                'cost',
                1,
                'transit',
                0,
                'reliability',
                0
            ),
            'missingDataRule',
            'EXCLUDE',
            'tieBreaker',
            'OFFER_ID_ASC'
        )
    )
);
select pg_temp.save(
    'ranking',
    'ranking.create',
    jsonb_build_object(
        'schemaVersion',
        '2.0',
        'policyId',
        pg_temp.id(
            'scorepolicy'
        )
    ),
    pg_temp.ctx(
        pg_temp.id(
            'request'
        )
    )
);
select pg_temp.save(
    'decision',
    'decisions.create',
    jsonb_build_object(
        'schemaVersion',
        '2.0',
        'planId',
        pg_temp.id(
            'plan'
        ),
        'selectedOfferIds',
        jsonb_build_array(
            pg_temp.id(
                'offer'
            )
        ),
        'rationale',
        'QA authorized choice',
        'policyId',
        pg_temp.id(
            'scorepolicy'
        ),
        'consideredOfferIds',
        jsonb_build_array(
            pg_temp.id(
                'offer'
            )
        ),
        'evidence',
        jsonb_build_array(
            pg_temp.ev()
        )
    ),
    pg_temp.ctx(
        pg_temp.id(
            'request'
        )
    )
);
select pg_temp.save(
    'booking',
    'bookings.create',
    jsonb_build_object(
        'schemaVersion',
        '2.0',
        'decisionId',
        pg_temp.id(
            'decision'
        ),
        'offerId',
        pg_temp.id(
            'offer'
        ),
        'authorization',
        'AUTHORIZE',
        'evidence',
        pg_temp.ev()
    )
);
select pg_temp.save(
    'execution',
    'executions.create',
    jsonb_build_object(
        'schemaVersion',
        '2.0',
        'bookingId',
        pg_temp.id(
            'booking'
        ),
        'serviceId',
        'd44d0000-0000-4000-8000-000000000001'
    )
);
select pg_temp.save(
    'batch',
    'consolidations.create',
    jsonb_build_object(
        'schemaVersion',
        '2.0',
        'serviceId',
        'd44d0000-0000-4000-8000-000000000001',
        'calendarId',
        pg_temp.id(
            'calendar'
        ),
        'routeId',
        pg_temp.id(
            'route'
        ),
        'window',
        pg_temp.win(),
        'cargoCategoryIds',
        jsonb_build_array(
            'c0000000-0000-0000-0000-000000000001'
        ),
        'compatibleRequirementCodes',
        '[]'::jsonb,
        'evidence',
        pg_temp.ev()
    ),
    pg_temp.ctx(
        null,
        'd4440000-0000-4000-8000-000000000001'
    )
);
reset role;
select 'HAC44_LTL_REFS:' || jsonb_object_agg(
    name,
    value
)::text from refs;
commit;
