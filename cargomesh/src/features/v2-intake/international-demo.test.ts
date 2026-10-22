import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {getIntakeOptionsFixture} from './intake-options';
import {parseConversationField} from './conversation-fields';
const root=new URL('../../../../supabase/scenarios/v2-international-client-demo/',import.meta.url);
const manifest=JSON.parse(readFileSync(new URL('manifest.json',root),'utf8'));
test('all international demo cities resolve to authorized selector IDs, never an invented facility',()=>{
 const options={...getIntakeOptionsFixture().data,facilities:manifest.facilities.map((f:{id:string;code:string;name:string;countryCode:string;region:string;city:string;latitude:number;longitude:number})=>({facilityId:f.id,code:f.code,label:f.name,countryCode:f.countryCode,region:f.region,city:f.city,lat:f.latitude,lng:f.longitude}))};
 assert.equal(options.facilities.length,32);assert.equal(new Set(options.facilities.map((f:{countryCode:string})=>f.countryCode)).size,16);
 for(const f of options.facilities){assert.equal(parseConversationField('originFacilityId',f.city,options),f.facilityId);assert.equal(parseConversationField('destinationFacilityId',f.city,options),f.facilityId);}
 assert.equal(parseConversationField('destinationFacilityId','Imaginary City',options),null);
 assert.ok(manifest.totalFacilities<=40);assert.equal(manifest.coverageConfirmed,false);assert.equal(manifest.capacityConfirmed,false);
});
test('international seed only appends reviewed synthetic facilities and guards collisions',()=>{
 const sql=readFileSync(new URL('seed.sql',root),'utf8');
 assert.match(sql,/REVIEWED_SYNTHETIC_CLIENT_REQUIRED/);assert.match(sql,/FACILITY_COLLISION_INSPECT_BEFORE_RETRY/);
 assert.doesNotMatch(sql,/insert into public\.(organizations|organization_members|carrier_offers|bookings|transport_assets)/i);
 assert.equal(new Set(manifest.facilities.map((f:{id:string})=>f.id)).size,32);
 for(const f of manifest.facilities){assert.match(f.name,/^\[SYNTHETIC\]/);assert.ok(sql.includes(f.id));}
});
