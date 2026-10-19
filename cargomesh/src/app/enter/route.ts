import {NextResponse} from 'next/server';
import {LOCALE_COOKIE} from '@/features/i18n/config';
export async function GET(request:Request){
 const portal=new URL(request.url).searchParams.get('portal');
 if(portal!=='shipper'&&portal!=='carrier')return new NextResponse('Unknown workspace',{status:400});
 const response=new NextResponse(null,{status:303,headers:{Location:portal==='carrier'?'/carriers':'/clients','Cache-Control':'no-store'}});
 response.cookies.set(LOCALE_COOKIE,'en',{path:'/',sameSite:'lax',maxAge:31536000});return response;
}
