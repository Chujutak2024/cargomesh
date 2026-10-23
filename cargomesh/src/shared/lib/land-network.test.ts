import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {facilityLandPolicy} from './land-network';
const manifest=JSON.parse(readFileSync(new URL('../../../../supabase/scenarios/v2-international-client-demo/manifest.json',import.meta.url),'utf8'));
test('every international seed has bounded coordinates, distinct IDs, and a classified geographic precheck',()=>{
 const facilities=manifest.facilities as Array<{id:string;countryCode:string;city:string;latitude:number;longitude:number}>;
 assert.equal(new Set(facilities.map(f=>f.id)).size,facilities.length);
 for(const f of facilities){
  assert.ok(Number.isFinite(f.latitude)&&Math.abs(f.latitude)<=90);
  assert.ok(Number.isFinite(f.longitude)&&Math.abs(f.longitude)<=180);
  assert.equal(facilityLandPolicy(f,f),'provider_required');
  assert.equal(facilityLandPolicy({...f,lat:f.latitude,lng:f.longitude},{...f,lat:f.latitude,lng:f.longitude}),'provider_required');
 }
 for(const a of facilities)for(const b of facilities)assert.equal(facilityLandPolicy(a,b),facilityLandPolicy(b,a));
 const sydney=facilities.find(f=>f.city==='Sydney')!,buenosAires=facilities.find(f=>f.city==='Buenos Aires')!;
 assert.equal(facilityLandPolicy(sydney,buenosAires),'disconnected');
 assert.equal(facilityLandPolicy(buenosAires,sydney),'disconnected');
 assert.equal(manifest.coverageConfirmed,false);assert.equal(manifest.capacityConfirmed,false);
});
test('matching networks request provider evidence; unknown countries remain unknown and Darién is excluded',()=>{
 for(const [a,b] of [['AU','AU'],['AR','BR'],['ES','DE'],['JP','JP']])assert.equal(facilityLandPolicy({countryCode:a},{countryCode:b}),'provider_required');
 for(const [a,b] of [['CO','PA'],['JP','IN'],['GB','FR'],['AU','AR']])assert.equal(facilityLandPolicy({countryCode:a},{countryCode:b}),'disconnected');
 assert.equal(facilityLandPolicy({countryCode:'XX'},{countryCode:'PE'}),'unknown');
 assert.equal(facilityLandPolicy({countryCode:'FR',lat:4.9,lng:-52.3},{countryCode:'BR',lat:-23.55,lng:-46.63}),'unknown');
});
