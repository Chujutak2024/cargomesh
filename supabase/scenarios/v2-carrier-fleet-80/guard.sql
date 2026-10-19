\set ON_ERROR_STOP on
\if :{?local_only}
\else
\set local_only 0
\endif
\if :local_only
\else
do $$begin raise exception 'HAC50_SCENARIO_LOCAL_ONLY';end$$;
\endif
do $$begin
 if current_database() !~ '^hac50_scenario_[a-z0-9_]+$' or inet_server_addr() is not null or current_user<>'postgres' then
  raise exception 'HAC50_ISOLATED_LOCAL_POSTGRES_REQUIRED';end if;
end$$;
