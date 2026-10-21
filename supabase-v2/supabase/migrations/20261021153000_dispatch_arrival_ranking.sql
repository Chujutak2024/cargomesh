-- Explicit versioned scoring metric: queue delay matters when prioritizing arrival.
begin;
alter function private.workflow_validate(text,jsonb) rename to workflow_validate_before_dispatch;
create function private.workflow_validate(a text,v jsonb) returns void language plpgsql set search_path='' as $$begin
 if a='scoring-policies.publish' and v->'policy' ? 'transitMetric' then
  if v#>>'{policy,transitMetric}' is null or v#>>'{policy,transitMetric}' not in('ARRIVAL_TIME','TRAVEL_DURATION') then raise exception 'VALIDATION_ERROR' using errcode='PT400';end if;
  perform private.workflow_validate_before_dispatch(a,jsonb_set(v,'{policy}',(v->'policy')-'transitMetric'));
 else perform private.workflow_validate_before_dispatch(a,v);end if;
end;$$;
create or replace function private.workflow_ranking(o uuid,qid uuid,policy uuid,i uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare pp public.scoring_policies;r public.v2_carrier_offers;m public.v2_carrier_metrics;reason text;weights jsonb;excluded jsonb:='[]';
 eligible jsonb:='[]';entry jsonb;bundle jsonb;states jsonb;next_states jsonb;covered jsonb;all_required jsonb;planid uuid;
 total_cost numeric;transit numeric;reliability numeric;minc numeric;maxc numeric;mint numeric;maxt numeric;options jsonb;
begin
 perform private.workflow_request(o,qid);select * into pp from public.scoring_policies where id=policy and status='ACTIVE';
 if pp.id is null then raise exception 'WORKFLOW_NOT_FOUND' using errcode='PT404';end if;
 weights:=pp.data#>'{policy,weights}';
 insert into public.v2_rankings(id,organization_id,freight_request_id,policy_id,status,data) values(i,o,qid,policy,'MATERIALIZED','{}');
 for r in select * from public.v2_carrier_offers where organization_id=o and freight_request_id=qid order by id loop
  reason:=null;select * into m from public.v2_carrier_metrics where carrier_id=r.carrier_id and (data#>>'{period,endsAt}')::timestamptz<=now()
   and (data->>'sampleSize')::integer>0 and data->>'corridorId' is null and data->>'mode'='ROAD'
   and private.workflow_evidence(data->'source',(data#>>'{period,startsAt}')::timestamptz,now()) order by created_at desc,id limit 1;
  if not private.workflow_current_plan(r.plan_id) then reason:='PLAN_NOT_ELIGIBLE';
  elsif not private.workflow_offer_current(r.id) then reason:='OFFER_NOT_CURRENT_OR_COMPARABLE';
  elsif (weights->>'transit')::numeric>0 and (case when pp.data#>>'{policy,transitMetric}'='ARRIVAL_TIME' then r.data->>'estimatedDeliveryAt' is null else r.data->>'transitDurationSeconds' is null end) then reason:='TRANSIT_UNKNOWN';
  elsif (weights->>'reliability')::numeric>0 and (m.id is null or m.data->>'onTimeRate' is null) then reason:='RELIABILITY_UNKNOWN';end if;
  if reason is null then eligible:=eligible||jsonb_build_array(jsonb_build_object('offerId',r.id,'planId',r.plan_id,'assignments',r.data->'coveredAssignmentIds',
    'costCents',round((r.data#>>'{price,amount}')::numeric*100),'transit',case when pp.data#>>'{policy,transitMetric}'='ARRIVAL_TIME' then to_jsonb(extract(epoch from (r.data->>'estimatedDeliveryAt')::timestamptz)) else r.data->'transitDurationSeconds' end,'reliability',m.data->'onTimeRate','metricId',m.id));
  else excluded:=excluded||jsonb_build_array(jsonb_build_object('offerId',r.id,'reason',reason));end if;
 end loop;
 -- Exhaustive disjoint covers in stable offer UUID order. A declared complexity limit fails the command,
 -- never silently drops candidates or promises an optimum over an incomplete universe.
 for planid in select distinct (x->>'planId')::uuid from jsonb_array_elements(eligible) x loop
  select jsonb_agg(id order by id) into all_required from public.plan_resource_bindings where plan_id=planid;
  states:=jsonb_build_array(jsonb_build_object('offerIds','[]'::jsonb,'assignments','[]'::jsonb,'costCents',0,'transit',0,'reliability',1,'metrics','[]'::jsonb));
  for entry in select value from jsonb_array_elements(eligible) where (value->>'planId')::uuid=planid order by value->>'offerId' loop
   next_states:=states;
   for bundle in select value from jsonb_array_elements(states) loop
    if not exists(select 1 from jsonb_array_elements_text(bundle->'assignments') x where entry->'assignments' ? x.value) then
     next_states:=next_states||jsonb_build_array(jsonb_build_object('offerIds',bundle->'offerIds'||jsonb_build_array(entry->'offerId'),
      'assignments',(bundle->'assignments')||(entry->'assignments'),'costCents',(bundle->>'costCents')::numeric+(entry->>'costCents')::numeric,
      'transit',case when entry->>'transit' is null or bundle->>'transit' is null then null when pp.data#>>'{policy,transitMetric}'='ARRIVAL_TIME' then greatest((bundle->>'transit')::numeric,(entry->>'transit')::numeric) else (bundle->>'transit')::numeric+(entry->>'transit')::numeric end,
      'reliability',case when entry->>'reliability' is null or bundle->>'reliability' is null then null else least((bundle->>'reliability')::numeric,(entry->>'reliability')::numeric) end,
      'metrics',bundle->'metrics'||jsonb_build_array(entry->'metricId')));
    end if;
   end loop;
   if jsonb_array_length(next_states)>65536 then raise exception 'RANKING_COMPLEXITY_LIMIT' using errcode='PT409';end if;states:=next_states;
  end loop;
  for bundle in select value from jsonb_array_elements(states) where value->'assignments' @> all_required and value->'assignments' <@ all_required loop
   insert into public.ranked_options(ranking_id,offer_id,bundle_key,data) values(i,(bundle#>>'{offerIds,0}')::uuid,(bundle->'offerIds')::text,
    bundle||jsonb_build_object('planId',planid,'policyVersion',pp.data#>'{policy,version}','transitAggregation',case when pp.data#>>'{policy,transitMetric}'='ARRIVAL_TIME' then 'LATEST_OFFER_ARRIVAL' else 'SUM_ISSUER_DURATIONS' end,'reliabilityAggregation','MIN_CARRIER_ON_TIME'));
  end loop;
  if not exists(select 1 from public.ranked_options where ranking_id=i and (data->>'planId')::uuid=planid) then excluded:=excluded||jsonb_build_array(jsonb_build_object('planId',planid,'reason','INCOMPLETE_OFFER_COVERAGE'));end if;
 end loop;
 select min((data->>'costCents')::numeric),max((data->>'costCents')::numeric),min((data->>'transit')::numeric),max((data->>'transit')::numeric) into minc,maxc,mint,maxt from public.ranked_options where ranking_id=i;
 update public.ranked_options set score=(case when maxc=minc then 1 else (maxc-(data->>'costCents')::numeric)/(maxc-minc) end)*(weights->>'cost')::numeric
  +(case when data->>'transit' is null then 0 when maxt=mint then 1 else (maxt-(data->>'transit')::numeric)/(maxt-mint) end)*(weights->>'transit')::numeric
  +coalesce((data->>'reliability')::numeric,0)*(weights->>'reliability')::numeric,
  data=data||jsonb_build_object('explanation',jsonb_build_object('weights',weights,'dimensions',jsonb_build_object('cost',case when maxc=minc then 1 else (maxc-(data->>'costCents')::numeric)/(maxc-minc) end,
   'transit',case when data->>'transit' is null then null when maxt=mint then 1 else (maxt-(data->>'transit')::numeric)/(maxt-mint) end,'reliability',data->'reliability')),'missingData','[]'::jsonb) where ranking_id=i;
 with ranks as(select id,row_number() over(order by score desc,bundle_key) n from public.ranked_options where ranking_id=i)
 update public.ranked_options rr set position=ranks.n from ranks where rr.id=ranks.id;
 select coalesce(jsonb_agg(data||jsonb_build_object('offerId',offer_id,'score',score,'position',position) order by position),'[]') into options from public.ranked_options where ranking_id=i;
 update public.v2_rankings set data=jsonb_build_object('policyVersion',pp.data#>'{policy,version}','policyId',policy,'options',options,'excluded',excluded,'evaluatedAt',now(),
  'algorithmVersion','DISJOINT_COVER_V1','universe','CURRENT_PERSISTED_OFFERS','completeWithinUniverse',true) where id=i;
 return private.workflow_record('ranking',i);end;$$;
create or replace function public.rank_v2_request_quotes(p_organization_id uuid,p_member_id uuid,p_request_id uuid,p_expected_version integer,p_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare q public.freight_requests;policy uuid;r jsonb;begin
 perform private.workflow_member(p_organization_id,p_member_id,true);
 perform 1 from public.carrier_services order by id for update;
 select * into q from public.freight_requests where id=p_request_id and organization_id=p_organization_id for update;
 if not found then raise exception 'REQUEST_NOT_FOUND' using errcode='PT404';end if;
 if q.draft_version is distinct from p_expected_version then raise exception 'STALE_DRAFT' using errcode='PT409';end if;
 select id into policy from public.scoring_policies where status='ACTIVE' and data#>>'{policy,objective}'=case when q.v2_snapshot#>>'{planningPreferences,urgency}'='URGENT' then 'FASTEST' else coalesce(q.v2_snapshot->>'selectionObjective','LOWEST_COST') end and (q.v2_snapshot#>>'{planningPreferences,urgency}' is distinct from 'URGENT' or data#>>'{policy,transitMetric}'='ARRIVAL_TIME') order by id limit 1;
 if policy is null then return jsonb_build_object('id',null,'notice','SCORING_POLICY_REQUIRED');end if;
 r:=private.command_v2_workflow(p_organization_id,p_member_id,'ranking.create',jsonb_build_object('requestId',q.id,'carrierId',null,'parentId',null,'id',null),p_key,jsonb_build_object('schemaVersion','2.0','policyId',policy));
 return jsonb_build_object('id',r#>'{record,id}','notice',null);
end;$$;
revoke all on function private.workflow_validate(text,jsonb),private.workflow_validate_before_dispatch(text,jsonb),private.workflow_ranking(uuid,uuid,uuid,uuid) from public,anon,authenticated,service_role;
commit;
