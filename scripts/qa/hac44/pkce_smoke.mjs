// Real local Supabase OAuth sessions; no bearer, key or password is exported.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {randomBytes, randomUUID, createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const root = process.env.HAC44_ROOT;
const require = createRequire(root + '/cargomesh/package.json');
const {createClient} = require('@supabase/supabase-js');
const statusProcess = spawnSync(process.env.HAC44_CLI,
  ['status', '--workdir', process.env.HAC44_BANK_FOLDER, '-o', 'json'], {encoding:'utf8'});
assert.equal(statusProcess.status, 0, 'Local status failed');
const status = JSON.parse(statusProcess.stdout);
assert.equal(status.API_URL, process.env.HAC44_API_URL);
const options = {auth:{persistSession:false, autoRefreshToken:false}};
const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, options);
const userClient = createClient(status.API_URL, status.ANON_KEY, options);
const credential = randomBytes(32).toString('base64url');
const email = 'hac44-pkce-' + randomUUID() + '@cargomesh.test';
const created = await admin.auth.admin.createUser({email, password:credential, email_confirm:true});
assert.equal(created.error, null, 'Local Auth fixture creation failed');
const userId = created.data.user.id;
console.log('PKCE_FIXTURE:' + JSON.stringify({userId, email}));
const signed = await userClient.auth.signInWithPassword({email, password:credential});
assert.equal(signed.error, null, 'Local Auth login failed');
const callback = process.env.HAC44_CALLBACK_URL;
const registered = await admin.auth.admin.oauth.createClient({client_name:'LOCAL_ONLY HAC44 PKCE',
  redirect_uris:[callback], grant_types:['authorization_code','refresh_token'],
  response_types:['code'], token_endpoint_auth_method:'none'});
assert.equal(registered.error, null, 'Local OAuth client creation failed');
const clientId = registered.data.client_id;
console.log('PKCE_CLIENT:' + JSON.stringify({clientId}));
const claims = token => JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
async function authorization() {
  const verifier = randomBytes(48).toString('base64url'), state = randomUUID();
  const params = new URLSearchParams({client_id:clientId, response_type:'code', redirect_uri:callback,
    code_challenge:createHash('sha256').update(verifier).digest('base64url'),
    code_challenge_method:'S256', scope:'openid email profile', state});
  const response = await fetch(status.API_URL + '/auth/v1/oauth/authorize?' + params,
    {headers:{apikey:status.ANON_KEY}, redirect:'manual'});
  assert.equal(response.status, 302, 'Local OAuth authorization did not redirect');
  const id = new URL(response.headers.get('location')).searchParams.get('authorization_id');
  const detail = await userClient.auth.oauth.getAuthorizationDetails(id);
  assert.equal(detail.error, null, 'Local authorization details failed');
  let redirect = detail.data.redirect_url;
  if (!redirect) {
    const approved = await userClient.auth.oauth.approveAuthorization(id, {skipBrowserRedirect:true});
    assert.equal(approved.error, null, 'Local fixture consent failed');
    redirect = approved.data.redirect_url;
  }
  const url = new URL(redirect);
  assert.equal(url.searchParams.get('state'), state);
  return {verifier, code:url.searchParams.get('code')};
}
async function exchange(code, verifier) {
  return fetch(status.API_URL + '/auth/v1/oauth/token', {method:'POST',
    headers:{apikey:status.ANON_KEY, 'Content-Type':'application/x-www-form-urlencoded'},
    body:new URLSearchParams({grant_type:'authorization_code',client_id:clientId,
      redirect_uri:callback,code,code_verifier:verifier})});
}
const tokens = [];
for (let n=0; n<2; n++) {
  const authorized = await authorization();
  const response = await exchange(authorized.code, authorized.verifier);
  assert.equal(response.status, 200, 'Correct PKCE verifier rejected');
  const token = (await response.json()).access_token;
  const payload = claims(token);
  assert.equal(payload.sub, userId);
  assert.equal(payload.client_id, clientId);
  const verified = await userClient.auth.getUser(token);
  assert.equal(verified.error, null, 'Issuer did not verify actual PKCE bearer');
  assert.equal(verified.data.user.id, userId);
  tokens.push(payload);
}
assert.notEqual(tokens[0].session_id, tokens[1].session_id);
const denied = await authorization();
const rejected = await exchange(denied.code, randomBytes(48).toString('base64url'));
assert.equal(rejected.status, 400, 'Wrong PKCE verifier was accepted');
const literal = value => "'" + String(value).replaceAll("'", "''") + "'";
const query = 'begin; set local role authenticated; select set_config(\'request.jwt.claims\','
  + literal(JSON.stringify(tokens[0])) + ',true); set constraints all immediate;'
  + "select 'PKCE_BOUNDARY:'||jsonb_build_object('role',current_user,'uid',auth.uid())::text;rollback;";
// Capture in memory: set_config returns claims, which are never forwarded to logs.
const boundary = spawnSync('docker', ['exec','-i',process.env.HAC44_BANK_DB,'psql','-X','-A','-t',
  '-v','ON_ERROR_STOP=1','-v','local_only=1','-U','postgres','-d','postgres'], {input:query,encoding:'utf8'});
assert.equal(boundary.status, 0, 'Authenticated SQL boundary failed');
const measured = JSON.parse(boundary.stdout.split('\n').find(line => line.startsWith('PKCE_BOUNDARY:')).slice(14));
assert.equal(measured.role, 'authenticated');
assert.equal(measured.uid, userId);
console.log('PKCE_RESULT:' + JSON.stringify({status:'PASS', cases:[
  {case:'Two actual local PKCE sessions',status:'PASS',distinctSessions:true,issuerVerified:true},
  {case:'Wrong verifier with correct-verifier controls',status:'PASS',positiveHttp:200,negativeHttp:400},
  {case:'Actual PKCE claims through ALL IMMEDIATE',status:'PASS',role:measured.role,subjectVerified:true}],
  scope:'Local OAuth/PKCE smoke only; no HAC-41 business or human consent UI certification',
  authAdminOnly:true, businessServiceRole:false, credentialsPersisted:false}));
