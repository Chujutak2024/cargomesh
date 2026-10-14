import assert from 'node:assert/strict';
const base = process.argv.find(arg => arg.startsWith('--origin='))?.slice(9) ?? 'http://127.0.0.1:3090';
assert.ok(['http://127.0.0.1:3090','http://127.0.0.1:8080'].includes(base), 'Local approved origin only');
const live = process.argv.includes('--live');
const probeMissingKey = process.argv.includes('--expect-missing-key');
assert.ok(!(live && probeMissingKey), 'Choose either live or missing-key validation');
const results = [];
async function check(name, body, expected, origin = base) {
  const response = await fetch(base + '/api/local/route-lab', {method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify(body)});
  // A framework-level cross-origin rejection can be an HTML 404, before our JSON handler.
  const data = response.headers.get('content-type')?.includes('application/json') ? await response.json() : {};
  assert.ok((Array.isArray(expected)?expected:[expected]).includes(response.status), `${name}: unexpected HTTP ${response.status}`);
  results.push({name,httpStatus:response.status,status:data.status,reason:data.reason??null,alternatives:data.alternatives?.length??0});
  return data;
}
const query = {originId:'lima',destinationId:'arequipa',objective:'FASTEST',traffic:'TRAFFIC_AWARE_OPTIMAL'};
const page = await fetch(base+'/carrier-route-lab');
assert.equal(page.status,200);assert.match(await page.text(),/Road routing lab/);results.push({name:'Page renders',httpStatus:200});
await check('Foreign origin rejected',query,[403,404],'https://foreign.example');
await check('Identical cities rejected',{...query,destinationId:'lima'},400);
await check('Unknown city rejected',{...query,originId:'unknown'},400);
await check('Unknown request fields rejected',{...query,apiKey:'test-placeholder'},400);
const blocked = await check('Disconnected networks',{...query,originId:'bogota',destinationId:'houston'},200);
assert.equal(blocked.reason,'DISCONNECTED_NETWORKS');assert.deepEqual(blocked.alternatives,[]);
if (probeMissingKey) {
  // Opt in: this expects the private server credential to be absent in this local environment.
  const missing=await check('Missing server key',query,503);assert.equal(missing.reason,'SERVER_KEY_MISSING');assert.deepEqual(missing.alternatives,[]);
}
if (live) {
  // At most five paid provider calls; no route coordinates/provider payloads are written to disk.
  for (const [originId,destinationId] of [['lima','arequipa'],['lima','huancayo'],['cl-santiago','buenos-aires'],['madrid','barcelona'],['los-angeles','las-vegas']]) {
    const data=await check(`${originId} → ${destinationId}`,{...query,originId,destinationId},200);
    assert.equal(data.status,'estimated');assert.equal(data.source,'GOOGLE_ROUTES_API');assert.equal(data.scope,'RETURNED_ALTERNATIVES_ONLY');
    assert.ok(data.alternatives.length>0);assert.ok(data.alternatives.every(route=>route.points.length>=2));
  }
}
console.log(JSON.stringify({mode:live?'LIVE_GOOGLE':probeMissingKey?'MISSING_KEY_CHECK':'NO_PAID_CALLS',results},null,2));
