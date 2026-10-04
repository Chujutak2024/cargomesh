-- HAC-40 Organization aggregate. No onboarding, auth identity, or scenario data.
begin;
alter table public.organizations
  add column corporate_email text,
  add column version integer not null default 1 check (version > 0),
  add column v2_command_managed boolean not null default false;
-- corporate_email is descriptive contact, not verified_corporate_email.
create table private.v2_organization_command_receipts (
  organization_id uuid not null references public.organizations(id),
  member_id uuid not null references public.organization_members(id),
  idempotency_key uuid not null, payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  result jsonb not null, created_at timestamptz not null default now(),
  primary key (organization_id,member_id,idempotency_key)
);
alter table private.v2_organization_command_receipts enable row level security;
revoke all on private.v2_organization_command_receipts from public,anon,authenticated,service_role;
create function private.protect_v2_organization_command() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if (old.v2_command_managed or new.v2_command_managed) and current_user <> 'postgres'
    then raise exception 'DIRECT_ORGANIZATION_MUTATION_FORBIDDEN' using errcode='PT403'; end if;
  if new.id is distinct from old.id then raise exception 'IMMUTABLE_ID' using errcode='PT400'; end if;
  new.version := old.version + 1;
  new.updated_at := now();
  return new;
end;
$$;
create trigger v2_organization_command_guard before update on public.organizations
  for each row execute function private.protect_v2_organization_command();

create function private.command_v2_organization(p_organization_id uuid,p_member_id uuid,
  p_idempotency_key uuid,p_expected_version integer,p_value jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_row public.organizations%rowtype;
  v_receipt private.v2_organization_command_receipts%rowtype; v_hash text;
begin
  if auth.uid() is null or not exists(select 1 from public.organization_members m
    where m.id=p_member_id and m.organization_id=p_organization_id and m.auth_user_id=auth.uid()
    and m.status='ACTIVE' and m.role='OWNER')
    then raise exception 'FORBIDDEN_TENANT' using errcode='PT403'; end if;
  if p_idempotency_key is null or p_expected_version is null or p_expected_version < 1
    or not coalesce(extensions.jsonb_matches_schema('{
      "type":"object","additionalProperties":false,
      "required":["schemaVersion","code","commercialName","legalName","taxIdType","taxIdValue","countryCode","corporateEmail","corporatePhone","defaultCurrency","status"],
      "properties":{"schemaVersion":{"const":"2.0"},
        "code":{"type":"string","minLength":1,"maxLength":100,"pattern":"\\S"},
        "commercialName":{"type":"string","minLength":1,"maxLength":200,"pattern":"\\S"},
        "legalName":{"type":["string","null"],"minLength":1,"maxLength":200,"pattern":"\\S"},
        "taxIdType":{"type":["string","null"],"minLength":1,"maxLength":50,"pattern":"\\S"},
        "taxIdValue":{"type":["string","null"],"minLength":1,"maxLength":100,"pattern":"\\S"},
        "countryCode":{"type":["string","null"],"pattern":"^[A-Z]{2}$"},
        "corporateEmail":{"type":["string","null"],"maxLength":254,"pattern":"^[^[:space:]@]+@[^[:space:]@]+\\.[^[:space:]@]+$"},
        "corporatePhone":{"type":["string","null"],"pattern":"^\\+[1-9][0-9]{6,14}$"},
        "defaultCurrency":{"const":"USD"},"status":{"enum":["ACTIVE","INACTIVE"]}}
      }'::json,p_value),false)
    or ((p_value->>'taxIdType') is null) <> ((p_value->>'taxIdValue') is null)
    then raise exception 'VALIDATION_ERROR' using errcode='PT400'; end if;
  v_hash := private.hash_v2_freight_payload(jsonb_build_object('expectedVersion',p_expected_version,'value',p_value));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    p_organization_id::text||':'||p_member_id::text||':'||p_idempotency_key::text,0));
  select * into v_receipt from private.v2_organization_command_receipts
    where organization_id=p_organization_id and member_id=p_member_id and idempotency_key=p_idempotency_key;
  if found then
    if v_receipt.payload_hash <> v_hash then raise exception 'IDEMPOTENCY_CONFLICT' using errcode='PT409'; end if;
    return jsonb_build_object('row',v_receipt.result,'replay',true);
  end if;
  select * into v_row from public.organizations where id=p_organization_id for update;
  if not found then raise exception 'ORGANIZATION_NOT_FOUND' using errcode='PT404'; end if;
  if v_row.version <> p_expected_version then raise exception 'STALE_DRAFT' using errcode='PT409'; end if;
  update public.organizations set code=p_value->>'code',name=p_value->>'commercialName',
    legal_name=p_value->>'legalName',business_identifier_type=p_value->>'taxIdType',
    business_identifier_value=p_value->>'taxIdValue',country_code=p_value->>'countryCode',
    corporate_email=p_value->>'corporateEmail',corporate_phone=p_value->>'corporatePhone',
    default_currency=p_value->>'defaultCurrency',status=p_value->>'status',v2_command_managed=true
    where id=p_organization_id returning * into v_row;
  insert into private.v2_organization_command_receipts(organization_id,member_id,idempotency_key,payload_hash,result)
    values(p_organization_id,p_member_id,p_idempotency_key,v_hash,to_jsonb(v_row));
  return jsonb_build_object('row',to_jsonb(v_row),'replay',false);
end;
$$;
create function public.command_v2_organization(p_organization_id uuid,p_member_id uuid,
  p_idempotency_key uuid,p_expected_version integer,p_value jsonb)
returns jsonb language sql security invoker set search_path = '' as $$
  select private.command_v2_organization(p_organization_id,p_member_id,p_idempotency_key,p_expected_version,p_value);
$$;
revoke all on function private.command_v2_organization(uuid,uuid,uuid,integer,jsonb) from public,anon,service_role;
revoke all on function public.command_v2_organization(uuid,uuid,uuid,integer,jsonb) from public,anon,service_role;
grant execute on function private.command_v2_organization(uuid,uuid,uuid,integer,jsonb) to authenticated;
grant execute on function public.command_v2_organization(uuid,uuid,uuid,integer,jsonb) to authenticated;
revoke all on function private.protect_v2_organization_command() from public,anon,authenticated;
commit;
