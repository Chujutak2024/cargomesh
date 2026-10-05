\set ON_ERROR_STOP on
\if :{?local_only}
\else
\set local_only 0
\endif
\if :local_only
\else
do $$begin raise exception 'HAC44_LOCAL_ONLY';end$$;
\endif
select hac44_qa.capture_ids();
select 'HAC44_COUNTS:'||hac44_qa.counts()::text;
