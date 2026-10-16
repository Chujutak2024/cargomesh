"use client";
import {z} from 'zod';
import {ContractForm} from './contract-form';
import {parseCatalogRecordV2,type CatalogKindV2} from '@/shared/schemas/v2/catalog';
import {CatalogInputsV2} from '@/shared/schemas/v2/catalog';
import {PortalApiError} from './api';
import {recordData,type PortalRecord} from './records';
/** Fixed references are selected from an authorized catalog, not editable UUID fields. */
export function operationalSchema(schema:z.ZodTypeAny,fixed:Record<string,unknown>){
 let object=schema;while(object instanceof z.ZodEffects)object=object.innerType();
 if(!(object instanceof z.ZodObject))throw new Error('Expected object contract');
 const shape=Object.fromEntries(Object.entries(object.shape as z.ZodRawShape).filter(([key])=>!(key in fixed)));
 return z.object(shape).superRefine((value,ctx)=>{const checked=schema.safeParse({...value,...fixed});if(!checked.success)for(const issue of checked.error.issues)ctx.addIssue(issue);}).transform(value=>({...value,...fixed}));
}
export function CatalogOperationalForm({kind,carrierId,serviceId,record,fixed,title,onSaved,onClose}:{kind:CatalogKindV2;carrierId:string;serviceId:string;record?:PortalRecord;fixed:Record<string,unknown>;title:string;onSaved:()=>void;onClose:()=>void}){
 const schema=operationalSchema(CatalogInputsV2[kind],{schemaVersion:'2.0',serviceId,...fixed});
 const path='/api/v2/carrier-portal/carriers/'+carrierId+'/'+kind+(record?'/'+record.id+'/revisions':'');
 return <ContractForm schema={schema} initial={record?recordData(record):undefined} path={path} revision={record?.version} title={title} onSaved={onSaved} onClose={onClose} hiddenReviewFields={['serviceId',...Object.keys(fixed)]} validateSaved={raw=>{const saved=parseCatalogRecordV2(kind,raw);const v=saved.value as Record<string,unknown>;if(saved.carrierId!==carrierId||v.serviceId!==serviceId||record&&saved.id!==record.id)throw new PortalApiError(502,'INVALID_RESPONSE');}}/>;
}
