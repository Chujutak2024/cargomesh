import assert from "node:assert/strict";
import {test} from "node:test";
import {celestialDirection, nextEnvironmentPhase, previewTruckEnvironment, type TruckEnvironmentPhase} from "./truck-environment";
test("environment preview cycles day, afternoon and night",()=>{
  let phase:TruckEnvironmentPhase="day";
  const sequence=[];
  for(let i=0;i<4;i++){sequence.push(phase);assert.equal(previewTruckEnvironment(phase).phase,phase);phase=nextEnvironmentPhase(phase);}
  assert.deepEqual(sequence,["day","afternoon","night","day"]);
});
test("celestial position is a fixed normalized world direction for each lighting phase",()=>{
  for(const phase of ["day","afternoon","night"] as const){
    const environment=previewTruckEnvironment(phase),direction=celestialDirection(environment);
    assert.ok(Math.abs(Math.hypot(...direction)-1)<1e-10);
    assert.ok(direction[1]>0);assert.deepEqual(celestialDirection(environment),direction);
  }
  assert.ok(celestialDirection(previewTruckEnvironment("afternoon"))[1]<celestialDirection(previewTruckEnvironment("day"))[1]);
});
