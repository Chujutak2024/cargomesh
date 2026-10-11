// Actual, issuer-verified local sessions. Credentials and claims remain in memory.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {readCliStatus} from './pkce_smoke.mjs';
import {syntheticFixtureSubjectAllowed} from './fixture_subjects.mjs';

export function localConfig() {
  const out = process.env.HAC44_EVIDENCE ?? process.env.HAC44_OUT;
  const folder = out + '/stack-v2';
  const project = process.env.HAC44_PROJECT_PREFIX + '-v2';
  const bank = 'supabase_db_' + project;
  const marker = JSON.parse(fs.readFileSync(folder + '/ownership.json', 'utf8'));
  assert.equal(marker.project, project);
  const inspect = spawnSync('docker', ['inspect', bank, '--format', '{{index .Config.Labels "com.supabase.cli.project"}}'], {encoding:'utf8'});
  assert.equal(inspect.status, 0, 'Owned local container unavailable');
  assert.equal(inspect.stdout.trim(), project);
  const sql = q => {
    const r = spawnSync('docker', ['exec','-i',bank,'psql','-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-v','local_only=1','-U','postgres','-d','postgres'], {encoding:'utf8',input:q});
    assert.equal(r.status, 0, 'Owned local SQL failed; raw output omitted');
    return r.stdout.trim();
  };
  assert.equal(sql("select id::text from hac44_bank.ownership where project='" + project + "'"), marker.id);
  const cfg = readCliStatus(process.env.HAC44_CLI_JSON, folder);
  assert.equal(cfg.API_URL, process.env.HAC44_API_URL);
  assert.ok(['127.0.0.1','localhost'].includes(new URL(cfg.API_URL).hostname));
  return {cfg, sql};
}

export async function fixtureSession(id) {
  assert.ok(syntheticFixtureSubjectAllowed(id),'Only the exact approved synthetic scenario actors');
  const {cfg, sql} = localConfig();
  const email = JSON.parse(sql("select to_jsonb(email) from auth.users where id='" + id + "'"));
  assert.ok(email?.endsWith('@cargomesh.test'), 'Only synthetic local users');
  const require = createRequire(process.env.HAC44_ROOT + '/cargomesh/package.json');
  const {createClient} = require('@supabase/supabase-js');
  const opts = {auth:{persistSession:false,autoRefreshToken:false}};
  const admin = createClient(cfg.API_URL,cfg.SERVICE_ROLE_KEY,opts);
  const client = createClient(cfg.API_URL,cfg.ANON_KEY,opts);
  const link = await admin.auth.admin.generateLink({type:'magiclink',email});
  assert.equal(link.error,null,'Local Auth link generation failed');
  assert.equal(link.data.user.id,id);
  const session = await client.auth.verifyOtp({token_hash:link.data.properties.hashed_token,type:'magiclink'});
  assert.equal(session.error,null,'Actual Auth session failed');
  const token = session.data.session.access_token;
  const verified = await client.auth.getUser(token);
  assert.equal(verified.error,null,'Issuer verification failed');
  assert.equal(verified.data.user.id,id);
  const claims = JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString());
  assert.equal(claims.sub,id);
  assert.equal(claims.role,'authenticated');
  assert.ok(claims.session_id);
  return {client,token,claims,id};
}

async function main() {
  try {
    const sessions = [];
    for (const id of JSON.parse(process.argv[2])) sessions.push(await fixtureSession(id));
    // Private pipe consumed by real_auth.py, never by the evidence/logging helper.
    process.stdout.write(JSON.stringify(Object.fromEntries(sessions.map(s => [s.id,s.claims]))));
    // SQL keeps these sessions live until exact-ID fixture cleanup removes Auth rows.
  } catch { process.stderr.write('Issuer-verified local claims unavailable\n'); process.exitCode=2; }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
