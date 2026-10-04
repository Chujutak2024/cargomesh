-- HAC-40: complete request lifecycle commands over the existing native writer.
-- Immutable creation receipts remain on freight_requests. Mutation receipts
-- are separate because each request may have many independently retried changes.
begin;
create table private.v2_request_command_receipts (
  organization_id uuid not null references public.organizations(id),
  member_id uuid not null references public.organization_members(id),
  idempotency_key uuid not null,
  request_id uuid not null references public.freight_requests(id),
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  result jsonb not null check (jsonb_typeof(result) = 'object'),
  created_at timestamptz not null default now(),
  primary key(organization_id,member_id,idempotency_key)
);
alter table private.v2_request_command_receipts enable row level security;
revoke all on private.v2_request_command_receipts from public,anon,authenticated,service_role;
create index v2_request_receipts_request_idx on private.v2_request_command_receipts(request_id);

create or replace function private.protect_v2_draft_update() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if old.v2_contract_version = '2.0' or new.v2_contract_version = '2.0' then
    -- API clients have no way to impersonate the command's database owner.
    if current_user <> 'postgres' then
      raise exception 'V2_DRAFT_MUTATION_UNSUPPORTED' using errcode = 'PT409';
    end if;
    if new.v2_contract_version is distinct from old.v2_contract_version
      or new.v2_creation_payload is distinct from old.v2_creation_payload
      or new.creation_payload_hash is distinct from old.creation_payload_hash
      or new.creation_idempotency_key is distinct from old.creation_idempotency_key
      or new.organization_id is distinct from old.organization_id
      or new.requested_by_member_id is distinct from old.requested_by_member_id
      or new.code is distinct from old.code
      or new.id is distinct from old.id
      or new.draft_version is distinct from old.draft_version + 1 then
      raise exception 'VALIDATION_ERROR' using errcode = 'PT400';
    end if;
  end if;
  return new;
