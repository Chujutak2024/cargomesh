import {requireOperationalRouteAccess} from '@/server/auth/route-guard';
import {ClientFacilities} from '@/features/shipper-portal/client-facilities';

export const dynamic = "force-dynamic";

export default async function FacilitiesPage({searchParams}:{searchParams?:Promise<{facility?:string}>}) {
  const member=await requireOperationalRouteAccess();
  return <ClientFacilities role={member.role} initialId={(await searchParams)?.facility}/>;
}
