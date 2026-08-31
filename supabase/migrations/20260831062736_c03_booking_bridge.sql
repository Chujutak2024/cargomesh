-- C-03 — Booking Bridge
--
-- Provider tools are intentionally unable to create CargoMesh bookings.  This
-- migration stores the server-issued authorization separately and exposes
-- service-role-only persistence functions for the two booking tools.

create table public.booking_authorizations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  freight_request_id uuid not null references public.freight_requests(id) on delete cascade,
  freight_decision_id uuid not null references public.freight_decisions(id) on delete restrict,
  offer_id uuid not null references public.carrier_offers(id) on delete restrict,
  carrier_id uuid not null references public.carriers(id) on delete restrict,
  carrier_service_id uuid not null references public.carrier_services(id) on delete restrict,
  selected_by_member_id uuid not null references public.organization_members(id) on delete restrict,
  selection_mode text not null check (selection_mode in ('ASSISTED', 'SMART_AUTO')),
  authorization_kind text not null check (authorization_kind in ('HUMAN_SELECTION', 'AUTO_BOOKING_POLICY')),
  booking_idempotency_key text not null,
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 minutes'),
  consumed_booking_id uuid references public.bookings(id) on delete set null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint booking_authorizations_idempotency_unique unique (booking_idempotency_key),
  constraint booking_authorizations_expiry_check check (expires_at > issued_at)
);

create index booking_authorizations_request_idx
  on public.booking_authorizations (freight_request_id, created_at desc);
create index booking_authorizations_offer_idx
  on public.booking_authorizations (offer_id)
  where revoked_at is null;

create table public.booking_bridge_calls (
  bridge_call_id text primary key,
  authorization_id uuid not null references public.booking_authorizations(id) on delete cascade,
  booking_id uuid not null references public.bookings(id) on delete cascade,
  tool_name text not null check (tool_name in ('book_freight', 'get_provider_booking_status')),
  canonical_payload jsonb not null,
  created_at timestamptz not null default now()
);

create index booking_bridge_calls_booking_idx
  on public.booking_bridge_calls (booking_id, created_at);

alter table public.booking_authorizations enable row level security;
alter table public.booking_bridge_calls enable row level security;

revoke all on table public.booking_authorizations, public.booking_bridge_calls from anon, authenticated;
grant all on table public.booking_authorizations, public.booking_bridge_calls to service_role;

create policy booking_authorizations_member_select
on public.booking_authorizations
for select to authenticated
using ((select private.is_organization_member(organization_id)));

create policy booking_bridge_calls_member_select
on public.booking_bridge_calls
for select to authenticated
using (
  exists (
    select 1
    from public.booking_authorizations ba
    where ba.id = booking_bridge_calls.authorization_id
      and (select private.is_organization_member(ba.organization_id))
  )
);

