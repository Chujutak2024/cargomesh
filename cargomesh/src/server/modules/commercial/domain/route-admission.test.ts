import {test} from 'node:test';
import assert from 'node:assert/strict';
import {assessRouteAdmission} from './route-admission';
import {WorkflowInputsV2} from '@/shared/schemas/v2/workflow';
import type {RouteAdmissionRecord} from '@/shared/schemas/v2/route-admission';
const window={startsAt:'2026-10-23T08:00:00Z',endsAt:'2026-10-24T18:00:00Z'},now=Date.parse('2026-10-21T00:00:00Z');
const r:RouteAdmissionRecord={assetId:'a0000001-0000-4000-8000-000000000001',limitId:'a0000001-0000-4000-8000-000000000002',version:1,compatibilityConfirmed:true,admission:null,
 source:{reference:'fixture:admission',provider:'Synthetic fixture',observedAt:'2020-01-01T00:00:00Z',validUntil:'2030-01-01T00:00:00Z',provenanceStatus:'SIMULATED'}};
test('four admission states retain evidence boundaries and safe legacy semantics',()=>{
 assert.equal(assessRouteAdmission(r,window,now).state,'ALLOWED');
 assert.equal(assessRouteAdmission({...r,compatibilityConfirmed:false,admission:{decision:'DENIED',reasonCode:'ACCESS_RESTRICTION'}},window,now).state,'DENIED');
 assert.equal(assessRouteAdmission({...r,compatibilityConfirmed:false},window,now).state,'UNKNOWN');
 assert.equal(assessRouteAdmission({...r,source:{...r.source!,validUntil:'2026-10-24T17:59:59Z'}},window,now).state,'EXPIRED');
 assert.equal(assessRouteAdmission({...r,source:{...r.source!,validUntil:window.endsAt}},window,now).state,'ALLOWED');
});
test('missing, future, estimated or contradictory records do not authorize a resource',()=>{
 for(const value of [undefined,{...r,source:null},{...r,source:{...r.source!,observedAt:'2026-10-22T00:00:00Z'}},
 {...r,source:{...r.source!,provenanceStatus:'ESTIMATED' as const}},
 {...r,admission:{decision:'DENIED' as const,reasonCode:'ACCESS_RESTRICTION'}}])assert.equal(assessRouteAdmission(value,window,now).state,'UNKNOWN');
});
test('publication rejects contradictory compatibility, arbitrary fields and persisted EXPIRED',()=>{
 const value={schemaVersion:'2.0',active:true,serviceId:r.assetId,assetId:r.assetId,combinationId:null,corridorId:r.limitId,
 manufacturerPayloadLimitKg:12000,routeGrossLimitKg:20000,combinedTareKg:5000,usableVolumeM3:50,usableDimensions:{length:800,width:245,height:260},compatibilityConfirmed:false,source:r.source,
 admission:{decision:'DENIED',reasonCode:'ACCESS_RESTRICTION'}};
 assert.equal(WorkflowInputsV2['limits.publish'].safeParse(value).success,true);
 assert.equal(WorkflowInputsV2['limits.publish'].safeParse({...value,compatibilityConfirmed:true}).success,false);
 assert.equal(WorkflowInputsV2['limits.publish'].safeParse({...value,admission:{...value.admission,decision:'EXPIRED'}}).success,false);
 assert.equal(WorkflowInputsV2['limits.publish'].safeParse({...value,admission:{...value.admission,override:true}}).success,false);
});
