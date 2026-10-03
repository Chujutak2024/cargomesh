-- HAC-12 independent review R-01/R-03/R-05. Structure/logic only.
-- HAC12-R-01: Sprint 2 exposes creation and read-only evaluation, no draft edit.
-- Until a canonical expected-version mutation exists, direct UPDATE is unsupported
-- for every V2 draft (including attempts to remove the V2 marker or change version).
create function private.protect_v2_draft_update() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if old.v2_contract_version = '2.0' or new.v2_contract_version = '2.0' then
    raise exception 'V2_DRAFT_MUTATION_UNSUPPORTED' using errcode = 'PT409';
  end if;
  return new;
end;
$$;
revoke all on function private.protect_v2_draft_update() from public, anon, authenticated;
create trigger protect_v2_draft_update before update on public.freight_requests
for each row execute function private.protect_v2_draft_update();

create or replace function public.create_v2_freight_request(
  p_organization_id uuid,
  p_member_id uuid,
  p_idempotency_key uuid,
  p_payload_hash text,
  p_payload jsonb
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_member public.organization_members%rowtype;
  v_category public.cargo_categories%rowtype;
  v_origin public.facilities%rowtype;
  v_destination public.facilities%rowtype;
  v_origin_json jsonb;
  v_destination_json jsonb;
  v_payload jsonb;
  v_cargo jsonb;
  v_unit jsonb;
  v_location jsonb;
  v_units_weight numeric := 0;
  v_units_volume numeric := 0;
  v_request public.freight_requests%rowtype;
  v_id uuid;
  v_replay boolean := false;
begin
  if p_idempotency_key is null or p_payload_hash !~ '^[0-9a-f]{64}$'
     or jsonb_typeof(p_payload) is distinct from 'object'
     or p_payload ->> 'schemaVersion' is distinct from '2.0'
     or p_payload -> 'acceptedModes' is distinct from '["ROAD"]'::jsonb
     or (p_payload ? 'budget' and p_payload -> 'budget' <> 'null'::jsonb
         and p_payload #>> '{budget,currency}' is distinct from 'USD') then
    raise exception 'VALIDATION_ERROR' using errcode = 'PT400';
  end if;
  if p_payload ? 'organizationId'
     and p_payload ->> 'organizationId' is distinct from p_organization_id::text then
    raise exception 'FORBIDDEN_TENANT' using errcode = 'PT403';
  end if;

  select * into v_member from public.organization_members
    where id = p_member_id and organization_id = p_organization_id
      and status = 'ACTIVE' and role in ('OWNER','SUPERVISOR');
  if not found or (current_user <> 'service_role'
                   and v_member.auth_user_id is distinct from auth.uid()) then
    raise exception 'FORBIDDEN_TENANT' using errcode = 'PT403';
  end if;

  -- The public RPC must enforce totals too, including callers outside Hono.
  v_cargo := p_payload -> 'cargoSpecification';
  if jsonb_typeof(v_cargo -> 'units') is distinct from 'array' then
    raise exception 'VALIDATION_ERROR' using errcode = 'PT400';
  end if;
  if jsonb_array_length(v_cargo -> 'units') = 0
     or jsonb_typeof(v_cargo -> 'totalWeightKg') is distinct from 'number'
     or jsonb_typeof(v_cargo -> 'totalVolumeM3') is distinct from 'number' then
    raise exception 'VALIDATION_ERROR' using errcode = 'PT400';
  end if;
  for v_unit in select value from jsonb_array_elements(v_cargo -> 'units') loop
    if jsonb_typeof(v_unit -> 'quantity') is distinct from 'number'
       or jsonb_typeof(v_unit -> 'weightPerUnitKg') is distinct from 'number'
       or jsonb_typeof(v_unit -> 'volumePerUnitM3') is distinct from 'number' then
      raise exception 'VALIDATION_ERROR' using errcode = 'PT400';
    end if;
    if (v_unit ->> 'quantity')::numeric <= 0
       or mod((v_unit ->> 'quantity')::numeric, 1) <> 0
       or (v_unit ->> 'weightPerUnitKg')::numeric <= 0
       or (v_unit ->> 'volumePerUnitM3')::numeric <= 0 then
      raise exception 'VALIDATION_ERROR' using errcode = 'PT400';
    end if;
    v_units_weight := v_units_weight + (v_unit ->> 'quantity')::numeric
      * (v_unit ->> 'weightPerUnitKg')::numeric;
    v_units_volume := v_units_volume + (v_unit ->> 'quantity')::numeric
      * (v_unit ->> 'volumePerUnitM3')::numeric;
  end loop;
  if abs((v_cargo ->> 'totalWeightKg')::numeric - v_units_weight) > 0.000001
     or abs((v_cargo ->> 'totalVolumeM3')::numeric - v_units_volume) > 0.000001 then
    raise exception 'VALIDATION_ERROR' using errcode = 'PT400';
  end if;
  -- Manual pins are user assertions, not provider geometry or verified facilities.
  for v_location in select value from jsonb_array_elements(
    jsonb_build_array(p_payload -> 'origin', p_payload -> 'destination')) loop
    if v_location ->> 'facilityId' is null then
      if (v_location ->> 'lat' is null) <> (v_location ->> 'lng' is null) then
        raise exception 'VALIDATION_ERROR' using errcode = 'PT400';
      end if;
      if v_location ->> 'lat' is not null then
        if jsonb_typeof(v_location -> 'lat') is distinct from 'number'
           or jsonb_typeof(v_location -> 'lng') is distinct from 'number' then
          raise exception 'VALIDATION_ERROR' using errcode = 'PT400';
        end if;
        if (v_location ->> 'lat')::numeric not between -90 and 90
           or (v_location ->> 'lng')::numeric not between -180 and 180 then
          raise exception 'VALIDATION_ERROR' using errcode = 'PT400';
        end if;
      end if;
    end if;
  end loop;

  select * into v_request from public.freight_requests
    where organization_id = p_organization_id
      and requested_by_member_id = p_member_id
      and creation_idempotency_key = p_idempotency_key;
  if found then
    if v_request.creation_payload_hash is distinct from p_payload_hash
       or v_request.v2_creation_payload is distinct from p_payload then
      raise exception 'IDEMPOTENCY_CONFLICT' using errcode = 'PT409';
    end if;
    v_replay := true;
  else
    select * into v_category from public.cargo_categories
      where code = p_payload #>> '{cargoSpecification,categoryCode}' and active;
    if not found then
      raise exception 'VALIDATION_ERROR' using errcode = 'PT400';
    end if;

    if p_payload #>> '{origin,facilityId}' is not null then
      select * into v_origin from public.facilities
        where id = (p_payload #>> '{origin,facilityId}')::uuid and active;
      if not found then
        perform private.assert_v2_facility_not_foreign(
          (p_payload #>> '{origin,facilityId}')::uuid, p_organization_id);
        raise exception 'VALIDATION_ERROR' using errcode = 'PT400';
      end if;
      if v_origin.organization_id <> p_organization_id then
        raise exception 'FORBIDDEN_TENANT' using errcode = 'PT403';
      end if;
      v_origin_json := jsonb_build_object(
        'facilityId', v_origin.id, 'label', v_origin.name,
        'countryCode', v_origin.country_code, 'region', v_origin.region_code,
        'city', v_origin.city, 'lat', v_origin.latitude, 'lng', v_origin.longitude);
    else
      if coalesce(p_payload #>> '{origin,label}', '') = ''
         or coalesce(p_payload #>> '{origin,countryCode}', '') = ''
         or coalesce(p_payload #>> '{origin,city}', '') = '' then
        raise exception 'VALIDATION_ERROR' using errcode = 'PT400';
      end if;
      v_origin_json := jsonb_build_object(
        'facilityId', null, 'label', p_payload #>> '{origin,label}',
        'countryCode', p_payload #>> '{origin,countryCode}',
        'region', p_payload #>> '{origin,region}',
        'city', p_payload #>> '{origin,city}',
        'lat', p_payload #> '{origin,lat}', 'lng', p_payload #> '{origin,lng}');
    end if;

    if p_payload #>> '{destination,facilityId}' is not null then
      select * into v_destination from public.facilities
        where id = (p_payload #>> '{destination,facilityId}')::uuid and active;
      if not found then
        perform private.assert_v2_facility_not_foreign(
          (p_payload #>> '{destination,facilityId}')::uuid, p_organization_id);
        raise exception 'VALIDATION_ERROR' using errcode = 'PT400';
      end if;
      if v_destination.organization_id <> p_organization_id then
        raise exception 'FORBIDDEN_TENANT' using errcode = 'PT403';
      end if;
      v_destination_json := jsonb_build_object(
        'facilityId', v_destination.id, 'label', v_destination.name,
        'countryCode', v_destination.country_code, 'region', v_destination.region_code,
        'city', v_destination.city, 'lat', v_destination.latitude, 'lng', v_destination.longitude);
    else
      if coalesce(p_payload #>> '{destination,label}', '') = ''
         or coalesce(p_payload #>> '{destination,countryCode}', '') = ''
         or coalesce(p_payload #>> '{destination,city}', '') = '' then
        raise exception 'VALIDATION_ERROR' using errcode = 'PT400';
      end if;
      v_destination_json := jsonb_build_object(
        'facilityId', null, 'label', p_payload #>> '{destination,label}',
        'countryCode', p_payload #>> '{destination,countryCode}',
        'region', p_payload #>> '{destination,region}',
        'city', p_payload #>> '{destination,city}',
        'lat', p_payload #> '{destination,lat}', 'lng', p_payload #> '{destination,lng}');
    end if;

    v_cargo := p_payload -> 'cargoSpecification';
    v_payload := p_payload || jsonb_build_object(
      'organizationId', p_organization_id,
      'origin', v_origin_json,
      'destination', v_destination_json);
    v_id := gen_random_uuid();
    insert into public.freight_requests (
      id, organization_id, requested_by_member_id, cargo_category_id, code,
      origin_country, origin_city, origin_region, origin_address, origin_facility_id,
      destination_country, destination_city, destination_region, destination_address,
      destination_facility_id, cargo_weight_kg, cargo_volume_m3, package_count,
      service_type, transport_mode, required_pickup, pickup_window_start,
      pickup_window_end, delivery_deadline, delivery_window_start, delivery_window_end,
      budget_max, budget_currency, cargo_description, cargo_specifications,
      pickup_contact_name, pickup_contact_phone, pickup_contact_email,
      receiver_name, receiver_phone, recipient_contact_email,
      required_equipment_code, status, draft_version, v2_contract_version,
      v2_snapshot, v2_creation_payload, creation_idempotency_key, creation_payload_hash
    ) values (
      v_id, p_organization_id, p_member_id, v_category.id,
      'V2-' || replace(v_id::text, '-', ''),
      v_origin_json ->> 'countryCode', v_origin_json ->> 'city',
      v_origin_json ->> 'region', v_origin_json ->> 'label', v_origin.id,
      v_destination_json ->> 'countryCode', v_destination_json ->> 'city',
      v_destination_json ->> 'region', v_destination_json ->> 'label', v_destination.id,
      (v_cargo ->> 'totalWeightKg')::numeric,
      (v_cargo ->> 'totalVolumeM3')::numeric,
      (select sum((unit ->> 'quantity')::integer)
       from jsonb_array_elements(v_cargo -> 'units') as unit),
      'FTL', 'ROAD', (p_payload #>> '{pickupWindow,startsAt}')::timestamptz,
      (p_payload #>> '{pickupWindow,startsAt}')::timestamptz,
      (p_payload #>> '{pickupWindow,endsAt}')::timestamptz,
      (p_payload #>> '{deliveryWindow,endsAt}')::timestamptz,
      (p_payload #>> '{deliveryWindow,startsAt}')::timestamptz,
      (p_payload #>> '{deliveryWindow,endsAt}')::timestamptz,
      nullif(p_payload #>> '{budget,amount}', '')::numeric,
      p_payload #>> '{budget,currency}', v_cargo ->> 'description', v_cargo,
      p_payload #>> '{contacts,pickup,name}',
      p_payload #>> '{contacts,pickup,phoneE164}',
      p_payload #>> '{contacts,pickup,email}',
      p_payload #>> '{contacts,recipient,name}',
      p_payload #>> '{contacts,recipient,phoneE164}',
      p_payload #>> '{contacts,recipient,email}',
      p_payload ->> 'requiredEquipment', 'DRAFT', 1, '2.0', v_payload,
      p_payload, p_idempotency_key, p_payload_hash
    ) on conflict (organization_id, requested_by_member_id, creation_idempotency_key)
      where creation_idempotency_key is not null do nothing
    returning * into v_request;
    if not found then
      select * into v_request from public.freight_requests
        where organization_id = p_organization_id
          and requested_by_member_id = p_member_id
          and creation_idempotency_key = p_idempotency_key;
      if v_request.creation_payload_hash is distinct from p_payload_hash
         or v_request.v2_creation_payload is distinct from p_payload then
        raise exception 'IDEMPOTENCY_CONFLICT' using errcode = 'PT409';
      end if;
      v_replay := true;
    end if;
  end if;

  return jsonb_build_object(
    'id', v_request.id, 'referenceCode', v_request.code,
    'organizationId', v_request.organization_id, 'status', v_request.status,
    'draftVersion', v_request.draft_version, 'snapshot', v_request.v2_snapshot,
    'createdAt', v_request.created_at, 'updatedAt', v_request.updated_at,
    'payloadHash', v_request.creation_payload_hash,
    'idempotentReplay', v_replay);
end;
$$;
