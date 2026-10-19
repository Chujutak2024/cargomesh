import {z} from 'zod';
import {CatalogInputsV2,parseCatalogRecordV2} from '@/shared/schemas/v2/catalog';
import {recordData,type PortalRecord} from '@/features/carrier-portal/records';
import {PortalApiError} from '@/features/carrier-portal/api';
export type SiteEditorKind='depots'|'areas'|'lanes';
export function keepSiteSelection(id:string,depots:PortalRecord[]) {return depots.some(d=>d.id===id)?id:depots[0]?.id??'';}
export function canEditSites(role:string,loaded:boolean,partial:boolean) {return role==='ADMIN'&&loaded&&!partial;}
export function areaLabel(row:PortalRecord) {
 const g=recordData(row).geography as Record<string,unknown>;
 return [g.city,g.region,g.postalCode,g.countryCode].filter(Boolean).join(' · ')+' ('+g.granularity+')';
}
export function laneChoices(areas:PortalRecord[],role:'PICKUP'|'DELIVERY') {
 return areas.filter(row=>{const v=recordData(row);return v.role===role&&v.inclusion==='INCLUDE'&&v.active===true;});
}
/** Catalog references are fixed by the surrounding authorized selectors, never typed UUIDs. */
export function siteEditorSchema(kind:SiteEditorKind,fixed:Record<string,unknown>) {
 const canonical=CatalogInputsV2[kind];let object:z.ZodTypeAny=canonical;
 while(object instanceof z.ZodEffects)object=object.innerType();
 if(!(object instanceof z.ZodObject))throw new Error('Expected catalog object');
 const constants={schemaVersion:'2.0',...fixed};
 return z.object(Object.fromEntries(Object.entries(object.shape as z.ZodRawShape).filter(([key])=>!(key in constants))))
  .strict().superRefine((value,ctx)=>{const checked=canonical.safeParse({...value,...constants});
   if(!checked.success)for(const issue of checked.error.issues)ctx.addIssue(issue);
  }).transform(value=>({...value,...constants}));
}
export function siteEditorPath(carrierId:string,serviceId:string,kind:SiteEditorKind,record?:PortalRecord) {
 const id=z.string().uuid();id.parse(carrierId);if(kind!=='depots')id.parse(serviceId);
 if(record){id.parse(record.id);if(record.carrierId!==carrierId||kind!=='depots'&&record.serviceId!==serviceId)throw new PortalApiError(400,'INVALID_CONTEXT');}
 return '/api/v2/carrier-portal/carriers/'+carrierId+'/'+(kind==='depots'?'':'services/'+serviceId+'/')+kind+(record?'/'+record.id+'/revisions':'');
}
export function validateSiteSaved(kind:SiteEditorKind,carrierId:string,serviceId:string,record:PortalRecord|undefined,raw:unknown) {
 const saved=parseCatalogRecordV2(kind,raw);
 if(saved.carrierId!==carrierId||kind!=='depots'&&saved.serviceId!==serviceId||record&&saved.id!==record.id)throw new PortalApiError(502,'INVALID_RESPONSE');
 return saved;
}
