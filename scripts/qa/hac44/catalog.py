from local import *

QUERY="""select jsonb_build_object(
'columns',(select jsonb_agg(to_jsonb(x)) from (select table_schema,table_name,column_name,data_type,udt_name,is_nullable,column_default,character_maximum_length,numeric_precision,numeric_scale,datetime_precision from information_schema.columns where table_schema in('public','private') order by table_schema,table_name,ordinal_position)x),
'constraints',(select jsonb_agg(to_jsonb(x)) from (select n.nspname as schema,c.conrelid::regclass::text as relation,c.conname,c.contype,pg_get_constraintdef(c.oid) as definition,c.confdeltype,c.confrelid::regclass::text as target,c.conkey,c.confkey from pg_constraint c join pg_namespace n on n.oid=c.connamespace where n.nspname in('public','private') order by 1,2,3)x),
'indexes',(select jsonb_agg(to_jsonb(x)) from (select schemaname,tablename,indexname,indexdef from pg_indexes where schemaname in('public','private') order by 1,2,3)x),
'tables',(select jsonb_agg(to_jsonb(x)) from (select n.nspname as schema,c.relname,c.relkind,c.relrowsecurity,c.relforcerowsecurity,c.relacl::text from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in('public','private') and c.relkind in('r','v') order by 1,2)x),
'policies',(select jsonb_agg(to_jsonb(x)) from (select schemaname,tablename,policyname,roles,cmd,qual,with_check from pg_policies where schemaname in('public','private') order by 1,2,3)x),
'grants',(select jsonb_agg(to_jsonb(x)) from (select table_schema,table_name,grantee,privilege_type from information_schema.table_privileges where table_schema in('public','private') and grantee in('PUBLIC','anon','authenticated','service_role') order by 1,2,3,4)x),
'functions',(select jsonb_agg(to_jsonb(x)) from (select n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) as args,p.prosecdef,p.proconfig,p.proacl::text,pg_get_functiondef(p.oid) as definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and p.prokind='f' order by 1,2)x),
'triggers',(select jsonb_agg(to_jsonb(x)) from (select n.nspname as schema,c.relname as relation,t.tgname,t.tgenabled,t.tgisinternal,pg_get_triggerdef(t.oid) as definition from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in('public','private') order by 1,2,3)x),
'keys',(select jsonb_agg(to_jsonb(x)) from (select n.nspname as schema,c.relname as relation,co.conname,array_agg(a.attname order by u.ord) as columns from pg_constraint co join pg_class c on c.oid=co.conrelid join pg_namespace n on n.oid=c.relnamespace join lateral unnest(co.conkey) with ordinality u(attnum,ord) on true join pg_attribute a on a.attrelid=c.oid and a.attnum=u.attnum where co.contype='p' and n.nspname in('public','private') group by 1,2,3 order by 1,2)x)
)::text;"""

if __name__=='__main__':
    p=sql('catalog',QUERY);assert p.returncode==0
    cat=json.loads(p.stdout);save('catalog.json',cat)
    print(json.dumps({k:len(v or []) for k,v in cat.items()}))
