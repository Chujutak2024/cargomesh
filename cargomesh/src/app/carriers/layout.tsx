import {DemoWorkspaceProvider,DemoWorkspaceEntry} from '@/features/workspace-demo/workspace-demo-controls';
import {workspaceDemoEnabled,automaticWorkspaceDemoEntry} from '@/server/auth/workspace-demo';
import { ConnectedCoordinator } from '@/features/carrier-portal/coordinator';
import { readCarrierPortalAccess } from '@/server/auth/carrier-portal';
import { demoEnabled } from '@/server/demo/access';
import { V2DraftError } from '@/server/modules/freight-requests/application/draft-service';
import { WorkspaceAccessRequired } from '@/components/workspace-access-required';
import type { ReactNode } from 'react';

export const dynamic = 'force-dynamic';
export default async function CarriersLayout({children}:{children:ReactNode}) {
 const enabled=await workspaceDemoEnabled();
 return <DemoWorkspaceProvider enabled={enabled}>{await carrierWorkspace(children,enabled)}</DemoWorkspaceProvider>;
}
async function carrierWorkspace(children:ReactNode,demoSwitchEnabled:boolean){
  try {
    const access = await readCarrierPortalAccess();
    if(!access.length&&demoSwitchEnabled)return <DemoWorkspaceEntry workspace="carrier" automatic={await automaticWorkspaceDemoEntry()}/>;
    return <><ConnectedCoordinator previewEnabled={demoEnabled()} initialAccess={access} />{children}</>;
  } catch (error) {
    if (error instanceof V2DraftError && error.code === 'UNAUTHORIZED') {
      if(demoSwitchEnabled)return <DemoWorkspaceEntry workspace="carrier" automatic/>;
      return <WorkspaceAccessRequired loginHref="/login?returnTo=%2Fcarriers" />;
    }
    throw error;
  }
}
