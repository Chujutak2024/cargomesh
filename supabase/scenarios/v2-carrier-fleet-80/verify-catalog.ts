import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {resolve, dirname} from 'node:path';
import {parseCatalogRecordV2, type CatalogKindV2} from '../../../cargomesh/src/shared/schemas/v2/catalog';
import {evaluateResourceWindow} from '../../../cargomesh/src/server/modules/fleet/application/availability-service';

const readback=JSON.parse(readFileSync(process.argv[2], 'utf8'));
const manifest=JSON.parse(readFileSync(process.argv[3], 'utf8'));
let parsed=0, windows=0;
for(const group of readback){
  const rows:Record<string,any[]>={};
  for(const [kind,records] of Object.entries(group.rows)){
    rows[kind]=(records as any[]).map(row=>parseCatalogRecordV2(kind as CatalogKindV2,row));
    parsed+=rows[kind].length;
    for(const row of rows[kind]) assert.equal(row.carrierId,group.carrierId,'Cross-Carrier catalog row');
  }
  rows.holds=[];
  for(const resource of manifest.resources.filter((r:any)=>r.carrierId===group.carrierId)){
    const expected={available:'eligible',busy:'ineligible',maintenance:'ineligible',unknown:'unknown'}[resource.state as string];
    for(const [kind,id] of [['asset',resource.assetId],['driver',resource.driverId]]){
      const result=evaluateResourceWindow({kind,resourceId:id,serviceId:resource.serviceId,window:resource.window} as any,
        rows,false,manifest.clock);
      assert.equal(result.status,expected,`${kind} ${id} ${resource.state}: ${result.reasons.join(',')}`);
      assert.equal(result.provenanceStatus,resource.state==='unknown'?'UNKNOWN':'SIMULATED');
      if(kind==='asset'&&resource.state==='busy') assert.ok(result.reasons.includes('RESOURCE_OCCUPIED'));
      if(kind==='driver'&&resource.state==='busy') assert.ok(result.reasons.includes('DRIVER_DUTY_LIMIT_EXCEEDED'));
      windows++;
    }
    if(resource.state==='busy'){
      const later={startsAt:resource.window.endsAt,endsAt:new Date(Date.parse(resource.window.endsAt)+3600000).toISOString()};
      const result=evaluateResourceWindow({kind:'asset',resourceId:resource.assetId,serviceId:resource.serviceId,window:later},rows,false,manifest.clock);
      assert.equal(result.status,'eligible','Repositioning block must end at the declared boundary');
      windows++;
    }
  }
}
const root=resolve(dirname(process.argv[3]),'../../..');
for(const visual of manifest.visuals) assert.ok(existsSync(resolve(root,'cargomesh/public'+visual.poster)),visual.poster);
assert.equal(windows,184);
console.log(JSON.stringify({canonicalRecordsParsed:parsed,resourceWindowChecks:windows,existingPostersValidated:manifest.visuals.length,
  scenarios:manifest.expectedStates,scope:'RESOURCE_WINDOW_ONLY',physicalPresenceAsserted:false},null,2));
