import {ClientRouteContent} from '@/features/shipper-portal/client-continuity';
import ConnectedPage from '@/app/(cargomesh)/requests/[id]/page';
import PreviewPage from '@/app/demo/shipper/requests/[id]/page';
import {hasLocalClientPreviewSession} from '@/server/auth/local-client-preview';
export const dynamic='force-dynamic';
export default async function ClientPage(props: Parameters<typeof ConnectedPage>[0]){
 return <ClientRouteContent route={'/clients/requests/'+(await props.params).id}>{await (await hasLocalClientPreviewSession()?PreviewPage(props):ConnectedPage(props))}</ClientRouteContent>;
}
