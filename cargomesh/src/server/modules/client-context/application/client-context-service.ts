import {z} from 'zod';
import {isDeepStrictEqual} from 'node:util';
import {FacilityInputV2Schema,PageV2Schema} from '@/shared/schemas/v2/facilities';
import {OrganizationValueV2Schema} from '@/shared/schemas/v2/organization';
import {CatalogInputsV2} from '@/shared/schemas/v2/catalog';
import {V2DraftError,type V2Actor} from '../../freight-requests/application/draft-service';
import type {FacilityServiceV2} from '../../facilities/application/facility-service';
import type {OrganizationServiceV2} from '../../organizations/application/organization-service';
import type {CatalogServiceV2} from '../../catalog/application/catalog-service';
const actions=['facility.create','facility.revise','organization.revise','cargo-profile.create','cargo-profile.revise','preferences.create','preferences.revise'] as const;
export const ClientActionInput=z.object({action:z.enum(actions),resourceId:z.string().uuid().nullable(),expectedVersion:z.number().int().positive().nullable(),idempotencyKey:z.string().uuid(),value:z.unknown()}).strict()
 .refine(v=>v.action.endsWith('.create')?(v.resourceId===null&&v.expectedVersion===null):(v.resourceId!==null&&v.expectedVersion!==null),'Creation requires no id/version; revision requires both.');
export const ClientActionProposal=z.object({id:z.string().uuid(),organizationId:z.string().uuid(),memberId:z.string().uuid(),action:z.enum(actions),resourceId:z.string().uuid().nullable(),expectedVersion:z.number().int().positive().nullable(),proposedValue:z.unknown(),expiresAt:z.string().datetime({offset:true}),requiresConfirmation:z.literal(true)}).strict();
export type ClientAction=z.infer<typeof ClientActionInput>;
export interface ClientConfirmationRepository{
 prepare(actor:V2Actor,input:ClientAction):Promise<unknown>;
 confirm(actor:V2Actor,id:string):Promise<unknown>;
}
type Services={organization:Pick<OrganizationServiceV2,'get'>;facilities:Pick<FacilityServiceV2,'get'|'list'>;catalog:Pick<CatalogServiceV2,'get'|'list'>};
/** Server-bound actor only. Juan can expose this adapter through his authenticated channel. */
export class ClientContextService{
 constructor(private readonly actor:V2Actor,private readonly services:Services,private readonly confirmations:ClientConfirmationRepository){}
 async read(rawPage:unknown={}){
  const page=PageV2Schema.parse(rawPage),scope={carrierId:null,serviceId:null};
  const [organization,facilities,profiles,preferences]=await Promise.all([this.services.organization.get(this.actor),this.services.facilities.list(this.actor,page),this.services.catalog.list(this.actor,'cargo-profiles',scope,page),this.services.catalog.list(this.actor,'preferences',scope,page)]);
  if(organization.data.id!==this.actor.organizationId||facilities.data.some(v=>v.organizationId!==this.actor.organizationId)||[...profiles.data,...preferences.data].some(v=>v.organizationId!==this.actor.organizationId))throw new V2DraftError('FORBIDDEN_TENANT','Client context scope mismatch.',403);
  return {schemaVersion:'2.0' as const,organization:organization.data,facilities,profiles,preferences};
 }
 async prepare(raw:unknown){
  const input=ClientActionInput.parse(raw),kind=input.action.split('.')[0];
  input.value=(kind==='facility'?FacilityInputV2Schema:kind==='organization'?OrganizationValueV2Schema:kind==='cargo-profile'?CatalogInputsV2['cargo-profiles']:CatalogInputsV2.preferences).parse(input.value);
  if(input.action==='organization.revise'&&input.resourceId!==this.actor.organizationId)throw new V2DraftError('FORBIDDEN_TENANT','Organization mismatch.',403);
  const proposal=ClientActionProposal.parse(await this.confirmations.prepare(this.actor,input));
  if(proposal.organizationId!==this.actor.organizationId||proposal.memberId!==this.actor.memberId||proposal.action!==input.action||proposal.resourceId!==input.resourceId||proposal.expectedVersion!==input.expectedVersion||!isDeepStrictEqual(proposal.proposedValue,input.value))throw new V2DraftError('FORBIDDEN_TENANT','Proposal scope mismatch.',403);
  return {schemaVersion:'2.0' as const,data:proposal};
 }
 async confirm(raw:unknown){
  const input=z.object({confirmationId:z.string().uuid(),confirmed:z.literal(true)}).strict().parse(raw);
  const result=z.object({action:z.enum(actions),id:z.string().uuid(),idempotentReplay:z.boolean()}).strict().parse(await this.confirmations.confirm(this.actor,input.confirmationId));
  const scope={carrierId:null,serviceId:null};
  const record=result.action.startsWith('facility.')?await this.services.facilities.get(this.actor,result.id):result.action==='organization.revise'?await this.services.organization.get(this.actor):await this.services.catalog.get(this.actor,result.action.startsWith('cargo-profile.')?'cargo-profiles':'preferences',scope,result.id);
  return {schemaVersion:'2.0' as const,data:record.data,meta:{idempotentReplay:result.idempotentReplay}};
 }
}
