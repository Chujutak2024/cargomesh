-- HAC-40: Facility UML attributes and atomic Web/MCP application commands.
-- No synthetic data. Existing legacy facility grants remain compatible;
-- records created/revised by this API become protected command-managed rows.
begin;
alter table public.facilities
  add column access_restrictions jsonb not null default '[]'::jsonb,
  add column operating_hours jsonb,
  add column version integer not null default 1 check (version > 0),
  add column v2_command_managed boolean not null default false;

create function private.valid_v2_facility_details(p_rules jsonb, p_hours jsonb)
returns boolean language plpgsql stable security invoker set search_path = '' as $$
declare v_item jsonb; v_other jsonb; v_timezone text;
begin
  if jsonb_typeof(p_rules) is distinct from 'array' or jsonb_array_length(p_rules) > 100 then return false; end if;
  for v_item in select value from jsonb_array_elements(p_rules) loop
    if not extensions.jsonb_matches_schema('{
      "type":"object", "required":["code","description","evidenceReference"], "additionalProperties":false,
      "properties":{"code":{"type":"string","minLength":1,"maxLength":100,"pattern":"\\S"},
        "description":{"type":"string","minLength":1,"maxLength":1000,"pattern":"\\S"},
        "evidenceReference":{"type":["string","null"],"minLength":1,"maxLength":500,"pattern":"\\S"}}
    }'::json, v_item) then return false; end if;
  end loop;
  if p_hours is null or p_hours = 'null'::jsonb then return true; end if;
  if not extensions.jsonb_matches_schema('{
    "type":"object","required":["timezone","weekly"],"additionalProperties":false,
    "properties":{"timezone":{"type":"string"},"weekly":{"type":"array","maxItems":28,
      "items":{"type":"object","required":["dayOfWeek","opensAt","closesAt"],"additionalProperties":false,
        "properties":{"dayOfWeek":{"type":"integer","minimum":1,"maximum":7},
          "opensAt":{"type":"string","pattern":"^([01][0-9]|2[0-3]):[0-5][0-9]$"},
          "closesAt":{"type":"string","pattern":"^([01][0-9]|2[0-3]):[0-5][0-9]$"}}}}}
  }'::json, p_hours) then return false; end if;
  v_timezone := p_hours ->> 'timezone';
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = v_timezone) then return false; end if;
  for v_item in select value from jsonb_array_elements(p_hours -> 'weekly') loop
    if v_item ->> 'opensAt' >= v_item ->> 'closesAt' then return false; end if;
  end loop;
  if exists (
    select 1 from jsonb_array_elements(p_hours -> 'weekly') with ordinality a(value,n)
    join jsonb_array_elements(p_hours -> 'weekly') with ordinality b(value,n) on a.n < b.n
    where a.value ->> 'dayOfWeek' = b.value ->> 'dayOfWeek'
      and a.value ->> 'opensAt' < b.value ->> 'closesAt'
      and b.value ->> 'opensAt' < a.value ->> 'closesAt'
  ) then return false; end if;
  return true;
end;
$$;
alter table public.facilities add constraint facilities_v2_details_valid
  check (private.valid_v2_facility_details(access_restrictions, operating_hours));

create table private.v2_facility_command_receipts (
  organization_id uuid not null references public.organizations(id),
  member_id uuid not null references public.organization_members(id),
  idempotency_key uuid not null,
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  facility_id uuid not null,
  result jsonb not null check (jsonb_typeof(result) = 'object'),
  created_at timestamptz not null default now(),
  primary key (organization_id, member_id, idempotency_key),
  foreign key (facility_id, organization_id) references public.facilities(id, organization_id)
);
alter table private.v2_facility_command_receipts enable row level security;
revoke all on private.v2_facility_command_receipts from public, anon, authenticated, service_role;
create index v2_facility_receipts_facility_idx on private.v2_facility_command_receipts(facility_id, organization_id);

