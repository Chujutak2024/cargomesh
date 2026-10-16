import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireDemoPageAccess } from '@/server/demo/access';
import { CARRIER_TOWER } from '@/features/carrier-navigation/workspace-route';
export const metadata:Metadata={title:'Control tower · CargoMesh Preview',description:'A simulated Carrier control tower using Google Maps.'};
/** Backward-compatible entry; destination retains its authenticated workspace guard. */
export default async function Page(){ await requireDemoPageAccess(); redirect(CARRIER_TOWER); }
