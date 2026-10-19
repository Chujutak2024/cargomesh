-- Capability probe only. No rows are removed; no guards are disabled.
\ir guard.sql
begin;
do $$begin
 begin
  delete from public.drivers where id='e500000b-0000-4000-8000-000000000101';
  if not found then raise exception 'HAC50_SCENARIO_NOT_SEEDED';end if;
  raise exception 'HAC50_EXPECTED_DRIVER_DELETE_GUARD';
 exception when insufficient_privilege then
  if sqlerrm<>'COMMAND_REQUIRED' then raise;end if;
 end;
end$$;
select 'PASS: crew DELETE remains protected; discard only a dedicated database through a separately authorized operation';
rollback;
