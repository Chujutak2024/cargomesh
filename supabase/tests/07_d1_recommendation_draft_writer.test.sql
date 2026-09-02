begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;
select plan(8);

select has_column(
  'public', 'freight_requests', 'draft_version',
  'D1-01 stores a persisted optimistic draft version'
);
select col_type_is(
  'public', 'freight_requests', 'draft_version', 'integer',
  'draft_version is an integer'
);
select col_not_null(
  'public', 'freight_requests', 'draft_version',
  'draft_version is never nullable'
);
select ok(
  exists (
    select 1 from pg_attrdef d
    join pg_class c on c.oid = d.adrelid
    join pg_attribute a on a.attrelid = c.oid and a.attnum = d.adnum
    where c.oid = 'public.freight_requests'::regclass
      and a.attname = 'draft_version'
      and pg_get_expr(d.adbin, d.adrelid) = '1'
  ),
  'draft_version defaults to one'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.freight_requests'::regclass),
  'D1-01 leaves RLS enabled on freight_requests'
);
select ok(
  not has_table_privilege('anon', 'public.freight_requests', 'UPDATE'),
  'D1-01 grants no anonymous update privilege'
);
select ok(
  has_table_privilege('service_role', 'public.freight_requests', 'UPDATE'),
  'service_role retains the server-only update privilege'
);

set local role service_role;
select throws_ok(
  $$update public.freight_requests set draft_version = 0 where code = 'FR-1042'$$,
  '23514',
  null,
  'draft_version rejects non-positive values'
);

select * from finish();
rollback;
