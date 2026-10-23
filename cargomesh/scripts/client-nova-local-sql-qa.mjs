// Repeatable pgTAP against the populated local demo, with all QA fixture changes rolled back.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
assert.equal(process.env.CLIENT_NOVA_AUTHORIZE_LOCAL_QA, '1', 'Explicit local QA authorization required');
const container = 'supabase_db_cargomesh-v2-local';
const info = JSON.parse(execFileSync('docker', ['inspect', container], { encoding: 'utf8' }))[0];
assert.ok(info.State.Running && info.Config.Labels['com.supabase.cli.project'] === 'cargomesh-v2-local');
assert.ok(info.NetworkSettings.Ports['5432/tcp'].some(row => row.HostPort === '61322'));
const run = sql => execFileSync('docker', ['exec', '-i', container, 'psql', '-X', '-A', '-t', '-q', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'postgres'], { input: sql, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }).trim();
const snapshot = () => run("select jsonb_build_object('requests',(select count(*) from public.freight_requests),'bookings',(select count(*) from public.v2_bookings),'operators',(select count(*) from public.carrier_operators),'routes',(select count(*) from public.route_corridors),'activeRoutes',(select count(*) from public.route_corridors where status='ACTIVE'))::text;");
const before = snapshot();
for (const name of ['44_v2_dispatch_schedule.test.sql', '48_v2_client_execution_preparation.test.sql']) {
  let sql = readFileSync(new URL('../../supabase/tests/' + name, import.meta.url), 'utf8');
  assert.match(sql.trim(), /rollback;$/i); assert.doesNotMatch(sql, /\bcommit\s*;/i);
  if (name.startsWith('44_')) {
    // The canonical test assumes a clean baseline; keep its assertions intact in this populated bank.
    // Isolate existing routes and supply the missing synthetic baseline actor ONLY inside its rollback.
    const fixture = `
update public.route_corridors set status='INACTIVE' where status='ACTIVE';
insert into public.carrier_operators(id,carrier_id,auth_user_id,display_name,role,status,verified_at)
values('c2380000-0000-4000-8000-000000000023','c2340000-0000-4000-8000-000000000001',
'c2310000-0000-4000-8000-000000000001','Synthetic Nova SQL QA','ADMIN','ACTIVE',now())
on conflict(carrier_id,auth_user_id) do nothing;
`;
    sql = sql.replace('begin;', 'begin;' + fixture)
      .replaceAll('WORKFLOW_QA', 'NOVA_FLOW_20261023').replaceAll('MULTI_TRUCK_02', 'NOVA_MULTI_20261023')
      .replaceAll('QA-001', 'NV-231001').replaceAll('QA-MULTI-02', 'NV-231002').replaceAll('QA-1', 'NOVA-20261023');
  }
  const result = run(sql);
  assert.equal(snapshot(), before, 'Rolled-back QA must not alter the local demo');
  console.log(name + '\n' + result.split(/\r?\n/).filter(line => /^(?:ok|not ok|1\.\.|#)/.test(line)).join('\n'));
  assert.doesNotMatch(result, /^not ok/m, 'pgTAP assertions must all pass');
  assert.match(result, /^1\.\.\d+/m, 'pgTAP must finish its plan');
}
console.log('PASS: local SQL QA rolled back; requests, bookings, actors and route status counts unchanged.');
