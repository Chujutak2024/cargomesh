-- HAC-40 B1 catalog: native aggregates, atomic commands, and an explicit ACL seam for HAC-41.
-- No identity onboarding, adapter activation, secrets, or synthetic catalog data.
begin;
create table private.v2_catalog_grants (
 auth_user_id uuid not null references auth.users(id) on delete cascade,
 carrier_id uuid references public.carriers(id) on delete cascade,
 permission text not null check(permission in ('CATALOG_ADMIN','CARRIER_EDITOR')),
 expires_at timestamptz, revoked_at timestamptz, created_at timestamptz not null default now(),
 check((permission='CATALOG_ADMIN')=(carrier_id is null))
);
create unique index v2_catalog_admin_unique on private.v2_catalog_grants(auth_user_id) where carrier_id is null;
create unique index v2_catalog_editor_unique on private.v2_catalog_grants(auth_user_id,carrier_id) where carrier_id is not null;
alter table private.v2_catalog_grants enable row level security;
revoke all on private.v2_catalog_grants from public,anon,authenticated,service_role;
create table private.v2_catalog_receipts (
 organization_id uuid not null references public.organizations(id), member_id uuid not null references public.organization_members(id),
 idempotency_key uuid not null, payload_hash text not null check(payload_hash ~ '^[0-9a-f]{64}$'),
 result jsonb not null, created_at timestamptz not null default now(),
 primary key(organization_id,member_id,idempotency_key)
);
alter table private.v2_catalog_receipts enable row level security;
revoke all on private.v2_catalog_receipts from public,anon,authenticated,service_role;
alter table public.organization_preferences add column objective text check(objective in ('LOWEST_COST','FASTEST','WEIGHTED')),
 add column maximum_wait_minutes integer check(maximum_wait_minutes between 0 and 525600),
 add column preferred_mode text check(preferred_mode in ('ROAD','RAIL','SEA','AIR')),
 add column preferred_equipment text, add column usual_budget jsonb, add column valid_until timestamptz;
alter table public.organization_cargo_profiles add column typical_units jsonb not null default '[]' check(jsonb_typeof(typical_units)='array'),
 add column requirements jsonb not null default '[]' check(jsonb_typeof(requirements)='array'), add column preferred_equipment text;
-- Keep the legacy default_requirements object; the UML requirements array is a distinct native field.
alter table public.cargo_categories add column suggested_equipment text;
alter table public.carriers add column legal_name text, add column business_identifier_type text,
 add column business_identifier_value text, add column registered_country text check(registered_country ~ '^[A-Z]{2}$'),
 add column operational_phone text check(operational_phone ~ '^\+[1-9][0-9]{6,14}$'),
 add column verified_contact jsonb,
 add constraint carrier_business_id_pair check((business_identifier_type is null)=(business_identifier_value is null));
-- Verified contact is HAC-41-owned and cannot be asserted by this catalog command.
alter table public.carrier_depots add column handling jsonb not null default '[]' check(jsonb_typeof(handling)='array');
alter table public.carrier_services alter column max_capacity_kg drop not null,
 alter column origin_country drop not null, alter column destination_country drop not null,
 add column response_channels jsonb not null default '["MANUAL"]' check(jsonb_typeof(response_channels)='array'),
 add column required_certifications jsonb not null default '[]' check(jsonb_typeof(required_certifications)='array');
-- Origin/destination compatibility columns never imply V2 coverage. Unknown limits remain NULL.
create table public.fulfilment_partners (
 id uuid primary key default gen_random_uuid(),carrier_id uuid not null references public.carriers(id),
 registered_name text not null check(length(btrim(registered_name))>0),partner_carrier_ref uuid references public.carriers(id),
 agreement_valid_from timestamptz not null,agreement_valid_until timestamptz not null,
 status text not null check(status in ('ACTIVE','INACTIVE')),coverage_evidence text not null check(length(btrim(coverage_evidence))>0),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(id,carrier_id),check(agreement_valid_until>agreement_valid_from),check(partner_carrier_ref is distinct from carrier_id)
);
create index fulfilment_partners_carrier_idx on public.fulfilment_partners(carrier_id,status);
create index fulfilment_partners_partner_idx on public.fulfilment_partners(partner_carrier_ref);
alter table public.fulfilment_partners enable row level security;
revoke all on public.fulfilment_partners from public,anon,authenticated;
grant select on public.fulfilment_partners to authenticated;
create policy fulfilment_partners_member_read on public.fulfilment_partners for select to authenticated
 using(exists(select 1 from public.organization_members m where m.auth_user_id=(select auth.uid()) and m.status='ACTIVE'));
alter table public.service_areas add column fulfilment_partner_id uuid references public.fulfilment_partners(id),
 alter column evidence_reference drop not null,alter column verified_at drop not null,alter column valid_from drop not null;
create index service_areas_partner_idx on public.service_areas(fulfilment_partner_id);
alter table public.service_lanes alter column evidence_reference drop not null,
 alter column verified_at drop not null,alter column valid_from drop not null,
 drop constraint service_lanes_transport_mode_check,
 add constraint service_lanes_transport_mode_check check(transport_mode in ('ROAD','RAIL','SEA','AIR'));

alter table public.service_areas add column geometry jsonb,
 drop constraint service_areas_granularity_check,drop constraint service_areas_location_shape,
 add constraint service_areas_granularity_check check(granularity in ('COUNTRY','REGION','CITY','POSTAL_CODE','POLYGON','POINTS')),
 add constraint service_areas_location_shape check(
 (granularity='COUNTRY' and region_code is null and city is null and postal_code is null and geometry is null)
 or (granularity='REGION' and region_code is not null and city is null and postal_code is null and geometry is null)
 or (granularity='CITY' and city is not null and postal_code is null and geometry is null)
 or (granularity='POSTAL_CODE' and postal_code is not null and geometry is null)
 or (granularity in ('POLYGON','POINTS') and region_code is null and city is null and postal_code is null and geometry is not null
 and geometry->>'type'=case granularity when 'POLYGON' then 'Polygon' else 'MultiPoint' end));
