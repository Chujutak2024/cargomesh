import {ClientOrganization} from '@/features/shipper-portal/client-organization';
export const dynamic = "force-dynamic";
export default async function OrganizationPage() {
  return <ClientOrganization role="SUPERVISOR" />;
}
