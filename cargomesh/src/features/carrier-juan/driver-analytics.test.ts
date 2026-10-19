import test from 'node:test';
import assert from 'node:assert/strict';
import {driverActivity,driverFacts} from './driver-analytics';
import type {PortalRecord} from '@/features/carrier-portal/records';
const scope={carrierId:'carrier',serviceId:'service',driverId:'driver'};
const at='2026-10-18T12:00:00Z';
const row=(value:Record<string,unknown>,carrierId='carrier'):PortalRecord=>({id:'row',version:1,carrierId,updatedAt:at,value});
const assignment=(startsAt:string,endsAt:string,extra:Record<string,unknown>={})=>row({serviceId:'service',driverId:'driver',status:'CONFIRMED',window:{startsAt,endsAt},...extra});
test('hours split at UTC boundaries and overlapping assignment windows do not inflate activity',()=>{
 const result=driverActivity([assignment('2026-10-17T23:00:00Z','2026-10-18T02:00:00Z'),assignment('2026-10-18T01:00:00Z','2026-10-18T03:00:00Z')],scope,at,7);
 assert.equal(result.count,2);assert.equal(result.series.at(-2)?.hours,1);assert.equal(result.series.at(-1)?.hours,3);
});
test('scope excludes other carriers, services, drivers, unconfirmed and released records',()=>{
 const a=assignment('2026-10-18T01:00:00Z','2026-10-18T03:00:00Z');
 const result=driverActivity([{...a,carrierId:'other'},assignment('2026-10-18T01:00:00Z','2026-10-18T03:00:00Z',{serviceId:'other'}),assignment('2026-10-18T01:00:00Z','2026-10-18T03:00:00Z',{driverId:'other'}),...['PROPOSED','RELEASED','CANCELLED'].map(status=>assignment('2026-10-18T01:00:00Z','2026-10-18T03:00:00Z',{status}))],scope,at,7);
 assert.equal(result.count,0);assert.ok(result.series.every(d=>d.hours===0));
});
test('incomplete reads and invalid confirmed windows remain unknown rather than empty availability',()=>{
 for(const result of [driverActivity([],scope,at,7,true),driverActivity([assignment('bad','bad')],scope,at,7)]){assert.equal(result.count,null);assert.ok(result.series.every(d=>d.hours===null));}
 assert.equal(driverActivity([],scope,'bad',7).count,null);
});
test('period clipping preserves real zero and ignores outside assignment windows',()=>{
 const result=driverActivity([assignment('2026-10-01T00:00:00Z','2026-10-02T00:00:00Z'),assignment('2026-10-11T22:00:00Z','2026-10-12T02:00:00Z')],scope,at,7);
 assert.equal(result.count,1);assert.equal(result.series[0].hours,2);assert.equal(result.series.at(-1)?.hours,0);
});
test('license expiry follows the license timezone, not UTC date or browser timezone',()=>{
 const driver=row({licenseValidUntil:'2026-10-17',licenseTimezone:'America/Lima'});
 assert.equal(driverFacts(driver,'2026-10-18T02:00:00Z').license,'recorded');
 assert.equal(driverFacts(driver,'2026-10-18T06:00:00Z').license,'expired');
 assert.equal(driverFacts(row({licenseValidUntil:'2026-10-17',licenseTimezone:'bad'}),at).license,'unknown');
});
test('duty usage requires recorded limit and distinguishes expired policy windows',()=>{
 assert.equal(driverFacts(row({usedDutySeconds:0}),at).percent,null);
 const value={usedDutySeconds:3600,maximumDutySeconds:7200,dutyWindow:{startsAt:'2026-10-18T10:00:00Z',endsAt:'2026-10-18T20:00:00Z'},dutyStatus:'ON_DUTY'};
 const facts=driverFacts(row(value),at);assert.equal(facts.percent,50);assert.equal(facts.usedHours,1);assert.equal(facts.current,true);
 assert.equal(driverFacts(row(value),'2026-10-19T00:00:00Z').current,false);
 assert.equal(driverFacts(row({...value,usedDutySeconds:99999}),at).percent,null);
});
