import assert from "node:assert/strict";
import { test } from "node:test";
import { coordinatePair, coverageGeometry } from "./map-model";
test("zero coordinates are real values; missing pairs never become the map origin",()=>{
 assert.deepEqual(coordinatePair({lat:0,lng:0}),{lat:0,lng:0});
 for(const input of [null,{}, {lat:1,lng:null},{lat:"1",lng:2},{lat:91,lng:2},{lat:2,lng:181},{lat:NaN,lng:1}])
  assert.deepEqual(coordinatePair(input),{lat:null,lng:null});
});
test("coverage geometry accepts only contracted points or closed rings",()=>{
 assert.equal(coverageGeometry(null),null);
 assert.equal(coverageGeometry({type:"LineString",coordinates:[[0,0],[1,1]]}),null);
 assert.equal(coverageGeometry({type:"Polygon",coordinates:[[[0,0],[1,0],[1,1],[0,1]]]}),null);
 assert.equal(coverageGeometry({type:"Polygon",coordinates:[[[0,0],[1,0],[1,1],[0,0]]]} )?.type,"Polygon");
 assert.equal(coverageGeometry({type:"MultiPoint",coordinates:[[0,0],[-77,-12]]})?.type,"MultiPoint");
});
