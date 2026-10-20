import {clientContextHttp} from '@/server/modules/client-context/infrastructure/client-context-http';
export const dynamic='force-dynamic';
export const POST=(request:Request)=>clientContextHttp(request,'confirm');
