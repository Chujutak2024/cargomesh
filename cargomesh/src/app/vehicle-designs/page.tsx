import type { Metadata } from 'next';
import { DepotPreview } from '@/features/logistics-3d/depot-preview';

export const metadata: Metadata = { title: '3D design studio | CargoMesh' };
/** Original public presentation assets only. No carrier records or business APIs. */
export default function VehicleDesignsPage() { return <DepotPreview initialView="designs" development={false}/>; }
