-- C-02 Result Bridge and Decision Engine persistence contract.
-- Both RPCs are intentionally service-role-only and SECURITY INVOKER. The
-- Next.js server validates the authenticated organization member before using
-- its isolated admin client, while these functions provide database atomicity.

alter table public.orchestration_events
  add column if not exists schema_version text,
  add column if not exists started_at timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists idempotency_payload jsonb;

alter table public.orchestration_events
  drop constraint if exists orchestration_events_schema_version_check;
alter table public.orchestration_events
  add constraint orchestration_events_schema_version_check
  check (schema_version is null or schema_version = '1.0');

alter table public.orchestration_events
  drop constraint if exists orchestration_events_tool_timeline_check;
alter table public.orchestration_events
  add constraint orchestration_events_tool_timeline_check
  check (
    started_at is null
    or completed_at is null
    or completed_at >= started_at
  );

create or replace function public.record_provider_result(
  p_tool_call_id text,
  p_orchestration_run_id uuid,
  p_freight_request_id uuid,
  p_carrier_id uuid,
  p_provider_url text,
  p_tool_name text,
  p_tool_input jsonb,
  p_tool_output jsonb,
  p_started_at timestamptz,
  p_completed_at timestamptz,
  p_schema_version text
)
returns table (
  event_id uuid,
  record_id uuid,
  record_type text,
  result_status text,
  deduplicated boolean
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_run public.orchestration_runs%rowtype;
  v_request public.freight_requests%rowtype;
  v_carrier public.carriers%rowtype;
  v_event public.orchestration_events%rowtype;
  v_existing_offer public.carrier_offers%rowtype;
  v_offer public.carrier_offers%rowtype;
  v_idempotency_payload jsonb;
  v_quote jsonb;
  v_duration_ms integer;
  v_availability_score numeric(5,2);
  v_reliability_score numeric(5,2) := 0;
  v_route_operations integer := 0;
  v_organization_history_score numeric(5,2) := 50;
  v_historical_average numeric(14,2);
  v_org_completed integer := 0;
  v_org_successful integer := 0;
begin
  if p_tool_call_id is null or btrim(p_tool_call_id) = '' then
    raise exception 'INVALID_ARGUMENT: tool_call_id is required' using errcode = '22023';
  end if;
  if p_schema_version <> '1.0' then
    raise exception 'UNSUPPORTED_SCHEMA_VERSION: expected 1.0' using errcode = '22023';
  end if;
  if p_tool_name <> 'quote_freight' then
    raise exception 'UNSUPPORTED_TOOL: only quote_freight is accepted by C-02' using errcode = '22023';
  end if;
  if p_completed_at < p_started_at then
    raise exception 'INVALID_TIMELINE: completed_at precedes started_at' using errcode = '22023';
  end if;
  if jsonb_typeof(p_tool_input) <> 'object'
    or p_tool_input ->> 'freight_request_id' is distinct from p_freight_request_id::text
  then
    raise exception 'CORRELATION_ERROR: tool input does not belong to freight request'
      using errcode = '22023';
  end if;

  -- Serialize the same tool call so a concurrent retry always observes the
  -- first committed event before mutable run state is evaluated.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_tool_call_id, 0)
  );

  select * into v_run
  from public.orchestration_runs
  where id = p_orchestration_run_id;

  if not found then
    raise exception 'ORCHESTRATION_RUN_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_run.freight_request_id <> p_freight_request_id then
    raise exception 'CORRELATION_ERROR: run does not belong to freight request' using errcode = '22023';
  end if;
  select * into v_request
  from public.freight_requests
  where id = p_freight_request_id;

  if not found then
    raise exception 'FREIGHT_REQUEST_NOT_FOUND' using errcode = 'P0002';
  end if;

  v_idempotency_payload := jsonb_build_object(
    'toolCallId', p_tool_call_id,
    'orchestrationRunId', p_orchestration_run_id,
    'freightRequestId', p_freight_request_id,
    'carrierId', p_carrier_id,
    'providerUrl', p_provider_url,
    'toolName', p_tool_name,
    'toolInput', coalesce(p_tool_input, 'null'::jsonb),
    'toolOutput', coalesce(p_tool_output, 'null'::jsonb),
    'startedAt', p_started_at,
    'completedAt', p_completed_at,
    'schemaVersion', p_schema_version
  );

  -- Idempotency is stable across the run lifecycle. An exact retry must keep
  -- succeeding after OPTIONS_READY/NO_MATCH; a changed payload must conflict.
  select * into v_event
  from public.orchestration_events
  where tool_call_id = p_tool_call_id;

  if found then
    if v_event.idempotency_payload = v_idempotency_payload then
      return query select
        v_event.id,
        v_event.persisted_entity_id,
        v_event.persisted_entity_type,
        'DEDUPLICATED'::text,
        true;
      return;
    end if;

    raise exception 'IDEMPOTENCY_CONFLICT: tool_call_id was already used with a different payload'
      using errcode = 'P0001';
  end if;

  if v_run.status <> 'RUNNING' then
    raise exception 'RUN_NOT_ACTIVE: orchestration run must be RUNNING' using errcode = '55000';
  end if;

  select * into v_carrier
  from public.carriers
  where id = p_carrier_id
    and status = 'ACTIVE'
    and supports_webmcp = true;

  if not found then
    raise exception 'CARRIER_NOT_AVAILABLE' using errcode = 'P0002';
  end if;
  if v_carrier.provider_url is distinct from p_provider_url then
    raise exception 'PROVIDER_URL_MISMATCH' using errcode = '22023';
  end if;

  v_duration_ms := greatest(
    0,
    floor(extract(epoch from (p_completed_at - p_started_at)) * 1000)::integer
  );

  begin
    insert into public.orchestration_events (
      orchestration_run_id,
      carrier_id,
      provider_url,
      event_type,
      tool_name,
      tool_call_id,
      input_payload,
      output_payload,
      status,
      duration_ms,
      schema_version,
      started_at,
      completed_at,
      idempotency_payload
    ) values (
      p_orchestration_run_id,
      p_carrier_id,
      p_provider_url,
      'PROVIDER_TOOL_RESULT_RECORDED',
      p_tool_name,
      p_tool_call_id,
      p_tool_input,
      p_tool_output,
      case when coalesce((p_tool_output ->> 'ok')::boolean, false) then 'SUCCEEDED' else 'FAILED' end,
      v_duration_ms,
      p_schema_version,
      p_started_at,
      p_completed_at,
      v_idempotency_payload
    )
    returning * into v_event;
  exception when unique_violation then
    select * into v_event
    from public.orchestration_events
    where tool_call_id = p_tool_call_id;

    if found and v_event.idempotency_payload = v_idempotency_payload then
      return query select
        v_event.id,
        v_event.persisted_entity_id,
        v_event.persisted_entity_type,
        'DEDUPLICATED'::text,
        true;
      return;
    end if;

    raise exception 'IDEMPOTENCY_CONFLICT: tool_call_id was already used with a different payload'
      using errcode = 'P0001';
  end;

  if jsonb_typeof(p_tool_output) <> 'object' or not (p_tool_output ? 'ok') then
    raise exception 'INVALID_TOOL_ENVELOPE' using errcode = '22023';
  end if;

  if not (p_tool_output ->> 'ok')::boolean then
    return query select v_event.id, null::uuid, null::text, 'INSERTED'::text, false;
    return;
  end if;

  v_quote := p_tool_output -> 'data';
  if jsonb_typeof(v_quote) <> 'object'
    or v_quote ->> 'schemaVersion' <> p_schema_version
    or v_quote ->> 'freightRequestId' <> p_freight_request_id::text
    or coalesce(v_quote ->> 'providerOfferReference', '') = ''
    or coalesce(v_quote ->> 'currency', '') <> 'USD'
    or (v_quote ->> 'price')::numeric <= 0
    or (v_quote ->> 'transitHours')::numeric <= 0
    or (v_quote ->> 'availableCapacityKg')::numeric < 0
    or v_quote ->> 'availabilityClass' not in (
      'EXACT_CONFIRMED_SLOT',
      'AVAILABLE_IN_WINDOW',
      'LIMITED_WINDOW',
      'WAITLIST',
      'UNAVAILABLE'
    )
  then
    raise exception 'INVALID_PROVIDER_QUOTE' using errcode = '22023';
  end if;

  if (v_quote ->> 'estimatedDelivery')::timestamptz < (v_quote ->> 'estimatedPickup')::timestamptz then
    raise exception 'INVALID_PROVIDER_QUOTE_TIMELINE' using errcode = '22023';
  end if;

  v_availability_score := case v_quote ->> 'availabilityClass'
    when 'EXACT_CONFIRMED_SLOT' then 100
    when 'AVAILABLE_IN_WINDOW' then 90
    when 'LIMITED_WINDOW' then 60
    when 'WAITLIST' then 30
    else 0
  end;

  select
    cm.success_rate,
    cm.route_completed_freight_requests,
    coalesce(cm.average_route_cost, cm.avg_cost)
  into
    v_reliability_score,
    v_route_operations,
    v_historical_average
  from public.carrier_metrics cm
  where cm.carrier_id = p_carrier_id
    and cm.organization_id is null
    and cm.transport_mode = v_request.transport_mode
    and cm.origin_country = v_request.origin_country
    and cm.origin_city = v_request.origin_city
    and cm.destination_country = v_request.destination_country
    and cm.destination_city = v_request.destination_city
    and (cm.cargo_category_id is null or cm.cargo_category_id = v_request.cargo_category_id)
  order by (cm.cargo_category_id = v_request.cargo_category_id) desc
  limit 1;

  v_reliability_score := coalesce(v_reliability_score, 0);
  v_route_operations := coalesce(v_route_operations, 0);

  select
    cm.organization_completed_freight_requests,
    cm.organization_successful_freight_requests
  into v_org_completed, v_org_successful
  from public.carrier_metrics cm
  where cm.carrier_id = p_carrier_id
    and cm.organization_id = v_request.organization_id
    and cm.transport_mode = v_request.transport_mode
    and cm.origin_country = v_request.origin_country
    and cm.origin_city = v_request.origin_city
    and cm.destination_country = v_request.destination_country
    and cm.destination_city = v_request.destination_city
    and (cm.cargo_category_id is null or cm.cargo_category_id = v_request.cargo_category_id)
  order by (cm.cargo_category_id = v_request.cargo_category_id) desc
  limit 1;

  if coalesce(v_org_completed, 0) > 0 then
    v_organization_history_score := least(
      100,
      greatest(0, v_org_successful::numeric / v_org_completed::numeric * 100)
    );
  end if;

  select * into v_existing_offer
  from public.carrier_offers
  where orchestration_run_id = p_orchestration_run_id
    and carrier_id = p_carrier_id
    and provider_offer_reference = v_quote ->> 'providerOfferReference';

  if found then
    if v_existing_offer.price = (v_quote ->> 'price')::numeric
      and v_existing_offer.currency = v_quote ->> 'currency'
      and v_existing_offer.transit_hours = (v_quote ->> 'transitHours')::numeric
      and v_existing_offer.availability_class = v_quote ->> 'availabilityClass'
      and v_existing_offer.quote_breakdown = coalesce(v_quote -> 'priceBreakdown', '{}'::jsonb)
    then
      update public.orchestration_events
      set persisted_entity_type = 'CARRIER_OFFER', persisted_entity_id = v_existing_offer.id
      where id = v_event.id;

      return query select
        v_event.id,
        v_existing_offer.id,
        'CARRIER_OFFER'::text,
        'DEDUPLICATED'::text,
        true;
      return;
    end if;

    raise exception 'PROVIDER_OFFER_CONFLICT: provider reference was reused with different commercial data'
      using errcode = 'P0001';
  end if;

  begin
    insert into public.carrier_offers (
    freight_request_id,
    carrier_id,
    orchestration_run_id,
    tool_call_id,
    provider_offer_reference,
    transport_mode,
    service_type,
    price,
    currency,
    quote_breakdown,
    estimated_pickup,
    estimated_delivery,
    transit_hours,
    available_capacity_kg,
    valid_until,
    availability_class,
    availability_score,
    reliability_score,
    route_operations,
    organization_history_score,
    compatibility_status,
    compatibility_notes,
    status
  ) values (
    p_freight_request_id,
    p_carrier_id,
    p_orchestration_run_id,
    p_tool_call_id,
    v_quote ->> 'providerOfferReference',
    v_request.transport_mode,
    v_request.service_type,
    (v_quote ->> 'price')::numeric,
    v_quote ->> 'currency',
    coalesce(v_quote -> 'priceBreakdown', '{}'::jsonb),
    (v_quote ->> 'estimatedPickup')::timestamptz,
    (v_quote ->> 'estimatedDelivery')::timestamptz,
    (v_quote ->> 'transitHours')::numeric,
    (v_quote ->> 'availableCapacityKg')::numeric,
    (v_quote ->> 'validUntil')::timestamptz,
    v_quote ->> 'availabilityClass',
    v_availability_score,
    v_reliability_score,
    v_route_operations,
    v_organization_history_score,
    'ELIGIBLE',
    jsonb_build_object(
      'schemaVersion', p_schema_version,
      'crossBorderSupported', coalesce((v_quote ->> 'crossBorderSupported')::boolean, false),
      'customsCoordinationIncluded', coalesce((v_quote ->> 'customsCoordinationIncluded')::boolean, false),
      'requiredDocuments', coalesce(v_quote -> 'requiredDocuments', '[]'::jsonb),
      'borderHandlingNotes', v_quote -> 'borderHandlingNotes',
      'historicalAverageRouteCost', to_jsonb(v_historical_average)
    ),
    'RECEIVED'
    )
    returning * into v_offer;
  exception when unique_violation then
    -- A concurrent retry can pass the pre-check before the first transaction commits.
    -- Resolve the winning row using the same commercial-payload rule instead of
    -- leaking a database uniqueness error or creating a second offer.
    select * into v_existing_offer
    from public.carrier_offers
    where orchestration_run_id = p_orchestration_run_id
      and carrier_id = p_carrier_id
      and provider_offer_reference = v_quote ->> 'providerOfferReference';

    if found
      and v_existing_offer.price = (v_quote ->> 'price')::numeric
      and v_existing_offer.currency = v_quote ->> 'currency'
      and v_existing_offer.transit_hours = (v_quote ->> 'transitHours')::numeric
      and v_existing_offer.availability_class = v_quote ->> 'availabilityClass'
      and v_existing_offer.quote_breakdown = coalesce(v_quote -> 'priceBreakdown', '{}'::jsonb)
    then
      update public.orchestration_events
      set persisted_entity_type = 'CARRIER_OFFER', persisted_entity_id = v_existing_offer.id
      where id = v_event.id;

      return query select
        v_event.id,
        v_existing_offer.id,
        'CARRIER_OFFER'::text,
        'DEDUPLICATED'::text,
        true;
      return;
    end if;

    raise exception 'PROVIDER_OFFER_CONFLICT: provider reference was reused with different commercial data'
      using errcode = 'P0001';
  end;

  update public.orchestration_events
  set persisted_entity_type = 'CARRIER_OFFER', persisted_entity_id = v_offer.id
  where id = v_event.id;

  return query select
    v_event.id,
    v_offer.id,
    'CARRIER_OFFER'::text,
    'INSERTED'::text,
    false;
