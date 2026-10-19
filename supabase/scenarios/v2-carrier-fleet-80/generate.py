"""Generate a local-only, deterministic V2 Carrier scenario. Standard library only."""
from collections import Counter
from datetime import datetime, timedelta, timezone
from pathlib import Path
import argparse
import json

HERE = Path(__file__).resolve().parent
NAME = 'v2-carrier-fleet-80'
PREFIX = 'SIMULATED:' + NAME
parser = argparse.ArgumentParser()
parser.add_argument('--clock', default='2026-10-16T00:00:00Z')
args = parser.parse_args()
clock = datetime.fromisoformat(args.clock.replace('Z', '+00:00'))
assert clock.utcoffset() == timedelta(0), 'Use an explicit UTC clock'
clock = clock.astimezone(timezone.utc)
iso = lambda value: value.isoformat().replace('+00:00', 'Z')
start, end = clock + timedelta(days=2, hours=8), clock + timedelta(days=2, hours=10)
horizon_end = clock + timedelta(days=14)
window = {'startsAt': iso(start), 'endsAt': iso(end)}
observed = iso(clock - timedelta(days=1))
expiry = iso(horizon_end)

def sid(kind, number):
    return f'e5{kind:06x}-0000-4000-8000-{number:012d}'

# Country/city tokens are canonical scenario values, not geocoded road positions.
config = [
    ('Lima Local', 'America/Lima', [('PE','Lima')], [0], [(0,0)], 6,2,1),
    ('California Link', 'America/Los_Angeles', [('US','Los Angeles'),('US','San Diego')], [0], [(0,1)], 6,2,1),
    ('Texas Corridor', 'America/Chicago', [('US','Dallas'),('US','Austin'),('US','Houston')], [0], [(0,1),(1,2)], 6,2,1),
    ('Amazonas Link', 'America/Lima', [('PE','Chachapoyas'),('PE','Chiclayo'),('PE','Lima')], [0,1], [(0,1),(1,2)], 10,3,1),
    ('Central America North', 'America/Guatemala', [('GT','Guatemala City'),('SV','San Salvador')], [0,1], [(0,1)], 10,3,1),
    ('Border Link', 'America/Lima', [('PE','Tacna'),('CL','Arica')], [0,1], [(0,1)], 8,2,1),
    ('Chile Port Link', 'America/Santiago', [('CL','Santiago'),('CL','Valparaiso')], [0,1], [(0,1)], 8,2,1),
    ('Central America South', 'America/Costa_Rica', [('CR','San Jose'),('PA','Panama City')], [0], [(0,1)], 8,2,1),
    ('Spain Corridor', 'Europe/Madrid', [('ES','Madrid'),('ES','Zaragoza'),('ES','Barcelona')], [0,2], [(0,1),(1,2)], 10,3,0),
    ('Japan Corridor', 'Asia/Tokyo', [('JP','Tokyo'),('JP','Yokohama'),('JP','Chiba')], [0,1], [(0,1),(1,2)], 8,3,0),
]
rows, carriers, resources, visuals, policies = [], [], [], [], []

def add(table, row, key=None):
    rows.append({'table': table, 'key': key or {'id': row['id']}, 'value': row})

def evidence(label):
    return {'reference': PREFIX + ':' + label, 'verifiedAt': observed,
            'validUntil': expiry, 'provenanceStatus': 'SIMULATED'}

def location(country, city):
    return {'label': '[SYNTHETIC] ' + city, 'countryCode': country, 'region': None,
            'city': city, 'lat': None, 'lng': None}

categories = []
for n, label in enumerate(['GENERAL', 'CHILLED'], 1):
    category = sid(4,n)
    categories.append(category)
    add('public.cargo_categories', dict(id=category,code='HAC50_SCENARIO_'+label,
        name='[SYNTHETIC] '+label.title(),description=PREFIX,active=True,
        recommended_entry_methods=['UNITIZED'],intake_specification_schema={},
        suggested_requirements={},recommended_vehicle_classes=['REEFER_TRUCK' if n==2 else 'BOX_TRUCK'],
        suggested_equipment='REEFER_TRUCK' if n==2 else 'BOX_TRUCK'))

