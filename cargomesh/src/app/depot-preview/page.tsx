import { notFound } from 'next/navigation';
import { DepotPreview } from '@/features/logistics-3d/depot-preview';

/** Development-only visual fixture, independent of identity and business APIs. */
export default function DepotPreviewPage() {
  if (process.env.NODE_ENV !== 'development') notFound();
  return <DepotPreview/>;
}