create or replace function public.prepare_booking_authorization(
  p_freight_request_id uuid,
  p_offer_id uuid,
  p_selected_by_member_id uuid,
  p_selection_mode text,
  p_booking_idempotency_key text
)
returns table (
  authorization_reference uuid,
  freight_decision_id uuid,
  freight_request_id uuid,
  offer_id uuid,
  carrier_id uuid,
  matching_service_id uuid,
  provider_offer_reference text,
  authorization_kind text,
  selection_mode text,
  booking_idempotency_key text,
  expires_at timestamptz,
  deduplicated boolean
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_request public.freight_requests%rowtype;
  v_offer public.carrier_offers%rowtype;
  v_decision public.freight_decisions%rowtype;
  v_member public.organization_members%rowtype;
  v_preferences public.organization_preferences%rowtype;
  v_existing public.booking_authorizations%rowtype;
  v_authorization public.booking_authorizations%rowtype;
  v_authorization_kind text;
begin
  if p_selection_mode not in ('ASSISTED', 'SMART_AUTO') then
    raise exception 'INVALID_SELECTION_MODE' using errcode = '22023';
  end if;
  if p_booking_idempotency_key is null or btrim(p_booking_idempotency_key) = '' then
    raise exception 'INVALID_BOOKING_IDEMPOTENCY_KEY' using errcode = '22023';
  end if;

  select * into v_existing
  from public.booking_authorizations ba
  where ba.booking_idempotency_key = p_booking_idempotency_key;

  if found then
    if v_existing.freight_request_id = p_freight_request_id
      and v_existing.offer_id = p_offer_id
      and v_existing.selected_by_member_id = p_selected_by_member_id
      and v_existing.selection_mode = p_selection_mode
      and v_existing.revoked_at is null
    then
      return query select
        v_existing.id,
        v_existing.freight_decision_id,
        v_existing.freight_request_id,
        v_existing.offer_id,
        v_existing.carrier_id,
        v_existing.carrier_service_id,
        coalesce((select co.provider_offer_reference from public.carrier_offers co where co.id = v_existing.offer_id), ''),
        v_existing.authorization_kind,
        v_existing.selection_mode,
        v_existing.booking_idempotency_key,
        v_existing.expires_at,
        true;
      return;
    end if;
    raise exception 'IDEMPOTENCY_CONFLICT: booking idempotency key was already used with a different selection'
      using errcode = 'P0001';
  end if;

  select * into v_request
  from public.freight_requests fr
  where fr.id = p_freight_request_id;
  if not found then
    raise exception 'FREIGHT_REQUEST_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_request.status <> 'AWAITING_SELECTION' then
    raise exception 'FREIGHT_REQUEST_NOT_READY_FOR_BOOKING' using errcode = '55000';
  end if;

  select * into v_member
  from public.organization_members om
  where om.id = p_selected_by_member_id
    and om.organization_id = v_request.organization_id
    and om.status = 'ACTIVE';
  if not found then
    raise exception 'AUTHORIZATION_MEMBER_MISMATCH' using errcode = '42501';
  end if;

  select * into v_offer
  from public.carrier_offers co
  where co.id = p_offer_id
    and co.freight_request_id = p_freight_request_id
    and co.status = 'ELIGIBLE'
    and co.valid_until > now();
  if not found or v_offer.carrier_service_id is null or v_offer.provider_offer_reference is null then
    raise exception 'BOOKING_OFFER_NOT_ELIGIBLE' using errcode = '22023';
  end if;

  select * into v_decision
  from public.freight_decisions fd
  where fd.freight_request_id = p_freight_request_id
  order by fd.decision_version desc
  limit 1;
  if not found then
    raise exception 'FREIGHT_DECISION_NOT_FOUND' using errcode = 'P0002';
  end if;

  if p_selection_mode = 'SMART_AUTO' then
    select * into v_preferences
    from public.organization_preferences op
    where op.organization_id = v_request.organization_id;
    if not found or not v_preferences.allow_auto_booking or v_member.role not in ('OWNER', 'SUPERVISOR') then
      raise exception 'SMART_AUTO_NOT_AUTHORIZED' using errcode = '42501';
    end if;
    if v_decision.recommended_offer_id is distinct from p_offer_id then
      raise exception 'SMART_AUTO_REQUIRES_RECOMMENDED_OFFER' using errcode = '22023';
    end if;
    v_authorization_kind := 'AUTO_BOOKING_POLICY';
  else
    v_authorization_kind := 'HUMAN_SELECTION';
  end if;

  update public.freight_decisions fd
  set selected_offer_id = p_offer_id,
      selection_mode = p_selection_mode,
      selected_by_member_id = p_selected_by_member_id,
      selected_at = now()
  where fd.id = v_decision.id;

  insert into public.booking_authorizations (
    organization_id, freight_request_id, freight_decision_id, offer_id,
    carrier_id, carrier_service_id, selected_by_member_id, selection_mode,
    authorization_kind, booking_idempotency_key
  ) values (
    v_request.organization_id, p_freight_request_id, v_decision.id, p_offer_id,
    v_offer.carrier_id, v_offer.carrier_service_id, p_selected_by_member_id, p_selection_mode,
    v_authorization_kind, p_booking_idempotency_key
  ) returning * into v_authorization;

  update public.freight_requests fr
  set status = 'BOOKING', updated_at = now()
  where fr.id = p_freight_request_id;

  return query select
    v_authorization.id,
    v_authorization.freight_decision_id,
    v_authorization.freight_request_id,
    v_authorization.offer_id,
    v_authorization.carrier_id,
    v_authorization.carrier_service_id,
    v_offer.provider_offer_reference,
    v_authorization.authorization_kind,
    v_authorization.selection_mode,
    v_authorization.booking_idempotency_key,
    v_authorization.expires_at,
    false;
end;
$$;

create or replace function public.assert_booking_bridge_identity(
  p_authorization public.booking_authorizations,
  p_canonical_payload jsonb,
  p_tool_name text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_carrier public.carriers%rowtype;
  v_service public.carrier_services%rowtype;
  v_cargomesh_origin text;
  v_provider_url text;
  v_navigation_url text;
  v_navigation_base text;
  v_navigation_fragment text;
  v_expected_navigation_url text;
begin
  if jsonb_typeof(p_canonical_payload) <> 'object'
    or p_canonical_payload ->> 'authorizationReference' is distinct from p_authorization.id::text
    or p_canonical_payload ->> 'freightRequestId' is distinct from p_authorization.freight_request_id::text
    or p_canonical_payload ->> 'offerId' is distinct from p_authorization.offer_id::text
    or p_canonical_payload ->> 'carrierId' is distinct from p_authorization.carrier_id::text
    or p_canonical_payload ->> 'matchingServiceId' is distinct from p_authorization.carrier_service_id::text
    or p_canonical_payload ->> 'toolName' is distinct from p_tool_name
  then
    raise exception 'BOOKING_AUTHORIZATION_CORRELATION_ERROR' using errcode = '22023';
  end if;

  select * into v_carrier from public.carriers c where c.id = p_authorization.carrier_id;
  select * into v_service from public.carrier_services cs where cs.id = p_authorization.carrier_service_id and cs.carrier_id = p_authorization.carrier_id and cs.active = true;
  if not found or v_carrier.provider_url is null or btrim(v_carrier.provider_url) = '' then
    raise exception 'BOOKING_PROVIDER_NOT_REGISTERED' using errcode = '22023';
  end if;

  v_cargomesh_origin := p_canonical_payload ->> 'cargomeshOrigin';
  v_provider_url := p_canonical_payload ->> 'providerUrl';
  v_navigation_url := p_canonical_payload ->> 'navigationUrl';
  if v_cargomesh_origin is null
    or v_cargomesh_origin !~ '^https?://[^/?#]+$'
    or v_provider_url is distinct from v_carrier.provider_url
    or v_navigation_url is null
    or v_navigation_url !~ '^https?://'
    or v_carrier.provider_url ~ '[?&]serviceId='
  then
    raise exception 'INVALID_BOOKING_PROVIDER_NAVIGATION' using errcode = '22023';
  end if;

  v_navigation_base := case
    when left(v_carrier.provider_url, 1) = '/' then v_cargomesh_origin || v_carrier.provider_url
    else v_carrier.provider_url
  end;
  if v_navigation_base ~ '^https?://[^/?#]+([?#]|$)' then
    v_navigation_base := pg_catalog.regexp_replace(v_navigation_base, '^(https?://[^/?#]+)([?#]|$)', E'\\1/\\2');
  end if;
  v_navigation_fragment := coalesce(substring(v_navigation_base from '(#.*)$'), '');
  v_navigation_base := split_part(v_navigation_base, '#', 1);
  v_expected_navigation_url := v_navigation_base
    || case when position('?' in v_navigation_base) > 0 then '&' else '?' end
    || 'serviceId=' || p_authorization.carrier_service_id::text
    || v_navigation_fragment;
  if v_navigation_url <> v_expected_navigation_url
    or (select count(*) from pg_catalog.regexp_matches(v_navigation_url, '[?&]serviceId=', 'g')) <> 1
  then
    raise exception 'INVALID_BOOKING_PROVIDER_NAVIGATION' using errcode = '22023';
  end if;
end;
$$;

-- The booking/status RPCs are defined above to keep their public signatures
-- stable.  Replace them after the shared identity guard is available.
create or replace function public.record_provider_booking_result(
  p_bridge_call_id text,
  p_authorization_reference uuid,
  p_canonical_payload jsonb,
  p_provider_reference text,
  p_provider_booking_status text,
  p_provider_response_deadline timestamptz,
  p_payment_required boolean,
  p_payment_url text,
  p_provider_idempotent_replay boolean
)
returns table (booking_id uuid, result_status text, deduplicated boolean)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_authorization public.booking_authorizations%rowtype;
  v_existing_call public.booking_bridge_calls%rowtype;
  v_existing_booking public.bookings%rowtype;
  v_booking public.bookings%rowtype;
  v_offer_reference text;
  v_booking_status text;
begin
  if p_bridge_call_id is null or btrim(p_bridge_call_id) = ''
    or p_provider_reference is null or btrim(p_provider_reference) = ''
    or p_provider_booking_status not in ('PENDING_PROVIDER_CONFIRMATION', 'CONFIRMED', 'REJECTED', 'EXPIRED', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED')
    or p_provider_response_deadline is null or jsonb_typeof(p_canonical_payload) <> 'object'
  then raise exception 'INVALID_BOOKING_PROVIDER_RESULT' using errcode = '22023'; end if;

  select * into v_existing_call from public.booking_bridge_calls bbc where bbc.bridge_call_id = p_bridge_call_id;
  if found then
    if v_existing_call.tool_name = 'book_freight' and v_existing_call.canonical_payload = p_canonical_payload then
      return query select v_existing_call.booking_id, 'DEDUPLICATED'::text, true; return;
    end if;
    raise exception 'IDEMPOTENCY_CONFLICT: bridge_call_id was already used with a different payload' using errcode = 'P0001';
  end if;

  select * into v_authorization from public.booking_authorizations ba where ba.id = p_authorization_reference for update;
  if not found then raise exception 'BOOKING_AUTHORIZATION_NOT_FOUND' using errcode = 'P0002'; end if;
  if v_authorization.revoked_at is not null or v_authorization.expires_at <= now() then raise exception 'BOOKING_AUTHORIZATION_EXPIRED' using errcode = '55000'; end if;
  perform public.assert_booking_bridge_identity(v_authorization, p_canonical_payload, 'book_freight');
  select co.provider_offer_reference into v_offer_reference from public.carrier_offers co where co.id = v_authorization.offer_id;
  if p_canonical_payload #>> '{toolInput,freight_request_id}' is distinct from v_authorization.freight_request_id::text
    or p_canonical_payload #>> '{toolInput,provider_offer_reference}' is distinct from v_offer_reference
    or p_canonical_payload #>> '{toolInput,idempotency_key}' is distinct from v_authorization.booking_idempotency_key
    or p_canonical_payload #>> '{toolInput,authorization_context,authorization_reference}' is distinct from v_authorization.id::text
    or p_canonical_payload #>> '{toolInput,authorization_context,authorized_by}' is distinct from v_authorization.authorization_kind
    or p_canonical_payload #>> '{toolInput,selection_mode}' is distinct from v_authorization.selection_mode
    or p_canonical_payload #>> '{toolOutput,data,freightRequestId}' is distinct from v_authorization.freight_request_id::text
    or p_canonical_payload #>> '{toolOutput,data,providerOfferReference}' is distinct from v_offer_reference
    or p_canonical_payload #>> '{toolOutput,data,providerReference}' is distinct from p_provider_reference
    or p_canonical_payload #>> '{toolOutput,data,providerBookingStatus}' is distinct from p_provider_booking_status
    or (p_canonical_payload #>> '{toolOutput,data,providerResponseDeadline}')::timestamptz is distinct from p_provider_response_deadline
    or (p_canonical_payload #>> '{toolOutput,data,idempotentReplay}')::boolean is distinct from p_provider_idempotent_replay
  then raise exception 'BOOKING_AUTHORIZATION_CORRELATION_ERROR' using errcode = '22023'; end if;

  select * into v_existing_booking from public.bookings b where b.idempotency_key = v_authorization.booking_idempotency_key;
  if found then
    if v_existing_booking.freight_request_id = v_authorization.freight_request_id and v_existing_booking.offer_id = v_authorization.offer_id and v_existing_booking.carrier_id = v_authorization.carrier_id and v_existing_booking.provider_reference = p_provider_reference and v_existing_booking.provider_response_deadline = p_provider_response_deadline then
      insert into public.booking_bridge_calls (bridge_call_id, authorization_id, booking_id, tool_name, canonical_payload) values (p_bridge_call_id, v_authorization.id, v_existing_booking.id, 'book_freight', p_canonical_payload);
      return query select v_existing_booking.id, 'DEDUPLICATED'::text, true; return;
    end if;
    raise exception 'IDEMPOTENCY_CONFLICT: booking idempotency key has a different provider result' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.bookings b where b.freight_request_id = v_authorization.freight_request_id and b.status in ('PENDING_PROVIDER_CONFIRMATION', 'CONFIRMED', 'IN_TRANSIT')) then
    raise exception 'BOOKING_ALREADY_EXISTS: active booking already exists for this FreightRequest' using errcode = '23505';
  end if;

  v_booking_status := case p_provider_booking_status when 'DELIVERED' then 'COMPLETED' else p_provider_booking_status end;
  insert into public.bookings (freight_request_id, carrier_id, offer_id, provider_reference, status, freight_decision_id, provider_booking_status, idempotency_key, provider_response_deadline, authorization_context, selection_mode, selected_by_member_id, replaces_booking_id, payment_mode, payment_status, payment_url, confirmed_at, rejected_at, expired_at, cancelled_at, updated_at)
  values (v_authorization.freight_request_id, v_authorization.carrier_id, v_authorization.offer_id, p_provider_reference, v_booking_status, v_authorization.freight_decision_id, p_provider_booking_status, v_authorization.booking_idempotency_key, p_provider_response_deadline, jsonb_build_object('authorizationReference', v_authorization.id, 'authorizedBy', v_authorization.authorization_kind), v_authorization.selection_mode, v_authorization.selected_by_member_id, v_authorization.replaces_booking_id, case when p_payment_required then 'EXTERNAL_CHECKOUT' else 'INVOICE' end, case when p_payment_required then 'PENDING' else 'NOT_REQUIRED' end, p_payment_url, case when p_provider_booking_status = 'CONFIRMED' then now() else null end, case when p_provider_booking_status = 'REJECTED' then now() else null end, case when p_provider_booking_status = 'EXPIRED' then now() else null end, case when p_provider_booking_status = 'CANCELLED' then now() else null end, now())
  returning * into v_booking;
  insert into public.booking_events (booking_id, provider_event_id, event_type, provider_booking_status, payload, occurred_at) values (v_booking.id, 'booking-bridge:' || p_bridge_call_id, 'BOOKING_REQUESTED', p_provider_booking_status, jsonb_build_object('providerReference', p_provider_reference, 'paymentRequired', p_payment_required, 'paymentUrl', p_payment_url, 'providerIdempotentReplay', p_provider_idempotent_replay), now());
  insert into public.booking_bridge_calls (bridge_call_id, authorization_id, booking_id, tool_name, canonical_payload) values (p_bridge_call_id, v_authorization.id, v_booking.id, 'book_freight', p_canonical_payload);
  update public.booking_authorizations ba set consumed_booking_id = v_booking.id, updated_at = now() where ba.id = v_authorization.id;
  update public.freight_requests fr set status = case when v_booking.status = 'CONFIRMED' then 'BOOKED' else 'BOOKING' end, updated_at = now() where fr.id = v_authorization.freight_request_id;
  return query select v_booking.id, 'INSERTED'::text, false;
end;
$$;

create or replace function public.record_provider_booking_status(
  p_bridge_call_id text,
  p_authorization_reference uuid,
  p_booking_id uuid,
  p_canonical_payload jsonb,
  p_provider_reference text,
  p_provider_booking_status text,
  p_payment_status text,
  p_events jsonb
)
returns table (booking_id uuid, result_status text, deduplicated boolean)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_authorization public.booking_authorizations%rowtype;
  v_booking public.bookings%rowtype;
  v_existing_call public.booking_bridge_calls%rowtype;
  v_event jsonb;
  v_event_id text;
  v_event_type text;
  v_event_status text;
  v_event_occurred_at timestamptz;
  v_status text;
begin
  if p_bridge_call_id is null or btrim(p_bridge_call_id) = ''
    or p_provider_reference is null or btrim(p_provider_reference) = ''
    or p_provider_booking_status not in ('PENDING_PROVIDER_CONFIRMATION', 'CONFIRMED', 'REJECTED', 'EXPIRED', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED')
    or p_payment_status not in ('NOT_REQUIRED', 'PENDING', 'PAID', 'FAILED', 'REFUNDED')
    or jsonb_typeof(p_canonical_payload) <> 'object'
    or jsonb_typeof(p_events) <> 'array'
  then
    raise exception 'INVALID_BOOKING_PROVIDER_STATUS' using errcode = '22023';
  end if;

  select * into v_existing_call from public.booking_bridge_calls where bridge_call_id = p_bridge_call_id;
  if found then
    if v_existing_call.tool_name = 'get_provider_booking_status' and v_existing_call.canonical_payload = p_canonical_payload then
      return query select v_existing_call.booking_id, 'DEDUPLICATED'::text, true;
      return;
    end if;
    raise exception 'IDEMPOTENCY_CONFLICT: bridge_call_id was already used with a different payload'
      using errcode = 'P0001';
  end if;

  select * into v_authorization from public.booking_authorizations ba where ba.id = p_authorization_reference;
  if not found then
    raise exception 'BOOKING_AUTHORIZATION_NOT_FOUND' using errcode = 'P0002';
  end if;
  perform public.assert_booking_bridge_identity(v_authorization, p_canonical_payload, 'get_provider_booking_status');
  if p_canonical_payload ->> 'bookingId' is distinct from p_booking_id::text
    or p_canonical_payload #>> '{toolInput,provider_reference}' is distinct from p_provider_reference
    or p_canonical_payload #>> '{toolOutput,data,providerReference}' is distinct from p_provider_reference
    or p_canonical_payload #>> '{toolOutput,data,providerBookingStatus}' is distinct from p_provider_booking_status
    or p_canonical_payload #>> '{toolOutput,data,paymentStatus}' is distinct from p_payment_status
  then
    raise exception 'BOOKING_STATUS_CORRELATION_ERROR' using errcode = '22023';
  end if;
  select * into v_booking from public.bookings b where b.id = p_booking_id for update;
  if not found or v_booking.freight_request_id <> v_authorization.freight_request_id
    or v_booking.provider_reference <> p_provider_reference then
    raise exception 'BOOKING_STATUS_CORRELATION_ERROR' using errcode = '22023';
  end if;

  for v_event in select value from jsonb_array_elements(p_events)
  loop
    if jsonb_typeof(v_event) <> 'object' then
      raise exception 'INVALID_PROVIDER_EVENT' using errcode = '22023';
    end if;
    v_event_id := v_event ->> 'providerEventId';
    v_event_type := v_event ->> 'eventType';
    v_event_status := v_event ->> 'providerBookingStatus';
    begin
      v_event_occurred_at := (v_event ->> 'occurredAt')::timestamptz;
    exception when others then
      raise exception 'INVALID_PROVIDER_EVENT' using errcode = '22023';
    end;
    if v_event_id is null or btrim(v_event_id) = '' or v_event_type is null or btrim(v_event_type) = ''
      or v_event_status not in ('PENDING_PROVIDER_CONFIRMATION', 'CONFIRMED', 'REJECTED', 'EXPIRED', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED') then
      raise exception 'INVALID_PROVIDER_EVENT' using errcode = '22023';
    end if;
    insert into public.booking_events (
      booking_id, provider_event_id, event_type, provider_booking_status, payload, occurred_at
    ) values (
      v_booking.id, v_event_id, v_event_type, v_event_status,
      jsonb_build_object('location', v_event -> 'location', 'description', v_event ->> 'description'),
      v_event_occurred_at
    ) on conflict on constraint booking_events_provider_event_unique do nothing;
  end loop;

  v_status := case p_provider_booking_status when 'DELIVERED' then 'COMPLETED' else p_provider_booking_status end;
  update public.bookings
  set provider_booking_status = p_provider_booking_status,
      status = v_status,
      payment_status = p_payment_status,
      confirmed_at = case when p_provider_booking_status = 'CONFIRMED' then coalesce(confirmed_at, now()) else confirmed_at end,
      rejected_at = case when p_provider_booking_status = 'REJECTED' then coalesce(rejected_at, now()) else rejected_at end,
      expired_at = case when p_provider_booking_status = 'EXPIRED' then coalesce(expired_at, now()) else expired_at end,
      cancelled_at = case when p_provider_booking_status = 'CANCELLED' then coalesce(cancelled_at, now()) else cancelled_at end,
      updated_at = now()
  where id = v_booking.id
  returning * into v_booking;

  insert into public.booking_bridge_calls (bridge_call_id, authorization_id, booking_id, tool_name, canonical_payload)
  values (p_bridge_call_id, v_authorization.id, v_booking.id, 'get_provider_booking_status', p_canonical_payload);

  update public.freight_requests
  set status = case
    when v_booking.status = 'CONFIRMED' then 'BOOKED'
    when v_booking.status in ('REJECTED', 'EXPIRED', 'CANCELLED') then 'AWAITING_SELECTION'
    else 'BOOKING'
  end,
  updated_at = now()
  where id = v_booking.freight_request_id;

  return query select v_booking.id, 'INSERTED'::text, false;
end;
$$;

revoke execute on function public.prepare_booking_authorization(uuid, uuid, uuid, text, text) from public, anon, authenticated;
revoke execute on function public.assert_booking_bridge_identity(public.booking_authorizations, jsonb, text) from public, anon, authenticated;
revoke execute on function public.record_provider_booking_result(text, uuid, jsonb, text, text, timestamptz, boolean, text, boolean) from public, anon, authenticated;
revoke execute on function public.record_provider_booking_status(text, uuid, uuid, jsonb, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.prepare_booking_authorization(uuid, uuid, uuid, text, text) to service_role;
grant execute on function public.assert_booking_bridge_identity(public.booking_authorizations, jsonb, text) to service_role;
grant execute on function public.record_provider_booking_result(text, uuid, jsonb, text, text, timestamptz, boolean, text, boolean) to service_role;
grant execute on function public.record_provider_booking_status(text, uuid, uuid, jsonb, text, text, text, jsonb) to service_role;

alter table public.booking_authorizations
  add column replaces_booking_id uuid references public.bookings(id) on delete restrict;

create index booking_authorizations_replaces_idx
  on public.booking_authorizations (replaces_booking_id)
  where replaces_booking_id is not null;

create or replace function public.prepare_booking_recovery(
  p_replaces_booking_id uuid,
  p_replacement_offer_id uuid,
  p_selected_by_member_id uuid,
  p_selection_mode text,
  p_booking_idempotency_key text
)
returns table (
  authorization_reference uuid,
  freight_decision_id uuid,
  freight_request_id uuid,
  offer_id uuid,
  carrier_id uuid,
  matching_service_id uuid,
  provider_offer_reference text,
  authorization_kind text,
  selection_mode text,
  booking_idempotency_key text,
  expires_at timestamptz,
  deduplicated boolean
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_replaced_booking public.bookings%rowtype;
  v_authorization public.booking_authorizations%rowtype;
begin
  select * into v_authorization
  from public.booking_authorizations ba
  where ba.booking_idempotency_key = p_booking_idempotency_key;
  if found then
    if v_authorization.replaces_booking_id = p_replaces_booking_id
      and v_authorization.offer_id = p_replacement_offer_id
      and v_authorization.selected_by_member_id is not distinct from p_selected_by_member_id
      and v_authorization.selection_mode = p_selection_mode
    then
      return query
      select
        v_authorization.id,
        v_authorization.freight_decision_id,
        v_authorization.freight_request_id,
        v_authorization.offer_id,
        v_authorization.carrier_id,
        v_authorization.carrier_service_id,
        o.provider_offer_reference,
        v_authorization.authorization_kind,
        v_authorization.selection_mode,
        v_authorization.booking_idempotency_key,
        v_authorization.expires_at,
        true
      from public.carrier_offers o
      where o.id = v_authorization.offer_id;
      return;
    end if;

    raise exception 'IDEMPOTENCY_CONFLICT: booking recovery key was already used with a different selection'
      using errcode = 'P0001';
  end if;

  select * into v_replaced_booking
  from public.bookings b
  where b.id = p_replaces_booking_id
  for update;
  if not found then
    raise exception 'BOOKING_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_replaced_booking.status not in ('REJECTED', 'EXPIRED', 'CANCELLED') then
    raise exception 'BOOKING_NOT_RECOVERABLE' using errcode = '55000';
  end if;

  return query
  select * from public.prepare_booking_authorization(
    v_replaced_booking.freight_request_id,
    p_replacement_offer_id,
    p_selected_by_member_id,
    p_selection_mode,
    p_booking_idempotency_key
  );

  select * into v_authorization
  from public.booking_authorizations ba
  where ba.booking_idempotency_key = p_booking_idempotency_key;
  update public.booking_authorizations ba
  set replaces_booking_id = p_replaces_booking_id,
      updated_at = now()
  where ba.id = v_authorization.id;
  update public.bookings b
  set status = 'REBOOKED', updated_at = now()
  where b.id = p_replaces_booking_id;
end;
$$;

create or replace function public.reset_demo_booking_runtime(
  p_freight_request_id uuid
)
returns table (
  freight_request_id uuid,
  deleted_bookings integer,
  deleted_authorizations integer
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_request public.freight_requests%rowtype;
  v_deleted_authorizations integer := 0;
  v_deleted_bookings integer := 0;
begin
  select * into v_request
  from public.freight_requests fr
  where fr.id = p_freight_request_id
  for update;
  if not found then
    raise exception 'FREIGHT_REQUEST_NOT_FOUND' using errcode = 'P0002';
  end if;
  -- This endpoint is intentionally for the reproducible demo only. It cannot
  -- erase booking history from an arbitrary tenant request.
  if v_request.code <> 'FR-1042' then
    raise exception 'DEMO_RUNTIME_ONLY' using errcode = '42501';
  end if;

  delete from public.booking_authorizations ba
  where ba.freight_request_id = p_freight_request_id;
  get diagnostics v_deleted_authorizations = row_count;

  delete from public.bookings b
  where b.freight_request_id = p_freight_request_id;
  get diagnostics v_deleted_bookings = row_count;

  update public.freight_decisions fd
  set selected_offer_id = null,
      selection_mode = null,
      selected_by_member_id = null,
      selected_at = null
  where fd.freight_request_id = p_freight_request_id;
  update public.freight_requests fr
  set status = case
    when exists (select 1 from public.freight_decisions fd where fd.freight_request_id = p_freight_request_id)
      then 'AWAITING_SELECTION'
    else 'PENDING'
  end,
  updated_at = now()
  where fr.id = p_freight_request_id;

  return query select p_freight_request_id, v_deleted_bookings, v_deleted_authorizations;
end;
$$;

revoke execute on function public.prepare_booking_recovery(uuid, uuid, uuid, text, text) from public, anon, authenticated;
revoke execute on function public.reset_demo_booking_runtime(uuid) from public, anon, authenticated;
grant execute on function public.prepare_booking_recovery(uuid, uuid, uuid, text, text) to service_role;
grant execute on function public.reset_demo_booking_runtime(uuid) to service_role;
