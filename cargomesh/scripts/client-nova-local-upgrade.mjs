// Explicitly authorized local-only schema sync. Never resets/seeds or contacts hosted Supabase.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

assert.equal(process.env.CLIENT_NOVA_AUTHORIZE_LOCAL_MIGRATIONS, '1', 'Local migration authorization required');
const approvedMain = '5f37cb2c8e5340f2dc8a5c252c7817005c66e415';
const container = 'supabase_db_cargomesh-v2-local';
const repository = fileURLToPath(new URL('../../', import.meta.url));
const directory = path.join(repository, 'supabase-v2/supabase/migrations');
const docker = (...args) => execFileSync('docker', args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
const info = JSON.parse(docker('inspect', container))[0];
assert.equal(info.Config.Labels['com.supabase.cli.project'], 'cargomesh-v2-local');
assert.ok(info.State.Running && info.NetworkSettings.Ports['5432/tcp'].some(row => row.HostPort === '61322'));
const run = sql => execFileSync('docker', ['exec', '-i', container, 'psql', '-X', '-q', '-A', '-t', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'], { input: sql, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }).trim();
const applied = new Set(run('select version from supabase_migrations.schema_migrations order by version;').split(/\r?\n/));
const pending = readdirSync(directory).filter(file => /^\d{14}_.+\.sql$/.test(file) && !applied.has(file.slice(0, 14))).sort();
assert.ok(pending.every(file => file.slice(0, 14) > '20261020150746' && file.slice(0, 14) <= '20261022100000'), 'Unexpected pending migration');
if (!pending.length) { console.log('Local schema already synchronized. No changes.'); process.exit(0); }
assert.equal(pending.length, 12, 'Re-review any changed migration set before proceeding');
const chunks = pending.map(file => {
  const sql = readFileSync(path.join(directory, file), 'utf8');
  const committed = execFileSync('git', ['show', `${approvedMain}:supabase-v2/supabase/migrations/${file}`], { cwd: repository, encoding: 'utf8' });
  assert.equal(sql.replaceAll('\r\n', '\n'), committed.replaceAll('\r\n', '\n'), 'Unchanged main SQL only: ' + file);
  // Reviewed cleanup inside function definitions only; no business rows are deleted by these migrations.
  const guardedSql = sql.replaceAll(/delete from private\.quote_issue_context where backend_pid=pg_backend_pid\(\) and transaction_id=txid_current\(\);/gi, '');
  assert.ok(!/\b(?:truncate|drop\s+(?:table|schema)|delete\s+from)\b/i.test(guardedSql), 'Destructive SQL requires separate review: ' + file);
  const literal = sql.replaceAll("'", "''");
  return sql.replace(/^\s*(?:begin|commit);[ \t]*$/gmi, '') + `\ninsert into supabase_migrations.schema_migrations(version,name,statements) values('${file.slice(0, 14)}','${file.slice(15, -4)}',ARRAY['${literal}']);`;
});
const backupDirectory = 'C:/Users/holap/Documents/Codex/CLIENT-NOVA-private-backups';
mkdirSync(backupDirectory, { recursive: true });
const stamp = new Date().toISOString().replaceAll(/[:.]/g, '-');
const basename = `v2-before-nova-${stamp}.dump`;
const backup = path.join(backupDirectory, basename);
assert.ok(path.relative(repository, backup).startsWith('..' + path.sep), 'Backup must stay outside Git');
docker('exec', container, 'pg_dump', '-U', 'postgres', '-d', 'postgres', '-Fc', '-f', '/tmp/' + basename);
docker('cp', container + ':/tmp/' + basename, backup);
assert.ok(statSync(backup).size > 100000, 'Backup missing or unexpectedly small');
const archive = docker('exec', container, 'pg_restore', '--list', '/tmp/' + basename);
assert.ok(archive.includes('freight_requests') && archive.includes('auth users'), 'Backup archive is unreadable/incomplete');
const countSql = "select jsonb_build_object('requests',(select count(*) from public.freight_requests),'facilities',(select count(*) from public.facilities),'bookings',(select count(*) from public.v2_bookings),'users',(select count(*) from auth.users))::text;";
const before = JSON.parse(run(countSql));
run('begin;\nset local lock_timeout = \'10s\';\nset local statement_timeout = \'120s\';\n' + chunks.join('\n') + "\nnotify pgrst, 'reload schema';\ncommit;");
const after = JSON.parse(run(countSql));
assert.deepEqual(after, before, 'Business row counts changed during schema sync');
assert.equal(run("select (private.v2_freight_input_schema()::jsonb #> '{properties,planningPreferences}') is not null;"), 't');
const result = { localOnly: true, container, approvedMain, backup, backupSha256: createHash('sha256').update(readFileSync(backup)).digest('hex'), applied: pending, before, after, reset: false, seeded: false };
writeFileSync(path.join(backupDirectory, `upgrade-${stamp}.json`), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