for c, (name,tz,cities,depot_indexes,connections,count,busy,maintenance) in enumerate(config,1):
    carrier, user, operator = sid(1,c),sid(2,c),sid(3,c)
    code = f'HAC50_C{c:02d}'
    add('public.carriers', dict(id=carrier,code=code,name='[SYNTHETIC] '+name,
        provider_type='CARRIER',status='ACTIVE',supports_webmcp=False,registered_country=cities[0][0],
        legal_name='[SYNTHETIC] '+name,verified_contact=None))
    add('auth.users', dict(id=user,instance_id='00000000-0000-0000-0000-000000000000',
        aud='authenticated',role='authenticated',email=f'hac50-c{c:02d}@example.invalid',
        email_confirmed_at=observed,raw_app_meta_data={'provider':'email','providers':['email']},
        raw_user_meta_data={'scenario':NAME},created_at=observed,updated_at=observed))
    add('public.carrier_operators',dict(id=operator,carrier_id=carrier,auth_user_id=user,
        display_name=f'[SYNTHETIC] C{c:02d} administrator',role='ADMIN',
        email=f'hac50-c{c:02d}@example.invalid',status='ACTIVE',verified_at=observed))
    add('private.v2_catalog_grants',dict(auth_user_id=user,carrier_id=carrier,
        permission='CARRIER_EDITOR',expires_at=expiry,revoked_at=None),
        {'auth_user_id':user,'carrier_id':carrier,'permission':'CARRIER_EDITOR'})
    service_ids = [sid(5,c*10+n) for n in (1,2)]
    depot_ids = []
    for d, city_index in enumerate(depot_indexes,1):
        country,city = cities[city_index]
        depot = sid(6,c*10+d)
        depot_ids.append(depot)
        add('public.carrier_depots',dict(id=depot,carrier_id=carrier,code=f'{code}_D{d}',
            name=f'[SYNTHETIC] {name} / {city}',country_code=country,region_code=None,
            city=city,address_line=f'[SYNTHETIC] {city} depot {d}; not a geocoded address',
            latitude=None,longitude=None,active=True,handling=['GENERAL','CHILLED']))
    for n, service in enumerate(service_ids,1):
        chilled = n==2
        add('public.carrier_services',dict(id=service,carrier_id=carrier,transport_mode='ROAD',
            service_type='FTL',origin_country=cities[0][0],origin_region=cities[0][1],
            destination_country=cities[-1][0],destination_region=cities[-1][1],
            provider_service_code=f'{code}_'+('CHILLED' if chilled else 'GENERAL'),
            max_capacity_kg=18000,max_volume_m3=60,supports_refrigerated=chilled,
            temperature_min_c=2 if chilled else None,temperature_max_c=8 if chilled else None,
            supports_hazardous=False,supports_fragile=False,supports_oversized=False,
            supports_cross_border=len({country for country,city in cities})>1,customs_coordination_included=False,
            active=True,response_channels=['MANUAL'],required_certifications=[]))
        add('public.carrier_service_cargo_categories',dict(carrier_service_id=service,
            cargo_category_id=categories[n-1]),{'carrier_service_id':service,'cargo_category_id':categories[n-1]})
        for i,(country,city) in enumerate(cities):
            for role in (1,2):
                area=sid(7,c*1000+n*100+i*2+role)
                add('public.service_areas',dict(id=area,carrier_service_id=service,
                    area_role='PICKUP' if role==1 else 'DELIVERY',coverage='INCLUDE',
                    granularity='CITY',country_code=country,region_code=None,city=city,
                    postal_code=None,geometry=None,fulfilment_source='OWN',fulfilment_partner_id=None,
                    evidence_reference=PREFIX+':area',verified_at=observed,
                    valid_from=iso(clock),valid_until=expiry,active=True))
        for i,(a,b) in enumerate(connections,1):
            add('public.service_lanes',dict(id=sid(8,c*100+n*10+i),carrier_service_id=service,
                pickup_area_id=sid(7,c*1000+n*100+a*2+1),
                delivery_area_id=sid(7,c*1000+n*100+b*2+2),
                lane_kind='WITHIN_AREA' if a==b else 'DIRECT',transport_mode='ROAD',
                evidence_reference=PREFIX+':lane',verified_at=observed,
                valid_from=iso(clock),valid_until=expiry,active=True,
                cross_border_review_required=cities[a][0]!=cities[b][0],cross_border_prohibited=False,
                planned_transit_minutes=None,transit_provenance_status='UNKNOWN'))
        add('public.cargo_capability_definitions',dict(id=sid(9,c*10+n),carrier_id=carrier,
            carrier_service_id=service,cargo_category_id=categories[n-1],requirements=[],max_weight_kg=18000,
            temperature_range={'minCelsius':2,'maxCelsius':8} if chilled else None,
            certifications=[],evidence=PREFIX+':capability',verified_at=observed,
            valid_until=expiry,active=True,fleet_managed=True))
    for d,depot in enumerate(depot_ids,1):
        country,city=cities[depot_indexes[d-1]]
        depot_tz={'CL':'America/Santiago','SV':'America/El_Salvador','PA':'America/Panama'}.get(country,tz)
        policy={'schemaVersion':'2.0','active':True,'serviceIds':service_ids,
            'operatingHours':{'timezone':depot_tz,'weekly':[
                {'dayOfWeek':day,'opensAt':'00:00','closesAt':'24:00'} for day in range(1,8)]},
            'resources':[{'code':'DOCK','name':'[SYNTHETIC] Shared load/unload dock',
                'activities':['LOAD','UNLOAD'],'equipmentTypes':['BOX_TRUCK','REEFER_TRUCK','TRACTOR_TRAILER'],
                'maxConcurrentVehicles':1},
                {'code':'PARK','name':'[SYNTHETIC] Parking','activities':['PARK'],
                'equipmentTypes':None,'maxConcurrentVehicles':count},
                {'code':'WORKSHOP','name':'[SYNTHETIC] Workshop','activities':['MAINTENANCE'],
                'equipmentTypes':None,'maxConcurrentVehicles':1}],
            'blockedWindows':[],'evidence':evidence('depot-policy')}
        add('public.depot_operating_policies',dict(depot_id=depot,carrier_id=carrier,version=1,value=policy),{'depot_id':depot})
        policies.append({'carrierId':carrier,'depotId':depot,'serviceId':service_ids[0],
            'slot':{'schemaVersion':'2.0','serviceId':service_ids[0],'resourceCode':'DOCK',
                'activity':'LOAD','equipmentType':'BOX_TRUCK','window':window,'units':1}})
    # One time-specific exclusion, outside the primary test window. No radius or road geometry.
    if c==1:
        add('public.service_areas',dict(id=sid(7,1999),carrier_service_id=service_ids[0],area_role='PICKUP',
            coverage='EXCLUDE',granularity='CITY',country_code='PE',region_code=None,city='Lima',
            fulfilment_source='OWN',fulfilment_partner_id=None,evidence_reference=PREFIX+':temporary-exclusion',
            verified_at=observed,valid_from=iso(start+timedelta(hours=4)),
            valid_until=iso(start+timedelta(hours=5)),active=True))
    for i in range(1,count+1):
        number=c*100+i
        asset,driver,calendar=sid(10,number),sid(11,number),sid(12,number)
        state='maintenance' if i<=maintenance else 'busy' if i<=maintenance+busy else 'available'
        if c>=7 and i==count:
            state='unknown'
        chilled=i>count-2
        service=service_ids[1 if chilled else 0]
        definition=sid(9,c*10+(2 if chilled else 1))
        family='refrigerated' if chilled else ['rigid','articulated','curtainsider'][(i-1)%3]
        equipment='REEFER_TRUCK' if chilled else 'TRACTOR_TRAILER' if family=='articulated' else 'BOX_TRUCK'
        capacity=18000 if equipment=='TRACTOR_TRAILER' else 10000 if chilled else 8000
        volume=60 if equipment=='TRACTOR_TRAILER' else 40 if chilled else 30
        depot=depot_ids[(i-1)%len(depot_ids)]
        add('public.transport_assets',dict(id=asset,carrier_id=carrier,carrier_service_id=service,
            code=f'{code}_T{i:02d}',mode='ROAD',equipment_code=equipment,asset_role='CARRIER',
            plate=f'QA-{c:02d}-{i:02d}',axle_config='QA_ONLY',max_weight_kg=capacity,max_volume_m3=volume,
            active=True,operating_status='MAINTENANCE' if state=='maintenance' else 'AVAILABLE',
            home_depot_id=depot,fulfilment_source='OWN',fulfilment_partner_id=None,
            evidence=PREFIX+':asset',registration_code=f'SYNTHETIC-{c:02d}-{i:02d}',
            registered_at=(clock-timedelta(days=365)).date().isoformat(),brand='Synthetic',
            model=family.title(),variant='QA illustration',body_type='REEFER' if chilled else 'BOX',
            usable_dimensions={'length':1200 if equipment=='TRACTOR_TRAILER' else 700 if chilled else 600,
                'width':240,'height':250},gross_weight_limit_kg=capacity+7000,
            odometer_km=10000+i*125,condition_reason='[SYNTHETIC] Preventive maintenance' if state=='maintenance' else None,
            fleet_managed=True))
        add('public.asset_cargo_capabilities',dict(id=sid(13,number),transport_asset_id=asset,
            cargo_category_id=categories[1 if chilled else 0],definition_id=definition,
            carrier_id=carrier,carrier_service_id=service,temperature_min_c=2 if chilled else None,
            temperature_max_c=8 if chilled else None,certifications=[],evidence=PREFIX+':asset-capability',
            verified_at=observed,valid_until=expiry,active=True,fleet_managed=True))
        unknown=state=='unknown'
        add('public.capacity_calendars',dict(id=calendar,carrier_id=carrier,carrier_service_id=service,
            transport_asset_id=asset,capacity_pool_id=None,complete=not unknown,
            available_windows=[] if unknown else [{'startsAt':iso(clock),'endsAt':expiry}],
            source_reference=PREFIX+':calendar',provenance_status='UNKNOWN' if unknown else 'SIMULATED',
            observed_at=None if unknown else observed,valid_until=None if unknown else expiry,
            ready_pickup_area_id=sid(7,c*1000+(2 if chilled else 1)*100+depot_indexes[(i-1)%len(depot_ids)]*2+1),
            timezone=tz,horizon_starts_at=iso(clock),horizon_ends_at=expiry,source=PREFIX+':calendar',
            last_verified_at=None if unknown else observed,freshness='UNKNOWN' if unknown else 'SIMULATED',
            fleet_managed=True))
        if state=='maintenance':
            add('public.scheduled_maintenances',dict(id=sid(14,number),transport_asset_id=asset,
                carrier_id=carrier,carrier_service_id=service,starts_at=iso(start),ends_at=iso(end),
                reason='[SYNTHETIC] Preventive inspection',kind='PREVENTIVE',status='SCHEDULED',
                source=PREFIX+':maintenance',fleet_managed=True))
        if state=='busy':
            # An operational calendar block, not a fabricated customer order or an execution.
            origin=location(*cities[depot_indexes[(i-1)%len(depot_ids)]])
            add('public.repositioning_blocks',dict(id=sid(15,number),capacity_calendar_id=calendar,
                carrier_id=carrier,carrier_service_id=service,starts_at=iso(start),ends_at=iso(end),
                origin=origin,next_pickup={**origin,'label':'[SYNTHETIC] Local pickup staging; no geocoded route'},estimated_travel_seconds=900,
                status='PLANNED',source=PREFIX+':operational-block',reason='[SYNTHETIC] Unavailable for repositioning',
                fleet_managed=True))
        add('public.drivers',dict(id=driver,carrier_id=carrier,carrier_service_id=service,
            full_name=f'[SYNTHETIC] Driver C{c:02d}-{i:02d}',carrier_operator_id=None,
            license_class='QA_ONLY',license_valid_until=(horizon_end+timedelta(days=365)).date().isoformat(),
            license_timezone=tz,qualifications=['QA_ONLY'],experience_years=i%10+1,
            duty_status={'available':'AVAILABLE','busy':'ON_DUTY','maintenance':'OFF_DUTY','unknown':'UNKNOWN'}[state],
            evidence=None if unknown else evidence('driver'),available_windows=[] if state in ('maintenance','unknown') else [
                {'startsAt':iso(start-timedelta(hours=2)),'endsAt':iso(end+timedelta(hours=8))}],
            duty_starts_at=None if unknown else iso(start-timedelta(hours=2)),
            duty_ends_at=None if unknown else iso(end+timedelta(hours=8)),
            maximum_duty_seconds=None if unknown else 28800,used_duty_seconds=28800 if state=='busy' else 0))
        resources.append(dict(carrierId=carrier,serviceId=service,assetId=asset,driverId=driver,
            calendarId=calendar,homeDepotId=depot,state=state,window=window))
        visuals.append(dict(assetId=asset,family=family,poster=f'/v2-workspace/trucks/{family}-3d.png'))
    carriers.append(dict(label=f'C{c:02d}',id=carrier,userId=user,operatorId=operator,
        name=name,serviceIds=service_ids,depotIds=depot_ids,vehicleCount=count,
        countries=sorted({country for country,city in cities})))

