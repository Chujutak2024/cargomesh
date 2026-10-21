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



import {proposeDispatch} from './dispatch-planner';
import {DispatchPreferencesSchema,CarrierDispatchPolicySchema,type DispatchPreferences,type DispatchOption} from '@/shared/schemas/v2/dispatch';
const preferences:DispatchPreferences={urgency:'URGENT',loadSize:'HEAVY',timeZone:'America/Lima',pickupWindows:[{startsAt:'2026-09-28T08:00:00Z',endsAt:'2026-09-28T12:00:00Z'},{startsAt:'2026-09-29T08:00:00Z',endsAt:'2026-09-29T12:00:00Z'}],deliveryWindows:[{startsAt:'2026-09-29T00:00:00Z',endsAt:'2026-09-29T04:00:00Z'},{startsAt:'2026-09-30T00:00:00Z',endsAt:'2026-09-30T04:00:00Z'}]};
const option:DispatchOption={serviceId:'road-service-1',laneId:'lima-arequipa',routeId:'route-1',policyVersion:1,transitSeconds:54000,provenance:'SIMULATED',policy:{allowedPriorities:['URGENT','SCHEDULED'],minNoticeMinutes:60,loadingMinutes:30,unloadingMinutes:30,autoConfirm:false,maxBookingAmount:1000,acknowledgeSchedulingAuthority:false}};
const cargo={cargoSpecification:{units:[{quantity:1,weightPerUnitKg:4800,volumePerUnitM3:19.2,dimensionsCm:{length:200,width:100,height:100},indivisible:true,packageType:'PALLET',stackable:false}],divisible:false}} as Parameters<typeof proposeDispatch>[0];
function fixture(){const svc=service();svc.capacities[0].calendar!.availableWindows[0].endsAt='2026-10-01T00:00:00Z';svc.capacities[0]={...svc.capacities[0],sourceType:'TRANSPORT_ASSET',calendarId:'calendar-1',usableDimensionsCm:{length:500,width:240,height:250}};return svc;}
const now=Date.parse('2026-09-27T00:00:00Z');
test('selects one feasible operation within accepted dates, not their envelope',()=>{const result=proposeDispatch(cargo,preferences,request,fixture(),option,now);assert.equal(result.status,'FOUND');if(result.status!=='FOUND')return;assert.equal(result.laneId,option.laneId);assert.equal(result.schedule.pickupAt,'2026-09-28T08:00:00.000Z');assert.equal(result.schedule.deliveryAt,'2026-09-29T00:00:00.000Z');assert.equal(result.schedule.operationWindow.endsAt,'2026-09-29T00:30:00.000Z');});
test('confirmed work is not displaced by urgency; proposes the next accepted day',()=>{const svc=fixture();svc.capacities[0].calendar!.reservations=[{startsAt:'2026-09-28T00:00:00Z',endsAt:'2026-09-29T06:00:00Z'}];const result=proposeDispatch(cargo,preferences,request,svc,option,now);assert.equal(result.status,'FOUND');if(result.status==='FOUND')assert.equal(result.schedule.pickupAt,'2026-09-29T08:00:00.000Z');});
test('a gap between accepted dates is never an available pickup day',()=>{const prefs=structuredClone(preferences);prefs.pickupWindows[1]={startsAt:'2026-09-30T08:00:00Z',endsAt:'2026-09-30T12:00:00Z'};const svc=fixture();svc.capacities[0].calendar!.availableWindows=[{startsAt:'2026-09-29T00:00:00Z',endsAt:'2026-09-29T23:59:00Z'}];assert.notEqual(proposeDispatch(cargo,prefs,request,svc,option,now).status,'FOUND');});
test('manual scheduling authority and urgent eligibility are distinct',()=>{assert.equal(CarrierDispatchPolicySchema.safeParse({...option.policy,autoConfirm:true}).success,false);assert.equal(proposeDispatch(cargo,preferences,request,fixture(),{...option,policy:{...option.policy,allowedPriorities:['SCHEDULED']}},now).status,'NOT_ALLOWED');});
test('overlapping windows and an unknown timezone are rejected',()=>{assert.equal(DispatchPreferencesSchema.safeParse({...preferences,pickupWindows:[preferences.pickupWindows[0],preferences.pickupWindows[0]]}).success,false);assert.equal(DispatchPreferencesSchema.safeParse({...preferences,timeZone:'Mars/Unknown'}).success,false);});
test('two whole packages require two calendars in the same slot',()=>{const svc=fixture();const c=structuredClone(svc.capacities[0]);svc.capacities=[{...c,id:'a',calendarId:'ca',maxWeightKg:5000},{...structuredClone(c),id:'b',calendarId:'cb',maxWeightKg:5000}];const input={...request,totalWeightKg:8000,totalVolumeM3:4};const cargo2={cargoSpecification:{units:[{...cargo.cargoSpecification.units[0],quantity:2,weightPerUnitKg:4000,volumePerUnitM3:2}],divisible:true}};const result=proposeDispatch(cargo2,preferences,input,svc,option,now);assert.equal(result.status,'FOUND');if(result.status==='FOUND')assert.equal(result.resources.length,2);svc.capacities[1].calendar!.maintenance=[{startsAt:'2026-09-27T00:00:00Z',endsAt:'2026-10-01T00:00:00Z'}];assert.notEqual(proposeDispatch(cargo2,preferences,input,svc,option,now).status,'FOUND');});
