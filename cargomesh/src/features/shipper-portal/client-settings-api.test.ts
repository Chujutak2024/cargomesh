import {test} from 'node:test';
import assert from 'node:assert/strict';
import {z} from 'zod';
import {ClientSettingsError,settingsCommand,sendSettingsCommand,settingsError,settingsRequest} from './client-settings-api';
import {OperatingHoursSchema} from '@/shared/scheduling/operating-hours';
import {FacilityInputV2Schema} from '@/shared/schemas/v2/facilities';
test('an ambiguous network failure retries the identical mutation key and payload',async()=>{
 const command=settingsCommand('/facilities',{code:'ONE'}),calls:{key:string|null;body:BodyInit|null|undefined}[]=[];
 const fetcher=(async(_url,init)=>{calls.push({key:new Headers(init?.headers).get('Idempotency-Key'),body:init?.body});if(calls.length===1)throw new TypeError('offline');return Response.json({saved:true});}) as typeof fetch;
 await assert.rejects(sendSettingsCommand(command,z.object({saved:z.boolean()}),fetcher));
 const retried=settingsCommand('/facilities',{code:'ONE'},command);
 assert.deepEqual(await sendSettingsCommand(retried,z.object({saved:z.boolean()}),fetcher),{saved:true});
 assert.equal(calls[0].key,calls[1].key);assert.equal(calls[0].body,calls[1].body);
 assert.match(settingsError(new TypeError('offline')),/edits are retained/);
});
test('successful persisted response is the control for stable 409/403 and invalid output',async()=>{
 const schema=z.object({id:z.string()});
 assert.deepEqual(await settingsRequest('/facilities',schema,{},async()=>Response.json({id:'saved'})),{id:'saved'});
 for(const [status,code] of [[409,'STALE_DRAFT'],[403,'FORBIDDEN_TENANT']] as const){
  await assert.rejects(settingsRequest('/facilities',schema,{},async()=>Response.json({error:{code,message:'denied'}},{status})),e=>e instanceof ClientSettingsError&&e.code===code&&e.status===status);
 }
 await assert.rejects(settingsRequest('/facilities',schema,{},async()=>Response.json({id:null})),z.ZodError);
 assert.match(settingsError(new ClientSettingsError('STALE_DRAFT',409,'stale')),/Reload the latest/);
});
test('civil hours accept midnight closure and reject invalid/overlapping time with a valid control',()=>{
 const opening={dayOfWeek:1,opensAt:'08:00',closesAt:'24:00'},valid={timezone:'America/Lima',weekly:[opening]};
 assert.equal(OperatingHoursSchema.safeParse(valid).success,true);
 assert.equal(OperatingHoursSchema.safeParse({...valid,timezone:'+05:00'}).success,false);
 assert.equal(OperatingHoursSchema.safeParse({...valid,timezone:'Fake/Place'}).success,false);
 assert.equal(OperatingHoursSchema.safeParse({...valid,weekly:[opening,{...opening,opensAt:'09:00'}]}).success,false);
 const facility={schemaVersion:'2.0',name:'Control',code:'CONTROL',facilityType:'SHIPPER_SITE',active:true,accessRestrictions:[],operatingHours:null,
  location:{label:'Fictional address',countryCode:'PE',region:null,city:'Lima',lat:-12,lng:-77}};
 assert.equal(FacilityInputV2Schema.safeParse(facility).success,true);
 for(const location of [{...facility.location,lat:91},{...facility.location,lng:null}])assert.equal(FacilityInputV2Schema.safeParse({...facility,location}).success,false);
});
