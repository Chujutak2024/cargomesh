import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {assertOwnerProvisioningTarget} from './hac54-owner-policy.mjs';
const repository=path.resolve('owner-policy-test-repo'),file=path.resolve('owner-policy-private.txt');
const target={api:'http://127.0.0.1:61321',app:'http://localhost:3000',repository,file,authorized:'1'};
test('local owner setup requires exact local gateway, app and explicit consent',()=>{
 assert.equal(assertOwnerProvisioningTarget(target).app.origin,'http://localhost:3000');
 for(const override of [{authorized:'0'},{api:'https://hosted.supabase.co'},{api:'http://127.0.0.1:54321'},
  {app:'https://localhost:3000'},{app:'http://example.com:3000'},{app:'http://localhost:3001'},
  {app:'http://user:password@localhost:3000'},{app:'http://localhost:3000/?remote=1'}])
  assert.throws(()=>assertOwnerProvisioningTarget({...target,...override}));
});
test('credential output cannot be relative or anywhere inside the checkout',()=>{
 for(const bad of ['relative.txt',path.join(repository,'owner.txt'),path.join(repository,'nested','owner.txt'),file+'.json'])
  assert.throws(()=>assertOwnerProvisioningTarget({...target,file:bad}));
 assert.equal(assertOwnerProvisioningTarget({...target,file:path.resolve('owner-policy-test-repo-private','owner.txt')}).file,path.resolve('owner-policy-test-repo-private','owner.txt'));
});
