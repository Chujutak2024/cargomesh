import { ConnectedCoordinator } from '@/features/carrier-portal/coordinator';
import { readCarrierPortalAccess } from '@/server/auth/carrier-portal';
import { demoEnabled } from '@/server/demo/access';
import { V2DraftError } from '@/server/modules/freight-requests/application/draft-service';
import { WorkspaceAccessRequired } from '@/components/workspace-access-required';
import type { ReactNode } from 'react';

export const dynamic = 'force-dynamic';
export default async function CarriersLayout({children}:{children:ReactNode}) {
  try {
    const access = await readCarrierPortalAccess();
    return <><ConnectedCoordinator previewEnabled={demoEnabled()} initialAccess={access} />{children}</>;
  } catch (error) {
    if (error instanceof V2DraftError && error.code === 'UNAUTHORIZED')
      return <WorkspaceAccessRequired loginHref="/login?returnTo=%2Fcarriers" />;
    throw error;
  }
}
