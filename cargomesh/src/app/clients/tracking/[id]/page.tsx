import {ClientRouteContent} from '@/features/shipper-portal/client-continuity';
import ConnectedPage from '@/app/(cargomesh)/tracking/[id]/page';
import PreviewPage from '@/app/demo/shipper/tracking/[id]/page';
import {hasLocalClientPreviewSession} from '@/server/auth/local-client-preview';
export const dynamic='force-dynamic';
export default async function ClientPage(props: Parameters<typeof ConnectedPage>[0]){
 return <ClientRouteContent route={'/clients/tracking/'+(await props.params).id}>{await (await hasLocalClientPreviewSession()?PreviewPage(props):ConnectedPage(props))}</ClientRouteContent>;
}
