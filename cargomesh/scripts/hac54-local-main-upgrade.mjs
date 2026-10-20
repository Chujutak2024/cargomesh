// Existing approved main migrations, named local V2 bank only; no reset or hosted access.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,readdirSync,statSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const main='f17fdc66cdade6b2820925918df871444c52ae79',container='supabase_db_cargomesh-v2-local';
assert.equal(process.env.HAC54_LOCAL_AUTHORIZE_MAIN_MIGRATIONS,'1','Explicit local migration authorization required.');
const gateway=JSON.parse(execFileSync('docker',['inspect','supabase_kong_cargomesh-v2-local'],{encoding:'utf8'}))[0];
assert.ok(gateway.State.Running&&gateway.NetworkSettings.Ports['8000/tcp'].some(row=>row.HostPort==='61321'));
assert.ok(statSync('C:/Users/holap/Documents/Codex/HAC54-private-backups/v2-before-main-20261020.dump').size>100000);
const run=sql=>execFileSync('docker',['exec','-i',container,'psql','-X','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-A','-t','-q'],{input:sql,encoding:'utf8'}).trim();
const directory=fileURLToPath(new URL('../../supabase-v2/supabase/migrations/',import.meta.url));
const applied=new Set(run('select version from supabase_migrations.schema_migrations order by version;').split(/\r?\n/));
const files=readdirSync(directory).filter(file=>/^\d{14}_.+\.sql$/.test(file)).sort();
const pending=files.filter(file=>!applied.has(file.slice(0,14))),chunks=[];
for(const file of pending){
 const sql=readFileSync(directory+file,'utf8'),committed=execFileSync('git',['show',`${main}:supabase-v2/supabase/migrations/${file}`],{encoding:'utf8'});
 assert.equal(sql.replaceAll('\r\n','\n'),committed.replaceAll('\r\n','\n'),'Only unchanged approved main migration: '+file);
 assert.ok(!/\b(?:truncate|drop\s+(?:table|schema)|delete\s+from)\b/i.test(sql),'Destructive migration requires a separate review: '+file);
 const literal=sql.replaceAll("'","''"),version=file.slice(0,14),name=file.slice(15,-4);
 chunks.push(sql.replace(/^\s*(?:begin|commit);[ \t]*$/gmi,'')+`\ninsert into supabase_migrations.schema_migrations(version,name,statements) values('${version}','${name}',ARRAY['${literal}']);`);
}
if(chunks.length)run('begin;\n'+chunks.join('\n')+'\ncommit;');
console.log(JSON.stringify({localOnly:true,container,approvedMain:main,applied:pending,ledgerCount:Number(run('select count(*) from supabase_migrations.schema_migrations;')),reset:false}));