end;
$$;

revoke execute on function public.record_provider_result(
  text, uuid, uuid, uuid, text, text, jsonb, jsonb, timestamptz, timestamptz, text
) from public, anon, authenticated;
grant execute on function public.record_provider_result(
  text, uuid, uuid, uuid, text, text, jsonb, jsonb, timestamptz, timestamptz, text
) to service_role;

create or replace function public.persist_balanced_decision(
  p_orchestration_run_id uuid,
  p_freight_request_id uuid,
  p_ranking jsonb,
  p_candidate_snapshot jsonb,
  p_confidence_score numeric,
  p_confidence_components jsonb,
  p_subscores jsonb,
  p_anomaly_evidence jsonb,
  p_recommended_offer_id uuid,
  p_requires_review boolean
)
returns table (
  decision_id uuid,
  run_status text
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_run public.orchestration_runs%rowtype;
  v_existing_decision public.freight_decisions%rowtype;
  v_decision public.freight_decisions%rowtype;
  v_previous_decision public.freight_decisions%rowtype;
  v_decision_version integer;
  v_top_raw_score numeric(8,4);
  v_option jsonb;
begin
  select * into v_run
  from public.orchestration_runs
  where id = p_orchestration_run_id;

  if not found then
    raise exception 'ORCHESTRATION_RUN_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_run.freight_request_id <> p_freight_request_id then
    raise exception 'CORRELATION_ERROR: run does not belong to freight request' using errcode = '22023';
  end if;

  select * into v_existing_decision
  from public.freight_decisions
  where orchestration_run_id = p_orchestration_run_id;

  if found then
    return query select v_existing_decision.id, 'OPTIONS_READY'::text;
    return;
  end if;

  if jsonb_typeof(p_ranking) <> 'object'
    or jsonb_typeof(p_ranking -> 'options') <> 'array'
  then
    raise exception 'INVALID_RANKING_PAYLOAD' using errcode = '22023';
  end if;

  for v_option in select value from jsonb_array_elements(p_ranking -> 'options')
  loop
    update public.carrier_offers
    set
      final_score = (v_option ->> 'rawScore')::numeric,
      status = case when (v_option ->> 'eligible')::boolean then 'ELIGIBLE' else 'INELIGIBLE' end,
      compatibility_status = case when (v_option ->> 'eligible')::boolean then 'ELIGIBLE' else 'INELIGIBLE' end
    where id = (v_option ->> 'offerId')::uuid
      and orchestration_run_id = p_orchestration_run_id;

    if not found then
      raise exception 'RANKING_OFFER_MISMATCH' using errcode = '22023';
    end if;
  end loop;

  if p_recommended_offer_id is null then
    update public.orchestration_runs
    set status = 'NO_MATCH', completed_at = now(), error_code = null, error_message = null
    where id = p_orchestration_run_id;

    update public.freight_requests
    set status = 'PENDING', updated_at = now()
    where id = p_freight_request_id;

    return query select null::uuid, 'NO_MATCH'::text;
    return;
  end if;

  if not exists (
    select 1
    from public.carrier_offers
    where id = p_recommended_offer_id
      and orchestration_run_id = p_orchestration_run_id
      and status = 'ELIGIBLE'
  ) then
    raise exception 'RECOMMENDED_OFFER_MISMATCH' using errcode = '22023';
  end if;

  select * into v_previous_decision
  from public.freight_decisions
  where freight_request_id = p_freight_request_id
  order by decision_version desc
  limit 1;

  v_decision_version := coalesce(v_previous_decision.decision_version, 0) + 1;
  v_top_raw_score := (p_ranking -> 'options' -> 0 ->> 'rawScore')::numeric;

  insert into public.freight_decisions (
    freight_request_id,
    orchestration_run_id,
    previous_decision_id,
    decision_version,
    decision_type,
    recommended_offer_id,
    optimization_strategy,
    heuristic_score,
    confidence_score,
    decision_reason,
    candidate_snapshot,
    ranking_snapshot,
    subscores,
    confidence_components,
    anomaly_evidence,
    requires_review
  ) values (
    p_freight_request_id,
    p_orchestration_run_id,
    v_previous_decision.id,
    v_decision_version,
    v_run.run_type,
    p_recommended_offer_id,
    'BALANCED',
    v_top_raw_score,
    p_confidence_score,
    'Deterministic BALANCED ranking over eligible runtime offers.',
    p_candidate_snapshot,
    p_ranking -> 'options',
    p_subscores,
    p_confidence_components,
    p_anomaly_evidence,
    p_requires_review
  )
  returning * into v_decision;

  update public.orchestration_runs
  set status = 'OPTIONS_READY', completed_at = now(), error_code = null, error_message = null
  where id = p_orchestration_run_id;

  update public.freight_requests
  set status = 'AWAITING_SELECTION', updated_at = now()
  where id = p_freight_request_id;

  return query select v_decision.id, 'OPTIONS_READY'::text;
end;
$$;

revoke execute on function public.persist_balanced_decision(
  uuid, uuid, jsonb, jsonb, numeric, jsonb, jsonb, jsonb, uuid, boolean
) from public, anon, authenticated;
grant execute on function public.persist_balanced_decision(
  uuid, uuid, jsonb, jsonb, numeric, jsonb, jsonb, jsonb, uuid, boolean
) to service_role;
