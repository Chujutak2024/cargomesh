"""Remove only recorded Auth operational keys from a verified disposable bank.

Users are retained for the native scenario cleanup. Secret session/token columns
are never backed up, logged, or interpolated into a delete predicate.
"""
import json
from common import save
from fk_strict import lit, table_ident


def clean_auth_ids(bank):
    bank.own('auth-operational-key-backup')
    catalog = bank.raw_sql('auth-cleanup-key-catalog', """
select coalesce(jsonb_agg(jsonb_build_object('table',n.nspname||'.'||c.relname,'keys',
 (select jsonb_agg(a.attname order by u.ord) from pg_constraint p
 cross join lateral unnest(p.conkey) with ordinality u(num,ord)
 join pg_attribute a on a.attrelid=p.conrelid and a.attnum=u.num
 where p.conrelid=c.oid and p.contype='p')) order by c.relname),'[]')
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='auth' and c.relkind in('r','p')
and c.relname not in('users','schema_migrations');
""")
    if catalog.returncode:
        raise RuntimeError('Cannot discover Auth operational keys')
    identifiers, before = [], {}
    for table in json.loads(catalog.stdout):
        relation = table_ident(table['table'])
        count = bank.raw_sql('auth-cleanup-before-' + table['table'], 'select count(*) from ' + relation + ';')
        if count.returncode:
            raise RuntimeError('Cannot count Auth operational rows')
        before[table['table']] = int(count.stdout.strip())
        keys = table['keys']
        if not keys:
            if before[table['table']]:
                raise RuntimeError('Auth table without a reviewed physical key')
            continue
        if any(k not in ('id','session_id','authentication_method','user_id','provider_id','domain','factor_id') for k in keys):
            raise RuntimeError('Unreviewed Auth physical key; no secret backup allowed')
        projection = ','.join(lit(k) + ',t."' + k + '"' for k in keys)
        rows = bank.raw_sql('auth-cleanup-keys-' + table['table'],
            "select coalesce(jsonb_agg(jsonb_build_object(" + projection + ")), '[]') from " + relation + ' t;')
        if rows.returncode:
            raise RuntimeError('Cannot back up nonsecret Auth keys')
        identifiers.extend({'relation': table['table'], 'key': key} for key in json.loads(rows.stdout))
    audit = bank.raw_sql('auth-cleanup-incoming-fks', """
select coalesce(jsonb_agg(jsonb_build_object('child',conrelid::regclass::text,
 'parent',confrelid::regclass::text,'onDelete',confdeltype,'definition',pg_get_constraintdef(oid))),'[]')
from pg_constraint where contype='f' and confrelid in(
 select c.oid from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='auth');
""")
    if audit.returncode:
        raise RuntimeError('Cannot audit Auth incoming CASCADE edges')
    save('auth-cleanup-nonsecret-backup.json', {'before': before, 'physicalKeys': identifiers,
         'incomingFKs': json.loads(audit.stdout), 'secretColumns': 'Never exported'})
    if identifiers:
        values = ','.join('(' + lit(r['relation']) + ',' + lit(r['key']) + '::jsonb)' for r in identifiers)
        query = 'begin; create temporary table auth_remove(relation text,key jsonb,primary key(relation,key)) on commit drop;insert into auth_remove values ' + values + ';'
        query += """
create function pg_temp.auth_key_where(k jsonb) returns text language sql as $$
 select string_agg(format('t.%I is not distinct from %L',name,k->>name),' and ')
 from jsonb_object_keys(k) name $$;
do $$declare item record;fk record;joins text;child_exists boolean;blocked boolean;progress int;affected int;
begin while exists(select 1 from auth_remove) loop
 progress:=0;
 for item in select * from auth_remove order by relation,key loop
  blocked:=false;
  for fk in select * from pg_constraint where contype='f' and confrelid=to_regclass(item.relation) loop
   select string_agg(format('child.%I=t.%I',a.attname,b.attname),' and ') into joins
   from unnest(fk.conkey,fk.confkey) k(l,r)
   join pg_attribute a on a.attrelid=fk.conrelid and a.attnum=k.l
   join pg_attribute b on b.attrelid=fk.confrelid and b.attnum=k.r;
   execute format('select exists(select 1 from %s child join %s t on %s where %s)',
    fk.conrelid::regclass,item.relation,joins,pg_temp.auth_key_where(item.key)) into child_exists;
   if child_exists then blocked:=true;end if;
  end loop;
  if blocked then continue;end if;
  execute format('delete from %s t where %s',item.relation,pg_temp.auth_key_where(item.key));
  get diagnostics affected=row_count;
  if affected<>1 then raise exception 'AUTH_CLEANUP_KEY_CHANGED';end if;
  delete from auth_remove where relation=item.relation and key=item.key;
  progress:=progress+1;
 end loop;
 if progress=0 then raise exception 'AUTH_CLEANUP_EXTERNAL_CHILD_OR_CYCLE';end if;
end loop;end$$;
commit;
"""
        bank.own('auth-delete-explicit-operational-ids')
        result = bank.raw_sql('auth-cleanup-exact-ids', query)
        if result.returncode:
            raise RuntimeError('Auth exact-ID cleanup aborted; transaction rolled back')
    after = {}
    for table in before:
        count = bank.raw_sql('auth-cleanup-after-' + table, 'select count(*) from ' + table_ident(table) + ';')
        if count.returncode:
            raise RuntimeError('Cannot verify Auth cleanup counts')
        after[table] = int(count.stdout.strip())
    if any(after.values()):
        raise RuntimeError('Auth operational cleanup is not zero')
    save('auth-cleanup-result.json', {'status':'PASS','before':before,'after':after,
         'removedExplicitKeys':len(identifiers),'cascadeUsed':False,'usersRetained':True})
