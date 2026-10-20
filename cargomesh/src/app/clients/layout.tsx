import type { ReactNode } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireAuthenticatedMember } from '@/server/auth/member';
import {hasLocalClientPreviewSession} from '@/server/auth/local-client-preview';
import {AppShell} from '@/components/app-shell';
import {AssignedDemoEntry} from '@/components/assigned-demo-entry';
import {assignedDemoConfig,assignedDemoEnabled} from '@/server/auth/assigned-demo';
import ClientShell from '@/app/(cargomesh)/layout';
export const dynamic = 'force-dynamic';
export default async function ClientsLayout({ children }: { children: ReactNode }) {
  if(await hasLocalClientPreviewSession()){
   if(assignedDemoConfig().clientOrganizationId&&await assignedDemoEnabled())return <AssignedDemoEntry workspace="client"/>;
   return <AppShell preview identity={{organizationName:'Northstar Logistics · Test organization',displayName:'Alex Morgan',role:'TEST CLIENT'}}>
    <aside role="note" style={{padding:'10px 16px',background:'#e5f5f7',color:'#075d68',marginBottom:16}}>Client test session · Sample data · Read only</aside>{children}
  </AppShell>;
  }
  try { await requireAuthenticatedMember(); }
  catch (error) {
    if (error instanceof Error && error.message.startsWith('UNAUTHENTICATED:')) redirect('/login?returnTo=%2Fclients');
    if (error instanceof Error && error.message.startsWith('FORBIDDEN:')) return <main style={{ padding: 40 }}>
      <h1>No Client access</h1><p>Your account needs an active client organization membership. Carrier access is separate.</p>
      <Link href="/carriers">Open Carrier workspace</Link> · <Link href="/">Back to CargoMesh</Link>
    </main>;
    throw error;
  }
  return <ClientShell>{children}</ClientShell>;
}
