import {AssignedDemoEntry} from '@/components/assigned-demo-entry';
import {assignedDemoEnabled} from '@/server/auth/assigned-demo';
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
    if(!access.length&&await assignedDemoEnabled())return <AssignedDemoEntry workspace="carrier"/>;
    return <><ConnectedCoordinator previewEnabled={demoEnabled()} initialAccess={access} />{children}</>;
  } catch (error) {
    if (error instanceof V2DraftError && error.code === 'UNAUTHORIZED') {
      if(await assignedDemoEnabled())return <AssignedDemoEntry workspace="carrier"/>;
      return <WorkspaceAccessRequired loginHref="/login?returnTo=%2Fcarriers" />;
    }
    throw error;
  }
}
