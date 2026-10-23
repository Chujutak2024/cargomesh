import {ClientRouteContent} from '@/features/shipper-portal/client-continuity';
import ConnectedPage from '@/app/(cargomesh)/organization/page';
import PreviewPage from '@/app/demo/shipper/organization/page';
import {hasLocalClientPreviewSession} from '@/server/auth/local-client-preview';
export const dynamic='force-dynamic';
export default async function ClientPage(){
 return <ClientRouteContent route="/clients/organization">{await (await hasLocalClientPreviewSession()?PreviewPage():ConnectedPage())}</ClientRouteContent>;
}
