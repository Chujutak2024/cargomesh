import {ClientRouteContent} from '@/features/shipper-portal/client-continuity';
import ConnectedPage from '@/app/(cargomesh)/freight-request/new/page';
import PreviewPage from '@/app/demo/shipper/freight-request/new/page';
import {hasLocalClientPreviewSession} from '@/server/auth/local-client-preview';
export const dynamic='force-dynamic';
export default async function ClientPage(){
 return <ClientRouteContent route="/clients/freight-request/new">{await (await hasLocalClientPreviewSession()?PreviewPage():ConnectedPage())}</ClientRouteContent>;
}