create function private.validate_v2_catalog_geometry(p_geo jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare shape jsonb; rings jsonb; ring jsonb; point jsonb; begin
 if p_geo is null or p_geo='null'::jsonb then return true;end if;
 if jsonb_typeof(p_geo) is distinct from 'object' or not (p_geo ?& array['type','coordinates']) or p_geo->>'type' not in ('Polygon','MultiPoint') or jsonb_typeof(p_geo->'coordinates') is distinct from 'array'
 or p_geo-ARRAY['type','coordinates']<>'{}'::jsonb then return false;end if;
 if p_geo->>'type'='Polygon' then
  rings:=p_geo->'coordinates';
  if jsonb_array_length(rings) not between 1 and 20 then return false;end if;
 else rings:=jsonb_build_array(p_geo->'coordinates');end if;
 for ring in select value from jsonb_array_elements(rings) loop
  if jsonb_typeof(ring) is distinct from 'array' or jsonb_array_length(ring) not between 1 and 1000 then return false;end if;
  if p_geo->>'type'='Polygon' and (jsonb_array_length(ring)<4 or ring->0 is distinct from ring->(jsonb_array_length(ring)-1)) then return false;end if;
  for point in select value from jsonb_array_elements(ring) loop
   if jsonb_typeof(point) is distinct from 'array' or jsonb_array_length(point)<>2 or jsonb_typeof(point->0) is distinct from 'number' or jsonb_typeof(point->1) is distinct from 'number'
   or (point->>0)::numeric not between -180 and 180 or (point->>1)::numeric not between -90 and 90 then return false;end if;
  end loop;
 end loop;return true;
end;$$;
alter table public.service_areas add constraint service_areas_geometry_shape check(private.validate_v2_catalog_geometry(geometry));
revoke all on function private.validate_v2_catalog_geometry(jsonb) from public,anon,authenticated,service_role;
create or replace function private.guard_v2_road_area_update() returns trigger language plpgsql set search_path='' as $$
begin
 if (new.carrier_service_id,new.area_role,new.coverage,new.granularity,new.country_code,new.region_code,new.city,new.postal_code,new.geometry)
 is distinct from (old.carrier_service_id,old.area_role,old.coverage,old.granularity,old.country_code,old.region_code,old.city,old.postal_code,old.geometry)
 and exists(select 1 from public.service_lanes l where l.pickup_area_id=old.id or l.delivery_area_id=old.id) then
 raise exception 'Referenced V2 ROAD area geography and role are immutable' using errcode='23514';end if;return new;
end;$$;

create or replace function private.validate_v2_road_lane() returns trigger language plpgsql set search_path='' as $$
declare pickup public.service_areas%rowtype; delivery public.service_areas%rowtype; service_mode text;
begin
 select transport_mode into service_mode from public.carrier_services where id=new.carrier_service_id;
 if service_mode is distinct from new.transport_mode then raise exception 'LANE_MODE_MISMATCH' using errcode='23514'; end if;
 select * into pickup from public.service_areas where id=new.pickup_area_id;
 select * into delivery from public.service_areas where id=new.delivery_area_id;
 if pickup.area_role is distinct from 'PICKUP' or pickup.coverage is distinct from 'INCLUDE'
 or delivery.area_role is distinct from 'DELIVERY' or delivery.coverage is distinct from 'INCLUDE' then
 raise exception 'INVALID_LANE_ENDPOINTS' using errcode='23514'; end if;
 if new.lane_kind='WITHIN_AREA' and (pickup.country_code,pickup.region_code,pickup.city,pickup.postal_code,pickup.geometry)
 is distinct from (delivery.country_code,delivery.region_code,delivery.city,delivery.postal_code,delivery.geometry) then
 raise exception 'WITHIN_AREA_GEOGRAPHY_MISMATCH' using errcode='23514'; end if;
 return new;
end;$$;
create function private.guard_v2_catalog() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if current_user<>'postgres' then raise exception 'DIRECT_CATALOG_MUTATION_FORBIDDEN' using errcode='PT403'; end if;
 if TG_OP='UPDATE' then
  if new.id is distinct from old.id then raise exception 'IMMUTABLE_ID' using errcode='PT400'; end if;
  new.version:=old.version+1; new.updated_at:=now();
 end if;
 return case when TG_OP='DELETE' then old else new end;
end;$$;
alter table public.organization_preferences add column version integer not null default 1 check(version>0);
create trigger v2_catalog_command_guard before insert or update or delete on public.organization_preferences for each row execute function private.guard_v2_catalog();
alter table public.organization_cargo_profiles add column version integer not null default 1 check(version>0);
create trigger v2_catalog_command_guard before insert or update or delete on public.organization_cargo_profiles for each row execute function private.guard_v2_catalog();
alter table public.cargo_categories add column version integer not null default 1 check(version>0);
create trigger v2_catalog_command_guard before insert or update or delete on public.cargo_categories for each row execute function private.guard_v2_catalog();
alter table public.carriers add column version integer not null default 1 check(version>0);
create trigger v2_catalog_command_guard before insert or update or delete on public.carriers for each row execute function private.guard_v2_catalog();
alter table public.carrier_depots add column version integer not null default 1 check(version>0);
create trigger v2_catalog_command_guard before insert or update or delete on public.carrier_depots for each row execute function private.guard_v2_catalog();
alter table public.carrier_services add column version integer not null default 1 check(version>0);
create trigger v2_catalog_command_guard before insert or update or delete on public.carrier_services for each row execute function private.guard_v2_catalog();
alter table public.service_areas add column version integer not null default 1 check(version>0);
create trigger v2_catalog_command_guard before insert or update or delete on public.service_areas for each row execute function private.guard_v2_catalog();
alter table public.service_lanes add column version integer not null default 1 check(version>0);
create trigger v2_catalog_command_guard before insert or update or delete on public.service_lanes for each row execute function private.guard_v2_catalog();
alter table public.fulfilment_partners add column version integer not null default 1 check(version>0);
create trigger v2_catalog_command_guard before insert or update or delete on public.fulfilment_partners for each row execute function private.guard_v2_catalog();
create function private.guard_v2_catalog_category_link() returns trigger language plpgsql security invoker set search_path='' as $$
begin if current_user<>'postgres' then raise exception 'DIRECT_CATALOG_MUTATION_FORBIDDEN' using errcode='PT403';end if;
return case when TG_OP='DELETE' then old else new end;end;$$;
create trigger v2_catalog_link_guard before insert or update or delete on public.carrier_service_cargo_categories
 for each row execute function private.guard_v2_catalog_category_link();
revoke all on function private.guard_v2_catalog_category_link() from public,anon,authenticated,service_role;
create function private.catalog_target(p_kind text,p_organization_id uuid,p_carrier_id uuid,p_service_id uuid)
 returns table(table_name text,scope_sql text) language plpgsql set search_path='' as $$ begin case p_kind
when 'preferences' then table_name:='organization_preferences';scope_sql:=format('organization_id=%L',p_organization_id);
when 'cargo-profiles' then table_name:='organization_cargo_profiles';scope_sql:=format('organization_id=%L',p_organization_id);
when 'cargo-categories' then table_name:='cargo_categories';scope_sql:='true';
when 'carriers' then table_name:='carriers';scope_sql:=case when p_carrier_id is null then 'true' else format('id=%L',p_carrier_id) end;
when 'depots' then table_name:='carrier_depots';scope_sql:=format('carrier_id=%L',p_carrier_id);
when 'services' then table_name:='carrier_services';scope_sql:=format('carrier_id=%L',p_carrier_id);
when 'areas' then table_name:='service_areas';scope_sql:=format('carrier_service_id=%L',p_service_id);
when 'lanes' then table_name:='service_lanes';scope_sql:=format('carrier_service_id=%L',p_service_id);
when 'partners' then table_name:='fulfilment_partners';scope_sql:=format('carrier_id=%L',p_carrier_id);
else raise exception 'INVALID_CATALOG_KIND' using errcode='PT400'; end case;return next;end;$$;
create function private.authorize_v2_catalog(p_organization_id uuid,p_member_id uuid,p_kind text,
 p_carrier_id uuid,p_service_id uuid,p_write boolean,p_id uuid)
 returns void language plpgsql security definer set search_path='' as $$
declare member_role text; admin boolean; begin
 select m.role into member_role from public.organization_members m join public.organizations o on o.id=m.organization_id
 where m.id=p_member_id and m.organization_id=p_organization_id and m.auth_user_id=auth.uid() and m.status='ACTIVE' and o.status='ACTIVE';
 if member_role is null then raise exception 'FORBIDDEN_CATALOG' using errcode='PT403'; end if;
 if p_kind not in ('preferences','cargo-profiles','cargo-categories','carriers','depots','services','areas','lanes','partners') then
 raise exception 'VALIDATION_ERROR' using errcode='PT400'; end if;
 if (p_kind in ('preferences','cargo-profiles','cargo-categories') and (p_carrier_id is not null or p_service_id is not null))
 or (p_kind in ('depots','services','partners','areas','lanes') and p_carrier_id is null)
 or ((p_kind in ('areas','lanes')) is distinct from (p_service_id is not null))
 or (p_kind='carriers' and p_carrier_id is not null and p_carrier_id is distinct from p_id) then
 raise exception 'VALIDATION_ERROR' using errcode='PT400'; end if;
 if p_write then
  select exists(select 1 from private.v2_catalog_grants g where g.auth_user_id=auth.uid() and g.permission='CATALOG_ADMIN'
   and g.revoked_at is null and (g.expires_at is null or g.expires_at>now())) into admin;
  if p_kind in ('preferences','cargo-profiles') then
   if member_role not in ('OWNER','SUPERVISOR') or (p_kind='preferences' and member_role<>'OWNER') then
    raise exception 'FORBIDDEN_CATALOG' using errcode='PT403'; end if;
  elsif not admin and (p_kind='cargo-categories' or (p_kind='carriers' and p_id is null) or not exists(
   select 1 from private.v2_catalog_grants g where g.auth_user_id=auth.uid() and g.permission='CARRIER_EDITOR'
   and g.carrier_id=case when p_kind='carriers' then p_id else p_carrier_id end
   and g.revoked_at is null and (g.expires_at is null or g.expires_at>now()))) then
   raise exception 'FORBIDDEN_CATALOG' using errcode='PT403';
  end if;
 end if;
 if p_carrier_id is not null and not exists(select 1 from public.carriers where id=p_carrier_id) then
  raise exception 'CATALOG_NOT_FOUND' using errcode='PT404'; end if;
 if p_service_id is not null and not exists(select 1 from public.carrier_services where id=p_service_id and carrier_id=p_carrier_id) then
  raise exception 'CATALOG_NOT_FOUND' using errcode='PT404'; end if;
end;$$;
create function private.catalog_record(p_kind text,p_id uuid) returns jsonb language plpgsql set search_path='' as $$
declare result jsonb; begin case p_kind
when 'preferences' then select jsonb_build_object('id',r.id,'organizationId',r.organization_id,'carrierId',null,'serviceId',null,'version',r.version,'createdAt',r.created_at,'updatedAt',r.updated_at,'value',jsonb_build_object('schemaVersion','2.0','objective',r.objective,'maximumWaitMinutes',r.maximum_wait_minutes,'preferredMode',r.preferred_mode,'preferredEquipment',r.preferred_equipment,'usualBudget',r.usual_budget,'validUntil',r.valid_until)) into result from public.organization_preferences r where r.id=p_id;
when 'cargo-profiles' then select jsonb_build_object('id',r.id,'organizationId',r.organization_id,'carrierId',null,'serviceId',null,'version',r.version,'createdAt',r.created_at,'updatedAt',r.updated_at,'value',jsonb_build_object('schemaVersion','2.0','name',r.profile_name,'categoryId',r.cargo_category_id,'typicalUnits',r.typical_units,'requirements',r.requirements,'preferredEquipment',r.preferred_equipment,'active',r.active)) into result from public.organization_cargo_profiles r where r.id=p_id;
when 'cargo-categories' then select jsonb_build_object('id',r.id,'organizationId',null,'carrierId',null,'serviceId',null,'version',r.version,'createdAt',r.created_at,'updatedAt',r.updated_at,'value',jsonb_build_object('schemaVersion','2.0','code',r.code,'name',r.name,'guidance',jsonb_build_object('recommendedEntryMethods',r.recommended_entry_methods,'intakeSpecificationSchema',r.intake_specification_schema,'suggestedRequirements',r.suggested_requirements,'recommendedVehicleClasses',r.recommended_vehicle_classes),'suggestedEquipment',r.suggested_equipment,'active',r.active)) into result from public.cargo_categories r where r.id=p_id;
when 'carriers' then select jsonb_build_object('id',r.id,'organizationId',null,'carrierId',r.id,'serviceId',null,'verifiedContact',r.verified_contact,'version',r.version,'createdAt',r.created_at,'updatedAt',r.updated_at,'value',jsonb_build_object('schemaVersion','2.0','code',r.code,'commercialName',r.name,'legalName',r.legal_name,'businessIdType',r.business_identifier_type,'businessIdValue',r.business_identifier_value,'registeredCountry',r.registered_country,'providerType',r.provider_type,'status',r.status,'operationalPhone',r.operational_phone)) into result from public.carriers r where r.id=p_id;
when 'depots' then select jsonb_build_object('id',r.id,'organizationId',null,'carrierId',r.carrier_id,'serviceId',null,'version',r.version,'createdAt',r.created_at,'updatedAt',r.updated_at,'value',jsonb_build_object('schemaVersion','2.0','code',r.code,'name',r.name,'location',jsonb_build_object('countryCode',r.country_code,'region',r.region_code,'city',r.city,'label',r.address_line,'lat',r.latitude,'lng',r.longitude),'active',r.active,'handling',r.handling)) into result from public.carrier_depots r where r.id=p_id;
when 'services' then select jsonb_build_object('id',r.id,'organizationId',null,'carrierId',r.carrier_id,'serviceId',r.id,'version',r.version,'createdAt',r.created_at,'updatedAt',r.updated_at,'value',jsonb_build_object('schemaVersion','2.0','mode',r.transport_mode,'serviceClass',r.service_type,'maxWeightKg',r.max_capacity_kg,'maxVolumeM3',r.max_volume_m3,'responseChannels',r.response_channels,'status',case when r.active then 'ACTIVE' else 'INACTIVE' end,'temperatureRange',case when r.temperature_min_c is null then null else jsonb_build_object('minCelsius',r.temperature_min_c,'maxCelsius',r.temperature_max_c) end,'requiredCertifications',r.required_certifications,'supportsHazardous',r.supports_hazardous,'supportsFragile',r.supports_fragile,'supportsOversized',r.supports_oversized,'admittedCargoTypes',coalesce((select jsonb_agg(c.cargo_category_id order by c.cargo_category_id) from public.carrier_service_cargo_categories c where c.carrier_service_id=r.id),'[]'::jsonb))) into result from public.carrier_services r where r.id=p_id;
when 'areas' then select jsonb_build_object('id',r.id,'organizationId',null,'carrierId',(select carrier_id from public.carrier_services where id=r.carrier_service_id),'serviceId',r.carrier_service_id,'version',r.version,'createdAt',r.created_at,'updatedAt',r.updated_at,'value',jsonb_build_object('schemaVersion','2.0','role',r.area_role,'inclusion',r.coverage,'geography',jsonb_build_object('granularity',r.granularity,'countryCode',r.country_code,'region',r.region_code,'city',r.city,'postalCode',r.postal_code,'geometry',r.geometry),'source',r.fulfilment_source,'partnerId',r.fulfilment_partner_id,'evidence',r.evidence_reference,'verifiedAt',r.verified_at,'validFrom',r.valid_from,'validUntil',r.valid_until,'active',r.active)) into result from public.service_areas r where r.id=p_id;
when 'lanes' then select jsonb_build_object('id',r.id,'organizationId',null,'carrierId',(select carrier_id from public.carrier_services where id=r.carrier_service_id),'serviceId',r.carrier_service_id,'version',r.version,'createdAt',r.created_at,'updatedAt',r.updated_at,'value',jsonb_build_object('schemaVersion','2.0','pickupAreaId',r.pickup_area_id,'deliveryAreaId',r.delivery_area_id,'kind',r.lane_kind,'mode',r.transport_mode,'borderReviewRequired',r.cross_border_review_required,'evidence',r.evidence_reference,'verifiedAt',r.verified_at,'validFrom',r.valid_from,'validUntil',r.valid_until,'active',r.active,'plannedTransitMinutes',r.planned_transit_minutes,'transitProvenanceStatus',r.transit_provenance_status,'crossBorderProhibited',r.cross_border_prohibited,'crossBorderProhibitionReference',r.cross_border_prohibition_reference)) into result from public.service_lanes r where r.id=p_id;
when 'partners' then select jsonb_build_object('id',r.id,'organizationId',null,'carrierId',r.carrier_id,'serviceId',null,'version',r.version,'createdAt',r.created_at,'updatedAt',r.updated_at,'value',jsonb_build_object('schemaVersion','2.0','registeredName',r.registered_name,'partnerCarrierRef',r.partner_carrier_ref,'agreementValidFrom',r.agreement_valid_from,'agreementValidUntil',r.agreement_valid_until,'status',r.status,'coverageEvidence',r.coverage_evidence)) into result from public.fulfilment_partners r where r.id=p_id;
else raise exception 'INVALID_CATALOG_KIND' using errcode='PT400';end case;return result;end;$$;
create function private.read_v2_catalog(p_organization_id uuid,p_member_id uuid,p_kind text,p_carrier_id uuid,
 p_service_id uuid,p_id uuid,p_limit integer,p_offset integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare target record; entry record; result jsonb:='[]'; begin
 perform private.authorize_v2_catalog(p_organization_id,p_member_id,p_kind,p_carrier_id,p_service_id,false,p_id);
 if p_limit is null or p_limit not between 1 and 100 or p_offset is null or p_offset not between 0 and 100000 then
 raise exception 'VALIDATION_ERROR' using errcode='PT400'; end if;
 select * into target from private.catalog_target(p_kind,p_organization_id,p_carrier_id,p_service_id);
 for entry in execute format('select id from public.%I where %s and ($1 is null or id=$1) order by created_at,id limit $2 offset $3',target.table_name,target.scope_sql)
 using p_id,p_limit,p_offset loop result:=result||jsonb_build_array(private.catalog_record(p_kind,entry.id)); end loop;
 return result;
end;$$;
create function private.command_v2_catalog(p_organization_id uuid,p_member_id uuid,p_kind text,p_carrier_id uuid,
 p_service_id uuid,p_id uuid,p_idempotency_key uuid,p_expected_version integer,p_value jsonb)
 returns jsonb language plpgsql security definer set search_path='' as $$
declare target record; receipt private.v2_catalog_receipts%rowtype; hash text; current_version integer; saved_id uuid; result jsonb;
 schema json; partner public.fulfilment_partners%rowtype; begin
 perform private.authorize_v2_catalog(p_organization_id,p_member_id,p_kind,p_carrier_id,p_service_id,true,p_id);
 if p_idempotency_key is null or ((p_id is null) is distinct from (p_expected_version is null))
 or p_expected_version<1 then raise exception 'VALIDATION_ERROR' using errcode='PT400';end if;
 case p_kind
when 'preferences' then schema:='{"type":"object","additionalProperties":false,"required":["schemaVersion","objective","maximumWaitMinutes","preferredMode","preferredEquipment","usualBudget","validUntil"],"properties":{"schemaVersion":{"const":"2.0"},"objective":{"anyOf":[{"enum":["LOWEST_COST","FASTEST","WEIGHTED"]},{"type":"null"}]},"maximumWaitMinutes":{"type":["integer","null"],"minimum":0,"maximum":525600},"preferredMode":{"anyOf":[{"enum":["ROAD","RAIL","SEA","AIR"]},{"type":"null"}]},"preferredEquipment":{"anyOf":[{"enum":["BOX_TRUCK","REEFER_TRUCK","FLATBED","TANKER_TRUCK","TRACTOR_TRAILER","ISO_CONTAINER","RAIL_WAGON","AIR_ULD"]},{"type":"null"}]},"usualBudget":{"type":["object","null"],"additionalProperties":false,"required":["amount","currency"],"properties":{"amount":{"type":"number","exclusiveMinimum":0},"currency":{"const":"USD"}}},"validUntil":{"type":["string","null"],"pattern":"^\\d{4}-\\d\\d-\\d\\dT\\d\\d:\\d\\d:\\d\\d(\\.\\d+)?(Z|[+-]\\d\\d:\\d\\d)$"}}}'::json;
when 'cargo-profiles' then schema:='{"type":"object","additionalProperties":false,"required":["schemaVersion","name","categoryId","typicalUnits","requirements","preferredEquipment","active"],"properties":{"schemaVersion":{"const":"2.0"},"name":{"type":"string","minLength":1,"maxLength":200,"pattern":"\\S"},"categoryId":{"type":"string","pattern":"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"},"typicalUnits":{"type":"array","items":{"type":"object","additionalProperties":false,"required":["packageType","quantity","weightPerUnitKg","volumePerUnitM3","dimensionsCm","indivisible","stackable","unitsPerPackage"],"properties":{"packageType":{"type":"string","minLength":1,"maxLength":500,"pattern":"\\S"},"quantity":{"type":"integer","minimum":1},"weightPerUnitKg":{"type":"number","exclusiveMinimum":0},"volumePerUnitM3":{"type":"number","exclusiveMinimum":0},"dimensionsCm":{"type":"object","additionalProperties":false,"required":["length","width","height"],"properties":{"length":{"type":"number","exclusiveMinimum":0},"width":{"type":"number","exclusiveMinimum":0},"height":{"type":"number","exclusiveMinimum":0}}},"indivisible":{"type":"boolean"},"stackable":{"type":"boolean"},"unitsPerPackage":{"type":"integer","minimum":1,"maximum":1000000}}},"minItems":0,"maxItems":100},"requirements":{"type":"array","items":{"type":"string","minLength":1,"maxLength":500,"pattern":"\\S"},"minItems":0,"maxItems":100,"uniqueItems":true},"preferredEquipment":{"anyOf":[{"enum":["BOX_TRUCK","REEFER_TRUCK","FLATBED","TANKER_TRUCK","TRACTOR_TRAILER","ISO_CONTAINER","RAIL_WAGON","AIR_ULD"]},{"type":"null"}]},"active":{"type":"boolean"}}}'::json;
when 'cargo-categories' then schema:='{"type":"object","additionalProperties":false,"required":["schemaVersion","code","name","guidance","suggestedEquipment","active"],"properties":{"schemaVersion":{"const":"2.0"},"code":{"type":"string","pattern":"^[A-Z][A-Z0-9_]{0,99}$"},"name":{"type":"string","minLength":1,"maxLength":200,"pattern":"\\S"},"guidance":{"type":"object","additionalProperties":false,"required":["recommendedEntryMethods","intakeSpecificationSchema","suggestedRequirements","recommendedVehicleClasses"],"properties":{"recommendedEntryMethods":{"type":"array","items":{"type":"string","minLength":1,"maxLength":500,"pattern":"\\S"},"minItems":1,"maxItems":100,"uniqueItems":true},"intakeSpecificationSchema":{"type":"object"},"suggestedRequirements":{"type":"object"},"recommendedVehicleClasses":{"type":"array","items":{"type":"string","minLength":1,"maxLength":500,"pattern":"\\S"},"minItems":0,"maxItems":100,"uniqueItems":true}}},"suggestedEquipment":{"anyOf":[{"enum":["BOX_TRUCK","REEFER_TRUCK","FLATBED","TANKER_TRUCK","TRACTOR_TRAILER","ISO_CONTAINER","RAIL_WAGON","AIR_ULD"]},{"type":"null"}]},"active":{"type":"boolean"}}}'::json;
when 'carriers' then schema:='{"type":"object","additionalProperties":false,"required":["schemaVersion","code","commercialName","legalName","businessIdType","businessIdValue","registeredCountry","providerType","status","operationalPhone"],"properties":{"schemaVersion":{"const":"2.0"},"code":{"type":"string","pattern":"^[A-Z][A-Z0-9_]{0,99}$"},"commercialName":{"type":"string","minLength":1,"maxLength":200,"pattern":"\\S"},"legalName":{"type":["string","null"],"minLength":1,"maxLength":200,"pattern":"\\S"},"businessIdType":{"type":["string","null"],"minLength":1,"maxLength":500,"pattern":"\\S"},"businessIdValue":{"type":["string","null"],"minLength":1,"maxLength":500,"pattern":"\\S"},"registeredCountry":{"type":["string","null"],"pattern":"^[A-Z]{2}$"},"providerType":{"enum":["OWNER_OPERATOR","SMALL_FLEET","CARRIER","ENTERPRISE_CARRIER"]},"status":{"enum":["ACTIVE","INACTIVE"]},"operationalPhone":{"type":["string","null"],"pattern":"^\\+[1-9]\\d{6,14}$"}}}'::json;
when 'depots' then schema:='{"type":"object","additionalProperties":false,"required":["schemaVersion","code","name","location","active","handling"],"properties":{"schemaVersion":{"const":"2.0"},"code":{"type":"string","pattern":"^[A-Z][A-Z0-9_]{0,99}$"},"name":{"type":"string","minLength":1,"maxLength":200,"pattern":"\\S"},"location":{"type":"object","additionalProperties":false,"required":["label","countryCode","region","city","lat","lng"],"properties":{"label":{"type":"string","minLength":1,"maxLength":200,"pattern":"\\S"},"countryCode":{"type":"string","pattern":"^[A-Z]{2}$"},"region":{"type":["string","null"],"minLength":1,"maxLength":120,"pattern":"\\S"},"city":{"type":"string","minLength":1,"maxLength":120,"pattern":"\\S"},"lat":{"type":["number","null"],"minimum":-90,"maximum":90},"lng":{"type":["number","null"],"minimum":-180,"maximum":180}}},"active":{"type":"boolean"},"handling":{"type":"array","items":{"type":"string","minLength":1,"maxLength":500,"pattern":"\\S"},"minItems":0,"maxItems":100,"uniqueItems":true}}}'::json;
when 'services' then schema:='{"type":"object","additionalProperties":false,"required":["schemaVersion","mode","serviceClass","maxWeightKg","maxVolumeM3","responseChannels","status","admittedCargoTypes","temperatureRange","requiredCertifications","supportsHazardous","supportsFragile","supportsOversized"],"properties":{"schemaVersion":{"const":"2.0"},"mode":{"enum":["ROAD","RAIL","SEA","AIR"]},"serviceClass":{"enum":["FTL","LTL"]},"maxWeightKg":{"type":["number","null"],"exclusiveMinimum":0},"maxVolumeM3":{"type":["number","null"],"exclusiveMinimum":0},"responseChannels":{"type":"array","items":{"enum":["MANUAL","API","MCP"]},"minItems":1,"maxItems":3,"uniqueItems":true},"status":{"enum":["ACTIVE","INACTIVE"]},"admittedCargoTypes":{"type":"array","items":{"type":"string","pattern":"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"},"minItems":0,"maxItems":100,"uniqueItems":true},"temperatureRange":{"type":["object","null"],"additionalProperties":false,"required":["minCelsius","maxCelsius"],"properties":{"minCelsius":{"type":"number"},"maxCelsius":{"type":"number"}}},"requiredCertifications":{"type":"array","items":{"type":"string","minLength":1,"maxLength":500,"pattern":"\\S"},"minItems":0,"maxItems":100,"uniqueItems":true},"supportsHazardous":{"type":"boolean"},"supportsFragile":{"type":"boolean"},"supportsOversized":{"type":"boolean"}}}'::json;
when 'areas' then schema:='{"type":"object","additionalProperties":false,"required":["schemaVersion","role","inclusion","geography","source","partnerId","evidence","verifiedAt","validFrom","validUntil","active"],"properties":{"schemaVersion":{"const":"2.0"},"role":{"enum":["PICKUP","DELIVERY"]},"inclusion":{"enum":["INCLUDE","EXCLUDE"]},"geography":{"type":"object","additionalProperties":false,"required":["granularity","countryCode","region","city","postalCode"],"properties":{"granularity":{"enum":["COUNTRY","REGION","CITY","POSTAL_CODE","POLYGON","POINTS"]},"countryCode":{"type":"string","pattern":"^[A-Z]{2}$"},"region":{"type":["string","null"],"minLength":1,"maxLength":500,"pattern":"\\S"},"city":{"type":["string","null"],"minLength":1,"maxLength":500,"pattern":"\\S"},"postalCode":{"type":["string","null"],"minLength":1,"maxLength":500,"pattern":"\\S"},"geometry":{"type":["object","null"]}}},"source":{"enum":["OWN","PARTNER"]},"partnerId":{"type":["string","null"],"pattern":"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"},"evidence":{"type":["string","null"],"minLength":1,"maxLength":500,"pattern":"\\S"},"verifiedAt":{"type":["string","null"],"pattern":"^\\d{4}-\\d\\d-\\d\\dT\\d\\d:\\d\\d:\\d\\d(\\.\\d+)?(Z|[+-]\\d\\d:\\d\\d)$"},"validFrom":{"type":["string","null"],"pattern":"^\\d{4}-\\d\\d-\\d\\dT\\d\\d:\\d\\d:\\d\\d(\\.\\d+)?(Z|[+-]\\d\\d:\\d\\d)$"},"validUntil":{"type":["string","null"],"pattern":"^\\d{4}-\\d\\d-\\d\\dT\\d\\d:\\d\\d:\\d\\d(\\.\\d+)?(Z|[+-]\\d\\d:\\d\\d)$"},"active":{"type":"boolean"}}}'::json;
when 'lanes' then schema:='{"type":"object","additionalProperties":false,"required":["schemaVersion","pickupAreaId","deliveryAreaId","kind","mode","borderReviewRequired","evidence","verifiedAt","validFrom","validUntil","active","plannedTransitMinutes","transitProvenanceStatus","crossBorderProhibited","crossBorderProhibitionReference"],"properties":{"schemaVersion":{"const":"2.0"},"pickupAreaId":{"type":"string","pattern":"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"},"deliveryAreaId":{"type":"string","pattern":"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"},"kind":{"enum":["DIRECT","WITHIN_AREA"]},"mode":{"enum":["ROAD","RAIL","SEA","AIR"]},"borderReviewRequired":{"type":"boolean"},"evidence":{"type":["string","null"],"minLength":1,"maxLength":500,"pattern":"\\S"},"verifiedAt":{"type":["string","null"],"pattern":"^\\d{4}-\\d\\d-\\d\\dT\\d\\d:\\d\\d:\\d\\d(\\.\\d+)?(Z|[+-]\\d\\d:\\d\\d)$"},"validFrom":{"type":["string","null"],"pattern":"^\\d{4}-\\d\\d-\\d\\dT\\d\\d:\\d\\d:\\d\\d(\\.\\d+)?(Z|[+-]\\d\\d:\\d\\d)$"},"validUntil":{"type":["string","null"],"pattern":"^\\d{4}-\\d\\d-\\d\\dT\\d\\d:\\d\\d:\\d\\d(\\.\\d+)?(Z|[+-]\\d\\d:\\d\\d)$"},"active":{"type":"boolean"},"plannedTransitMinutes":{"type":["integer","null"],"minimum":1},"transitProvenanceStatus":{"enum":["VERIFIED","ESTIMATED","SIMULATED","UNKNOWN"]},"crossBorderProhibited":{"type":"boolean"},"crossBorderProhibitionReference":{"type":["string","null"],"minLength":1,"maxLength":500,"pattern":"\\S"}}}'::json;
when 'partners' then schema:='{"type":"object","additionalProperties":false,"required":["schemaVersion","registeredName","partnerCarrierRef","agreementValidFrom","agreementValidUntil","status","coverageEvidence"],"properties":{"schemaVersion":{"const":"2.0"},"registeredName":{"type":"string","minLength":1,"maxLength":200,"pattern":"\\S"},"partnerCarrierRef":{"type":["string","null"],"pattern":"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"},"agreementValidFrom":{"type":"string","pattern":"^\\d{4}-\\d\\d-\\d\\dT\\d\\d:\\d\\d:\\d\\d(\\.\\d+)?(Z|[+-]\\d\\d:\\d\\d)$"},"agreementValidUntil":{"type":"string","pattern":"^\\d{4}-\\d\\d-\\d\\dT\\d\\d:\\d\\d:\\d\\d(\\.\\d+)?(Z|[+-]\\d\\d:\\d\\d)$"},"status":{"enum":["ACTIVE","INACTIVE"]},"coverageEvidence":{"type":"string","minLength":1,"maxLength":500,"pattern":"\\S"}}}'::json;
end case;
 if not coalesce(extensions.jsonb_matches_schema(schema,p_value),false) then raise exception 'VALIDATION_ERROR' using errcode='PT400';end if;
 if p_kind='carriers' and ((p_value->>'businessIdType' is null)<>(p_value->>'businessIdValue' is null))
 or p_kind='depots' and ((p_value#>>'{location,lat}' is null)<>(p_value#>>'{location,lng}' is null))
 or p_kind='services' and (p_value#>>'{temperatureRange,maxCelsius}')::numeric<(p_value#>>'{temperatureRange,minCelsius}')::numeric
 or p_kind in ('areas','lanes') and (p_value->>'validUntil')::timestamptz<=(p_value->>'validFrom')::timestamptz
 or p_kind='partners' and (p_value->>'agreementValidUntil')::timestamptz<=(p_value->>'agreementValidFrom')::timestamptz
 or p_kind='lanes' and ((p_value->>'plannedTransitMinutes' is null) is distinct from (p_value->>'transitProvenanceStatus'='UNKNOWN'))
 then raise exception 'VALIDATION_ERROR' using errcode='PT400'; end if;
 hash:=private.hash_v2_freight_payload(jsonb_build_object('kind',p_kind,'carrierId',p_carrier_id,'serviceId',p_service_id,'id',p_id,'expectedVersion',p_expected_version,'value',p_value));
 perform pg_advisory_xact_lock(hashtextextended(p_organization_id::text||':'||p_member_id::text||':'||p_idempotency_key::text,0));
 select * into receipt from private.v2_catalog_receipts where organization_id=p_organization_id and member_id=p_member_id and idempotency_key=p_idempotency_key;
 if found then
  if receipt.payload_hash<>hash then raise exception 'IDEMPOTENCY_CONFLICT' using errcode='PT409';end if;
  return jsonb_build_object('record',receipt.result,'replay',true);
 end if;
 if p_kind='areas' then
  if ((p_value->>'source'='OWN') is distinct from (p_value->>'partnerId' is null)) then
   raise exception 'INVALID_PARTNER_SOURCE' using errcode='PT400';end if;
  if p_value->>'partnerId' is not null then
   select * into partner from public.fulfilment_partners where id=(p_value->>'partnerId')::uuid and carrier_id=p_carrier_id for share;
   if not found then raise exception 'INVALID_PARTNER_SOURCE' using errcode='PT400';end if;
  end if;
 end if;
 if p_kind='services' and exists(select 1 from jsonb_array_elements_text(p_value->'admittedCargoTypes') v
  where not exists(select 1 from public.cargo_categories where id=v::uuid and active)) then
  raise exception 'INVALID_CARGO_CATEGORY' using errcode='PT400';end if;
 if p_kind='cargo-profiles' and not exists(select 1 from public.cargo_categories where id=(p_value->>'categoryId')::uuid and active) then
  raise exception 'INVALID_CARGO_CATEGORY' using errcode='PT400';end if;
 select * into target from private.catalog_target(p_kind,p_organization_id,p_carrier_id,p_service_id);
 if p_id is not null then
  execute format('select version from public.%I where id=$1 and %s for update',target.table_name,target.scope_sql) into current_version using p_id;
  if current_version is null then raise exception 'CATALOG_NOT_FOUND' using errcode='PT404';end if;
  if current_version<>p_expected_version then raise exception 'STALE_DRAFT' using errcode='PT409';end if;
 end if;
 if p_kind='cargo-categories' and p_id is not null and exists(select 1 from public.cargo_categories where id=p_id and code<>p_value->>'code') then
 raise exception 'IMMUTABLE_CATEGORY_CODE' using errcode='PT400';end if;
 -- Lock the service while revising its mode or creating/revising lanes. This prevents a concurrent mode mismatch.
 if p_kind in ('areas','lanes') then perform 1 from public.carrier_services where id=p_service_id for update;end if;
 if p_kind='services' and p_id is not null and exists(select 1 from public.service_lanes where carrier_service_id=p_id and transport_mode<>p_value->>'mode') then
  raise exception 'SERVICE_MODE_HAS_LANES' using errcode='PT400';end if;
 case p_kind
when 'preferences' then
 if p_id is null then insert into public.organization_preferences (allow_auto_booking,objective,maximum_wait_minutes,preferred_mode,preferred_equipment,usual_budget,valid_until,organization_id) values(false,(p_value#>>'{objective}')::text,(p_value#>>'{maximumWaitMinutes}')::integer,(p_value#>>'{preferredMode}')::text,(p_value#>>'{preferredEquipment}')::text,nullif(p_value#>'{usualBudget}','null'::jsonb),(p_value#>>'{validUntil}')::timestamptz,p_organization_id) returning id into saved_id;
 else update public.organization_preferences set objective=(p_value#>>'{objective}')::text,maximum_wait_minutes=(p_value#>>'{maximumWaitMinutes}')::integer,preferred_mode=(p_value#>>'{preferredMode}')::text,preferred_equipment=(p_value#>>'{preferredEquipment}')::text,usual_budget=nullif(p_value#>'{usualBudget}','null'::jsonb),valid_until=(p_value#>>'{validUntil}')::timestamptz where id=p_id returning id into saved_id;end if;
when 'cargo-profiles' then
 if p_id is null then insert into public.organization_cargo_profiles (profile_name,cargo_category_id,typical_units,requirements,preferred_equipment,active,organization_id,default_entry_method) values((p_value#>>'{name}')::text,(p_value#>>'{categoryId}')::uuid,nullif(p_value#>'{typicalUnits}','null'::jsonb),nullif(p_value#>'{requirements}','null'::jsonb),(p_value#>>'{preferredEquipment}')::text,(p_value#>>'{active}')::boolean,p_organization_id,'PACKAGES') returning id into saved_id;
 else update public.organization_cargo_profiles set profile_name=(p_value#>>'{name}')::text,cargo_category_id=(p_value#>>'{categoryId}')::uuid,typical_units=nullif(p_value#>'{typicalUnits}','null'::jsonb),requirements=nullif(p_value#>'{requirements}','null'::jsonb),preferred_equipment=(p_value#>>'{preferredEquipment}')::text,active=(p_value#>>'{active}')::boolean where id=p_id returning id into saved_id;end if;
when 'cargo-categories' then
 if p_id is null then insert into public.cargo_categories (code,name,recommended_entry_methods,intake_specification_schema,suggested_requirements,recommended_vehicle_classes,suggested_equipment,active) values((p_value#>>'{code}')::text,(p_value#>>'{name}')::text,nullif(p_value#>'{guidance,recommendedEntryMethods}','null'::jsonb),nullif(p_value#>'{guidance,intakeSpecificationSchema}','null'::jsonb),nullif(p_value#>'{guidance,suggestedRequirements}','null'::jsonb),nullif(p_value#>'{guidance,recommendedVehicleClasses}','null'::jsonb),(p_value#>>'{suggestedEquipment}')::text,(p_value#>>'{active}')::boolean) returning id into saved_id;
 else update public.cargo_categories set code=(p_value#>>'{code}')::text,name=(p_value#>>'{name}')::text,recommended_entry_methods=nullif(p_value#>'{guidance,recommendedEntryMethods}','null'::jsonb),intake_specification_schema=nullif(p_value#>'{guidance,intakeSpecificationSchema}','null'::jsonb),suggested_requirements=nullif(p_value#>'{guidance,suggestedRequirements}','null'::jsonb),recommended_vehicle_classes=nullif(p_value#>'{guidance,recommendedVehicleClasses}','null'::jsonb),suggested_equipment=(p_value#>>'{suggestedEquipment}')::text,active=(p_value#>>'{active}')::boolean where id=p_id returning id into saved_id;end if;
when 'carriers' then
 if p_id is null then insert into public.carriers (code,name,legal_name,business_identifier_type,business_identifier_value,registered_country,provider_type,status,operational_phone) values((p_value#>>'{code}')::text,(p_value#>>'{commercialName}')::text,(p_value#>>'{legalName}')::text,(p_value#>>'{businessIdType}')::text,(p_value#>>'{businessIdValue}')::text,(p_value#>>'{registeredCountry}')::text,(p_value#>>'{providerType}')::text,(p_value#>>'{status}')::text,(p_value#>>'{operationalPhone}')::text) returning id into saved_id;
 else update public.carriers set code=(p_value#>>'{code}')::text,name=(p_value#>>'{commercialName}')::text,legal_name=(p_value#>>'{legalName}')::text,business_identifier_type=(p_value#>>'{businessIdType}')::text,business_identifier_value=(p_value#>>'{businessIdValue}')::text,registered_country=(p_value#>>'{registeredCountry}')::text,provider_type=(p_value#>>'{providerType}')::text,status=(p_value#>>'{status}')::text,operational_phone=(p_value#>>'{operationalPhone}')::text where id=p_id returning id into saved_id;end if;
when 'depots' then
 if p_id is null then insert into public.carrier_depots (code,name,country_code,region_code,city,address_line,latitude,longitude,active,handling,carrier_id) values((p_value#>>'{code}')::text,(p_value#>>'{name}')::text,(p_value#>>'{location,countryCode}')::text,(p_value#>>'{location,region}')::text,(p_value#>>'{location,city}')::text,(p_value#>>'{location,label}')::text,(p_value#>>'{location,lat}')::numeric,(p_value#>>'{location,lng}')::numeric,(p_value#>>'{active}')::boolean,nullif(p_value#>'{handling}','null'::jsonb),p_carrier_id) returning id into saved_id;
 else update public.carrier_depots set code=(p_value#>>'{code}')::text,name=(p_value#>>'{name}')::text,country_code=(p_value#>>'{location,countryCode}')::text,region_code=(p_value#>>'{location,region}')::text,city=(p_value#>>'{location,city}')::text,address_line=(p_value#>>'{location,label}')::text,latitude=(p_value#>>'{location,lat}')::numeric,longitude=(p_value#>>'{location,lng}')::numeric,active=(p_value#>>'{active}')::boolean,handling=nullif(p_value#>'{handling}','null'::jsonb) where id=p_id returning id into saved_id;end if;
when 'services' then
 if p_id is null then insert into public.carrier_services (transport_mode,service_type,max_capacity_kg,max_volume_m3,response_channels,active,temperature_min_c,temperature_max_c,required_certifications,supports_hazardous,supports_fragile,supports_oversized,carrier_id,supports_refrigerated) values((p_value#>>'{mode}')::text,(p_value#>>'{serviceClass}')::text,(p_value#>>'{maxWeightKg}')::numeric,(p_value#>>'{maxVolumeM3}')::numeric,nullif(p_value#>'{responseChannels}','null'::jsonb),(p_value->>'status'='ACTIVE'),(p_value#>>'{temperatureRange,minCelsius}')::numeric,(p_value#>>'{temperatureRange,maxCelsius}')::numeric,nullif(p_value#>'{requiredCertifications}','null'::jsonb),(p_value#>>'{supportsHazardous}')::boolean,(p_value#>>'{supportsFragile}')::boolean,(p_value#>>'{supportsOversized}')::boolean,p_carrier_id,(p_value->>'temperatureRange' is not null)) returning id into saved_id;
 else update public.carrier_services set transport_mode=(p_value#>>'{mode}')::text,service_type=(p_value#>>'{serviceClass}')::text,max_capacity_kg=(p_value#>>'{maxWeightKg}')::numeric,max_volume_m3=(p_value#>>'{maxVolumeM3}')::numeric,response_channels=nullif(p_value#>'{responseChannels}','null'::jsonb),active=(p_value->>'status'='ACTIVE'),temperature_min_c=(p_value#>>'{temperatureRange,minCelsius}')::numeric,temperature_max_c=(p_value#>>'{temperatureRange,maxCelsius}')::numeric,required_certifications=nullif(p_value#>'{requiredCertifications}','null'::jsonb),supports_hazardous=(p_value#>>'{supportsHazardous}')::boolean,supports_fragile=(p_value#>>'{supportsFragile}')::boolean,supports_oversized=(p_value#>>'{supportsOversized}')::boolean,supports_refrigerated=(p_value->>'temperatureRange' is not null) where id=p_id returning id into saved_id;end if;
delete from public.carrier_service_cargo_categories where carrier_service_id=saved_id;
insert into public.carrier_service_cargo_categories(carrier_service_id,cargo_category_id) select saved_id,value::uuid from jsonb_array_elements_text(p_value->'admittedCargoTypes');
when 'areas' then
 if p_id is null then insert into public.service_areas (area_role,coverage,granularity,country_code,region_code,city,postal_code,geometry,fulfilment_source,fulfilment_partner_id,evidence_reference,verified_at,valid_from,valid_until,active,carrier_service_id,partner_reference) values((p_value#>>'{role}')::text,(p_value#>>'{inclusion}')::text,(p_value#>>'{geography,granularity}')::text,(p_value#>>'{geography,countryCode}')::text,(p_value#>>'{geography,region}')::text,(p_value#>>'{geography,city}')::text,(p_value#>>'{geography,postalCode}')::text,nullif(p_value#>'{geography,geometry}','null'::jsonb),(p_value#>>'{source}')::text,(p_value#>>'{partnerId}')::uuid,(p_value#>>'{evidence}')::text,(p_value#>>'{verifiedAt}')::timestamptz,(p_value#>>'{validFrom}')::timestamptz,(p_value#>>'{validUntil}')::timestamptz,(p_value#>>'{active}')::boolean,p_service_id,p_value->>'partnerId') returning id into saved_id;
 else update public.service_areas set area_role=(p_value#>>'{role}')::text,coverage=(p_value#>>'{inclusion}')::text,granularity=(p_value#>>'{geography,granularity}')::text,country_code=(p_value#>>'{geography,countryCode}')::text,region_code=(p_value#>>'{geography,region}')::text,city=(p_value#>>'{geography,city}')::text,postal_code=(p_value#>>'{geography,postalCode}')::text,geometry=nullif(p_value#>'{geography,geometry}','null'::jsonb),fulfilment_source=(p_value#>>'{source}')::text,fulfilment_partner_id=(p_value#>>'{partnerId}')::uuid,evidence_reference=(p_value#>>'{evidence}')::text,verified_at=(p_value#>>'{verifiedAt}')::timestamptz,valid_from=(p_value#>>'{validFrom}')::timestamptz,valid_until=(p_value#>>'{validUntil}')::timestamptz,active=(p_value#>>'{active}')::boolean,partner_reference=p_value->>'partnerId' where id=p_id returning id into saved_id;end if;
when 'lanes' then
 if p_id is null then insert into public.service_lanes (pickup_area_id,delivery_area_id,lane_kind,transport_mode,cross_border_review_required,evidence_reference,verified_at,valid_from,valid_until,active,planned_transit_minutes,transit_provenance_status,cross_border_prohibited,cross_border_prohibition_reference,carrier_service_id) values((p_value#>>'{pickupAreaId}')::uuid,(p_value#>>'{deliveryAreaId}')::uuid,(p_value#>>'{kind}')::text,(p_value#>>'{mode}')::text,(p_value#>>'{borderReviewRequired}')::boolean,(p_value#>>'{evidence}')::text,(p_value#>>'{verifiedAt}')::timestamptz,(p_value#>>'{validFrom}')::timestamptz,(p_value#>>'{validUntil}')::timestamptz,(p_value#>>'{active}')::boolean,(p_value#>>'{plannedTransitMinutes}')::integer,(p_value#>>'{transitProvenanceStatus}')::text,(p_value#>>'{crossBorderProhibited}')::boolean,(p_value#>>'{crossBorderProhibitionReference}')::text,p_service_id) returning id into saved_id;
 else update public.service_lanes set pickup_area_id=(p_value#>>'{pickupAreaId}')::uuid,delivery_area_id=(p_value#>>'{deliveryAreaId}')::uuid,lane_kind=(p_value#>>'{kind}')::text,transport_mode=(p_value#>>'{mode}')::text,cross_border_review_required=(p_value#>>'{borderReviewRequired}')::boolean,evidence_reference=(p_value#>>'{evidence}')::text,verified_at=(p_value#>>'{verifiedAt}')::timestamptz,valid_from=(p_value#>>'{validFrom}')::timestamptz,valid_until=(p_value#>>'{validUntil}')::timestamptz,active=(p_value#>>'{active}')::boolean,planned_transit_minutes=(p_value#>>'{plannedTransitMinutes}')::integer,transit_provenance_status=(p_value#>>'{transitProvenanceStatus}')::text,cross_border_prohibited=(p_value#>>'{crossBorderProhibited}')::boolean,cross_border_prohibition_reference=(p_value#>>'{crossBorderProhibitionReference}')::text where id=p_id returning id into saved_id;end if;
when 'partners' then
 if p_id is null then insert into public.fulfilment_partners (registered_name,partner_carrier_ref,agreement_valid_from,agreement_valid_until,status,coverage_evidence,carrier_id) values((p_value#>>'{registeredName}')::text,(p_value#>>'{partnerCarrierRef}')::uuid,(p_value#>>'{agreementValidFrom}')::timestamptz,(p_value#>>'{agreementValidUntil}')::timestamptz,(p_value#>>'{status}')::text,(p_value#>>'{coverageEvidence}')::text,p_carrier_id) returning id into saved_id;
 else update public.fulfilment_partners set registered_name=(p_value#>>'{registeredName}')::text,partner_carrier_ref=(p_value#>>'{partnerCarrierRef}')::uuid,agreement_valid_from=(p_value#>>'{agreementValidFrom}')::timestamptz,agreement_valid_until=(p_value#>>'{agreementValidUntil}')::timestamptz,status=(p_value#>>'{status}')::text,coverage_evidence=(p_value#>>'{coverageEvidence}')::text where id=p_id returning id into saved_id;end if;
end case;
 result:=private.catalog_record(p_kind,saved_id);
 insert into private.v2_catalog_receipts(organization_id,member_id,idempotency_key,payload_hash,result)
 values(p_organization_id,p_member_id,p_idempotency_key,hash,result);
 return jsonb_build_object('record',result,'replay',false);
end;$$;
create function public.read_v2_catalog(p_organization_id uuid,p_member_id uuid,p_kind text,p_carrier_id uuid,p_service_id uuid,p_id uuid,p_limit integer,p_offset integer) returns jsonb language sql security invoker set search_path='' as $$select private.read_v2_catalog(p_organization_id,p_member_id,p_kind,p_carrier_id,p_service_id,p_id,p_limit,p_offset);$$;
revoke all on function public.read_v2_catalog(uuid,uuid,text,uuid,uuid,uuid,integer,integer) from public,anon,service_role;
grant execute on function public.read_v2_catalog(uuid,uuid,text,uuid,uuid,uuid,integer,integer) to authenticated;
revoke all on function private.read_v2_catalog(uuid,uuid,text,uuid,uuid,uuid,integer,integer) from public,anon,service_role;
grant execute on function private.read_v2_catalog(uuid,uuid,text,uuid,uuid,uuid,integer,integer) to authenticated;
create function public.command_v2_catalog(p_organization_id uuid,p_member_id uuid,p_kind text,p_carrier_id uuid,p_service_id uuid,p_id uuid,p_idempotency_key uuid,p_expected_version integer,p_value jsonb) returns jsonb language sql security invoker set search_path='' as $$select private.command_v2_catalog(p_organization_id,p_member_id,p_kind,p_carrier_id,p_service_id,p_id,p_idempotency_key,p_expected_version,p_value);$$;
revoke all on function public.command_v2_catalog(uuid,uuid,text,uuid,uuid,uuid,uuid,integer,jsonb) from public,anon,service_role;
grant execute on function public.command_v2_catalog(uuid,uuid,text,uuid,uuid,uuid,uuid,integer,jsonb) to authenticated;
revoke all on function private.command_v2_catalog(uuid,uuid,text,uuid,uuid,uuid,uuid,integer,jsonb) from public,anon,service_role;
grant execute on function private.command_v2_catalog(uuid,uuid,text,uuid,uuid,uuid,uuid,integer,jsonb) to authenticated;
revoke all on function private.catalog_target(text,uuid,uuid,uuid) from public,anon,authenticated,service_role;
revoke all on function private.catalog_record(text,uuid) from public,anon,authenticated,service_role;
revoke all on function private.authorize_v2_catalog(uuid,uuid,text,uuid,uuid,boolean,uuid) from public,anon,authenticated,service_role;
revoke all on function private.guard_v2_catalog() from public,anon,authenticated,service_role;
create or replace function private.v2_freight_input_schema() returns json
language sql immutable security invoker set search_path = '' as $schema$
 select '{
  "type": "object",
  "properties": {
    "schemaVersion": {
      "const": "2.0"
    },
    "organizationId": {
      "type": "string",
      "pattern": "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"
    },
    "origin": {
      "type": "object",
      "properties": {
        "facilityId": {
          "anyOf": [
            {
              "type": "string",
              "pattern": "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"
            },
            {
              "type": "null"
            }
          ]
        },
        "label": {
          "type": "string",
          "minLength": 1,
          "pattern": "\\S",
          "maxLength": 200
        },
        "countryCode": {
          "type": "string",
          "pattern": "^[A-Z]{2}$"
        },
        "region": {
          "anyOf": [
            {
              "type": "string",
              "maxLength": 120
            },
            {
              "type": "null"
            }
          ]
        },
        "city": {
          "type": "string",
          "minLength": 1,
          "pattern": "\\S",
          "maxLength": 120
        },
        "lat": {
          "anyOf": [
            {
              "type": "number",
              "minimum": -90,
              "maximum": 90
            },
            {
              "type": "null"
            }
          ]
        },
        "lng": {
          "anyOf": [
            {
              "type": "number",
              "minimum": -180,
              "maximum": 180
            },
            {
              "type": "null"
            }
          ]
        }
      },
      "required": [],
      "additionalProperties": false
    },
    "destination": {
      "type": "object",
      "properties": {
        "facilityId": {
          "anyOf": [
            {
              "type": "string",
              "pattern": "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"
            },
            {
              "type": "null"
            }
          ]
        },
        "label": {
          "type": "string",
          "minLength": 1,
          "pattern": "\\S",
          "maxLength": 200
        },
        "countryCode": {
          "type": "string",
          "pattern": "^[A-Z]{2}$"
        },
        "region": {
          "anyOf": [
            {
              "type": "string",
              "maxLength": 120
            },
            {
              "type": "null"
            }
          ]
        },
        "city": {
          "type": "string",
          "minLength": 1,
          "pattern": "\\S",
          "maxLength": 120
        },
        "lat": {
          "anyOf": [
            {
              "type": "number",
              "minimum": -90,
              "maximum": 90
            },
            {
              "type": "null"
            }
          ]
        },
        "lng": {
          "anyOf": [
            {
              "type": "number",
              "minimum": -180,
              "maximum": 180
            },
            {
              "type": "null"
            }
          ]
        }
      },
      "required": [],
      "additionalProperties": false
    },
    "pickupWindow": {
      "type": "object",
      "properties": {
        "startsAt": {
          "type": "string",
          "format": "date-time",
          "pattern": "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d+)?(Z|[+-]\\d{2}:?\\d{2})$"
        },
        "endsAt": {
          "type": "string",
          "format": "date-time",
          "pattern": "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d+)?(Z|[+-]\\d{2}:?\\d{2})$"
        }
      },
      "required": [
        "startsAt",
        "endsAt"
      ],
      "additionalProperties": false
    },
    "deliveryWindow": {
      "type": "object",
      "properties": {
        "startsAt": {
          "type": "string",
          "format": "date-time",
          "pattern": "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d+)?(Z|[+-]\\d{2}:?\\d{2})$"
        },
        "endsAt": {
          "type": "string",
          "format": "date-time",
          "pattern": "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d+)?(Z|[+-]\\d{2}:?\\d{2})$"
        }
      },
      "required": [
        "startsAt",
        "endsAt"
      ],
      "additionalProperties": false
    },
    "acceptedModes": {
      "type": "array",
      "minItems": 1,
      "maxItems": 4,
      "uniqueItems": true,
      "items": {
        "enum": [
          "ROAD",
          "RAIL",
          "SEA",
          "AIR"
        ]
      }
    },
    "requiredEquipment": {
      "anyOf": [
        {
          "enum": [
            "BOX_TRUCK",
            "REEFER_TRUCK",
            "FLATBED",
            "TANKER_TRUCK",
            "TRACTOR_TRAILER",
            "ISO_CONTAINER",
            "RAIL_WAGON",
            "AIR_ULD"
          ]
        },
        {
          "type": "null"
        }
      ]
    },
    "cargoSpecification": {
      "type": "object",
      "properties": {
        "categoryCode": {"type":"string","pattern":"^[A-Z][A-Z0-9_]{0,99}$"},
        "description": {
          "type": "string",
          "minLength": 1,
          "pattern": "\\S",
          "maxLength": 1000
        },
        "packaging": {
          "type": "string",
          "minLength": 1,
          "pattern": "\\S"
        },
        "totalWeightKg": {
          "type": "number",
          "exclusiveMinimum": 0
        },
        "totalVolumeM3": {
          "type": "number",
          "exclusiveMinimum": 0
        },
        "divisible": {
          "type": "boolean"
        },
        "requirements": {
          "type": "array",
          "items": {
            "type": "string",
            "minLength": 1,
            "pattern": "\\S"
          }
        },
        "temperatureRange": {
          "anyOf": [
            {
              "type": "object",
              "properties": {
                "minCelsius": {
                  "type": "number"
                },
                "maxCelsius": {
                  "type": "number"
                }
              },
              "required": [
                "minCelsius",
                "maxCelsius"
              ],
              "additionalProperties": false
            },
            {
              "type": "null"
            }
          ]
        },
        "units": {
          "type": "array",
          "minItems": 1,
          "items": {
            "type": "object",
            "properties": {
              "packageType": {
                "type": "string",
                "minLength": 1,
                "pattern": "\\S"
              },
              "quantity": {
                "type": "integer",
                "minimum": 1,
                "maximum": 2147483647
              },
              "weightPerUnitKg": {
                "type": "number",
                "exclusiveMinimum": 0
              },
              "volumePerUnitM3": {
                "type": "number",
                "exclusiveMinimum": 0
              },
              "dimensionsCm": {
                "type": "object",
                "properties": {
                  "length": {
                    "type": "number",
                    "exclusiveMinimum": 0
                  },
                  "width": {
                    "type": "number",
                    "exclusiveMinimum": 0
                  },
                  "height": {
                    "type": "number",
                    "exclusiveMinimum": 0
                  }
                },
                "required": [
                  "length",
                  "width",
                  "height"
                ],
                "additionalProperties": false
              },
              "indivisible": {
                "type": "boolean"
              },
              "stackable": {
                "type": "boolean"
              },
              "unitsPerPackage": {
                "type": "integer",
                "minimum": 1,
                "maximum": 1000000
              }
            },
            "required": [
              "packageType",
              "quantity",
              "weightPerUnitKg",
              "volumePerUnitM3",
              "dimensionsCm",
              "indivisible",
              "stackable"
            ],
            "additionalProperties": false
          }
        },
        "availableDocuments": {
          "type": "array",
          "maxItems": 100,
          "items": {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "code",
              "reference",
              "issuedAt",
              "validUntil"
            ],
            "properties": {
              "code": {
                "type": "string",
                "minLength": 1,
                "maxLength": 100,
                "pattern": "\\S"
              },
              "reference": {
                "type": "string",
                "minLength": 1,
                "maxLength": 500,
                "pattern": "\\S"
              },
              "issuedAt": {
                "anyOf": [
                  {
                    "type": "string",
                    "format": "date-time",
                    "pattern": "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d+)?(Z|[+-]\\d{2}:?\\d{2})$"
                  },
                  {
                    "type": "null"
                  }
                ]
              },
              "validUntil": {
                "anyOf": [
                  {
                    "type": "string",
                    "format": "date-time",
                    "pattern": "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d+)?(Z|[+-]\\d{2}:?\\d{2})$"
                  },
                  {
                    "type": "null"
                  }
                ]
              }
            }
          }
        }
      },
      "required": [
        "categoryCode",
        "description",
        "packaging",
        "totalWeightKg",
        "totalVolumeM3",
        "divisible",
        "requirements",
        "units"
      ],
      "additionalProperties": false
    },
    "contacts": {
      "type": "object",
      "properties": {
        "pickup": {
          "type": "object",
          "properties": {
            "name": {
              "type": "string",
              "minLength": 1,
              "pattern": "\\S",
              "maxLength": 150
            },
            "phoneE164": {
              "type": "string",
              "pattern": "^\\+[1-9]\\d{6,14}$"
            },
            "email": {
              "anyOf": [
                {
                  "type": "string",
                  "format": "email"
                },
                {
                  "type": "null"
                }
              ]
            },
            "company": {
              "anyOf": [
                {
                  "type": "string",
                  "minLength": 1,
                  "maxLength": 200,
                  "pattern": "\\S"
                },
                {
                  "type": "null"
                }
              ]
            },
            "addressDetail": {
              "anyOf": [
                {
                  "type": "string",
                  "minLength": 1,
                  "maxLength": 1000,
                  "pattern": "\\S"
                },
                {
                  "type": "null"
                }
              ]
            },
            "handlingInstructions": {
              "anyOf": [
                {
                  "type": "string",
                  "minLength": 1,
                  "maxLength": 2000,
                  "pattern": "\\S"
                },
                {
                  "type": "null"
                }
              ]
            }
          },
          "required": [
            "name",
            "phoneE164"
          ],
          "additionalProperties": false
        },
        "recipient": {
          "type": "object",
          "properties": {
            "name": {
              "type": "string",
              "minLength": 1,
              "pattern": "\\S",
              "maxLength": 150
            },
            "phoneE164": {
              "type": "string",
              "pattern": "^\\+[1-9]\\d{6,14}$"
            },
            "email": {
              "anyOf": [
                {
                  "type": "string",
                  "format": "email"
                },
                {
                  "type": "null"
                }
              ]
            },
            "company": {
              "anyOf": [
                {
                  "type": "string",
                  "minLength": 1,
                  "maxLength": 200,
                  "pattern": "\\S"
                },
                {
                  "type": "null"
                }
              ]
            },
            "addressDetail": {
              "anyOf": [
                {
                  "type": "string",
                  "minLength": 1,
                  "maxLength": 1000,
                  "pattern": "\\S"
                },
                {
                  "type": "null"
                }
              ]
            },
            "handlingInstructions": {
              "anyOf": [
                {
                  "type": "string",
                  "minLength": 1,
                  "maxLength": 2000,
                  "pattern": "\\S"
                },
                {
                  "type": "null"
                }
              ]
            }
          },
          "required": [
            "name",
            "phoneE164"
          ],
          "additionalProperties": false
        }
      },
      "required": [
        "pickup",
        "recipient"
      ],
      "additionalProperties": false
    },
    "budget": {
      "anyOf": [
        {
          "type": "object",
          "properties": {
            "amount": {
              "type": "number",
              "exclusiveMinimum": 0
            },
            "currency": {
              "const": "USD"
            }
          },
          "required": [
            "amount",
            "currency"
          ],
          "additionalProperties": false
        },
        {
          "type": "null"
        }
      ]
    },
    "serviceType": {
      "enum": [
        "FTL",
        "LTL"
      ]
    },
    "selectionObjective": {
      "enum": [
        "LOWEST_COST",
        "FASTEST",
        "WEIGHTED"
      ]
    },
    "preferredEquipment": {
      "anyOf": [
        {
          "enum": [
            "BOX_TRUCK",
            "REEFER_TRUCK",
            "FLATBED",
            "TANKER_TRUCK",
            "TRACTOR_TRAILER",
            "ISO_CONTAINER",
            "RAIL_WAGON",
            "AIR_ULD"
          ]
        },
        {
          "type": "null"
        }
      ]
    }
  },
  "required": [
    "schemaVersion",
    "origin",
    "destination",
    "pickupWindow",
    "deliveryWindow",
    "acceptedModes",
    "cargoSpecification",
    "contacts"
  ],
  "additionalProperties": false,
  "$schema": "http://json-schema.org/draft-07/schema#"
}'::json;
$schema$;

commit;
