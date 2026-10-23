import {ClientRouteContent} from '@/features/shipper-portal/client-continuity';
import ConnectedPage from '@/app/(cargomesh)/requests/page';
import PreviewPage from '@/app/demo/shipper/requests/page';
import {hasLocalClientPreviewSession} from '@/server/auth/local-client-preview';
export const dynamic='force-dynamic';
export default async function ClientPage(props: Parameters<typeof ConnectedPage>[0]){
 return <ClientRouteContent route="/clients/requests" offset={String((await props.searchParams).offset??'0')}>{await (await hasLocalClientPreviewSession()?PreviewPage(props):ConnectedPage(props))}</ClientRouteContent>;
}
