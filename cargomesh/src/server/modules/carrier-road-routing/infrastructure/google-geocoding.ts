import {z} from 'zod';
import {ResolvedRoadStopV2Schema,type ResolvedRoadStopV2,type RoadStopInputV2} from '@/shared/schemas/v2/road-points';
import {V2DraftError} from '../../freight-requests/application/draft-service';
export type GeocodeStop=(carrierId:string,input:Exclude<RoadStopInputV2,{kind:'DEPOT'}>)=>Promise<ResolvedRoadStopV2>;
const Result=z.object({formatted_address:z.string().min(1).max(500),place_id:z.string().min(1).max(300),partial_match:z.boolean().optional(),
 types:z.array(z.string()),address_components:z.array(z.object({long_name:z.string(),short_name:z.string(),types:z.array(z.string())})).max(40),
 geometry:z.object({location:z.object({lat:z.number().finite().min(-90).max(90),lng:z.number().finite().min(-180).max(180)}),location_type:z.string()})});
const fail=(code:string,message:string,status=422):never=>{throw new V2DraftError(code,message,status);};
export function stopDistance(a:{lat:number;lng:number},b:{lat:number;lng:number}){const r=(x:number)=>x*Math.PI/180,h=Math.sin(r(b.lat-a.lat)/2)**2+Math.cos(r(a.lat))*Math.cos(r(b.lat))*Math.sin(r(b.lng-a.lng)/2)**2;return 6371000*2*Math.asin(Math.sqrt(Math.min(1,h)));}
/** Address metadata comes from the server provider, never client-supplied city/country labels. */
export function parseGeocodedStop(raw:unknown,input:Exclude<RoadStopInputV2,{kind:'DEPOT'}>,now:string):ResolvedRoadStopV2{
 const response=z.object({status:z.string(),results:z.array(z.unknown()).max(100).default([])}).safeParse(raw);
 if(!response.success)return fail('INVALID_GEOCODING_RESPONSE','Invalid location response.',502);
 if(response.data.status==='REQUEST_DENIED')return fail('GEOCODING_DENIED','Address resolution is not authorized.',503);
 if(response.data.status==='OVER_QUERY_LIMIT'||response.data.status==='OVER_DAILY_LIMIT')return fail('GEOCODING_RATE_LIMITED','Address resolution quota reached.',429);
 if(response.data.status==='ZERO_RESULTS')return fail('LOCATION_NOT_FOUND','No precise address was found.');
 if(response.data.status!=='OK')return fail('GEOCODING_UNAVAILABLE','Address resolution is unavailable.',503);
 const candidates=response.data.results.map(r=>Result.safeParse(r)).filter(r=>r.success).map(r=>r.data)
  .filter(r=>!r.partial_match&&['ROOFTOP','RANGE_INTERPOLATED'].includes(r.geometry.location_type)
   &&r.types.some(t=>['street_address','premise','subpremise','establishment','point_of_interest'].includes(t)));
 // A reverse lookup may also return postal/locality/country results. They are not stop addresses.
 const precise=input.kind==='COORDINATES'?candidates.filter(r=>stopDistance(input,r.geometry.location)<=100):candidates;
 if(precise.length===0)return fail('LOCATION_PRECISION_REQUIRED','Select a precise property or entrance, not a city or broad area.');
 if(precise.length!==1)return fail('LOCATION_AMBIGUOUS','Several precise addresses match. Provide a more specific address.');
 const result=precise[0],component=(kind:string,short=false)=>{const c=result.address_components.find(c=>c.types.includes(kind));return c?(short?c.short_name:c.long_name):null;};
 const countryCode=component('country',true);if(!countryCode||!/^[A-Z]{2}$/.test(countryCode))return fail('LOCATION_COUNTRY_UNKNOWN','The location country could not be established.');
 return ResolvedRoadStopV2Schema.parse({...(input.kind==='COORDINATES'?{lat:input.lat,lng:input.lng}:result.geometry.location),
  label:result.formatted_address,countryCode,city:component('locality')??component('postal_town'),region:component('administrative_area_level_1'),postalCode:component('postal_code'),
  // A custom pin must remain the requested routing point; its nearby address is descriptive only.
  placeId:input.kind==='ADDRESS'?result.place_id:null,source:'GOOGLE_GEOCODING',resolvedAt:now,precision:result.geometry.location_type,
  depotId:null,depotVersion:null,accessStatus:'UNVERIFIED'});
}
export function createGeocodeStop(config:{apiKey?:string;fetcher?:typeof fetch;now?:()=>number}):GeocodeStop{
 let calls:Array<{carrierId:string;at:number}>=[];
 return async(carrierId,input)=>{
  if(!config.apiKey?.trim())return fail('GEOCODING_NOT_CONFIGURED','Server address resolution is not configured. Select a saved Carrier site with coordinates.',503);
  const now=(config.now??Date.now)();calls=calls.filter(c=>now-c.at<60000);
  if(calls.length>=30||calls.filter(c=>c.carrierId===carrierId).length>=10)return fail('GEOCODING_RATE_LIMITED','Local address resolution budget reached.',429);
  calls.push({carrierId,at:now});
  const url=new URL('https://maps.googleapis.com/maps/api/geocode/json');url.searchParams.set('key',config.apiKey);url.searchParams.set('language','en');
  if(input.kind==='ADDRESS')url.searchParams.set('address',input.address);else url.searchParams.set('latlng',`${input.lat},${input.lng}`);
  let payload:unknown;try{const response=await(config.fetcher??fetch)(url,{signal:AbortSignal.timeout(10000),cache:'no-store'});
   if(response.status===401||response.status===403)return fail('GEOCODING_DENIED','Address resolution is not authorized.',503);
   if(!response.ok)return fail('GEOCODING_UNAVAILABLE','Address resolution is unavailable.',503);payload=await response.json();
  }catch(error){if(error instanceof V2DraftError)throw error;return fail('GEOCODING_UNAVAILABLE','Address resolution is unavailable.',503);}
  return parseGeocodedStop(payload,input,new Date(now).toISOString());
 };
}
export const geocodeRoadStop=createGeocodeStop({apiKey:process.env.GOOGLE_GEOCODING_API_KEY});
