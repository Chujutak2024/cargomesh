import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { requireAuthenticatedMember } from '@/server/auth/member';
import {hasLocalClientPreviewSession,localClientFrontendPreviewEnabled} from '@/server/auth/local-client-preview';
import {AppShell} from '@/components/app-shell';
import {DemoWorkspaceProvider,DemoWorkspaceEntry} from '@/features/workspace-demo/workspace-demo-controls';
import {workspaceDemoEnabled,automaticWorkspaceDemoEntry} from '@/server/auth/workspace-demo';
import {assignedDemoConfig,assignedDemoEnabled} from '@/server/auth/assigned-demo';
import ClientShell from '@/app/(cargomesh)/layout';

export const dynamic = 'force-dynamic';
export default async function ClientsLayout({ children }: { children: ReactNode }) {
 const enabled=await workspaceDemoEnabled();
 return <DemoWorkspaceProvider enabled={enabled}>{await clientWorkspace(children,enabled)}</DemoWorkspaceProvider>;
}
async function clientWorkspace(children:ReactNode,demoEnabled:boolean){
  if(await hasLocalClientPreviewSession()){
   if(assignedDemoConfig().clientOrganizationId&&await assignedDemoEnabled())return <DemoWorkspaceEntry workspace="client" automatic/>;
   return <AppShell preview identity={{organizationName:'Northstar Logistics · Test organization',displayName:'Alex Morgan',role:'TEST CLIENT'}}>
    <aside role="note" style={{padding:'10px 16px',background:'#e5f5f7',color:'#075d68',marginBottom:16}}>Client test session · Sample data · Read only</aside>{children}
  </AppShell>;
  }
  if(await localClientFrontendPreviewEnabled())redirect('/login?returnTo=%2Fclients');
  try { await requireAuthenticatedMember(); }
  catch (error) {
    if (error instanceof Error && error.message.startsWith('UNAUTHENTICATED:')){
     if(demoEnabled)return <DemoWorkspaceEntry workspace="client" automatic/>;
     redirect('/login?returnTo=%2Fclients');
    }
    if (error instanceof Error && error.message.startsWith('FORBIDDEN:')) return <DemoWorkspaceEntry workspace="client" automatic={demoEnabled&&await automaticWorkspaceDemoEntry()}/>;
    throw error;
  }
  return <ClientShell>{children}</ClientShell>;
}
