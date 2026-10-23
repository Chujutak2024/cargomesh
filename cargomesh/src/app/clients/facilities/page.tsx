import {ClientRouteContent} from '@/features/shipper-portal/client-continuity';
import ConnectedPage from '@/app/(cargomesh)/facilities/page';
import PreviewPage from '@/app/demo/shipper/facilities/page';
import {hasLocalClientPreviewSession} from '@/server/auth/local-client-preview';
export const dynamic='force-dynamic';
export default async function ClientPage({searchParams}:{searchParams:Promise<{facility?:string}>}){
 return <ClientRouteContent route="/clients/facilities">{await (await hasLocalClientPreviewSession()?PreviewPage():ConnectedPage({searchParams}))}</ClientRouteContent>;
}