end;
$$;
create function private.command_v2_freight_request(
  p_organization_id uuid, p_member_id uuid, p_idempotency_key uuid, p_request_id uuid,
  p_expected_version integer, p_action text, p_value jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_request public.freight_requests%rowtype; v_scratch public.freight_requests%rowtype;
  v_receipt private.v2_request_command_receipts%rowtype; v_hash text; v_created jsonb;
  v_result jsonb; v_snapshot jsonb;
begin
  if auth.uid() is null or not exists (
    select 1 from public.organization_members m where m.id = p_member_id
      and m.organization_id = p_organization_id and m.auth_user_id = auth.uid()
      and m.status = 'ACTIVE' and m.role in ('OWNER','SUPERVISOR')
  ) then raise exception 'FORBIDDEN_TENANT' using errcode = 'PT403'; end if;
  if p_idempotency_key is null or p_request_id is null or p_expected_version is null
    or p_expected_version <= 0 or p_action is null or p_action not in ('REVISE','SUBMIT')
    or (p_action = 'SUBMIT' and p_value is not null and p_value <> 'null'::jsonb)
    or (p_action = 'REVISE' and (p_value is null or jsonb_typeof(p_value) <> 'object'))
  then raise exception 'VALIDATION_ERROR' using errcode = 'PT400'; end if;
  v_hash := private.hash_v2_freight_payload(jsonb_build_object('id',p_request_id,
    'expectedVersion',p_expected_version,'action',p_action,'value',p_value));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    p_organization_id::text || ':' || p_member_id::text || ':' || p_idempotency_key::text, 1));
  select * into v_receipt from private.v2_request_command_receipts
    where organization_id=p_organization_id and member_id=p_member_id and idempotency_key=p_idempotency_key;
  if found then
    if v_receipt.payload_hash <> v_hash then raise exception 'IDEMPOTENCY_CONFLICT' using errcode='PT409'; end if;
    return v_receipt.result || '{"replay":true}'::jsonb;
  end if;
  select * into v_request from public.freight_requests where id=p_request_id
    and organization_id=p_organization_id and v2_contract_version='2.0' for update;
  if not found then raise exception 'REQUEST_NOT_FOUND' using errcode='PT404'; end if;
  if v_request.draft_version <> p_expected_version then raise exception 'STALE_DRAFT' using errcode='PT409'; end if;
  if v_request.status <> 'DRAFT' then raise exception 'INVALID_TRANSITION' using errcode='PT409'; end if;
  if p_action = 'REVISE' then
    -- Reuse the native writer's entire SQL validator and canonical facility
    -- resolver. Its scratch row is created, copied and deleted within this same
    -- transaction; it cannot escape on failure and never changes the old receipt.
    v_created := public.create_v2_freight_request(p_organization_id,p_member_id,gen_random_uuid(),
      private.hash_v2_freight_payload(p_value),p_value);
    select * into strict v_scratch from public.freight_requests where id=(v_created->>'id')::uuid;
    update public.freight_requests set
      cargo_category_id=v_scratch.cargo_category_id,
      origin_country=v_scratch.origin_country,origin_city=v_scratch.origin_city,
      origin_region=v_scratch.origin_region,origin_address=v_scratch.origin_address,origin_facility_id=v_scratch.origin_facility_id,
      destination_country=v_scratch.destination_country,destination_city=v_scratch.destination_city,
      destination_region=v_scratch.destination_region,destination_address=v_scratch.destination_address,destination_facility_id=v_scratch.destination_facility_id,
      cargo_weight_kg=v_scratch.cargo_weight_kg,cargo_volume_m3=v_scratch.cargo_volume_m3,package_count=v_scratch.package_count,
      service_type=v_scratch.service_type,transport_mode=v_scratch.transport_mode,required_pickup=v_scratch.required_pickup,
      pickup_window_start=v_scratch.pickup_window_start,pickup_window_end=v_scratch.pickup_window_end,
      delivery_deadline=v_scratch.delivery_deadline,delivery_window_start=v_scratch.delivery_window_start,delivery_window_end=v_scratch.delivery_window_end,
      budget_max=v_scratch.budget_max,budget_currency=v_scratch.budget_currency,cargo_description=v_scratch.cargo_description,
      cargo_specifications=v_scratch.cargo_specifications,pickup_contact_name=v_scratch.pickup_contact_name,
      pickup_contact_phone=v_scratch.pickup_contact_phone,pickup_contact_email=v_scratch.pickup_contact_email,
      receiver_name=v_scratch.receiver_name,receiver_phone=v_scratch.receiver_phone,recipient_contact_email=v_scratch.recipient_contact_email,
      required_equipment_code=v_scratch.required_equipment_code,v2_snapshot=v_scratch.v2_snapshot,
      draft_version=v_request.draft_version+1,updated_at=clock_timestamp()
    where id=p_request_id returning * into v_request;
    delete from public.freight_requests where id=v_scratch.id;
  else
    perform private.validate_v2_freight_payload(v_request.v2_snapshot);
    update public.freight_requests set status='PENDING',draft_version=draft_version+1,updated_at=clock_timestamp()
      where id=p_request_id returning * into v_request;
  end if;
  v_snapshot := v_request.v2_snapshot;
  v_result := jsonb_build_object('replay',false,'payloadHash',v_request.creation_payload_hash,'data',
    jsonb_build_object('id',v_request.id,'referenceCode',v_request.code,'organizationId',v_request.organization_id,
      'status',v_request.status,'draftVersion',v_request.draft_version,
      'origin',v_snapshot->'origin','destination',v_snapshot->'destination',
      'pickupWindow',v_snapshot->'pickupWindow','deliveryWindow',v_snapshot->'deliveryWindow',
      'acceptedModes',v_snapshot->'acceptedModes','requiredEquipment',coalesce(v_snapshot->'requiredEquipment','null'::jsonb),
      'cargoSpecification',v_snapshot->'cargoSpecification','contacts',v_snapshot->'contacts',
      'budget',coalesce(v_snapshot->'budget','null'::jsonb),'createdAt',v_request.created_at,'updatedAt',v_request.updated_at));
  insert into private.v2_request_command_receipts(organization_id,member_id,idempotency_key,request_id,payload_hash,result)
    values(p_organization_id,p_member_id,p_idempotency_key,p_request_id,v_hash,v_result);
  return v_result;
end;
$$;
create function public.command_v2_freight_request(
  p_organization_id uuid,p_member_id uuid,p_idempotency_key uuid,p_request_id uuid,
  p_expected_version integer,p_action text,p_value jsonb
) returns jsonb language sql security invoker set search_path = '' as $$
  select private.command_v2_freight_request(p_organization_id,p_member_id,p_idempotency_key,
    p_request_id,p_expected_version,p_action,p_value);
$$;
revoke all on function private.command_v2_freight_request(uuid,uuid,uuid,uuid,integer,text,jsonb) from public,anon,service_role;
revoke all on function public.command_v2_freight_request(uuid,uuid,uuid,uuid,integer,text,jsonb) from public,anon,service_role;
grant execute on function private.command_v2_freight_request(uuid,uuid,uuid,uuid,integer,text,jsonb) to authenticated;
grant execute on function public.command_v2_freight_request(uuid,uuid,uuid,uuid,integer,text,jsonb) to authenticated;
commit;