create function private.protect_v2_facility_command() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  -- Only the checked SECURITY DEFINER command (or the database administrator)
  -- can write managed rows. A client cannot enable a bypass with a custom GUC.
  if (new.v2_command_managed or (tg_op = 'UPDATE' and old.v2_command_managed))
    and current_user <> 'postgres' then
    raise exception 'FACILITY_COMMAND_REQUIRED' using errcode = 'PT403';
  end if;
  if tg_op = 'UPDATE' then
    if new.organization_id is distinct from old.organization_id then
      raise exception 'FORBIDDEN_TENANT' using errcode = 'PT403';
    end if;
    if old.v2_command_managed and not new.v2_command_managed then
      raise exception 'FACILITY_COMMAND_REQUIRED' using errcode = 'PT403';
    end if;
    new.version := old.version + 1;
    new.updated_at := clock_timestamp();
  end if;
  return new;
end;
$$;
create trigger protect_v2_facility_command before insert or update on public.facilities
for each row execute function private.protect_v2_facility_command();

-- Privileged mutation is necessary to protect managed writes and receipts from
-- direct Data API mutation. This function verifies the authenticated actor and
-- tenant/role before every lookup; client organization/member ids never authorize.
create function private.command_v2_facility(
  p_organization_id uuid, p_member_id uuid, p_idempotency_key uuid,
  p_facility_id uuid, p_expected_version integer, p_value jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_row public.facilities%rowtype; v_receipt private.v2_facility_command_receipts%rowtype;
  v_hash text; v_location jsonb; v_input jsonb; v_id uuid;
begin
  if auth.uid() is null or not exists (
    select 1 from public.organization_members m where m.id = p_member_id
      and m.organization_id = p_organization_id and m.auth_user_id = auth.uid()
      and m.status = 'ACTIVE' and m.role in ('OWNER','SUPERVISOR')
  ) then raise exception 'FORBIDDEN_TENANT' using errcode = 'PT403'; end if;
  if p_idempotency_key is null
    or (p_facility_id is null) <> (p_expected_version is null)
    or p_expected_version <= 0
    or not coalesce(extensions.jsonb_matches_schema('{
      "type":"object","additionalProperties":false,
      "required":["schemaVersion","code","name","facilityType","location","active","accessRestrictions","operatingHours"],
      "properties":{"schemaVersion":{"const":"2.0"},
        "code":{"type":"string","minLength":1,"maxLength":100,"pattern":"\\S"},
        "name":{"type":"string","minLength":1,"maxLength":200,"pattern":"\\S"},
        "facilityType":{"enum":["SHIPPER_SITE","WAREHOUSE","DISTRIBUTION_CENTER","OTHER"]},
        "active":{"type":"boolean"},"accessRestrictions":{"type":"array"},
        "operatingHours":{"type":["object","null"]},
        "location":{"type":"object","additionalProperties":false,
          "required":["label","countryCode","region","city","lat","lng"],
          "properties":{"label":{"type":"string","minLength":1,"maxLength":200,"pattern":"\\S"},
            "countryCode":{"type":"string","pattern":"^[A-Z]{2}$"},"region":{"type":["string","null"]},
            "city":{"type":"string","minLength":1,"maxLength":120,"pattern":"\\S"},
            "lat":{"type":["number","null"],"minimum":-90,"maximum":90},
            "lng":{"type":["number","null"],"minimum":-180,"maximum":180}}}}
      }'::json, p_value), false)
    or not private.valid_v2_facility_details(p_value -> 'accessRestrictions', p_value -> 'operatingHours')
    or ((p_value #>> '{location,lat}') is null) <> ((p_value #>> '{location,lng}') is null)
  then raise exception 'VALIDATION_ERROR' using errcode = 'PT400'; end if;
  v_input := jsonb_build_object('facilityId', p_facility_id, 'expectedVersion', p_expected_version, 'value', p_value);
  v_hash := private.hash_v2_freight_payload(v_input);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    p_organization_id::text || ':' || p_member_id::text || ':' || p_idempotency_key::text, 0));
  select * into v_receipt from private.v2_facility_command_receipts
    where organization_id = p_organization_id and member_id = p_member_id and idempotency_key = p_idempotency_key;
  if found then
    if v_receipt.payload_hash <> v_hash then raise exception 'IDEMPOTENCY_CONFLICT' using errcode = 'PT409'; end if;
    return jsonb_build_object('row', v_receipt.result, 'replay', true);
  end if;
  v_location := p_value -> 'location';
  if p_facility_id is null then
    insert into public.facilities(organization_id, code, name, facility_type,
      country_code, region_code, city, address_line, latitude, longitude, active,
      access_restrictions, operating_hours, v2_command_managed)
    values (p_organization_id, p_value ->> 'code', p_value ->> 'name', p_value ->> 'facilityType',
      v_location ->> 'countryCode', v_location ->> 'region', v_location ->> 'city', v_location ->> 'label',
      (v_location ->> 'lat')::numeric, (v_location ->> 'lng')::numeric, (p_value ->> 'active')::boolean,
      p_value -> 'accessRestrictions', nullif(p_value -> 'operatingHours','null'::jsonb), true)
    returning * into v_row;
  else
    select * into v_row from public.facilities
      where id = p_facility_id and organization_id = p_organization_id for update;
    if not found then raise exception 'FACILITY_NOT_FOUND' using errcode = 'PT404'; end if;
    if v_row.version <> p_expected_version then raise exception 'STALE_DRAFT' using errcode = 'PT409'; end if;
    update public.facilities set code = p_value ->> 'code', name = p_value ->> 'name',
      facility_type = p_value ->> 'facilityType', country_code = v_location ->> 'countryCode',
      region_code = v_location ->> 'region', city = v_location ->> 'city', address_line = v_location ->> 'label',
      latitude = (v_location ->> 'lat')::numeric, longitude = (v_location ->> 'lng')::numeric,
      active = (p_value ->> 'active')::boolean, access_restrictions = p_value -> 'accessRestrictions',
      operating_hours = nullif(p_value -> 'operatingHours','null'::jsonb), v2_command_managed = true
    where id = p_facility_id and organization_id = p_organization_id returning * into v_row;
  end if;
  insert into private.v2_facility_command_receipts(organization_id,member_id,idempotency_key,payload_hash,facility_id,result)
    values(p_organization_id,p_member_id,p_idempotency_key,v_hash,v_row.id,to_jsonb(v_row));
  return jsonb_build_object('row',to_jsonb(v_row),'replay',false);
end;
$$;
create function public.command_v2_facility(
  p_organization_id uuid, p_member_id uuid, p_idempotency_key uuid,
  p_facility_id uuid, p_expected_version integer, p_value jsonb
) returns jsonb language sql security invoker set search_path = '' as $$
  select private.command_v2_facility(p_organization_id,p_member_id,p_idempotency_key,
    p_facility_id,p_expected_version,p_value);
$$;
revoke all on function private.command_v2_facility(uuid,uuid,uuid,uuid,integer,jsonb) from public,anon,service_role;
revoke all on function public.command_v2_facility(uuid,uuid,uuid,uuid,integer,jsonb) from public,anon,service_role;
grant execute on function private.command_v2_facility(uuid,uuid,uuid,uuid,integer,jsonb) to authenticated;
grant execute on function public.command_v2_facility(uuid,uuid,uuid,uuid,integer,jsonb) to authenticated;
revoke all on function private.protect_v2_facility_command() from public,anon,authenticated;
revoke all on function private.valid_v2_facility_details(jsonb,jsonb) from public,anon;
grant execute on function private.valid_v2_facility_details(jsonb,jsonb) to authenticated,service_role;
commit;
