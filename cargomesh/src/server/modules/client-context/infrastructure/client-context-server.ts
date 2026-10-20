import 'server-only';
import {requireAuthenticatedMember} from '@/server/auth/member';
import {createV2ServerSupabaseClient} from '@/server/db/supabase/v2';
import {V2DraftError} from '../../freight-requests/application/draft-service';
import {FacilityServiceV2} from '../../facilities/application/facility-service';
import {facilityRepositoryV2} from '../../facilities/infrastructure/supabase-facility-repository';
import {OrganizationServiceV2} from '../../organizations/application/organization-service';
import {organizationRepositoryV2} from '../../organizations/infrastructure/supabase-organization-repository';
import {CatalogServiceV2} from '../../catalog/application/catalog-service';
import {catalogRepositoryV2} from '../../catalog/infrastructure/supabase-catalog-repository';
import {ClientContextService} from '../application/client-context-service';
function databaseError(error:{code?:string;message:string}):never{
 const code=error.message;
 const status=error.code==='PT403'?403:error.code==='PT404'?404:error.code==='PT409'?409:error.code==='PT400'||error.code==='23514'?400:500;
 throw new V2DraftError(status===500?'CLIENT_CONTEXT_UNAVAILABLE':code,status===500?'Client context unavailable.':code,status);
}
export async function clientContextForCurrentMember(){
 const actor=await requireAuthenticatedMember();
 const [db,facilities,organization,catalog]=await Promise.all([createV2ServerSupabaseClient(),facilityRepositoryV2(),organizationRepositoryV2(),catalogRepositoryV2()]);
 return new ClientContextService(actor,{facilities:new FacilityServiceV2(facilities),organization:new OrganizationServiceV2(organization),catalog:new CatalogServiceV2(catalog)},{
  async prepare(member,input){
   // Additive RPCs are validated by the application schema; no broad untyped table access.
   const {data,error}=await db.schema('public').rpc('prepare_v2_client_action' as never,{p_organization_id:member.organizationId,p_member_id:member.memberId,p_action:input.action,p_resource_id:input.resourceId,p_expected_version:input.expectedVersion,p_idempotency_key:input.idempotencyKey,p_value:input.value} as never);
   if(error)databaseError(error);return data;
  },
  async confirm(member,id){const {data,error}=await db.schema('public').rpc('confirm_v2_client_action' as never,{p_organization_id:member.organizationId,p_member_id:member.memberId,p_confirmation_id:id} as never);if(error)databaseError(error);return data;},
 });
}
