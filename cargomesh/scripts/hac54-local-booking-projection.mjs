// Apply only the existing main booking read projection to the named local database, without reset.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const container='supabase_db_cargomesh-v2-local',version='20261015122904';
const sql=readFileSync(fileURLToPath(new URL('../../supabase-v2/supabase/migrations/20261015122904_hac50_booking_offer_projection.sql',import.meta.url)),'utf8');
const committed=execFileSync('git',['show','HEAD:supabase-v2/supabase/migrations/20261015122904_hac50_booking_offer_projection.sql'],{encoding:'utf8'});
assert.equal(sql.replaceAll('\r\n','\n'),committed.replaceAll('\r\n','\n'),'Only the committed existing migration may run.');
const gateway=JSON.parse(execFileSync('docker',['inspect','supabase_kong_cargomesh-v2-local'],{encoding:'utf8'}))[0];
assert.ok(gateway.State.Running&&gateway.NetworkSettings.Ports['8000/tcp'].some(p=>p.HostPort==='61321'));
const run=input=>execFileSync('docker',['exec','-i',container,'psql','-X','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-A','-t','-q'],{input,encoding:'utf8'}).trim();
const applied=run(`select exists(select 1 from supabase_migrations.schema_migrations where version='${version}');`)==='t';
if(!applied){
 assert.equal(run("select to_regprocedure('private.workflow_record_before_model_associations(text,uuid)') is not null and exists(select 1 from information_schema.columns where table_schema='public' and table_name='plan_leg_assignments' and column_name='fulfilment_partner_id');"),'t','Existing prerequisite projection/schema required.');
 // Register this exact migration atomically. Other pending Depot/Border/Driver migrations remain pending.
 const literal=sql.replaceAll("'","''");
 run(sql.replace(/commit;\s*$/i,`insert into supabase_migrations.schema_migrations(version,name,statements) values('${version}','hac50_booking_offer_projection',ARRAY['${literal}']);\ncommit;`));
}
console.log(JSON.stringify({localOnly:true,container,migration:version,alreadyApplied:applied,reset:false,unrelatedPendingMigrationsApplied:false}));
