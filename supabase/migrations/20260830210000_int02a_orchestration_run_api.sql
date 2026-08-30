-- INT-02A: create an auditable, idempotent orchestration run before a
-- browser-runner executes any WebMCP provider tool. CandidateProvider keeps
-- its frozen contract; this snapshot only makes the discovered set immutable
-- for the lifecycle of one run.

alter table public.orchestration_runs
  add column if not exists idempotency_key text,
  add column if not exists candidate_snapshot jsonb not null default '[]'::jsonb,
  add column if not exists result_snapshot jsonb;

alter table public.orchestration_runs
  drop constraint if exists orchestration_runs_idempotency_key_check;
alter table public.orchestration_runs
  add constraint orchestration_runs_idempotency_key_check
  check (
    idempotency_key is null
    or (btrim(idempotency_key) <> '' and length(idempotency_key) <= 200)
  );

alter table public.orchestration_runs
  drop constraint if exists orchestration_runs_candidate_snapshot_check;
alter table public.orchestration_runs
  add constraint orchestration_runs_candidate_snapshot_check
  check (jsonb_typeof(candidate_snapshot) = 'array');

alter table public.orchestration_runs
  drop constraint if exists orchestration_runs_result_snapshot_check;
alter table public.orchestration_runs
  add constraint orchestration_runs_result_snapshot_check
  check (result_snapshot is null or jsonb_typeof(result_snapshot) = 'object');

create unique index if not exists orchestration_runs_request_idempotency_unique
  on public.orchestration_runs (freight_request_id, idempotency_key)
  where idempotency_key is not null;

create or replace function public.start_orchestration_run(
  p_freight_request_id uuid,
  p_created_by_member_id uuid,
  p_idempotency_key text,
  p_candidate_snapshot jsonb
)
returns table (
  orchestration_run_id uuid,
  freight_request_id uuid,
  status text,
  deduplicated boolean,
  candidate_snapshot jsonb
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_request public.freight_requests%rowtype;
  v_member public.organization_members%rowtype;
  v_existing public.orchestration_runs%rowtype;
  v_run public.orchestration_runs%rowtype;
begin
  if p_freight_request_id is null or p_created_by_member_id is null then
    raise exception 'INVALID_ARGUMENT: freight request and member are required'
      using errcode = '22023';
  end if;
  if p_idempotency_key is null
    or btrim(p_idempotency_key) = ''
    or length(p_idempotency_key) > 200
  then
    raise exception 'INVALID_ARGUMENT: idempotency key must be between 1 and 200 characters'
      using errcode = '22023';
  end if;
  if jsonb_typeof(p_candidate_snapshot) <> 'array' then
    raise exception 'INVALID_ARGUMENT: candidate snapshot must be an array'
      using errcode = '22023';
  end if;

  select om.* into v_member
  from public.organization_members as om
  where om.id = p_created_by_member_id
    and om.status = 'ACTIVE';

  if not found then
    raise exception 'FORBIDDEN: active organization membership is required'
      using errcode = '42501';
  end if;

  -- A replay is legal after the request advances from PENDING. Resolve it
  -- before locking or checking the mutable request state.
  select r.* into v_existing
  from public.orchestration_runs as r
  where r.freight_request_id = p_freight_request_id
    and r.idempotency_key = p_idempotency_key;

  if found then
    return query select
      v_existing.id,
      v_existing.freight_request_id,
      v_existing.status,
      true,
      v_existing.candidate_snapshot;
    return;
  end if;

  -- Serialise distinct start attempts for the same FreightRequest. The second
  -- request sees ORCHESTRATING after this lock is released and cannot create a
  -- competing initial run with another idempotency key.
  select * into v_request
  from public.freight_requests
  where id = p_freight_request_id
  for update;

  if not found then
    raise exception 'NOT_FOUND: FreightRequest not found' using errcode = 'P0002';
  end if;
  if v_request.organization_id <> v_member.organization_id then
    raise exception 'CORRELATION_ERROR: member does not belong to FreightRequest organization'
      using errcode = '22023';
  end if;

  -- Recheck after obtaining the lock, so a concurrent exact replay returns
  -- the canonical run instead of a request-state conflict.
  select r.* into v_existing
  from public.orchestration_runs as r
  where r.freight_request_id = p_freight_request_id
    and r.idempotency_key = p_idempotency_key;

  if found then
    return query select
      v_existing.id,
      v_existing.freight_request_id,
      v_existing.status,
      true,
      v_existing.candidate_snapshot;
    return;
  end if;

  if v_request.status <> 'PENDING' then
    raise exception 'FREIGHT_REQUEST_NOT_READY: expected PENDING, got %', v_request.status
      using errcode = 'P0001';
  end if;

  insert into public.orchestration_runs (
    freight_request_id,
    run_type,
    status,
    created_by_member_id,
    idempotency_key,
    candidate_snapshot
  ) values (
    p_freight_request_id,
    'INITIAL',
    'RUNNING',
    p_created_by_member_id,
    p_idempotency_key,
    p_candidate_snapshot
  )
  returning * into v_run;

  update public.freight_requests
  set status = 'ORCHESTRATING', updated_at = now()
  where id = p_freight_request_id;

  return query select
    v_run.id,
    v_run.freight_request_id,
    v_run.status,
    false,
    v_run.candidate_snapshot;
end;
$$;

revoke all on function public.start_orchestration_run(uuid, uuid, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.start_orchestration_run(uuid, uuid, text, jsonb)
  to service_role;

-- C-02 deliberately avoids a synthetic FreightDecision for NO_MATCH. Persist
-- the immutable ranking on the run as well, so the INT-02A read model can
-- explain both success and NO_MATCH without rerunning BALANCED during GET.
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
  if jsonb_typeof(p_ranking) <> 'object'
    or jsonb_typeof(p_ranking -> 'options') <> 'array'
  then
    raise exception 'INVALID_RANKING_PAYLOAD' using errcode = '22023';
  end if;

  select * into v_existing_decision
  from public.freight_decisions
  where orchestration_run_id = p_orchestration_run_id;

  if found then
    update public.orchestration_runs
    set result_snapshot = p_ranking
    where id = p_orchestration_run_id;
    return query select v_existing_decision.id, 'OPTIONS_READY'::text;
    return;
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
    set
      status = 'NO_MATCH',
      completed_at = now(),
      error_code = null,
      error_message = null,
      result_snapshot = p_ranking
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
  set
    status = 'OPTIONS_READY',
    completed_at = now(),
    error_code = null,
    error_message = null,
    result_snapshot = p_ranking
  where id = p_orchestration_run_id;

  update public.freight_requests
  set status = 'AWAITING_SELECTION', updated_at = now()
  where id = p_freight_request_id;

  return query select v_decision.id, 'OPTIONS_READY'::text;
end;
$$;
