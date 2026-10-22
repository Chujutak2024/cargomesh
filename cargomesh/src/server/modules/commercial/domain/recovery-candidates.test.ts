import {test} from 'node:test';
import assert from 'node:assert/strict';
import {recoveryCandidates} from './recovery-candidates';
import {CreateIncidentRecoverySchema,IncidentRecoverySchema} from '@/shared/schemas/v2/incident-recovery';
const id='10000000-0000-4000-8000-000000000001';
const input={schemaVersion:'2.0',expectedIncidentVersion:1,cause:'CARRIER_ACCIDENT',reservationIds:[id],origin:{label:'Punto acordado',countryCode:'PE',city:'Lima'},pickupWindow:{startsAt:'2026-11-02T13:00:00Z',endsAt:'2026-11-02T15:00:00Z'},deliveryWindow:{startsAt:'2026-11-02T19:00:00Z',endsAt:'2026-11-02T23:00:00Z'},timeZone:'America/Lima',consent:'AUTHORIZE_RECOVERY_SEARCH'};
test('recovery excludes only the failed Carrier and unavailable resources before ranking',()=>{
 const services=[{carrierId:'failed',capacities:[{calendarId:'a'}]},{carrierId:'other',capacities:[{calendarId:'b'},{calendarId:'c'}]},{carrierId:'third',capacities:[{calendarId:'d'}]}];
 const result=recoveryCandidates(services,'failed',['b']);
 assert.deepEqual(result,[{carrierId:'other',capacities:[{calendarId:'c'}]},{carrierId:'third',capacities:[{calendarId:'d'}]}]);
 assert.equal(services[1].capacities.length,2,'do not mutate the authorized catalog');
 assert.equal(recoveryCandidates(services,null,[]).length,3,'normal requests retain the supported universe');
});
test('recovery requires consent, an attributable cause, unique reservations and valid time zone',()=>{
 assert.equal(CreateIncidentRecoverySchema.safeParse(input).success,true);
 for(const delta of [{consent:'AUTHORIZE_BOOKING'},{cause:'CLIENT_CHANGED_MIND'},{reservationIds:[id,id]},{timeZone:'invented-zone'},{urgencySurcharge:5},{expectedIncidentVersion:0}])assert.equal(CreateIncidentRecoverySchema.safeParse({...input,...delta}).success,false);
});
test('remaining cargo preserves whole package counts and rejects duplicate groups',()=>{
 assert.equal(CreateIncidentRecoverySchema.safeParse({...input,confirmRemainingCargo:true,remainingAllocations:[{unitIndex:0,quantity:1}]}).success,true);
 for(const remainingAllocations of [[{unitIndex:0,quantity:.5}],[{unitIndex:0,quantity:1},{unitIndex:0,quantity:1}],[{unitIndex:-1,quantity:1}]])assert.equal(CreateIncidentRecoverySchema.safeParse({...input,remainingAllocations}).success,false);
});
test('recovery response cannot disguise a surcharge or ordinary priority',()=>{
 const record={id,incidentId:id,originalRequestId:id,originalBookingId:id,originalExecutionId:id,failedCarrierId:id,replacementRequestId:id,replacementBookingId:null,status:'SEARCHING',phase:'NEEDS_ATTENTION',cause:'CARRIER_ACCIDENT',priority:'URGENT',urgencySurcharge:0,version:1,createdAt:input.pickupWindow.startsAt,updatedAt:input.pickupWindow.startsAt,reservationIds:[id]};
 assert.equal(IncidentRecoverySchema.safeParse(record).success,true);
 assert.equal(IncidentRecoverySchema.safeParse({...record,urgencySurcharge:1}).success,false);
 assert.equal(IncidentRecoverySchema.safeParse({...record,priority:'SCHEDULED'}).success,false);
});
