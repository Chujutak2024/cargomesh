import test from 'node:test';
import assert from 'node:assert/strict';
import {browserRoadResult} from './browser-road-result';
const a={lat:-33.87,lng:151.21},b={lat:-37.81,lng:144.96},at='2026-10-23T12:00:00Z';
const route=()=>({points:[a,b],distanceMeters:1000000,durationMillis:36000000,legs:[{steps:[{travelMode:'DRIVING',maneuver:'DEPART'}]}]});
test('browser route preserves provider geometry and converts milliseconds, without a truck-access claim',()=>{
 const result=browserRoadResult(route(),a,b,at);assert.equal(result.status,'estimated');
 if(result.status==='estimated'){assert.equal(result.durationSeconds,36000);assert.deepEqual(result.points,[a,b]);assert.equal(result.truckAccess,'UNVERIFIED');}
});
test('browser route rejects missing steps, ferries, invalid numbers and unrelated/reversed endpoints',()=>{
 for(const raw of [{...route(),legs:[]},{...route(),legs:[{steps:[]}]},{...route(),distanceMeters:NaN},{...route(),points:[b,a]},
  {...route(),legs:[{steps:[{travelMode:'DRIVING',maneuver:'FERRY'}]}]},{...route(),legs:[{steps:[{travelMode:'TRANSIT',maneuver:'DEPART'}]}]}])assert.equal(browserRoadResult(raw,a,b,at).status,'unavailable');
});
