import ConnectedPage from '@/app/(cargomesh)/bookings/page';
import PreviewPage from '@/app/demo/shipper/bookings/page';
import {hasLocalClientPreviewSession} from '@/server/auth/local-client-preview';
export const dynamic='force-dynamic';
export default async function ClientPage(){
 return await hasLocalClientPreviewSession()?PreviewPage():ConnectedPage();
}
