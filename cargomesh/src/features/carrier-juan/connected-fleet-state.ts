import type {CarrierPortalAccessV2} from '@/shared/schemas/v2/carrier-portal';
import {recordData} from '@/features/carrier-portal/records';
import type {ConnectedFleetSnapshot} from '@/features/carrier-portal/connected-fleet-presentation';

export function fleetContext(access:CarrierPortalAccessV2[],carrierId:string,serviceId:string,snapshot:ConnectedFleetSnapshot|null,networkOnly=false){
 const carrier=access.find(row=>row.carrierId===carrierId)??null;
 const current=carrier&&snapshot?.carrierId===carrier.carrierId?snapshot:null;
 const services=current?.services.filter(row=>networkOnly||recordData(row).mode==='ROAD')??[];
 const service=services.find(row=>row.id===serviceId)??null;
 return {carrier,current,services,service,canWrite:!!carrier&&carrier.role==='ADMIN'&&!!current&&!current.partial&&!!service&&recordData(service).status==='ACTIVE'};
}
