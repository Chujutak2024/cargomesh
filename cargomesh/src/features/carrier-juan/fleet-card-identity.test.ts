import test from 'node:test';
import assert from 'node:assert/strict';
import {fleetCardIdentity} from './fleet-card-identity';

test('scenario cards lead with the recorded plate and human vehicle type without mutating source data',()=>{
 const vehicle={source:'SERVICE' as const,code:'HAC50_C02_T01',plate:'QA-02-01',model:'Synthetic Rigid QA illustration',body:'BOX'};
 const original=structuredClone(vehicle);
 assert.deepEqual(fleetCardIdentity(vehicle),{title:'QA-02-01',model:'Rigid truck',unit:'Unit 01'});
 assert.deepEqual(vehicle,original);
});
test('real recorded make/model and fleet code remain intact',()=>{
 assert.deepEqual(fleetCardIdentity({source:'SERVICE',code:'CM-311',plate:'ABC-123',model:'DAF LF 230',body:'BOX'}),{title:'ABC-123',model:'DAF LF 230',unit:'CM-311'});
});
test('missing plates use the actual code; unknown models are not invented',()=>{
 assert.deepEqual(fleetCardIdentity({source:'SERVICE',code:'OTHER-1',plate:null,model:null,body:'UNKNOWN'}),{title:'OTHER-1',model:'UNKNOWN',unit:'OTHER-1'});
});
test('Juan local examples retain their original identification',()=>{
 assert.deepEqual(fleetCardIdentity({source:'EXAMPLE',code:'CM-311',plate:'SIM-003',model:'DAF LF 230',body:'BOX'}),{title:'CM-311',model:'DAF LF 230',unit:'CM-311'});
});
