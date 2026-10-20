import ConnectedPage from '@/app/(cargomesh)/tracking/page';
import PreviewPage from '@/app/demo/shipper/tracking/page';
import {hasLocalClientPreviewSession} from '@/server/auth/local-client-preview';
export const dynamic='force-dynamic';
export default async function ClientPage(props:Parameters<typeof ConnectedPage>[0]){
 return await hasLocalClientPreviewSession()?PreviewPage():ConnectedPage(props);
}
