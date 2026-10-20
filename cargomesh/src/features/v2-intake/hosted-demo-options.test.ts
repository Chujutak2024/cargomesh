import test from 'node:test';
import assert from 'node:assert/strict';
import {loadIntakeOptions} from './v2-intake-client';
import {INTAKE_OPTIONS_FIXTURE} from './fixtures/intake-options.fixture';
test('explicit fixture API provenance selects conversation-only intake mode on hosting',async()=>{
 const result=await loadIntakeOptions(async()=>Response.json(INTAKE_OPTIONS_FIXTURE,{headers:{'X-CargoMesh-Data-Source':'fixture'}}),'api');
 assert.equal(result.source,'fixture');assert.equal(result.fixtureReason,'EXPLICIT_VISUAL_DEMO');
});
test('ordinary authenticated intake options keep their real API source',async()=>{
 const result=await loadIntakeOptions(async()=>Response.json(INTAKE_OPTIONS_FIXTURE),'api');
 assert.equal(result.source,'api');assert.equal(result.fixtureReason,null);
});
