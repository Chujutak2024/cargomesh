import type {CarrierPortalAccessV2} from '@/shared/schemas/v2/carrier-portal';
import type {PortalResource} from './resources';
export type CarrierPortalRole=CarrierPortalAccessV2['role'];
/** Advisory UI policy. Every command is independently authorized in the database. */
export function canCreateCarrierRecord(role:CarrierPortalRole,resource:PortalResource){
 if(!resource.schema)return false;
 if(resource.family==='catalog'||['limits','metrics'].includes(resource.key))return role==='ADMIN';
 return ['incidents','consolidations','asset-events'].includes(resource.key);
}
export function canReviseCarrierRecord(role:CarrierPortalRole,resource:PortalResource){
 return role==='ADMIN'&&!!resource.schema&&(resource.family==='catalog'||['limits','metrics'].includes(resource.key));
}
export function canCarrierAction(role:CarrierPortalRole,action:string,status:string){
 if(role==='DISPATCHER'&&!['executions','incidents','asset-events','consolidations'].some(prefix=>action.startsWith(prefix+'.')))return false;
 const states:Record<string,string[]>={
 'opportunities.respond':['SENT','ACCEPTED'], 'offers.create':['SENT','ACCEPTED'],
 'offers.withdraw':['RECEIVED'], 'offers.supersede':['RECEIVED'],
 'bookings.confirm':['AUTHORIZED'], 'bookings.cancel':['AUTHORIZED','CONFIRMED'],
 'holds.confirm':['HELD'], 'holds.release':['HELD','CONFIRMED'],
 'executions.start':['PLANNED'], 'executions.complete':['IN_PROGRESS'],
 'executions.cancel':['PLANNED','IN_PROGRESS'], 'executions.position':['IN_PROGRESS'],
 'incidents.update':['OPEN','RESOLVED'],
 'consolidations.start':['OPEN'], 'consolidations.complete':['IN_PROGRESS'],
 'consolidations.cancel':['OPEN','IN_PROGRESS'], 'consolidations.close':['OPEN'],
 'consolidations.position':['IN_PROGRESS']};
 return states[action]?.includes(status)??false;
}
