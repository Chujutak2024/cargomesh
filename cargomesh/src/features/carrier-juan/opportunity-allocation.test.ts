import test from 'node:test';
import assert from 'node:assert/strict';
import {opportunity,period,id} from '@/features/carrier-portal/commercial-test-fixtures';
import {opportunityAllocations} from './opportunity-allocation';
test('only a typed allowlisted allocation renders; legacy resource snapshots are ignored',()=>{
 const row=opportunity();row.data.assignmentSnapshots=[{id:id(900),serviceId:id(901),window:period,resource:{assetId:id(902)}}];
 assert.deepEqual(opportunityAllocations(row),[]);
 row.data.assignmentSnapshots[0].allocationSummary={role:'LOAD_BEARING',equipment:'BOX_TRUCK',units:[{unitIndex:0,quantity:1,weightKg:6000,volumeM3:2}]};
 const summary=opportunityAllocations(row);assert.equal(summary[0]?.allocationSummary.units[0].weightKg,6000);assert.equal('resource' in summary[0],false);
});
