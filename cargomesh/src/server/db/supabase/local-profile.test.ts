import test from 'node:test';
import assert from 'node:assert/strict';
import {localScenarioCookieOptions} from './local-profile';
test('only the exact development fixture profile receives an isolated cookie name',()=>{
 const base={profile:'fleet80',url:'http://127.0.0.1:59730',production:false};
 assert.deepEqual(localScenarioCookieOptions(base),{name:'sb-cargomesh-fleet80-auth-token'});
 for(const patch of [{profile:undefined},{profile:'other'},{url:'https://remote.supabase.co'},{production:true}]) assert.equal(localScenarioCookieOptions({...base,...patch}),undefined);
});
