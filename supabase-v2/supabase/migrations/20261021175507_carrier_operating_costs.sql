-- Carrier cost-plus rules. No tariffs, route facts, demo rows or new authority are activated.
begin;
alter table private.quote_issued_offers add column calculation_snapshot jsonb check(calculation_snapshot is null or jsonb_typeof(calculation_snapshot)='object');
create function private.operating_cost_policy_schema() returns json language sql immutable set search_path='' as $schema$select '{"type":"object","additionalProperties":false,"required":["fuelLitresPer100Km","fuelPricePerLitre","driverHourlyCost","vehicleCostPerKm","fixedCostPerVehicle","handlingCostPerShipment","version","maxContinuousDrivingMinutes","maxDailyDrivingMinutes","breakMinutes","dailyRestMinutes","payRestTime","markupPercent","taxPercent"],"properties":{"fuelLitresPer100Km":{"type":"number","minimum":0,"maximum":100000000},"fuelPricePerLitre":{"type":"number","minimum":0,"maximum":100000000},"driverHourlyCost":{"type":"number","minimum":0,"maximum":100000000},"vehicleCostPerKm":{"type":"number","minimum":0,"maximum":100000000},"fixedCostPerVehicle":{"type":"number","minimum":0,"maximum":100000000},"handlingCostPerShipment":{"type":"number","minimum":0,"maximum":100000000},"version":{"const":"COST_PLUS_V1"},"maxContinuousDrivingMinutes":{"type":"integer","minimum":1,"maximum":1440},"maxDailyDrivingMinutes":{"type":"integer","minimum":1,"maximum":1440},"breakMinutes":{"type":"integer","minimum":1,"maximum":1440},"dailyRestMinutes":{"type":"integer","minimum":1,"maximum":4320},"payRestTime":{"type":"boolean"},"markupPercent":{"type":"number","minimum":0,"maximum":500},"taxPercent":{"type":"number","minimum":0,"maximum":100},"fleet":{"type":"object","additionalProperties":false,"required":["version","profiles","assets"],"properties":{"version":{"const":"TRUCK_PROFILES_V1"},"profiles":{"type":"array","minItems":1,"maxItems":32,"items":{"type":"object","additionalProperties":false,"required":["id","label","equipmentCode","fuelLitresPer100Km","driverHourlyCost","vehicleCostPerKm","fixedCostPerVehicle","maxSpeedKph"],"properties":{"id":{"type":"string","pattern":"^[A-Za-z0-9_-]{1,64}$"},"label":{"type":"string","minLength":1,"maxLength":120},"equipmentCode":{"type":"string","minLength":1,"maxLength":100},"fuelLitresPer100Km":{"type":"number","minimum":0,"maximum":100000000},"driverHourlyCost":{"type":"number","minimum":0,"maximum":100000000},"vehicleCostPerKm":{"type":"number","minimum":0,"maximum":100000000},"fixedCostPerVehicle":{"type":"number","minimum":0,"maximum":100000000},"maxSpeedKph":{"type":"number","exclusiveMinimum":0,"maximum":160}}}},"assets":{"type":"array","minItems":1,"maxItems":64,"items":{"type":"object","additionalProperties":false,"required":["assetId","profileId","overrides"],"properties":{"assetId":{"type":"string","format":"uuid"},"profileId":{"type":"string","minLength":1,"maxLength":64},"overrides":{"type":"object","additionalProperties":false,"properties":{"fuelLitresPer100Km":{"type":"number","minimum":0,"maximum":100000000},"driverHourlyCost":{"type":"number","minimum":0,"maximum":100000000},"vehicleCostPerKm":{"type":"number","minimum":0,"maximum":100000000},"fixedCostPerVehicle":{"type":"number","minimum":0,"maximum":100000000},"maxSpeedKph":{"type":"number","exclusiveMinimum":0,"maximum":160}}}}}}}}}}'::json;$schema$;
create function private.route_operating_profile_schema() returns json language sql immutable set search_path='' as $schema$select '{"type":"object","additionalProperties":false,"required":["version","drivingSeconds","tollAmount","stops","source"],"properties":{"version":{"const":"ROAD_COST_INPUT_V1"},"drivingSeconds":{"type":"integer","minimum":1,"maximum":2592000},"tollAmount":{"type":"number","minimum":0,"maximum":100000000},"source":{"type":"object","additionalProperties":false,"required":["reference","provider","observedAt","validUntil","provenanceStatus"],"properties":{"reference":{"type":"string","minLength":1,"maxLength":500},"provider":{"type":"string","minLength":1,"maxLength":150},"observedAt":{"type":"string","format":"date-time"},"validUntil":{"anyOf":[{"type":"string","format":"date-time"},{"type":"null"}]},"provenanceStatus":{"enum":["VERIFIED","ESTIMATED","SIMULATED","UNKNOWN"]}}},"stops":{"type":"array","maxItems":32,"items":{"type":"object","additionalProperties":false,"required":["waypointIndex","afterDrivingSeconds","restMinutes","feeAmount"],"properties":{"waypointIndex":{"type":"integer","minimum":0,"maximum":99},"afterDrivingSeconds":{"type":"integer","minimum":1},"restMinutes":{"type":"integer","minimum":1,"maximum":4320},"feeAmount":{"type":"number","minimum":0,"maximum":100000000}}}},"endpoints":{"type":"object","additionalProperties":false,"required":["origin","destination"],"properties":{"origin":{"type":"object","additionalProperties":false,"required":["lat","lng"],"properties":{"lat":{"type":"number","minimum":-90,"maximum":90},"lng":{"type":"number","minimum":-180,"maximum":180}}},"destination":{"type":"object","additionalProperties":false,"required":["lat","lng"],"properties":{"lat":{"type":"number","minimum":-90,"maximum":90},"lng":{"type":"number","minimum":-180,"maximum":180}}}}}}}'::json;$schema$;
create function private.valid_operating_cost_policy(p jsonb) returns boolean language plpgsql immutable set search_path='' as $$begin
 if not coalesce(extensions.jsonb_matches_schema(private.operating_cost_policy_schema(),p),false) then return false;end if;
 if p ? 'fleet' then
  if (select count(distinct x->>'id') from jsonb_array_elements(p#>'{fleet,profiles}') x)<>jsonb_array_length(p#>'{fleet,profiles}')
   or (select count(distinct x->>'assetId') from jsonb_array_elements(p#>'{fleet,assets}') x)<>jsonb_array_length(p#>'{fleet,assets}')
   or exists(select 1 from jsonb_array_elements(p#>'{fleet,assets}') a where not exists(select 1 from jsonb_array_elements(p#>'{fleet,profiles}') f where f->>'id'=a->>'profileId')) then return false;end if;
  if exists(select 1 from (select x as v from jsonb_array_elements(p#>'{fleet,profiles}') x union all select x->'overrides' from jsonb_array_elements(p#>'{fleet,assets}') x) q cross join lateral jsonb_each(q.v) x
   where jsonb_typeof(x.value)='number' and (x.value::text)::numeric*case when x.key='fixedCostPerVehicle' then 100 else 10000 end<>round((x.value::text)::numeric*case when x.key='fixedCostPerVehicle' then 100 else 10000 end)) then return false;end if;
 end if;
 return not exists(select 1 from jsonb_each(p) x where jsonb_typeof(x.value)='number' and (x.value::text)::numeric*case when x.key in('fixedCostPerVehicle','handlingCostPerShipment') then 100 else 10000 end<>round((x.value::text)::numeric*case when x.key in('fixedCostPerVehicle','handlingCostPerShipment') then 100 else 10000 end));
end;$$;
create function private.valid_route_operating_profile(v jsonb) returns boolean language plpgsql immutable set search_path='' as $$begin
 if not coalesce(extensions.jsonb_matches_schema(private.route_operating_profile_schema(),v),false) then return false;end if;
 return (v->>'tollAmount')::numeric*100=round((v->>'tollAmount')::numeric*100) and not exists(select 1 from jsonb_array_elements(v->'stops') x where (x->>'feeAmount')::numeric*100<>round((x->>'feeAmount')::numeric*100));
end;$$;
create function private.calculate_operating_costs(p jsonb,r jsonb,n integer,minimum_amount numeric,additional_seconds integer,through_at timestamptz)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare v jsonb:=r->'operatingProfile';e jsonb;st jsonb;w jsonb;previous integer:=0;continuous integer:=0;daily integer:=0;seg integer;rest_seconds integer:=0;rest_fees numeric:=0;
 paid integer;distance numeric;parts jsonb;operating numeric;markup numeric;floor_cents numeric;tax numeric;total numeric;begin
 if not private.valid_operating_cost_policy(p) or (p->>'maxDailyDrivingMinutes')::int<(p->>'maxContinuousDrivingMinutes')::int or (p->>'dailyRestMinutes')::int<(p->>'breakMinutes')::int then return jsonb_build_object('status','REQUIRES_REVIEW','reason','COST_POLICY_INVALID');end if;
 if not private.valid_route_operating_profile(v) then return jsonb_build_object('status','REQUIRES_REVIEW','reason','ROUTE_OPERATING_PROFILE_REQUIRED');end if;
 e:=v->'source';
 if through_at is null or through_at<now() or not coalesce(private.workflow_evidence(e,now(),through_at),false) then return jsonb_build_object('status','REQUIRES_REVIEW','reason','COST_ROUTE_EVIDENCE_REQUIRED');end if;
 distance:=(r->>'estimatedDistanceKm')::numeric;
 if distance is null or distance<=0 or distance>1000000 then return jsonb_build_object('status','REQUIRES_REVIEW','reason','COST_DISTANCE_REQUIRED');end if;
 distance:=round(distance,6);
 if n is null or n<1 or n>8 or additional_seconds is null or additional_seconds<0 or additional_seconds>2592000 or minimum_amount is null or minimum_amount<0 or minimum_amount>100000000 then return jsonb_build_object('status','REQUIRES_REVIEW','reason','COST_INPUT_INVALID');end if;
 if (select count(distinct x->>'waypointIndex') from jsonb_array_elements(v->'stops') x)<>jsonb_array_length(v->'stops') then return jsonb_build_object('status','REQUIRES_REVIEW','reason','REST_LOCATION_EVIDENCE_REQUIRED');end if;
 for st in select value from jsonb_array_elements((v->'stops')||jsonb_build_array(jsonb_build_object('waypointIndex',-1,'afterDrivingSeconds',v->'drivingSeconds','restMinutes',0,'feeAmount',0))) loop
  seg:=(st->>'afterDrivingSeconds')::integer-previous;
  if seg<=0 or (st->>'waypointIndex')::int>=0 and (st->>'afterDrivingSeconds')::int>=(v->>'drivingSeconds')::int then return jsonb_build_object('status','REQUIRES_REVIEW','reason','ROUTE_OPERATING_PROFILE_REQUIRED');end if;
  continuous:=continuous+seg;daily:=daily+seg;
  if continuous>(p->>'maxContinuousDrivingMinutes')::int*60 or daily>(p->>'maxDailyDrivingMinutes')::int*60 then return jsonb_build_object('status','REQUIRES_REVIEW','reason','DRIVER_REST_PLAN_REQUIRED');end if;
  if (st->>'waypointIndex')::int>=0 then
   w:=r->'waypoints'->((st->>'waypointIndex')::int);
   if w->>'kind' is distinct from 'REST' or not coalesce(private.workflow_evidence(w->'source',now(),through_at),false) then return jsonb_build_object('status','REQUIRES_REVIEW','reason','REST_LOCATION_EVIDENCE_REQUIRED');end if;
  end if;
  if (st->>'restMinutes')::int>=(p->>'breakMinutes')::int then continuous:=0;end if;
  if (st->>'restMinutes')::int>=(p->>'dailyRestMinutes')::int then daily:=0;end if;
  rest_seconds:=rest_seconds+(st->>'restMinutes')::int*60;rest_fees:=rest_fees+round((st->>'feeAmount')::numeric*100);previous:=(st->>'afterDrivingSeconds')::int;
 end loop;
 paid:=(v->>'drivingSeconds')::int+additional_seconds+case when (p->>'payRestTime')::boolean then rest_seconds else 0 end;
 parts:=jsonb_build_array(
 jsonb_build_object('code','FUEL','kind','FUEL','cents',round(distance*(p->>'fuelLitresPer100Km')::numeric*(p->>'fuelPricePerLitre')::numeric*n)),
 jsonb_build_object('code','DRIVER','kind','OTHER','cents',round((p->>'driverHourlyCost')::numeric*paid*n/36)),
 jsonb_build_object('code','VEHICLE','kind','TRANSPORT','cents',round(distance*(p->>'vehicleCostPerKm')::numeric*n*100)),
 jsonb_build_object('code','FIXED_PER_VEHICLE','kind','TRANSPORT','cents',round((p->>'fixedCostPerVehicle')::numeric*100)*n),
 jsonb_build_object('code','TOLLS','kind','TOLL','cents',round((v->>'tollAmount')::numeric*100)*n),
 jsonb_build_object('code','REST_FACILITIES','kind','OTHER','cents',rest_fees*n),
 jsonb_build_object('code','HANDLING_PER_SHIPMENT','kind','HANDLING','cents',round((p->>'handlingCostPerShipment')::numeric*100)));
 select sum((x->>'cents')::numeric) into operating from jsonb_array_elements(parts) x;
 markup:=round(operating*(p->>'markupPercent')::numeric/100);floor_cents:=greatest(0,round(minimum_amount*100)-operating-markup);
 tax:=round((operating+markup+floor_cents)*(p->>'taxPercent')::numeric/100);total:=operating+markup+floor_cents+tax;
 if total<=0 or total>1000000000000 then return jsonb_build_object('status','REQUIRES_REVIEW','reason','COST_TOTAL_INVALID');end if;
 parts:=parts||jsonb_build_array(jsonb_build_object('code','CARRIER_MARKUP','kind','OTHER','cents',markup),jsonb_build_object('code','MINIMUM_ADJUSTMENT','kind','OTHER','cents',floor_cents),jsonb_build_object('code','TAX','kind','TAX','cents',tax));
 return jsonb_build_object('status','READY','formulaVersion','COST_PLUS_V1','operatingCents',operating,'markupCents',markup,'taxCents',tax,'totalCents',total,'components',parts,'resourceCount',n,'drivingSeconds',(v->>'drivingSeconds')::int,'restSeconds',rest_seconds,'paidDriverSeconds',paid,'transportSeconds',(v->>'drivingSeconds')::int+rest_seconds,'restStopCount',jsonb_array_length(v->'stops'),'litres',distance*(p->>'fuelLitresPer100Km')::numeric/100*n,'provenance',e->>'provenanceStatus');
exception when data_exception then return jsonb_build_object('status','REQUIRES_REVIEW','reason','COST_INPUT_INVALID');end;$$;
alter function private.workflow_validate(text,jsonb) rename to workflow_validate_before_costs;
create function private.workflow_validate(a text,v jsonb) returns void language plpgsql set search_path='' as $$declare st jsonb;previous integer:=0;begin
 if a='corridors.publish' and v ? 'operatingProfile' then
  if not private.valid_route_operating_profile(v->'operatingProfile') then raise exception 'INVALID_ROUTE_OPERATING_PROFILE' using errcode='PT400';end if;
  if (select count(distinct x->>'waypointIndex') from jsonb_array_elements(v#>'{operatingProfile,stops}') x)<>jsonb_array_length(v#>'{operatingProfile,stops}') then raise exception 'INVALID_ROUTE_OPERATING_PROFILE' using errcode='PT400';end if;
  for st in select value from jsonb_array_elements(v#>'{operatingProfile,stops}') loop
   if (st->>'afterDrivingSeconds')::int<=previous or (st->>'afterDrivingSeconds')::int>=(v#>>'{operatingProfile,drivingSeconds}')::int or v->'waypoints'->((st->>'waypointIndex')::int)->>'kind' is distinct from 'REST' then raise exception 'INVALID_ROUTE_OPERATING_PROFILE' using errcode='PT400';end if;
   previous:=(st->>'afterDrivingSeconds')::int;
  end loop;
  perform private.workflow_validate_before_costs(a,v-'operatingProfile');
 else perform private.workflow_validate_before_costs(a,v);end if;
end;$$;

-- Asset scope is read from persisted fleet rows. Callers cannot provide fuel rates or equipment claims.
create function private.calculate_resource_operating_costs(p jsonb,r jsonb,resources jsonb,minimum_amount numeric,additional_seconds integer,through_at timestamptz,carrier uuid,service uuid)
returns jsonb language plpgsql stable set search_path='' as $$
declare resource jsonb;binding jsonb;profile jsonb;effective jsonb;params jsonb;truck public.transport_assets;cost jsonb;summary jsonb;items jsonb:='[]';truck_results jsonb:='[]';parts jsonb;operating numeric;markup numeric;floor_cents numeric;tax numeric;total numeric;litres numeric:=0;n int;
begin
 n:=jsonb_array_length(resources);
 if n<1 or n>8 or (select count(distinct x->>'assetId') from jsonb_array_elements(resources) x)<>n then return jsonb_build_object('status','REQUIRES_REVIEW','reason','COST_RESOURCE_IDENTITIES_REQUIRED');end if;
 if not p ? 'fleet' then return private.calculate_operating_costs(p,r,n,minimum_amount,additional_seconds,through_at);end if;
 if not private.valid_operating_cost_policy(p) then return jsonb_build_object('status','REQUIRES_REVIEW','reason','COST_POLICY_INVALID');end if;
 for resource in select value from jsonb_array_elements(resources) order by value->>'assetId' loop
  select * into truck from public.transport_assets where id=(resource->>'assetId')::uuid and carrier_id=carrier and carrier_service_id=service and active and operating_status='AVAILABLE' and asset_role='CARRIER';
  if not found then return jsonb_build_object('status','REQUIRES_REVIEW','reason','TRUCK_COST_ASSET_SCOPE');end if;
  select x into binding from jsonb_array_elements(p#>'{fleet,assets}') x where x->>'assetId'=resource->>'assetId';
  select x into profile from jsonb_array_elements(p#>'{fleet,profiles}') x where x->>'id'=binding->>'profileId';
  if profile is null then return jsonb_build_object('status','REQUIRES_REVIEW','reason','TRUCK_COST_PROFILE_REQUIRED');end if;
  if profile->>'equipmentCode' is distinct from truck.equipment_code then return jsonb_build_object('status','REQUIRES_REVIEW','reason','TRUCK_COST_EQUIPMENT_MISMATCH');end if;
  effective:=profile||(binding->'overrides');
  if (r#>>'{operatingProfile,drivingSeconds}')::numeric<ceil((r->>'estimatedDistanceKm')::numeric/(effective->>'maxSpeedKph')::numeric*3600) then return jsonb_build_object('status','REQUIRES_REVIEW','reason','TRUCK_DRIVING_TIME_INCONSISTENT');end if;
  params:=(p-'fleet')||jsonb_build_object('fuelLitresPer100Km',effective->'fuelLitresPer100Km','driverHourlyCost',effective->'driverHourlyCost','vehicleCostPerKm',effective->'vehicleCostPerKm','fixedCostPerVehicle',effective->'fixedCostPerVehicle','handlingCostPerShipment',0,'markupPercent',0,'taxPercent',0);
  cost:=private.calculate_operating_costs(params,r,1,0.01,additional_seconds,through_at);
  if cost->>'status'<>'READY' then return cost;end if;summary:=cost;litres:=litres+(cost->>'litres')::numeric;
  truck_results:=truck_results||jsonb_build_array(jsonb_build_object('assetId',truck.id,'assetCode',truck.code,'profileId',profile->>'id','label',profile->>'label','equipmentCode',truck.equipment_code,'operatingCents',cost->'operatingCents','litres',cost->'litres','maxSpeedKph',effective->'maxSpeedKph','drivingSeconds',cost->'drivingSeconds'));
  select items||coalesce(jsonb_agg(x),'[]') into items from jsonb_array_elements(cost->'components') x where x->>'code' not in('CARRIER_MARKUP','MINIMUM_ADJUSTMENT','TAX','HANDLING_PER_SHIPMENT');
 end loop;
 items:=items||jsonb_build_array(jsonb_build_object('code','HANDLING_PER_SHIPMENT','kind','HANDLING','cents',round((p->>'handlingCostPerShipment')::numeric*100)));
 select jsonb_agg(jsonb_build_object('code',code,'kind',kind,'cents',amount) order by code),sum(amount) into parts,operating from (select x->>'code' as code,x->>'kind' as kind,sum((x->>'cents')::numeric) amount from jsonb_array_elements(items) x group by 1,2) grouped;
 markup:=round(operating*(p->>'markupPercent')::numeric/100);floor_cents:=greatest(0,round(minimum_amount*100)-operating-markup);tax:=round((operating+markup+floor_cents)*(p->>'taxPercent')::numeric/100);total:=operating+markup+floor_cents+tax;
 if minimum_amount is null or minimum_amount<0 or minimum_amount>100000000 or total<=0 or total>1000000000000 then return jsonb_build_object('status','REQUIRES_REVIEW','reason','COST_TOTAL_INVALID');end if;
 parts:=parts||jsonb_build_array(jsonb_build_object('code','CARRIER_MARKUP','kind','OTHER','cents',markup),jsonb_build_object('code','MINIMUM_ADJUSTMENT','kind','OTHER','cents',floor_cents),jsonb_build_object('code','TAX','kind','TAX','cents',tax));
 return summary||jsonb_build_object('operatingCents',operating,'markupCents',markup,'taxCents',tax,'totalCents',total,'components',parts,'resourceCount',n,'resources',truck_results,'litres',litres);
exception when data_exception then return jsonb_build_object('status','REQUIRES_REVIEW','reason','COST_INPUT_INVALID');end;$$;
-- Exact coordinate correlation; same-city geometry cannot price a different pickup/delivery point.
create function private.cost_route_matches_request(r jsonb,q jsonb) returns boolean language sql immutable set search_path='' as $$
 select r#>'{operatingProfile,endpoints}' is not null and q#>'{origin,lat}'<>'null'::jsonb and q#>'{origin,lng}'<>'null'::jsonb and q#>'{destination,lat}'<>'null'::jsonb and q#>'{destination,lng}'<>'null'::jsonb
 and (r#>>'{operatingProfile,endpoints,origin,lat}')::numeric=(q#>>'{origin,lat}')::numeric and (r#>>'{operatingProfile,endpoints,origin,lng}')::numeric=(q#>>'{origin,lng}')::numeric
 and (r#>>'{operatingProfile,endpoints,destination,lat}')::numeric=(q#>>'{destination,lat}')::numeric and (r#>>'{operatingProfile,endpoints,destination,lng}')::numeric=(q#>>'{destination,lng}')::numeric;$$;

create or replace function public.configure_v2_quote_policy(p_carrier_id uuid,p_operator_id uuid,p_key uuid,p_expected_version integer,p_value jsonb default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare p private.carrier_quote_policies;r private.quote_command_receipts;h text;result jsonb;begin
 if p_operator_id is distinct from private.identity_carrier(p_carrier_id) then raise exception 'FORBIDDEN_CARRIER_IDENTITY' using errcode='PT403';end if;
 perform private.identity_carrier_action(p_carrier_id,'limits.publish'); -- Private operating costs require ADMIN even on reads.
 if p_value is null then
  return coalesce((select jsonb_agg(private.quote_policy_record(x) order by x.service_id,x.lane_id) from private.carrier_quote_policies x where x.carrier_id=p_carrier_id),'[]'::jsonb);
 end if;
 perform private.identity_carrier_action(p_carrier_id,'limits.publish'); -- ADMIN approval, not a shipper grant.
 if p_key is null or p_expected_version is null or p_expected_version<0 or not coalesce(extensions.jsonb_matches_schema($policy_schema${"type":"object","additionalProperties":false,"required":["schemaVersion","serviceId","laneId","active","autoIssue","basis","baseAmount","ratePerKm","minimumAmount","fuelAmount","tollAmount","handlingAmount","taxAmount","validityMinutes","confirmationMinutes","validUntil","terms","provenanceStatus","acknowledgeAuthority"],"properties":{"schemaVersion":{"const":"2.0"},"serviceId":{"type":"string","format":"uuid"},"laneId":{"type":"string","format":"uuid"},"active":{"type":"boolean"},"autoIssue":{"type":"boolean"},"basis":{"enum":["PER_TRIP","PER_KM","COST_PLUS"]},"baseAmount":{"type":"number","minimum":0,"maximum":100000000},"ratePerKm":{"type":"number","minimum":0,"maximum":100000000},"minimumAmount":{"type":"number","minimum":0,"maximum":100000000},"fuelAmount":{"type":"number","minimum":0,"maximum":100000000},"tollAmount":{"type":"number","minimum":0,"maximum":100000000},"handlingAmount":{"type":"number","minimum":0,"maximum":100000000},"taxAmount":{"type":"number","minimum":0,"maximum":100000000},"validityMinutes":{"type":"integer","minimum":5,"maximum":1440},"confirmationMinutes":{"type":"integer","minimum":5,"maximum":1440},"validUntil":{"type":"string","format":"date-time"},"terms":{"type":"string","minLength":1,"maxLength":2000},"provenanceStatus":{"enum":["VERIFIED","SIMULATED"]},"acknowledgeAuthority":{"const":true},"maxResources":{"type":"integer","minimum":1,"maximum":8},"resourcePricing":{"enum":["PER_PLAN","PER_RESOURCE"]},"dispatch":{"type":"object","additionalProperties":false,"required":["allowedPriorities","minNoticeMinutes","loadingMinutes","unloadingMinutes","autoConfirm","maxBookingAmount","acknowledgeSchedulingAuthority"],"properties":{"allowedPriorities":{"type":"array","items":{"enum":["URGENT","SCHEDULED"]},"minItems":1,"maxItems":2,"uniqueItems":true},"minNoticeMinutes":{"type":"integer","minimum":0,"maximum":43200},"loadingMinutes":{"type":"integer","minimum":0,"maximum":1440},"unloadingMinutes":{"type":"integer","minimum":0,"maximum":1440},"autoConfirm":{"type":"boolean"},"maxBookingAmount":{"type":["number","null"],"exclusiveMinimum":0,"maximum":100000000},"acknowledgeSchedulingAuthority":{"type":"boolean"}}},"operatingCosts":{"type":"object","additionalProperties":false,"required":["fuelLitresPer100Km","fuelPricePerLitre","driverHourlyCost","vehicleCostPerKm","fixedCostPerVehicle","handlingCostPerShipment","version","maxContinuousDrivingMinutes","maxDailyDrivingMinutes","breakMinutes","dailyRestMinutes","payRestTime","markupPercent","taxPercent"],"properties":{"fuelLitresPer100Km":{"type":"number","minimum":0,"maximum":100000000},"fuelPricePerLitre":{"type":"number","minimum":0,"maximum":100000000},"driverHourlyCost":{"type":"number","minimum":0,"maximum":100000000},"vehicleCostPerKm":{"type":"number","minimum":0,"maximum":100000000},"fixedCostPerVehicle":{"type":"number","minimum":0,"maximum":100000000},"handlingCostPerShipment":{"type":"number","minimum":0,"maximum":100000000},"version":{"const":"COST_PLUS_V1"},"maxContinuousDrivingMinutes":{"type":"integer","minimum":1,"maximum":1440},"maxDailyDrivingMinutes":{"type":"integer","minimum":1,"maximum":1440},"breakMinutes":{"type":"integer","minimum":1,"maximum":1440},"dailyRestMinutes":{"type":"integer","minimum":1,"maximum":4320},"payRestTime":{"type":"boolean"},"markupPercent":{"type":"number","minimum":0,"maximum":500},"taxPercent":{"type":"number","minimum":0,"maximum":100},"fleet":{"type":"object","additionalProperties":false,"required":["version","profiles","assets"],"properties":{"version":{"const":"TRUCK_PROFILES_V1"},"profiles":{"type":"array","minItems":1,"maxItems":32,"items":{"type":"object","additionalProperties":false,"required":["id","label","equipmentCode","fuelLitresPer100Km","driverHourlyCost","vehicleCostPerKm","fixedCostPerVehicle","maxSpeedKph"],"properties":{"id":{"type":"string","pattern":"^[A-Za-z0-9_-]{1,64}$"},"label":{"type":"string","minLength":1,"maxLength":120},"equipmentCode":{"type":"string","minLength":1,"maxLength":100},"fuelLitresPer100Km":{"type":"number","minimum":0,"maximum":100000000},"driverHourlyCost":{"type":"number","minimum":0,"maximum":100000000},"vehicleCostPerKm":{"type":"number","minimum":0,"maximum":100000000},"fixedCostPerVehicle":{"type":"number","minimum":0,"maximum":100000000},"maxSpeedKph":{"type":"number","exclusiveMinimum":0,"maximum":160}}}},"assets":{"type":"array","minItems":1,"maxItems":64,"items":{"type":"object","additionalProperties":false,"required":["assetId","profileId","overrides"],"properties":{"assetId":{"type":"string","format":"uuid"},"profileId":{"type":"string","minLength":1,"maxLength":64},"overrides":{"type":"object","additionalProperties":false,"properties":{"fuelLitresPer100Km":{"type":"number","minimum":0,"maximum":100000000},"driverHourlyCost":{"type":"number","minimum":0,"maximum":100000000},"vehicleCostPerKm":{"type":"number","minimum":0,"maximum":100000000},"fixedCostPerVehicle":{"type":"number","minimum":0,"maximum":100000000},"maxSpeedKph":{"type":"number","exclusiveMinimum":0,"maximum":160}}}}}}}}}}}}$policy_schema$::json,p_value),false)
 then raise exception 'VALIDATION_ERROR' using errcode='PT400';end if;
 if p_value->>'basis'='COST_PLUS' then
  if not private.valid_operating_cost_policy(p_value->'operatingCosts') or not p_value ? 'operatingCosts' or not p_value ? 'dispatch' or p_value->>'resourcePricing' is distinct from 'PER_RESOURCE'
   or exists(select 1 from jsonb_each(p_value) x where x.key in('baseAmount','ratePerKm','fuelAmount','tollAmount','handlingAmount','taxAmount') and (x.value::text)::numeric<>0)
   or (p_value#>>'{operatingCosts,maxDailyDrivingMinutes}')::int<(p_value#>>'{operatingCosts,maxContinuousDrivingMinutes}')::int
   or (p_value#>>'{operatingCosts,dailyRestMinutes}')::int<(p_value#>>'{operatingCosts,breakMinutes}')::int then raise exception 'INVALID_OPERATING_COST_POLICY' using errcode='PT400';end if;
 elsif p_value ? 'operatingCosts' then raise exception 'INVALID_OPERATING_COST_POLICY' using errcode='PT400';end if;
 if (p_value#>>'{dispatch,autoConfirm}')::boolean and (not coalesce((p_value#>>'{dispatch,acknowledgeSchedulingAuthority}')::boolean,false) or p_value#>>'{dispatch,maxBookingAmount}' is null) then raise exception 'SCHEDULING_AUTHORITY_REQUIRED' using errcode='PT400';end if;
 if coalesce((p_value->>'maxResources')::integer,1)>1 and p_value->>'resourcePricing' is null then raise exception 'RESOURCE_PRICING_SCOPE_REQUIRED' using errcode='PT400';end if;
 if (p_value->>'validUntil')::timestamptz<=now() or btrim(p_value->>'terms')='' or
  (p_value->>'basis'='PER_KM' and (p_value->>'ratePerKm')::numeric<=0) or
  (p_value->>'basis'='PER_TRIP' and (p_value->>'ratePerKm')::numeric<>0) or
  (p_value->>'basis'<>'COST_PLUS' and (p_value->>'baseAmount')::numeric+(p_value->>'minimumAmount')::numeric+(p_value->>'ratePerKm')::numeric<=0) or
  exists(select 1 from jsonb_each(p_value) kv where kv.key in('baseAmount','ratePerKm','minimumAmount','fuelAmount','tollAmount','handlingAmount','taxAmount') and (kv.value::text)::numeric*100<>round((kv.value::text)::numeric*100))
 then raise exception 'INVALID_TARIFF' using errcode='PT400';end if;
 if p_value#>'{operatingCosts,fleet}' is not null and exists(select 1 from jsonb_array_elements(p_value#>'{operatingCosts,fleet,assets}') a
  where not exists(select 1 from public.transport_assets t join jsonb_array_elements(p_value#>'{operatingCosts,fleet,profiles}') f on f->>'id'=a->>'profileId'
   where t.id=(a->>'assetId')::uuid and t.carrier_id=p_carrier_id and t.carrier_service_id=(p_value->>'serviceId')::uuid and t.active and t.asset_role='CARRIER' and t.equipment_code=f->>'equipmentCode')) then raise exception 'TRUCK_COST_ASSET_SCOPE' using errcode='PT400';end if;
 if not exists(select 1 from public.carrier_services s join public.service_lanes l on l.carrier_service_id=s.id
  where s.id=(p_value->>'serviceId')::uuid and s.carrier_id=p_carrier_id and l.id=(p_value->>'laneId')::uuid and s.transport_mode='ROAD' and s.service_type='FTL')
 then raise exception 'INVALID_POLICY_SCOPE' using errcode='PT400';end if;
 h:=private.hash_v2_freight_payload(jsonb_build_object('carrier',p_carrier_id,'expectedVersion',p_expected_version,'value',p_value));
 perform pg_advisory_xact_lock(hashtextextended('quote-policy-key:'||p_operator_id||':'||p_key,0));
 select * into r from private.quote_command_receipts where actor_id=p_operator_id and key=p_key and scope='policy';
 if found then if r.payload_hash<>h then raise exception 'IDEMPOTENCY_CONFLICT' using errcode='PT409';end if;return r.result;end if;
 perform pg_advisory_xact_lock(hashtextextended('quote-policy:'||p_carrier_id||':'||(p_value->>'serviceId')||':'||(p_value->>'laneId'),0));
 select * into p from private.carrier_quote_policies where carrier_id=p_carrier_id and service_id=(p_value->>'serviceId')::uuid and lane_id=(p_value->>'laneId')::uuid for update;
 if coalesce(p.version,0)<>p_expected_version then raise exception 'STALE_DRAFT' using errcode='PT409';end if;
 insert into private.carrier_quote_policies(carrier_id,service_id,lane_id,operator_id,auth_user_id,version,value)
 values(p_carrier_id,(p_value->>'serviceId')::uuid,(p_value->>'laneId')::uuid,p_operator_id,auth.uid(),p_expected_version+1,p_value)
 on conflict(carrier_id,service_id,lane_id) do update set operator_id=excluded.operator_id,auth_user_id=excluded.auth_user_id,version=excluded.version,value=excluded.value,updated_at=now() returning * into p;
 result:=private.quote_policy_record(p);
 insert into private.quote_command_receipts values(p_operator_id,p_key,'policy',h,result);return result;
end;$$;
create function private.dispatch_transit_seconds(r jsonb,lane_minutes integer,p jsonb) returns integer language plpgsql stable set search_path='' as $$declare cost jsonb;begin
 if p->>'basis'='COST_PLUS' then
  cost:=private.calculate_operating_costs((p->'operatingCosts')-'fleet',r,1,0.01,0,now());
  if cost->>'status'<>'READY' then return null;end if;
  return ceil(greatest((r->>'estimatedDurationSeconds')::numeric,lane_minutes*60,(cost->>'transportSeconds')::numeric));
 end if;
 return ceil(greatest((r->>'estimatedDurationSeconds')::numeric,lane_minutes*60));
end;$$;
create or replace function public.read_v2_dispatch_options(p_organization_id uuid,p_member_id uuid,p_request_id uuid,p_expected_version integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare q public.freight_requests;result jsonb;begin
 perform private.workflow_member(p_organization_id,p_member_id,false);
 select * into q from public.freight_requests where id=p_request_id and organization_id=p_organization_id;
 if not found then raise exception 'REQUEST_NOT_FOUND' using errcode='PT404';end if;
 if q.draft_version is distinct from p_expected_version then raise exception 'STALE_DRAFT' using errcode='PT409';end if;
 select coalesce(jsonb_agg(jsonb_build_object('serviceId',s.id,'laneId',l.id,'policyVersion',p.version,'costMode',case when p.value->>'basis'='COST_PLUS' then 'COST_PLUS' else 'FIXED' end,'maxResources',coalesce((p.value->>'maxResources')::int,1),'routeId',c.id,'transitSeconds',private.dispatch_transit_seconds(c.data,l.planned_transit_minutes,p.value),'provenance',case when c.data#>>'{source,provenanceStatus}'='SIMULATED' or l.transit_provenance_status='SIMULATED' then 'SIMULATED' else 'VERIFIED' end,'policy',p.value->'dispatch') order by s.id,l.id,c.id),'[]'::jsonb) into result
 from private.carrier_quote_policies p join public.carrier_services s on s.id=p.service_id and s.carrier_id=p.carrier_id
 join public.service_lanes l on l.id=p.lane_id and l.carrier_service_id=s.id
 join public.route_corridors c on c.status='ACTIVE' and c.data->>'mode'='ROAD'
 join public.logistics_nodes n1 on n1.id=c.origin_node_id and n1.status='ACTIVE' join public.logistics_nodes n2 on n2.id=c.destination_node_id and n2.status='ACTIVE'
 where s.active and s.transport_mode='ROAD' and s.service_type='FTL' and l.active and private.dispatch_policy_authorized(p) and p.value ? 'dispatch'
 and private.dispatch_transit_seconds(c.data,l.planned_transit_minutes,p.value) is not null and (c.data->>'estimatedDurationSeconds')::numeric>0 and c.data#>>'{source,provenanceStatus}' in('VERIFIED','SIMULATED') and l.planned_transit_minutes>0 and l.transit_provenance_status in('VERIFIED','SIMULATED')
 and (p.value#>'{operatingCosts,fleet}' is null or coalesce(private.cost_route_matches_request(c.data,q.v2_snapshot),false))
 and exists(select 1 from public.route_resource_limits rr where rr.status='ACTIVE' and rr.carrier_service_id=s.id and rr.corridor_id=c.id)
 and n1.data#>>'{location,countryCode}'=q.v2_snapshot#>>'{origin,countryCode}' and n2.data#>>'{location,countryCode}'=q.v2_snapshot#>>'{destination,countryCode}'
 and lower(n1.data#>>'{location,city}')=lower(q.v2_snapshot#>>'{origin,city}') and lower(n2.data#>>'{location,city}')=lower(q.v2_snapshot#>>'{destination,city}');
 return result;
end;$$;
create or replace function private.validate_dispatch_schedule(q public.freight_requests,v jsonb,p private.carrier_quote_policies,lane uuid) returns void language plpgsql security definer set search_path='' as $$
declare start_at timestamptz:=(v->>'pickupAt')::timestamptz;arrival timestamptz:=(v->>'deliveryAt')::timestamptz;end_at timestamptz:=(v#>>'{operationWindow,endsAt}')::timestamptz;seconds numeric;begin
 if not q.v2_snapshot ? 'planningPreferences' or not p.value ? 'dispatch' or not private.dispatch_policy_authorized(p) or p.version is distinct from (v->>'policyVersion')::integer then raise exception 'DISPATCH_POLICY_CHANGED' using errcode='PT409';end if;
 if not p.value#>'{dispatch,allowedPriorities}' ? (q.v2_snapshot#>>'{planningPreferences,urgency}') then raise exception 'PRIORITY_NOT_ACCEPTED' using errcode='PT409';end if;
 select private.dispatch_transit_seconds(c.data,l.planned_transit_minutes,p.value) into seconds from public.route_corridors c join public.service_lanes l on l.id=lane and l.carrier_service_id=p.service_id where c.id=(v->>'routeId')::uuid and c.status='ACTIVE' and l.active and (c.data->>'estimatedDurationSeconds')::numeric>0 and l.planned_transit_minutes>0 and l.transit_provenance_status in('VERIFIED','SIMULATED');
 if seconds is null or seconds is distinct from (v->>'transitSeconds')::numeric then raise exception 'DISPATCH_TRANSIT_CHANGED' using errcode='PT409';end if;
 if start_at is distinct from (v#>>'{operationWindow,startsAt}')::timestamptz or start_at<now()+make_interval(mins=>(p.value#>>'{dispatch,minNoticeMinutes}')::integer)
  or arrival<start_at+make_interval(mins=>(p.value#>>'{dispatch,loadingMinutes}')::integer)+make_interval(secs=>seconds::double precision)
  or end_at<arrival+greatest(make_interval(mins=>(p.value#>>'{dispatch,unloadingMinutes}')::integer),interval '1 millisecond')
  or not exists(select 1 from jsonb_array_elements(q.v2_snapshot#>'{planningPreferences,pickupWindows}') w where start_at>=(w->>'startsAt')::timestamptz and start_at < (w->>'endsAt')::timestamptz and start_at+make_interval(mins=>(p.value#>>'{dispatch,loadingMinutes}')::integer)<=(w->>'endsAt')::timestamptz)
  or not exists(select 1 from jsonb_array_elements(q.v2_snapshot#>'{planningPreferences,deliveryWindows}') w where arrival>=(w->>'startsAt')::timestamptz and end_at<=(w->>'endsAt')::timestamptz)
 then raise exception 'INVALID_DISPATCH_SCHEDULE' using errcode='PT400';end if;
end;$$;
create or replace function public.request_v2_carrier_quote(p_organization_id uuid,p_member_id uuid,p_request_id uuid,p_expected_version integer,
 p_key uuid,p_deadline timestamptz,p_candidate jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare q public.freight_requests;s public.carrier_services;p private.carrier_quote_policies;r private.quote_command_receipts;
 h text;ctx jsonb;route jsonb;plan jsonb;opp jsonb;offer jsonb;result jsonb;route_policy uuid;corridor uuid;corridor_count integer;
 allocations jsonb;assignments jsonb;offer_id uuid;expiry timestamptz;distance numeric;transport numeric;total numeric;component jsonb;parts jsonb;ev jsonb;v jsonb;
 sid uuid:=(p_candidate->>'serviceId')::uuid;lane uuid:=(p_candidate->>'laneId')::uuid;cal uuid:=(p_candidate->>'calendarId')::uuid;
 resources jsonb;resource_count integer;fingerprint text;pricing_factor integer;reason text;cost_result jsonb;route_data jsonb;extra_seconds integer;reuse_plan boolean:=false;supersedes uuid;current_offer uuid;begin
 perform private.workflow_member(p_organization_id,p_member_id,true);
 -- Keep the service -> request ordering used by fleet, crew and native workflow commands.
 perform 1 from public.carrier_services order by id for update;
 select * into q from public.freight_requests where id=p_request_id and organization_id=p_organization_id for update;
 if not found then raise exception 'REQUEST_NOT_FOUND' using errcode='PT404';end if;
 if p_expected_version is null or p_expected_version<>q.draft_version then raise exception 'STALE_DRAFT' using errcode='PT409';end if;
 if q.status<>'PENDING' then raise exception 'REQUEST_NOT_SUBMITTED' using errcode='PT409';end if;
 if p_key is null or p_deadline is null or p_deadline<=now() or p_deadline>coalesce((p_candidate#>>'{schedule,pickupAt}')::timestamptz,q.pickup_window_start) or not coalesce(extensions.jsonb_matches_schema(
 '{"type":"object","additionalProperties":false,"required":["serviceId","laneId","calendarId","assetId","poolId"],"properties":{"serviceId":{"type":"string","format":"uuid"},"laneId":{"type":"string","format":"uuid"},"calendarId":{"type":"string","format":"uuid"},"assetId":{"type":["string","null"],"format":"uuid"},"poolId":{"type":["string","null"],"format":"uuid"},"resources":{"type":"array","minItems":2,"maxItems":8,"items":{"type":"object","additionalProperties":false,"required":["calendarId","assetId","poolId","allocations"],"properties":{"calendarId":{"type":"string","format":"uuid"},"assetId":{"type":"string","format":"uuid"},"poolId":{"type":"null"},"allocations":{"type":"array","minItems":1,"items":{"type":"object","additionalProperties":false,"required":["unitIndex","quantity"],"properties":{"unitIndex":{"type":"integer","minimum":0},"quantity":{"type":"integer","minimum":1}}}}}}},"schedule":{"type":"object","additionalProperties":false,"required":["policyVersion","pickupAt","deliveryAt","operationWindow","routeId","transitSeconds"],"properties":{"policyVersion":{"type":"integer","minimum":1},"pickupAt":{"type":"string","format":"date-time"},"deliveryAt":{"type":"string","format":"date-time"},"operationWindow":{"type":"object","additionalProperties":false,"required":["startsAt","endsAt"],"properties":{"startsAt":{"type":"string","format":"date-time"},"endsAt":{"type":"string","format":"date-time"}}},"routeId":{"type":"string","format":"uuid"},"transitSeconds":{"type":"integer","minimum":1}}}}}'::json,p_candidate),false)
 then raise exception 'INVALID_QUOTE_SEARCH' using errcode='PT400';end if;
 if exists(select 1 from private.carrier_quote_policies where service_id=sid and lane_id=lane and value->>'basis'='COST_PLUS') and not p_candidate ? 'schedule' then return jsonb_build_object('serviceId',sid,'planId',null,'opportunityId',null,'offerId',null,'status','REQUIRES_REVIEW','reason','COST_DISPATCH_SCHEDULE_REQUIRED','policyVersion',null);end if;
 resources:=p_candidate->'resources';resource_count:=coalesce(jsonb_array_length(resources),1);
 if resource_count>1 and not coalesce((q.v2_snapshot#>>'{cargoSpecification,divisible}')::boolean,false) then raise exception 'SHIPMENT_SPLIT_NOT_ALLOWED' using errcode='PT400';end if;
 fingerprint:=case when p_candidate ? 'schedule' then private.hash_v2_freight_payload(jsonb_build_object('resources',resources,'schedule',p_candidate->'schedule')) when resources is null then '' else private.hash_v2_freight_payload(resources) end;
 if resources is not null and (p_candidate->'poolId'<>'null'::jsonb or resources->0->>'calendarId' is distinct from p_candidate->>'calendarId' or resources->0->>'assetId' is distinct from p_candidate->>'assetId'
   or (select count(distinct x->>'calendarId') from jsonb_array_elements(resources) x)<>resource_count
   or (select count(distinct x->>'assetId') from jsonb_array_elements(resources) x)<>resource_count)
 then raise exception 'INVALID_QUOTE_CANDIDATE' using errcode='PT400';end if;
 h:=private.hash_v2_freight_payload(jsonb_build_object('request',p_request_id,'version',p_expected_version,'deadline',p_deadline,'candidate',p_candidate));
 perform pg_advisory_xact_lock(hashtextextended('quote-command:'||p_member_id||':'||p_key,0));
 select * into r from private.quote_command_receipts where actor_id=p_member_id and key=p_key and scope='request';
 if found then if r.payload_hash<>h then raise exception 'IDEMPOTENCY_CONFLICT' using errcode='PT409';end if;return r.result;end if;
 select * into s from public.carrier_services where id=sid and active and transport_mode='ROAD' and service_type='FTL';
 if s.id is null or not exists(select 1 from public.service_lanes where id=lane and carrier_service_id=sid and active)
  or not exists(select 1 from public.capacity_calendars cc where cc.id=cal and cc.carrier_service_id=sid
   and cc.transport_asset_id is not distinct from (p_candidate->>'assetId')::uuid and cc.capacity_pool_id is not distinct from (p_candidate->>'poolId')::uuid)
 then raise exception 'INVALID_QUOTE_CANDIDATE' using errcode='PT400';end if;
 if resources is not null and exists(select 1 from jsonb_array_elements(resources) x where not exists(select 1 from public.capacity_calendars cc join public.transport_assets a on a.id=cc.transport_asset_id where cc.id=(x->>'calendarId')::uuid and cc.carrier_service_id=sid and a.id=(x->>'assetId')::uuid and a.carrier_service_id=sid and a.active and a.mode='ROAD')) then raise exception 'INVALID_QUOTE_CANDIDATE' using errcode='PT400';end if;
 select * into p from private.carrier_quote_policies where carrier_id=s.carrier_id and service_id=sid and lane_id=lane for share;
 if q.v2_snapshot ? 'planningPreferences' and not p_candidate ? 'schedule' then raise exception 'DISPATCH_SCHEDULE_REQUIRED' using errcode='PT400';end if;
 if p_candidate ? 'schedule' then perform private.validate_dispatch_schedule(q,p_candidate->'schedule',p,lane);end if;
 select d.result into result from private.quote_dispatches d where request_id=q.id and request_version=q.draft_version and service_id=sid and lane_id=lane and calendar_id=cal and resource_fingerprint=fingerprint;
 if result is not null then
  plan:=private.workflow_record('plans',(result->>'planId')::uuid);opp:=private.workflow_record('opportunities',(result->>'opportunityId')::uuid);
  if not private.workflow_current_plan((plan->>'id')::uuid) then raise exception 'PLAN_REQUIRES_REVIEW' using errcode='PT409';end if;
  select id into current_offer from public.v2_carrier_offers where parent_id=(result->>'opportunityId')::uuid and private.workflow_offer_current(id) order by created_at desc,id limit 1;
  if current_offer is not null then
   result:=result||jsonb_build_object('offerId',current_offer,'status','OFFERED','reason','CURRENT_CARRIER_QUOTE');
   insert into private.quote_command_receipts values(p_member_id,p_key,'request',h,result);return result;
  end if;
  if opp->>'status' in('DECLINED','CANCELLED') then
   result:=result||jsonb_build_object('offerId',null,'status','REQUIRES_REVIEW','reason','CARRIER_DECLINED');
   insert into private.quote_command_receipts values(p_member_id,p_key,'request',h,result);return result;
  end if;
  if (opp#>>'{data,responseDeadline}')::timestamptz>now() then
   reuse_plan:=true;
   select private.workflow_record('routes',route_plan_id) into route from public.transport_plan_candidates where id=(plan->>'id')::uuid;
   select id into supersedes from public.v2_carrier_offers where parent_id=(opp->>'id')::uuid and status='RECEIVED' order by created_at desc,id limit 1;
  end if;
 end if;
 -- This first automatic adapter handles one direct ROAD leg. Ambiguous/multi-leg routes remain manual.
 select count(*),(array_agg(c.id order by c.id))[1] into corridor_count,corridor from public.route_corridors c
 join public.logistics_nodes n1 on n1.id=(c.data->>'originNodeId')::uuid join public.logistics_nodes n2 on n2.id=(c.data->>'destinationNodeId')::uuid
 where c.status='ACTIVE' and n1.status='ACTIVE' and n2.status='ACTIVE' and c.data->>'mode'='ROAD'
 and n1.data#>>'{location,countryCode}'=q.v2_snapshot#>>'{origin,countryCode}' and n2.data#>>'{location,countryCode}'=q.v2_snapshot#>>'{destination,countryCode}'
 and exists(select 1 from public.route_resource_limits limits where limits.status='ACTIVE' and limits.carrier_service_id=sid and limits.corridor_id=c.id
  and limits.combination_id is null and (limits.asset_id is null or limits.asset_id=(p_candidate->>'assetId')::uuid))
 and (resources is null or not exists(select 1 from jsonb_array_elements(resources) x where not exists(select 1 from public.route_resource_limits ll where ll.status='ACTIVE' and ll.carrier_service_id=sid and ll.corridor_id=c.id and ll.combination_id is null and (ll.asset_id is null or ll.asset_id=(x->>'assetId')::uuid))))
 and lower(n1.data#>>'{location,city}')=lower(q.v2_snapshot#>>'{origin,city}') and lower(n2.data#>>'{location,city}')=lower(q.v2_snapshot#>>'{destination,city}');
 select id into route_policy from public.route_planning_policies where status='ACTIVE' order by id limit 1;
 result:=jsonb_build_object('serviceId',sid,'planId',null,'opportunityId',null,'offerId',null,'status','REQUIRES_REVIEW','reason','PUBLISHED_DIRECT_ROUTE_REQUIRED','policyVersion',null);
 if not reuse_plan and (corridor_count<>1 or route_policy is null) then
  insert into private.quote_command_receipts values(p_member_id,p_key,'request',h,result);return result;
 end if;
 if p_candidate ? 'schedule' and corridor is distinct from (p_candidate#>>'{schedule,routeId}')::uuid then raise exception 'DISPATCH_ROUTE_CHANGED' using errcode='PT409';end if;
 ctx:=jsonb_build_object('requestId',q.id,'carrierId',null,'parentId',null,'id',null);
 begin
  if not reuse_plan then
  route:=private.command_v2_workflow(p_organization_id,p_member_id,'routes.create',ctx,gen_random_uuid(),jsonb_build_object('schemaVersion','2.0','corridorIds',jsonb_build_array(corridor),'policyId',route_policy))->'record';
  if resources is null then
  select jsonb_agg(jsonb_build_object('unitIndex',idx-1,'quantity',(unit->>'quantity')::integer) order by idx) into allocations
   from jsonb_array_elements(q.v2_snapshot#>'{cargoSpecification,units}') with ordinality x(unit,idx);
  resources:=jsonb_build_array(jsonb_build_object('calendarId',cal,'assetId',p_candidate->'assetId','poolId',p_candidate->'poolId','allocations',allocations));
  end if;
  select jsonb_agg(jsonb_build_object('calendarId',x->'calendarId','assetId',x->'assetId','capacityPoolId',x->'poolId','combinationId',null,'role','LOAD_BEARING','allocations',x->'allocations') order by n) into resources from jsonb_array_elements(resources) with ordinality r(x,n);
  plan:=private.command_v2_workflow(p_organization_id,p_member_id,'plans.create',ctx,gen_random_uuid(),jsonb_build_object('schemaVersion','2.0','routeId',route->>'id','assignments',jsonb_build_array(
   jsonb_build_object('legSequence',1,'serviceId',sid,'laneId',lane,'window',coalesce(p_candidate#>'{schedule,operationWindow}',jsonb_build_object('startsAt',q.v2_snapshot#>>'{pickupWindow,startsAt}','endsAt',q.v2_snapshot#>>'{deliveryWindow,endsAt}')),
    'resources',resources))))->'record';
  end if;
  if plan#>>'{data,eligibility}'<>'eligible' or not private.workflow_current_plan((plan->>'id')::uuid) then raise exception 'PLAN_REQUIRES_REVIEW' using errcode='PT422';end if;
  select jsonb_agg(x->'id') into assignments from jsonb_array_elements(plan#>'{data,legAssignments}') x;
  if not reuse_plan then
   opp:=private.command_v2_workflow(p_organization_id,p_member_id,'opportunities.create',ctx,gen_random_uuid(),jsonb_build_object('schemaVersion','2.0','planId',plan->>'id','carrierId',s.carrier_id,'assignmentIds',assignments,'responseDeadline',p_deadline,'responseChannel','MANUAL'))->'record';
  end if;
  result:=result||jsonb_build_object('planId',plan->'id','opportunityId',opp->'id','status','AWAITING_CARRIER','reason','MANUAL_QUOTE_REQUIRED');
  select * into p from private.carrier_quote_policies where carrier_id=s.carrier_id and service_id=sid and lane_id=lane for share;
  if p.id is not null and (p.value->>'active')::boolean and (p.value->>'autoIssue')::boolean and (p.value->>'validUntil')::timestamptz>=q.delivery_window_end
   and resource_count<=coalesce((p.value->>'maxResources')::integer,1) and (resource_count=1 or p.value->>'resourcePricing' in('PER_PLAN','PER_RESOURCE')) then
   offer_id:=gen_random_uuid();
   insert into private.quote_issue_context values(pg_backend_pid(),txid_current(),auth.uid(),p.id,offer_id);
   if (private.active_quote_delegation(s.carrier_id)).id is null then delete from private.quote_issue_context where backend_pid=pg_backend_pid() and transaction_id=txid_current();
   else
    distance:=(route#>>'{data,estimatedDistanceKm}')::numeric;
    if p.value->>'basis'='PER_KM' and (distance is null or distance<=0) then
     delete from private.quote_issue_context where backend_pid=pg_backend_pid() and transaction_id=txid_current();
     result:=result||jsonb_build_object('reason','TARIFF_DISTANCE_UNKNOWN');
    else
     expiry:=least(p_deadline,(opp#>>'{data,responseDeadline}')::timestamptz,(p.value->>'validUntil')::timestamptz,now()+make_interval(mins=>(p.value->>'validityMinutes')::integer));
     ev:=jsonb_build_object('reference','quote-policy:'||p.id||':v'||p.version,'provider','Carrier-approved tariff','observedAt',p.updated_at,'validUntil',p.value->>'validUntil',
      'provenanceStatus',p.value->>'provenanceStatus');
     if p.value->>'basis'='COST_PLUS' then
      select data into route_data from public.route_corridors where id=corridor;
      if p.value#>'{operatingCosts,fleet}' is not null and not coalesce(private.cost_route_matches_request(route_data,q.v2_snapshot),false) then raise exception 'EXACT_COST_ROUTE_REQUIRED' using errcode='PT422';end if;
      cost_result:=private.calculate_resource_operating_costs(p.value->'operatingCosts',route_data,resources,(p.value->>'minimumAmount')::numeric,0,(p_candidate#>>'{schedule,operationWindow,endsAt}')::timestamptz,s.carrier_id,sid);
      if cost_result->>'status'<>'READY' then raise exception '%',cost_result->>'reason' using errcode='PT422';end if;
      extra_seconds:=ceil(extract(epoch from ((p_candidate#>>'{schedule,operationWindow,endsAt}')::timestamptz-(p_candidate#>>'{schedule,operationWindow,startsAt}')::timestamptz)))-(cost_result->>'transportSeconds')::integer;
      cost_result:=private.calculate_resource_operating_costs(p.value->'operatingCosts',route_data,resources,(p.value->>'minimumAmount')::numeric,extra_seconds,(p_candidate#>>'{schedule,operationWindow,endsAt}')::timestamptz,s.carrier_id,sid);
      if cost_result->>'status'<>'READY' then raise exception '%',cost_result->>'reason' using errcode='PT422';end if;
      total:=(cost_result->>'totalCents')::numeric/100;
      -- Commercial components are visible to Client; internal wages and markup remain Carrier-private.
      select jsonb_agg(jsonb_build_object('kind',kind,'amount',jsonb_build_object('amount',cents/100,'currency','USD'),'treatment','QUOTED','source',ev,'observedAt',now(),'details','Carrier-approved operating-cost quote') order by kind) into parts
       from (select case when x->>'code' in('FUEL','TOLLS','HANDLING_PER_SHIPMENT','TAX') then x->>'kind' else 'TRANSPORT' end as kind,sum((x->>'cents')::numeric) as cents from jsonb_array_elements(cost_result->'components') x group by 1) quoted;
     else
     pricing_factor:=case when p.value->>'resourcePricing'='PER_RESOURCE' then resource_count else 1 end;
     transport:=pricing_factor*greatest((p.value->>'minimumAmount')::numeric,round((p.value->>'baseAmount')::numeric+case when p.value->>'basis'='PER_KM' then distance*(p.value->>'ratePerKm')::numeric else 0 end,2));total:=transport;
     parts:=jsonb_build_array(jsonb_build_object('kind','TRANSPORT','amount',jsonb_build_object('amount',transport,'currency','USD'),'treatment','QUOTED','source',ev,'observedAt',now(),'details',p.value->>'terms'));
     for component in select value from jsonb_array_elements(jsonb_build_array(jsonb_build_object('kind','FUEL','amount',p.value->'fuelAmount'),jsonb_build_object('kind','TOLL','amount',p.value->'tollAmount'),jsonb_build_object('kind','HANDLING','amount',p.value->'handlingAmount'),jsonb_build_object('kind','TAX','amount',p.value->'taxAmount'))) loop
      total:=total+pricing_factor*(component->>'amount')::numeric;
      parts:=parts||jsonb_build_array(jsonb_build_object('kind',component->>'kind','amount',jsonb_build_object('amount',pricing_factor*(component->>'amount')::numeric,'currency','USD'),'treatment','QUOTED','source',ev,'observedAt',now(),'details','Carrier policy component'));
     end loop;
     end if;
     v:=jsonb_build_object('schemaVersion','2.0','carrierReference','AUTO-'||left(offer_id::text,8),'planCandidateId',plan->'id','coveredServiceIds',jsonb_build_array(sid),'coveredAssignmentIds',assignments,
      'price',jsonb_build_object('amount',total,'currency','USD'),'breakdown',parts,'validity',jsonb_build_object('startsAt',now(),'endsAt',expiry),'issuedAt',now(),
      'estimatedPickupAt',coalesce(p_candidate#>'{schedule,pickupAt}',q.v2_snapshot#>'{pickupWindow,startsAt}'),'estimatedDeliveryAt',coalesce(p_candidate#>'{schedule,deliveryAt}',q.v2_snapshot#>'{deliveryWindow,startsAt}'),
      'transitDurationSeconds',coalesce(p_candidate#>'{schedule,transitSeconds}',route#>'{data,estimatedDurationSeconds}'),'reservableCapacity',jsonb_build_object('weightKg',q.v2_snapshot#>'{cargoSpecification,totalWeightKg}','volumeM3',q.v2_snapshot#>'{cargoSpecification,totalVolumeM3}'),
      'commercialTerms',jsonb_build_array(jsonb_build_object('code','CARRIER_POLICY','description',(p.value->>'terms')||' | resources='||resource_count||'; pricing='||coalesce(p.value->>'resourcePricing','PER_PLAN')),jsonb_build_object('code','CONFIRMATION_WINDOW_MINUTES','description',p.value->>'confirmationMinutes')),
      'evidence',case when p.value->>'basis'='COST_PLUS' then jsonb_build_array(ev,route_data#>'{operatingProfile,source}') else jsonb_build_array(ev) end,'source',jsonb_build_object('channel','API','evidence',ev),'supersedesOfferId',supersedes);
     perform private.workflow_validate('offers.create',v);
     -- Use the same grouped-leg to resource-binding adapter as the native Carrier command.
     v:=jsonb_set(v,'{coveredAssignmentIds}',private.expand_leg_assignments(v->'coveredAssignmentIds',(v->>'planCandidateId')::uuid));
     offer:=private.workflow_offer(null,p.operator_id,s.carrier_id,(opp->>'id')::uuid,v,offer_id);
     insert into private.quote_issued_offers(offer_id,policy_id,policy_version,policy_snapshot,issued_at,calculation_snapshot) values(offer_id,p.id,p.version,p.value,now(),case when p.value->>'basis'='COST_PLUS' then jsonb_build_object('calculation',cost_result,'distanceKm',route_data->'estimatedDistanceKm','operatingProfile',route_data->'operatingProfile','restLocations',(select coalesce(jsonb_agg(jsonb_build_object('waypointIndex',ord-1,'label',point#>>'{location,label}','city',point#>>'{location,city}') order by ord),'[]'::jsonb) from jsonb_array_elements(coalesce(route_data->'waypoints','[]'::jsonb)) with ordinality nodes(point,ord) where point->>'kind'='REST')) else null end);
     delete from private.quote_issue_context where backend_pid=pg_backend_pid() and transaction_id=txid_current();
     result:=result||jsonb_build_object('offerId',offer_id,'status','OFFERED','reason','CARRIER_POLICY_QUOTE','policyVersion',p.version);
    end if;
   end if;
  end if;
  if p_candidate ? 'schedule' then result:=result||jsonb_build_object('schedule',p_candidate->'schedule');end if;
  insert into private.quote_dispatches(request_id,request_version,service_id,lane_id,calendar_id,result,created_at,resource_fingerprint) values(q.id,q.draft_version,sid,lane,cal,result,now(),fingerprint)
   on conflict(request_id,request_version,service_id,lane_id,calendar_id,resource_fingerprint) do update set result=excluded.result,created_at=excluded.created_at;
 exception when sqlstate 'PT422' or sqlstate 'PT409' or sqlstate 'PT400' then
  get stacked diagnostics reason=message_text;
  result:=jsonb_build_object('serviceId',sid,'planId',null,'opportunityId',null,'offerId',null,'status','REQUIRES_REVIEW','reason',reason,'policyVersion',null);
 end;
 insert into private.quote_command_receipts values(p_member_id,p_key,'request',h,result);return result;
end;$$;

-- Read-only commercial estimate. Private rates/driver wages are never returned to the Client.
-- Booking and final emission still revalidate capacity and policy atomically through their native commands.
create function public.preview_v2_dispatch_costs(p_organization_id uuid,p_member_id uuid,p_request_id uuid,p_expected_version integer,p_candidates jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare q public.freight_requests;p private.carrier_quote_policies;c jsonb;r jsonb;resources jsonb;cost jsonb;results jsonb:='[]';idx int:=0;extra int;reason text;carrier uuid;begin
 perform private.workflow_member(p_organization_id,p_member_id,false);
 select * into q from public.freight_requests where id=p_request_id and organization_id=p_organization_id;
 if not found then raise exception 'REQUEST_NOT_FOUND' using errcode='PT404';end if;
 if q.draft_version is distinct from p_expected_version then raise exception 'STALE_DRAFT' using errcode='PT409';end if;
 if q.status<>'PENDING' then raise exception 'REQUEST_NOT_SUBMITTED' using errcode='PT409';end if;
 if p_candidates is null or jsonb_typeof(p_candidates)<>'array' or jsonb_array_length(p_candidates)>128 then raise exception 'DISPATCH_COST_SEARCH_LIMIT' using errcode='PT400';end if;
 for c in select value from jsonb_array_elements(p_candidates) loop
  begin
   select * into p from private.carrier_quote_policies where service_id=(c->>'serviceId')::uuid and lane_id=(c->>'laneId')::uuid;
   if p.id is null or p.value->>'basis'<>'COST_PLUS' or not private.dispatch_policy_authorized(p) then raise exception 'COST_POLICY_REQUIRED' using errcode='PT422';end if;
   if (p.value->>'validUntil')::timestamptz<q.delivery_window_end or not exists(select 1 from public.carrier_services where id=p.service_id and carrier_id=p.carrier_id and active) then raise exception 'COST_POLICY_SCOPE_OR_VALIDITY' using errcode='PT422';end if;
   perform private.validate_dispatch_schedule(q,c->'schedule',p,(c->>'laneId')::uuid);
   select rc.data into r from public.route_corridors rc join public.logistics_nodes n1 on n1.id=rc.origin_node_id join public.logistics_nodes n2 on n2.id=rc.destination_node_id
    where rc.id=(c#>>'{schedule,routeId}')::uuid and rc.status='ACTIVE' and n1.status='ACTIVE' and n2.status='ACTIVE'
    and n1.data#>>'{location,countryCode}'=q.v2_snapshot#>>'{origin,countryCode}' and n2.data#>>'{location,countryCode}'=q.v2_snapshot#>>'{destination,countryCode}'
    and lower(n1.data#>>'{location,city}')=lower(q.v2_snapshot#>>'{origin,city}') and lower(n2.data#>>'{location,city}')=lower(q.v2_snapshot#>>'{destination,city}');
   if r is null then raise exception 'COST_ROUTE_SCOPE' using errcode='PT422';end if;
   if p.value#>'{operatingCosts,fleet}' is not null and not coalesce(private.cost_route_matches_request(r,q.v2_snapshot),false) then raise exception 'EXACT_COST_ROUTE_REQUIRED' using errcode='PT422';end if;
   resources:=coalesce(c->'resources',jsonb_build_array(jsonb_build_object('assetId',c->'assetId','calendarId',c->'calendarId')));
   if jsonb_array_length(resources)>coalesce((p.value->>'maxResources')::int,1) or exists(select 1 from jsonb_array_elements(resources) x where not exists(select 1 from public.route_resource_limits rr where rr.carrier_service_id=p.service_id and rr.corridor_id=(c#>>'{schedule,routeId}')::uuid and rr.asset_id=(x->>'assetId')::uuid and rr.status='ACTIVE')) then raise exception 'COST_RESOURCE_SCOPE' using errcode='PT422';end if;
   cost:=private.calculate_resource_operating_costs(p.value->'operatingCosts',r,resources,(p.value->>'minimumAmount')::numeric,0,(c#>>'{schedule,operationWindow,endsAt}')::timestamptz,p.carrier_id,p.service_id);
   if cost->>'status'<>'READY' then raise exception '%',cost->>'reason' using errcode='PT422';end if;
   extra:=ceil(extract(epoch from ((c#>>'{schedule,operationWindow,endsAt}')::timestamptz-(c#>>'{schedule,operationWindow,startsAt}')::timestamptz)))-(cost->>'transportSeconds')::int;
   cost:=private.calculate_resource_operating_costs(p.value->'operatingCosts',r,resources,(p.value->>'minimumAmount')::numeric,extra,(c#>>'{schedule,operationWindow,endsAt}')::timestamptz,p.carrier_id,p.service_id);
   if cost->>'status'<>'READY' then raise exception '%',cost->>'reason' using errcode='PT422';end if;
   results:=results||jsonb_build_array(jsonb_build_object('index',idx,'status','READY','totalCents',cost->'totalCents','reason',null));
  exception when sqlstate 'PT422' or sqlstate 'PT400' or sqlstate 'PT409' or data_exception then
   get stacked diagnostics reason=message_text;results:=results||jsonb_build_array(jsonb_build_object('index',idx,'status','REQUIRES_REVIEW','totalCents',null,'reason',reason));
  end;idx:=idx+1;
 end loop;return results;
end;$$;
revoke all on function public.preview_v2_dispatch_costs(uuid,uuid,uuid,integer,jsonb) from public,anon,service_role;
grant execute on function public.preview_v2_dispatch_costs(uuid,uuid,uuid,integer,jsonb) to authenticated;

create function public.read_v2_carrier_cost_calculation(p_carrier_id uuid,p_operator_id uuid,p_offer_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$declare result jsonb;begin
 if p_operator_id is distinct from private.identity_carrier(p_carrier_id) then raise exception 'FORBIDDEN_CARRIER_IDENTITY' using errcode='PT403';end if;
 perform private.identity_carrier_action(p_carrier_id,'limits.publish');
 select jsonb_build_object('offerId',q.offer_id,'policyVersion',q.policy_version,'snapshot',q.calculation_snapshot,'parameters',q.policy_snapshot->'operatingCosts') into result from private.quote_issued_offers q join public.v2_carrier_offers o on o.id=q.offer_id where q.offer_id=p_offer_id and o.carrier_id=p_carrier_id;
 return result;
end;$$;
revoke all on function public.read_v2_carrier_cost_calculation(uuid,uuid,uuid) from public,anon,service_role;
grant execute on function public.read_v2_carrier_cost_calculation(uuid,uuid,uuid) to authenticated;
revoke all on function private.calculate_resource_operating_costs(jsonb,jsonb,jsonb,numeric,integer,timestamptz,uuid,uuid),private.cost_route_matches_request(jsonb,jsonb) from public,anon,authenticated,service_role;
revoke all on function private.operating_cost_policy_schema(),private.valid_operating_cost_policy(jsonb),private.valid_route_operating_profile(jsonb),private.route_operating_profile_schema(),private.calculate_operating_costs(jsonb,jsonb,integer,numeric,integer,timestamptz),private.dispatch_transit_seconds(jsonb,integer,jsonb),private.workflow_validate_before_costs(text,jsonb),private.workflow_validate(text,jsonb) from public,anon,authenticated,service_role;
commit;
