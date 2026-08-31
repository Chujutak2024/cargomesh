-- INT-02A: preserve the discovered carrier service and record every provider
-- tool call through one idempotent Result Bridge. The existing C-02 function
-- remains the quote persistence primitive; this overload adds the canonical
-- browser-runner envelope and handles coverage/capacity/technical events.

alter table public.orchestration_events
  add column if not exists carrier_service_id uuid references public.carrier_services(id),
  add column if not exists navigation_url text,
  add column if not exists attempt_number integer,
  add column if not exists execution_status text,
  add column if not exists technical_error jsonb;

alter table public.carrier_offers
  add column if not exists carrier_service_id uuid references public.carrier_services(id);

alter table public.orchestration_events
  drop constraint if exists orchestration_events_attempt_number_check;
alter table public.orchestration_events
  add constraint orchestration_events_attempt_number_check
  check (attempt_number is null or attempt_number > 0);

alter table public.orchestration_events
  drop constraint if exists orchestration_events_execution_status_check;
alter table public.orchestration_events
  add constraint orchestration_events_execution_status_check
  check (execution_status is null or execution_status in ('COMPLETED', 'TECHNICAL_ERROR'));

create index if not exists orchestration_events_carrier_service_idx
  on public.orchestration_events (carrier_service_id);
create index if not exists carrier_offers_carrier_service_idx
  on public.carrier_offers (carrier_service_id);

