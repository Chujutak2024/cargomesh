-- HAC-12 R-06-E1/R-10: bind receipts to their payload on every INSERT.
-- Additive migration; no scenario data and no changes to RPC tenant checks.
begin;

-- Matches the existing Node draft hash for the strict V2 DTO's ASCII keys.
-- Numbers are first rounded to IEEE-754 binary64, as JSON.parse in the API.
create or replace function private.canonical_v2_payload(p_value jsonb)
returns text language plpgsql immutable strict security invoker
set search_path = '' set extra_float_digits = 3 as $$
declare
  v_result text;
  v_number double precision;
begin
  case jsonb_typeof(p_value)
    when 'object' then
      select '{' || coalesce(string_agg(to_json(e.key)::text || ':' ||
        private.canonical_v2_payload(e.value), ',' order by e.key collate "C"), '') || '}'
      into v_result from jsonb_each(p_value) e;
    when 'array' then
      select '[' || coalesce(string_agg(private.canonical_v2_payload(e.value),
        ',' order by e.ordinality), '') || ']'
      into v_result from jsonb_array_elements(p_value) with ordinality e(value, ordinality);
    when 'number' then
      v_number := p_value::text::double precision;
      if v_number = 0 then
        v_result := '0';
      elsif abs(v_number) >= 0.000001 and abs(v_number) < 1e21 then
        v_result := trim_scale(v_number::text::numeric)::text;
      else
        v_result := regexp_replace(v_number::text, 'e([+-])0+([0-9]+)$', 'e\1\2');
      end if;
    else v_result := p_value::text;
  end case;
  return v_result;
exception when numeric_value_out_of_range then
  raise exception using errcode = 'PT400', message = 'VALIDATION_ERROR';
end;
$$;

create or replace function private.hash_v2_freight_payload(p_payload jsonb)
returns text language sql immutable strict security invoker
set search_path = '' as $$
  select encode(extensions.digest(convert_to(private.canonical_v2_payload(p_payload), 'UTF8'), 'sha256'), 'hex');
$$;

create or replace function private.verify_v2_receipt_hash()
returns trigger language plpgsql security invoker
set search_path = '' as $$
begin
  -- Legacy rows have no V2 receipt. The existing protect trigger checks markers,
  -- the full DTO, canonical facility snapshots, membership and flattened fields.
  if new.v2_contract_version is null and new.v2_snapshot is null
    and new.v2_creation_payload is null then return new; end if;
  if new.creation_payload_hash is distinct from
    private.hash_v2_freight_payload(new.v2_creation_payload) then
    raise exception using errcode = 'PT400', message = 'VALIDATION_ERROR';
  end if;
  return new;
end;
$$;

-- PostgreSQL orders same-event triggers by name: protect_* validates first.
create trigger verify_v2_receipt_hash before insert on public.freight_requests
for each row execute function private.verify_v2_receipt_hash();

grant usage on schema private to service_role;
revoke all on function private.canonical_v2_payload(jsonb) from public, anon;
revoke all on function private.hash_v2_freight_payload(jsonb) from public, anon;
grant execute on function private.canonical_v2_payload(jsonb) to authenticated, service_role;
grant execute on function private.hash_v2_freight_payload(jsonb) to authenticated, service_role;
revoke all on function private.verify_v2_receipt_hash() from public, anon, authenticated;
commit;
