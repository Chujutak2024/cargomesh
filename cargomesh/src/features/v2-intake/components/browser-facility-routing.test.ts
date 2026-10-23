import test from 'node:test';
import assert from 'node:assert/strict';
import {createFacilityRouter} from './browser-facility-routing';
import type {IntakeFacilityOption} from '../contracts';
const a:IntakeFacilityOption={facilityId:'33000000-0000-4000-8000-000000000001',code:'A',label:'A',city:'Sydney',region:null,countryCode:'AU',lat:-33.87,lng:151.21};
const b:IntakeFacilityOption={...a,facilityId:'33000000-0000-4000-8000-000000000002',code:'B',label:'B',city:'Melbourne',lat:-37.81,lng:144.96};
test('missing server credential uses the intended browser channel once per directed pair and retains geometry privately',async()=>{
 const previousFetch=globalThis.fetch,previousGoogle=Reflect.get(globalThis,'google'),previousKey=process.env.NEXT_PUBLIC_GOOGLE_MAPS_JS_API_KEY;
 let server=0,browser=0;
 process.env.NEXT_PUBLIC_GOOGLE_MAPS_JS_API_KEY='unit-only';
 globalThis.fetch=async()=>{server++;return Response.json({schemaVersion:'2.0',data:{originId:a.facilityId,destinationId:b.facilityId,result:{status:'unavailable',reason:'SERVER_KEY_MISSING'}}});};
 Reflect.set(globalThis,'google',{maps:{Map:class {},importLibrary:async()=>({Route:{computeRoutes:async(input:{origin:{lat:number;lng:number};destination:{lat:number;lng:number};routeModifiers:{avoidFerries:boolean};fields:string[]})=>{
  browser++;assert.equal(input.routeModifiers.avoidFerries,true);assert.ok(input.fields.includes('legs.steps.maneuver'));
  return {routes:[{path:[input.origin,input.destination],distanceMeters:1000000,durationMillis:36000000,legs:[{steps:[{travelMode:'DRIVING',maneuver:'DEPART'}]}]}]};
 }}})}});
 try{
  const read=createFacilityRouter();const results=await Promise.all([read(a,b),read(a,b)]);
  assert.ok(results.every(result=>result.status==='estimated'));assert.equal(server,1);assert.equal(browser,1);
  await read(a,b);assert.equal(server,1);assert.equal(browser,1);
  await read(b,a);assert.equal(server,1);assert.equal(browser,2);
 }finally{globalThis.fetch=previousFetch;if(previousGoogle===undefined)Reflect.deleteProperty(globalThis,'google');else Reflect.set(globalThis,'google',previousGoogle);if(previousKey===undefined)delete process.env.NEXT_PUBLIC_GOOGLE_MAPS_JS_API_KEY;else process.env.NEXT_PUBLIC_GOOGLE_MAPS_JS_API_KEY=previousKey;}
});
test('authorization denial never falls back to a paid browser calculation',async()=>{
 const previous=globalThis.fetch;globalThis.fetch=async()=>new Response(null,{status:403});
 try{await assert.rejects(createFacilityRouter()(a,b),/ROAD_PREVIEW_UNAVAILABLE/);}finally{globalThis.fetch=previous;}
});
