import {RegularDriverRecord,RegularDriverValue,type RegularDriverRecordV2} from '@/shared/schemas/v2/regular-driver';
import {portalRequest,PortalApiError} from './api';
import {validCarrierId} from './records';
export async function readRegularDrivers(carrierId:string,signal:AbortSignal,fetcher:typeof fetch=fetch){
 if(!validCarrierId(carrierId))throw new PortalApiError(400,'INVALID_REFERENCE');
 const records:RegularDriverRecordV2[]=[];
 for(let offset=0;offset<1000;offset+=100){
  const response=await portalRequest('/api/v2/carrier-portal/carriers/'+carrierId+'/regular-drivers?offset='+offset,{signal},fetcher);
  const rows=RegularDriverRecord.array().max(100).parse(response.data);
  if(rows.some(row=>row.carrierId!==carrierId)||rows.some(row=>records.some(existing=>existing.assetId===row.assetId)))throw new PortalApiError(502,'INVALID_RESPONSE');
  records.push(...rows);if(rows.length<100)return {records,truncated:false};
 }return {records,truncated:true};
}
export async function saveRegularDriver(carrierId:string,assetId:string,value:unknown,key:string,signal:AbortSignal,fetcher:typeof fetch=fetch){
 if(![carrierId,assetId,key].every(validCarrierId))throw new PortalApiError(400,'INVALID_REFERENCE');
 const input=RegularDriverValue.parse(value);
 const response=await portalRequest('/api/v2/carrier-portal/carriers/'+carrierId+'/assets/'+assetId+'/regular-driver',{method:'POST',signal,headers:{'Content-Type':'application/json','Idempotency-Key':key},body:JSON.stringify(input)},fetcher);
 const row=RegularDriverRecord.parse(response.data);
 if(row.carrierId!==carrierId||row.assetId!==assetId||row.serviceId!==input.serviceId||row.driverId!==input.driverId)throw new PortalApiError(502,'INVALID_RESPONSE');
 return row;
}