create or replace function public.record_provider_result(
  p_tool_call_id text,
  p_orchestration_run_id uuid,
  p_freight_request_id uuid,
  p_carrier_id uuid,
  p_carrier_service_id uuid,
  p_provider_url text,
  p_navigation_url text,
  p_tool_name text,
  p_attempt_number integer,
  p_tool_input jsonb,
  p_tool_output jsonb,
  p_started_at timestamptz,
  p_completed_at timestamptz,
  p_duration_ms integer,
  p_execution_status text,
  p_technical_error jsonb,
  p_cargomesh_origin text,
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
  v_carrier public.carriers%rowtype;
  v_service public.carrier_services%rowtype;
  v_event public.orchestration_events%rowtype;
  v_legacy_result record;
  v_idempotency_payload jsonb;
  v_output_ok boolean;
  v_registered_navigation_base text;
  v_navigation_base text;
  v_navigation_fragment text;
  v_expected_navigation_url text;
begin
  if p_tool_call_id is null or btrim(p_tool_call_id) = '' then
    raise exception 'INVALID_ARGUMENT: tool_call_id is required' using errcode = '22023';
  end if;
  if p_schema_version <> '1.0' then
    raise exception 'UNSUPPORTED_SCHEMA_VERSION: expected 1.0' using errcode = '22023';
  end if;
  if p_tool_name not in ('check_service_coverage', 'check_capacity', 'quote_freight') then
    raise exception 'UNSUPPORTED_TOOL: INT-02A provider tool is required' using errcode = '22023';
  end if;
  if p_attempt_number is null or p_attempt_number < 1 then
    raise exception 'INVALID_ATTEMPT_NUMBER' using errcode = '22023';
  end if;
  if p_completed_at < p_started_at or p_duration_ms < 0 then
    raise exception 'INVALID_TIMELINE' using errcode = '22023';
  end if;
  if p_duration_ms <> floor(extract(epoch from (p_completed_at - p_started_at)) * 1000)::integer then
    raise exception 'INVALID_DURATION' using errcode = '22023';
  end if;
  if p_execution_status not in ('COMPLETED', 'TECHNICAL_ERROR') then
    raise exception 'INVALID_EXECUTION_STATUS' using errcode = '22023';
  end if;
  if p_tool_call_id <> concat_ws(
    ':',
    'cm',
    'int02a',
    'v1',
    p_orchestration_run_id,
    p_freight_request_id,
    p_carrier_id,
    p_carrier_service_id,
    p_tool_name,
    p_attempt_number
  ) then
    raise exception 'INVALID_TOOL_CALL_ID: canonical INT-02A identity required'
      using errcode = '22023';
  end if;
  if p_execution_status = 'COMPLETED' and (p_tool_output is null or p_technical_error is not null) then
    raise exception 'INVALID_EXECUTION_RESULT: completed calls require output without technical error'
      using errcode = '22023';
  end if;
  if p_execution_status = 'TECHNICAL_ERROR' and p_technical_error is null then
    raise exception 'INVALID_EXECUTION_RESULT: technical errors require evidence'
      using errcode = '22023';
  end if;
  if jsonb_typeof(p_tool_input) <> 'object' then
    raise exception 'INVALID_TOOL_INPUT' using errcode = '22023';
  end if;
  if p_tool_name = 'quote_freight'
    and p_tool_input ->> 'freight_request_id' is distinct from p_freight_request_id::text
  then
    raise exception 'CORRELATION_ERROR: quote input does not belong to freight request'
      using errcode = '22023';
  end if;
  if p_tool_output is not null
    and (jsonb_typeof(p_tool_output) <> 'object' or not (p_tool_output ? 'ok'))
  then
    raise exception 'INVALID_TOOL_ENVELOPE' using errcode = '22023';
  end if;

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

  v_idempotency_payload := jsonb_build_object(
    'schemaVersion', p_schema_version,
    'toolCallId', p_tool_call_id,
    'orchestrationRunId', p_orchestration_run_id,
    'freightRequestId', p_freight_request_id,
    'carrierId', p_carrier_id,
    'matchingServiceId', p_carrier_service_id,
    'providerUrl', p_provider_url,
    'navigationUrl', p_navigation_url,
    'toolName', p_tool_name,
    'attemptNumber', p_attempt_number,
    'toolInput', coalesce(p_tool_input, 'null'::jsonb),
    'toolOutput', coalesce(p_tool_output, 'null'::jsonb),
    'startedAt', p_started_at,
    'completedAt', p_completed_at,
    'durationMs', p_duration_ms,
    'status', p_execution_status,
    'technicalError', coalesce(p_technical_error, 'null'::jsonb)
  );

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
  where id = p_carrier_id and status = 'ACTIVE' and supports_webmcp = true;

  if not found then
    raise exception 'CARRIER_NOT_AVAILABLE' using errcode = 'P0002';
  end if;
  if v_carrier.provider_url is distinct from p_provider_url then
    raise exception 'PROVIDER_URL_MISMATCH' using errcode = '22023';
  end if;

  select * into v_service
  from public.carrier_services
  where id = p_carrier_service_id
    and carrier_id = p_carrier_id
    and active = true
    and provider_service_code is not null;

  if not found then
    raise exception 'CARRIER_SERVICE_MISMATCH' using errcode = '22023';
  end if;

  -- Rebuild the expected URL from the registered provider URL. Internal
  -- providers must resolve against CargoMesh itself; external providers keep
  -- their own origin, pathname and every registered base query parameter.
  if p_provider_url is null
    or btrim(p_provider_url) = ''
    or v_carrier.provider_url is null
    or p_cargomesh_origin is null
    or p_cargomesh_origin !~ '^https?://[^/?#]+$'
    or p_navigation_url is null
    or btrim(p_navigation_url) = ''
    or p_navigation_url !~ '^https?://'
    or v_carrier.provider_url ~ '[?&]serviceId='
  then
    raise exception 'INVALID_PROVIDER_NAVIGATION' using errcode = '22023';
  end if;

  v_registered_navigation_base := case
    when left(v_carrier.provider_url, 1) = '/'
      then p_cargomesh_origin || v_carrier.provider_url
    else v_carrier.provider_url
  end;
  if v_registered_navigation_base ~ '^https?://[^/?#]+([?#]|$)' then
    v_registered_navigation_base := pg_catalog.regexp_replace(
      v_registered_navigation_base,
      '^(https?://[^/?#]+)([?#]|$)',
      E'\\1/\\2'
    );
  end if;
  v_navigation_fragment := coalesce(
    substring(v_registered_navigation_base from '(#.*)$'),
    ''
  );
  v_navigation_base := split_part(v_registered_navigation_base, '#', 1);
  v_expected_navigation_url := v_navigation_base
    || case when position('?' in v_navigation_base) > 0 then '&' else '?' end
    || 'serviceId=' || p_carrier_service_id::text
    || v_navigation_fragment;

  if p_navigation_url <> v_expected_navigation_url
    or (
      select count(*)
      from pg_catalog.regexp_matches(p_navigation_url, '[?&]serviceId=', 'g')
    ) <> 1
  then
    raise exception 'INVALID_PROVIDER_NAVIGATION' using errcode = '22023';
  end if;

  if p_tool_output is not null then
    v_output_ok := coalesce((p_tool_output ->> 'ok')::boolean, false);
    if v_output_ok
      and p_tool_name in ('check_service_coverage', 'check_capacity')
      and (
        jsonb_typeof(p_tool_output -> 'data') <> 'object'
        or p_tool_output -> 'data' ->> 'schemaVersion' <> p_schema_version
        or p_tool_output -> 'data' ->> 'providerServiceCode' is distinct from v_service.provider_service_code
      )
    then
      raise exception 'PROVIDER_SERVICE_CODE_MISMATCH' using errcode = '22023';
    end if;
  else
    v_output_ok := false;
  end if;

  -- Successful/error quote envelopes continue through the verified C-02 quote
  -- persistence primitive. Null technical outputs and non-quote tools create
  -- observability events only and can never create CarrierOffer rows.
  if p_tool_name = 'quote_freight' and p_tool_output is not null then
    select * into v_legacy_result
    from public.record_provider_result(
      p_tool_call_id,
      p_orchestration_run_id,
      p_freight_request_id,
      p_carrier_id,
      p_provider_url,
      p_tool_name,
      p_tool_input,
      p_tool_output,
      p_started_at,
      p_completed_at,
      p_schema_version
    );

    update public.orchestration_events
    set carrier_service_id = p_carrier_service_id,
        navigation_url = p_navigation_url,
        attempt_number = p_attempt_number,
        duration_ms = p_duration_ms,
        execution_status = p_execution_status,
        technical_error = p_technical_error,
        idempotency_payload = v_idempotency_payload
    where id = v_legacy_result.event_id;

    if v_legacy_result.record_type = 'CARRIER_OFFER' and v_legacy_result.record_id is not null then
      update public.carrier_offers
      set carrier_service_id = p_carrier_service_id
      where id = v_legacy_result.record_id;
    end if;

    return query select
      v_legacy_result.event_id::uuid,
      v_legacy_result.record_id::uuid,
      v_legacy_result.record_type::text,
      v_legacy_result.result_status::text,
      v_legacy_result.deduplicated::boolean;
    return;
  end if;

  insert into public.orchestration_events (
    orchestration_run_id,
    carrier_id,
    carrier_service_id,
    provider_url,
    navigation_url,
    event_type,
    tool_name,
    tool_call_id,
    attempt_number,
    input_payload,
    output_payload,
    status,
    duration_ms,
    execution_status,
    technical_error,
    schema_version,
    started_at,
    completed_at,
    idempotency_payload
  ) values (
    p_orchestration_run_id,
    p_carrier_id,
    p_carrier_service_id,
    p_provider_url,
    p_navigation_url,
    'PROVIDER_TOOL_RESULT_RECORDED',
    p_tool_name,
    p_tool_call_id,
    p_attempt_number,
    p_tool_input,
    p_tool_output,
    case when v_output_ok and p_execution_status = 'COMPLETED' then 'SUCCEEDED' else 'FAILED' end,
    p_duration_ms,
    p_execution_status,
    p_technical_error,
    p_schema_version,
    p_started_at,
    p_completed_at,
    v_idempotency_payload
  ) returning * into v_event;

  return query select v_event.id, null::uuid, null::text, 'INSERTED'::text, false;
end;
$$;

revoke execute on function public.record_provider_result(
  text, uuid, uuid, uuid, uuid, text, text, text, integer,
  jsonb, jsonb, timestamptz, timestamptz, integer, text, jsonb, text, text
) from public, anon, authenticated;
grant execute on function public.record_provider_result(
  text, uuid, uuid, uuid, uuid, text, text, text, integer,
  jsonb, jsonb, timestamptz, timestamptz, integer, text, jsonb, text, text
) to service_role;
