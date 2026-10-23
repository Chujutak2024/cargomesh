/** Presentation labels only. Canonical states still drive filtering and commands. */
const labels:Record<string,[string,string]>={
 'New':['Por cotizar','To quote'],'Preparing offer':['En preparación','Preparing'],
 'Customer review':['Cliente revisando','Customer review'],'Booking review':['Por confirmar','To confirm'],
 'Scheduled':['Programada','Scheduled'],'In progress':['En curso','In progress'],
 'Completed':['Completada','Completed'],'Closed':['Cerrada','Closed'],'Needs review':['Revisar','Review needed'],
 PLANNED:['Programada','Scheduled'],IN_PROGRESS:['En curso','In progress'],COMPLETED:['Completada','Completed'],
 CONFIRMED:['Confirmada','Confirmed'],PROPOSED:['Propuesta','Proposed'],CANCELLED:['Cancelada','Cancelled'],
 AUTHORIZED:['Autorizada','Authorized'],PENDING:['Pendiente','Pending'],REJECTED:['Rechazada','Rejected'],
 HELD:['Retenida','Held'],RELEASED:['Liberada','Released'],AVAILABLE:['Disponible','Available'],
 UNKNOWN:['Sin verificar','Unverified'],ON_DUTY:['En servicio','On duty'],OFF_DUTY:['Fuera de turno','Off duty'],
 SUSPENDED:['Suspendido','Suspended'],EXPIRED:['Vencida','Expired'],PRIMARY:['Principal','Primary'],
};
export function carrierStatusLabel(value:string,spanish=false){return labels[value]?.[spanish?0:1]??value.replaceAll('_',' ');}
