import {ClientRouteContent} from '@/features/shipper-portal/client-continuity';
import ConnectedPage from '@/app/(cargomesh)/history/page';
import PreviewPage from '@/app/demo/shipper/history/page';
import {hasLocalClientPreviewSession} from '@/server/auth/local-client-preview';
export const dynamic='force-dynamic';
export default async function ClientPage(){
 return <ClientRouteContent route="/clients/history">{await (await hasLocalClientPreviewSession()?PreviewPage():ConnectedPage())}</ClientRouteContent>;
}
