import {requireOperationalRouteAccess} from '@/server/auth/route-guard';
import {ClientOrganization} from '@/features/shipper-portal/client-organization';
export const dynamic = "force-dynamic";
export default async function OrganizationPage() {
  const member=await requireOperationalRouteAccess();
  return <ClientOrganization role={member.role}/>;
}
