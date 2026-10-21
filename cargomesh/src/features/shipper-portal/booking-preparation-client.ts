import {BookingPreparationResponseSchema} from '@/shared/schemas/v2/booking-preparation';
import {workspaceFetch} from '@/features/workspace-mode/workspace-fetch';
import {ShipperApiError} from './shipper-api';
export async function prepareBookingCapacity(id:string,version:number,key:string){
 const response=await workspaceFetch(`/api/v2/bookings/${encodeURIComponent(id)}/preparations`,{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json','Idempotency-Key':key},body:JSON.stringify({expectedVersion:version,consent:'PREPARE_AUTHORIZED_CAPACITY'})});
 const body=await response.json().catch(()=>null);if(!response.ok)throw new ShipperApiError(body?.error?.code??'CAPACITY_PREPARATION_FAILED',body?.error?.message??'Capacity could not be prepared.',response.status,response.status>=500);
 const result=BookingPreparationResponseSchema.parse(body).data;if(result.bookingId!==id)throw new Error('INVALID_BOOKING_SCOPE');return result;
}
