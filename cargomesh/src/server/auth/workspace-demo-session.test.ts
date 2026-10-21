import test from 'node:test';
import assert from 'node:assert/strict';
import {activateDemoSession} from './workspace-demo-session';
const account={email:'qa-v2-a@cargomesh.test',password:'server-only-test'},org='c2300000-0000-4000-8000-000000000001';
const user={id:'user',email:account.email,email_confirmed_at:'2026-10-21T12:00:00Z'};
const member={organization_id:org,role:'SUPERVISOR',status:'ACTIVE',organizations:{name:'[SYNTHETIC] QA A',status:'ACTIVE'}};
const carriers=[{carrierId:org,operatorId:org,role:'OPERATOR',carrierName:'[SYNTHETIC] QA carrier',displayName:'QA'}];
function source(){let commits=0,logins=0;return {count:()=>({commits,logins}),access:{current:async()=>user,signIn:async()=>{logins++;return user;},member:async()=>member,carriers:async()=>carriers,commit:()=>{commits++;}}};}
test('valid existing synthetic actor commits only after target checks, without repeated login',async()=>{
 for(const workspace of ['client','carrier'] as const){const s=source();assert.equal(await activateDemoSession(workspace,account,org,s.access),true);assert.deepEqual(s.count(),{commits:1,logins:0});}
});
test('different current actor is authenticated as the configured target, never granted new roles',async()=>{
 const s=source();assert.equal(await activateDemoSession('client',account,org,{...s.access,current:async()=>({...user,email:'hac54.carrier.local@cargomesh.test'})}),true);
 assert.deepEqual(s.count(),{commits:1,logins:1});
});
test('login failure, unconfirmed/different identity, wrong tenant/role or non-synthetic data never commit cookies',async()=>{
 for(const override of [
  {current:async()=>null,signIn:async()=>null},
  {current:async()=>({...user,email_confirmed_at:null})},
  {current:async()=>null,signIn:async()=>({...user,email:'other@example.test'})},
  {member:async()=>({...member,organization_id:'other'})},
  {member:async()=>({...member,role:'OWNER'})},
  {member:async()=>({...member,organizations:{name:'Real company',status:'ACTIVE'}})},
 ]){const s=source();assert.equal(await activateDemoSession('client',account,org,{...s.access,...override}),false);assert.equal(s.count().commits,0);}
 for(const rows of [[],[{...carriers[0],carrierName:'Real carrier'}],[{}]]){
  const s=source();assert.equal(await activateDemoSession('carrier',account,org,{...s.access,carriers:async()=>rows}),false);assert.equal(s.count().commits,0);
 }
});
test('backend failure keeps old browser cookies; there is no signOut or preview fallback',async()=>{
 for(const workspace of ['client','carrier'] as const){
  const s=source(),fail=async()=>{throw Error('backend unavailable');};
  await assert.rejects(()=>activateDemoSession(workspace,account,org,{...s.access,member:fail,carriers:fail}),/unavailable/);
  assert.equal(s.count().commits,0);
 }
});

test('effective first active tenant must be the configured synthetic tenant, not an earlier second membership',async()=>{
 const s=source();
 const earlier={...member,organization_id:'a0000000-0000-4000-8000-000000000001'};
 assert.equal(await activateDemoSession('client',account,org,{...s.access,member:async()=>earlier}),false);
 assert.equal(s.count().commits,0);
});
