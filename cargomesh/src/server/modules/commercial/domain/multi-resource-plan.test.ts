import { describe, it, test } from "node:test";
import assert from "node:assert/strict";
import { evaluateRoad, type RoadRequest, type RoadService } from "../../road-serviceability/domain/evaluate-road";

const request: RoadRequest = {
  origin: { countryCode: "PE", regionCode: "LIM", city: "Lima" },
  destination: { countryCode: "PE", regionCode: "ARE", city: "Arequipa" },
  operationWindow: { startsAt: "2026-09-28T10:00:00Z", endsAt: "2026-09-29T10:00:00Z" },
  pickupWindow: { startsAt: "2026-09-28T10:00:00Z", endsAt: "2026-09-28T12:00:00Z" },
  deliveryWindow: { startsAt: "2026-09-29T08:00:00Z", endsAt: "2026-09-29T10:00:00Z" },
  cargoCategoryCode: "PHARMA",
  totalWeightKg: 4800,
  totalVolumeM3: 19.2,
  requiredEquipmentCode: "REEFER_TRUCK",
  unverifiedRequirements: [],
};

function service(): RoadService {
  return {
    id: "road-service-1",
    carrierId: "carrier-1",
    mode: "ROAD",
    serviceClass: "FTL",
    active: true,
    supportedCargoCategoryCodes: ["PHARMA"],
    areas: [
      {
        id: "lima-pickup", role: "PICKUP", coverage: "INCLUDE", granularity: "CITY",
        location: { countryCode: "PE", regionCode: "LIM", city: "Lima" }, active: true,
        validFrom: "2026-01-01T00:00:00Z", validUntil: "2027-01-01T00:00:00Z",
      },
      {
        id: "arequipa-delivery", role: "DELIVERY", coverage: "INCLUDE", granularity: "CITY",
        location: { countryCode: "PE", regionCode: "ARE", city: "Arequipa" }, active: true,
        validFrom: "2026-01-01T00:00:00Z", validUntil: "2027-01-01T00:00:00Z",
      },
    ],
    lanes: [{
      id: "lima-arequipa", pickupAreaId: "lima-pickup", deliveryAreaId: "arequipa-delivery",
      plannedTransitMinutes: 900, transitProvenanceStatus: "SIMULATED",
      active: true, validFrom: "2026-01-01T00:00:00Z", validUntil: "2027-01-01T00:00:00Z",
    }],
    capacities: [{
      id: "asset-1", role: "CARRIER", equipmentCode: "REEFER_TRUCK",
      cargoCategoryCodes: ["PHARMA"], maxWeightKg: 8000, maxVolumeM3: 30,
      calendar: {
        validUntil: "2026-12-31T00:00:00Z", complete: true,
        readyPickupAreaId: "lima-pickup", provenanceStatus: "SIMULATED",
        availableWindows: [{ startsAt: "2026-09-28T00:00:00Z", endsAt: "2026-09-30T00:00:00Z" }],
        reservations: [], maintenance: [], repositioning: [],
      },
    }],
  };
}


import {planWholePackages} from './multi-resource-plan';
function wholeCase(weights:number[],limits:number[]){const svc=service();svc.maxWeightKg=100000;svc.maxVolumeM3=1000;
 svc.capacities=limits.map((kg,i)=>({...structuredClone(svc.capacities[0]),id:'asset-'+i,sourceType:'TRANSPORT_ASSET' as const,calendarId:'calendar-'+i,maxWeightKg:kg,maxVolumeM3:40,usableDimensionsCm:{length:500,width:240,height:250}}));
 const units=weights.map(kg=>({quantity:1,weightPerUnitKg:kg,volumePerUnitM3:2,dimensionsCm:{length:100,width:100,height:200},indivisible:true}));
 const input={...request,totalWeightKg:weights.reduce((a,b)=>a+b,0),totalVolumeM3:weights.length*2};
 return {svc,units,input};
}
test('two whole six-tonne packages use two independent ten-tonne resources deterministically',()=>{const {svc,units,input}=wholeCase([6000,6000],[10000,10000]);const result=planWholePackages(input,units,true,svc);assert.equal(result.status,'FOUND');if(result.status!=='FOUND')return;assert.equal(result.resources.length,2);assert.deepEqual(result.resources.map(r=>r.allocations),[[{unitIndex:0,quantity:1}],[{unitIndex:1,quantity:1}]]);assert.deepEqual(planWholePackages(input,units,true,svc),result);});
test('backtracking finds a valid partition where greedy placement would fail',()=>{const {svc,units,input}=wholeCase([6000,4000,4000],[8000,6000]);const result=planWholePackages(input,units,true,svc);assert.equal(result.status,'FOUND');if(result.status!=='FOUND')return;assert.equal(result.resources.length,2);assert.equal(result.resources.flatMap(r=>r.allocations).reduce((n,a)=>n+a.quantity,0),3);});
test('one indivisible twelve-tonne package never becomes two six-tonne allocations',()=>{const {svc,units,input}=wholeCase([12000],[10000,10000]);assert.notEqual(planWholePackages(input,units,true,svc).status,'FOUND');});
test('a shipment that forbids splitting cannot use two trucks',()=>{const {svc,units,input}=wholeCase([6000,6000],[10000,10000]);assert.notEqual(planWholePackages(input,units,false,svc).status,'FOUND');});
test('an occupied second calendar cannot complete a two-truck proposal',()=>{const {svc,units,input}=wholeCase([6000,6000],[10000,10000]);svc.capacities[1].calendar!.maintenance=[request.operationWindow];assert.notEqual(planWholePackages(input,units,true,svc).status,'FOUND');});
test('search bounds are explicit review outcomes, never invented feasibility',()=>{const {svc,units,input}=wholeCase([100],[10000]);units[0].quantity=201;const result=planWholePackages(input,units,true,svc);assert.equal(result.status,'REQUIRES_REVIEW');assert.equal(result.reason,'PLAN_SEARCH_PACKAGE_LIMIT');});
