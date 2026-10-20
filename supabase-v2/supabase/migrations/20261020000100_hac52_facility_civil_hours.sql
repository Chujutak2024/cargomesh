-- Part of HAC-52. Additive scheduling validator port from HAC-51.
-- No synthetic data, request planning, Carrier agenda or Depot changes.
begin;
create function private.hac52_valid_facility_hours(v jsonb) returns boolean
language plpgsql stable set search_path='' as $$declare h jsonb;begin
 if not coalesce(extensions.jsonb_matches_schema('{
  "type":"object","required":["timezone","weekly"],"additionalProperties":false,
  "properties":{"timezone":{"type":"string","minLength":1},"weekly":{"type":"array","maxItems":28,
   "items":{"type":"object","required":["dayOfWeek","opensAt","closesAt"],"additionalProperties":false,
    "properties":{"dayOfWeek":{"type":"integer","minimum":1,"maximum":7},
     "opensAt":{"type":"string","pattern":"^([01][0-9]|2[0-3]):[0-5][0-9]$"},
     "closesAt":{"type":"string","pattern":"^(([01][0-9]|2[0-3]):[0-5][0-9]|24:00)$"}}}}}
 }'::json,v),false) then return false;end if;
 if not exists(select 1 from pg_catalog.pg_timezone_names where name=v->>'timezone') then return false;end if;
 for h in select value from jsonb_array_elements(v->'weekly') loop
  if h->>'opensAt'>=h->>'closesAt' then return false;end if;
 end loop;
 return not exists(select 1 from jsonb_array_elements(v->'weekly') with ordinality a(h,n)
  join jsonb_array_elements(v->'weekly') with ordinality b(h,n) on a.n<b.n
  where a.h->>'dayOfWeek'=b.h->>'dayOfWeek' and a.h->>'opensAt'<b.h->>'closesAt' and b.h->>'opensAt'<a.h->>'closesAt');
end;$$;
create or replace function private.valid_v2_facility_details(p_rules jsonb,p_hours jsonb) returns boolean
language plpgsql stable set search_path='' as $$declare item jsonb;begin
 if jsonb_typeof(p_rules) is distinct from 'array' or jsonb_array_length(p_rules)>100 then return false;end if;
 for item in select value from jsonb_array_elements(p_rules) loop
  if not coalesce(extensions.jsonb_matches_schema('{
   "type":"object","required":["code","description","evidenceReference"],"additionalProperties":false,
   "properties":{"code":{"type":"string","minLength":1,"maxLength":100,"pattern":"\\S"},
    "description":{"type":"string","minLength":1,"maxLength":1000,"pattern":"\\S"},
    "evidenceReference":{"type":["string","null"],"minLength":1,"maxLength":500,"pattern":"\\S"}}
  }'::json,item),false) then return false;end if;
 end loop;
 return p_hours is null or p_hours='null'::jsonb or private.hac52_valid_facility_hours(p_hours);
end;$$;
revoke all on function private.hac52_valid_facility_hours(jsonb) from public,anon,authenticated,service_role;
grant execute on function private.hac52_valid_facility_hours(jsonb) to authenticated,service_role;
notify pgrst,'reload schema';
commit;
