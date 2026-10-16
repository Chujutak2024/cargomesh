import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireDemoPageAccess } from '@/server/demo/access';
import { CARRIER_ROUTE_LAB } from '@/features/carrier-navigation/workspace-route';
export const metadata: Metadata = { title: "Road routing lab · CargoMesh", description: "Local comparison of calculated road routes." };
/** Backward-compatible entry; destination retains its authenticated workspace guard. */
export default async function Page(){ await requireDemoPageAccess(); redirect(CARRIER_ROUTE_LAB); }
