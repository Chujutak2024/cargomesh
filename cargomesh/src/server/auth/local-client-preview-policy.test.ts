import test from 'node:test';
import assert from 'node:assert/strict';
import {localClientPreviewAllowed,signClientPreview,validClientPreview,CLIENT_PREVIEW_TTL} from './local-client-preview-policy';
const config={enabled:true,production:false,secret:'local-only-test-secret-which-is-long-enough'};
test('local preview requires opt-in, loopback and nonproduction environment',()=>{
 assert.ok(localClientPreviewAllowed(config,'127.0.0.1:8080'));
 for(const patch of [{enabled:false},{production:true},{secret:''}])assert.equal(localClientPreviewAllowed({...config,...patch},'127.0.0.1:8080'),false);
 for(const host of ['example.com:8080','127.0.0.1:3090',null])assert.equal(localClientPreviewAllowed(config,host),false);
});
test('Client preview cookie is scoped, signed, expires and rejects forgery',()=>{
 const now=1792260000000,secret=config.secret,cookie=signClientPreview(secret,now);
 assert.ok(validClientPreview(cookie,secret,now));
 assert.equal(validClientPreview(cookie,secret+'other',now),false);
 assert.equal(validClientPreview(cookie,secret,now+CLIENT_PREVIEW_TTL*1000),false);
 assert.equal(validClientPreview(cookie.replace('client-preview','carrier-preview'),secret,now),false);
 assert.equal(validClientPreview(cookie.slice(0,-1)+(cookie.endsWith('0')?'1':'0'),secret,now),false);
 assert.equal(validClientPreview(cookie,secret,now-1000),false);
});