states=Counter(r['state'] for r in resources)
assert states==dict(available=44,busy=24,maintenance=8,unknown=4), states
assert len(resources)==80 and sum(len(c['depotIds']) for c in carriers)==16
tables=Counter(r['table'] for r in rows)
manifest=dict(schemaVersion='2.0',scenario=NAME,provenance='SIMULATED',clock=iso(clock),
    scope='CARRIER_CATALOG_AND_RESOURCE_WINDOWS_ONLY',horizon={'startsAt':iso(clock),'endsAt':expiry},
    queryWindow=window,expectedStates=dict(states),tableCounts=dict(tables),carriers=carriers,
    resources=resources,depots=policies,visuals=visuals,
    createsClientRequests=False,createsOffers=False,createsBookings=False,containsRoadGeometry=False,
    currentPhysicalPresence='UNKNOWN',permanentDriverVehicleAssignments=False)
(HERE/'manifest.json').write_text(json.dumps(manifest,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
# records.json is generator input to SQL rendering, and facilitates exact drift/cleanup checks.
(HERE/'records.json').write_text(json.dumps(rows,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
common='''\\set ON_ERROR_STOP on
\\if :{?local_only}
\\else
\\set local_only 0
\\endif
\\if :local_only
\\else
do $$begin raise exception 'HAC50_SCENARIO_LOCAL_ONLY';end$$;
\\endif
do $$begin
 if current_database() !~ '^hac50_scenario_[a-z0-9_]+$' or inet_server_addr() is not null or current_user<>'postgres' then
  raise exception 'HAC50_ISOLATED_LOCAL_POSTGRES_REQUIRED';end if;
end$$;
'''
(HERE/'guard.sql').write_text(common,encoding='utf-8')
payload=json.dumps(rows,ensure_ascii=False,indent=1)
seed='''-- Generated by generate.py; synthetic local scenario, never a migration.
\\ir guard.sql
begin;
select pg_advisory_xact_lock(hashtextextended('v2-carrier-fleet-80',0));
create temp table scenario_rows(ordinal bigint,table_name text,key jsonb,value jsonb) on commit drop;
insert into scenario_rows
select ordinal,x->>'table',x->'key',x->'value'
from jsonb_array_elements($scenario$PAYLOAD$scenario$::jsonb) with ordinality as q(x,ordinal);
do $load$
declare r record; cols text; actual jsonb; expected jsonb; mismatch boolean; schema_name text; target_name text;
begin
 for r in select * from scenario_rows order by ordinal loop
  schema_name:=split_part(r.table_name,'.',1);target_name:=split_part(r.table_name,'.',2);
  select string_agg(format('%I',k),',' order by k) into cols from jsonb_object_keys(r.value) k;
  execute format('insert into %I.%I(%s) select %s from jsonb_populate_record(null::%I.%I,$1) on conflict do nothing',
    schema_name,target_name,cols,cols,schema_name,target_name) using r.value;
  execute format('select to_jsonb(t) from %I.%I t where to_jsonb(t) @> $1',schema_name,target_name) into actual using r.key;
  execute format('select to_jsonb(t) from jsonb_populate_record(null::%I.%I,$1) t',schema_name,target_name) into expected using r.value;
  select bool_or((actual->k) is distinct from (expected->k)) into mismatch from jsonb_object_keys(r.value) k;
  if actual is null or mismatch then raise exception 'HAC50_SCENARIO_ROW_CONFLICT: % %',r.table_name,r.key;end if;
 end loop;
end$load$;
commit;
'''.replace('PAYLOAD',payload)
(HERE/'seed.sql').write_text(seed,encoding='utf-8',newline='\n')
# Production intentionally forbids driver DELETE, even for postgres. Keep it intact.
# This transaction proves the guard and rolls back; it is not a cleanup implementation.
probe='''-- Capability probe only. No rows are removed; no guards are disabled.
\\ir guard.sql
begin;
do $$begin
 begin
  delete from public.drivers where id='e500000b-0000-4000-8000-000000000101';
  if not found then raise exception 'HAC50_SCENARIO_NOT_SEEDED';end if;
  raise exception 'HAC50_EXPECTED_DRIVER_DELETE_GUARD';
 exception when insufficient_privilege then
  if sqlerrm<>'COMMAND_REQUIRED' then raise;end if;
 end;
end$$;
select 'PASS: crew DELETE remains protected; discard only a dedicated database through a separately authorized operation';
rollback;
'''
(HERE/'cleanup-probe.sql').write_text(probe,encoding='utf-8',newline='\n')
sql_manifest=json.dumps(manifest,ensure_ascii=False)
verify="""\\ir guard.sql
begin;
create extension if not exists pgtap with schema extensions;
set local search_path=extensions,public;
select no_plan();
create temp table scenario_manifest(v jsonb);
insert into scenario_manifest values($manifest$MANIFEST$manifest$::jsonb);
grant select on scenario_manifest to authenticated;
create function pg_temp.verify_counts() returns setof text language plpgsql as $$
declare entry record;n bigint; filter_sql text;
begin
 for entry in select key,value from jsonb_each((select v->'tableCounts' from scenario_manifest)) loop
  filter_sql:=case entry.key when 'auth.users' then ' where id::text like ''e5000002-%'''
   when 'public.carrier_operators' then ' where id::text like ''e5000003-%'''
   when 'private.v2_catalog_grants' then ' where auth_user_id::text like ''e5000002-%''' else '' end;
  execute format('select count(*) from %I.%I%s',split_part(entry.key,'.',1),split_part(entry.key,'.',2),filter_sql) into n;
  return next extensions.is(n,(entry.value::text)::bigint,'Exact base scenario count: '||entry.key);
 end loop;
end$$;
select * from pg_temp.verify_counts();
select is((select count(*) from public.freight_requests),0::bigint,'No Client request manufactured');
select is((select count(*) from public.v2_bookings),0::bigint,'No booking manufactured');
select is((select count(*) from public.v2_carrier_offers),0::bigint,'No offer manufactured');
select is((select count(*) from public.driver_assignments),0::bigint,'No permanent driver/vehicle assignments manufactured');
select is((select count(*) from public.vehicle_assignments),0::bigint,'No execution assignments manufactured');
select is((select count(*) from public.transport_assets a join public.carrier_depots d on d.id=a.home_depot_id where a.carrier_id<>d.carrier_id),0::bigint,'Home Depot belongs to the same Carrier');
select is((select count(*) from public.capacity_calendars where provenance_status='SIMULATED'),76::bigint,'Known calendars explicitly SIMULATED');
select is((select count(*) from public.capacity_calendars where provenance_status='UNKNOWN' and not complete and available_windows='[]'),4::bigint,'Unknown calendars do not promise availability');
select is((select count(*) from public.service_lanes where planned_transit_minutes is not null),0::bigint,'No road travel times invented');
select is((select count(*) from public.service_lanes l join public.service_areas p on p.id=l.pickup_area_id join public.service_areas d on d.id=l.delivery_area_id where p.carrier_service_id<>l.carrier_service_id or d.carrier_service_id<>l.carrier_service_id or p.area_role<>'PICKUP' or d.area_role<>'DELIVERY'),0::bigint,'Lane references stay within service and role');
select is((select count(*) from public.service_lanes l join public.service_areas p on p.id=l.pickup_area_id join public.service_areas d on d.id=l.delivery_area_id where p.country_code<>d.country_code and not l.cross_border_review_required),0::bigint,'International lanes retain border review');
select is((select count(*) from public.service_areas where granularity='COUNTRY'),0::bigint,'No whole-country coverage inferred');
select is((select count(*) from public.service_lanes l join public.service_areas p on p.id=l.pickup_area_id join public.service_areas d on d.id=l.delivery_area_id where l.lane_kind<>'WITHIN_AREA' and exists(select 1 from public.service_lanes r join public.service_areas rp on rp.id=r.pickup_area_id join public.service_areas rd on rd.id=r.delivery_area_id where r.carrier_service_id=l.carrier_service_id and (rp.country_code,rp.city)=(d.country_code,d.city) and (rd.country_code,rd.city)=(p.country_code,p.city))),0::bigint,'Reverse lanes are not silently published');
select is((select count(*) from public.transport_assets where equipment_code='REEFER_TRUCK'),20::bigint,'Two refrigerated assets per Carrier');
select is((select count(*) from public.service_areas where coverage='EXCLUDE'),1::bigint,'Time-specific exclusion exists');
select is((select count(*) from public.repositioning_blocks where (origin->>'countryCode',origin->>'city') is distinct from (next_pickup->>'countryCode',next_pickup->>'city')),0::bigint,'Synthetic yard blocks do not invent intercity travel times');
select is((select count(*) from public.transport_assets where plate not like 'QA-%'),0::bigint,'All plates are synthetic');
select is((select count(*) from public.drivers where full_name not like '[SYNTHETIC]%'),0::bigint,'All driver names are synthetic');
select is((select count(*) from auth.users where id::text like 'e5000002-%' and encrypted_password is not null),0::bigint,'Base test subjects have no password credentials');
select is((select count(*) from public.transport_assets where usable_dimensions is not null and max_volume_m3>((usable_dimensions->>'length')::numeric*(usable_dimensions->>'width')::numeric*(usable_dimensions->>'height')::numeric/1000000)),0::bigint,'Usable volume fits declared box dimensions');
create function pg_temp.verify_actor() returns setof text language plpgsql as $$
declare c jsonb;r jsonb;d jsonb;result jsonb;foreign_carrier uuid;
begin
 for c in select value from jsonb_array_elements((select v->'carriers' from scenario_manifest)) loop
  perform set_config('request.jwt.claims',jsonb_build_object('sub',c->>'userId','role','authenticated')::text,true);
  r:=public.read_v2_carrier_catalog((c->>'operatorId')::uuid,'assets',(c->>'id')::uuid,null,null,100,0);
  return next extensions.is(jsonb_array_length(r),(c->>'vehicleCount')::integer,'Carrier sees its exact asset count '||(c->>'label'));
  return next extensions.ok(not exists(select 1 from jsonb_array_elements(r) x where x->>'carrierId'<>c->>'id'),'Carrier assets isolated '||(c->>'label'));
  r:=public.read_v2_carrier_catalog((c->>'operatorId')::uuid,'drivers',(c->>'id')::uuid,null,null,100,0);
  return next extensions.is(jsonb_array_length(r),(c->>'vehicleCount')::integer,'Carrier sees its drivers '||(c->>'label'));
  r:=public.read_v2_carrier_catalog((c->>'operatorId')::uuid,'depots',(c->>'id')::uuid,null,null,100,0);
  return next extensions.is(jsonb_array_length(r),jsonb_array_length(c->'depotIds'),'Carrier sees its depots '||(c->>'label'));
  select (value->>'id')::uuid into foreign_carrier from jsonb_array_elements((select v->'carriers' from scenario_manifest)) where value->>'id'<>c->>'id' limit 1;
  return next extensions.throws_ok(format('select public.read_v2_carrier_catalog(%L,''assets'',%L,null,null,100,0)',c->>'operatorId',foreign_carrier),'PT403','FORBIDDEN_WORKFLOW','Foreign Carrier denied '||(c->>'label'));
  for d in select value from jsonb_array_elements((select v->'depots' from scenario_manifest)) where value->>'carrierId'=c->>'id' loop
   result:=public.depot_operations_v2((c->>'operatorId')::uuid,(c->>'id')::uuid,(d->>'depotId')::uuid,'availability',null,null,null,d->'slot');
   return next extensions.is(result#>>'{data,status}','eligible','Simulated depot slot available '||(d->>'depotId'));
   result:=public.depot_operations_v2((c->>'operatorId')::uuid,(c->>'id')::uuid,(d->>'depotId')::uuid,'availability',null,null,null,jsonb_set(d->'slot','{units}','2'));
   return next extensions.is(result#>>'{data,status}','ineligible','Depot capacity limit respected '||(d->>'depotId'));
  end loop;
 end loop;
 perform set_config('request.jwt.claims','{}',true);
 c:=(select v#>'{carriers,0}' from scenario_manifest);
 return next extensions.throws_ok(format('select public.read_v2_carrier_catalog(%L,''assets'',%L,null,null,100,0)',c->>'operatorId',c->>'id'),'PT403','FORBIDDEN_CARRIER_IDENTITY','Missing session denied');
end$$;
set local role authenticated;
select * from pg_temp.verify_actor();
reset role;
select * from finish();
rollback;
""".replace('MANIFEST',sql_manifest)
(HERE/'verify.sql').write_text(verify,encoding='utf-8',newline='\n')
print(json.dumps({'rows':len(rows),'states':dict(states),'carriers':len(carriers),'depots':16,'vehicles':80,'drivers':80}))
