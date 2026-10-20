import {notFound} from "next/navigation";
import {z} from "zod";
import {TrackingDetail} from "@/features/shipper-portal/tracking-detail";
import {readOperationsTrackingDetail} from "@/server/services/v2-workspace/tracking-server";
import {getRequestLocale} from "@/server/i18n/server";
import {V2DraftError} from "@/server/modules/freight-requests/application/draft-service";
import {OperationsReadNotice} from "@/features/shipper-portal/operations-navigation";
export const dynamic="force-dynamic";
export default async function TrackingDetailPage({params}:{params:Promise<{id:string}>}) {
  const {id}=await params;if(!z.string().uuid().safeParse(id).success)notFound();
  const [result,locale]=await Promise.all([readOperationsTrackingDetail(id).catch(error=>{
    if(error instanceof V2DraftError&&error.httpStatus===404)notFound();throw error;
  }),getRequestLocale()]);
  const {item,request}=result;
  return <><OperationsReadNotice issues={result.issues}/><TrackingDetail {...item} requestId={request.id}
    origin={request.origin.city} destination={request.destination.city} originLabel={request.origin.label} destinationLabel={request.destination.label}
    presentation={result.presentation} canView3D={result.canView3D} locale={locale}
    estimatedDeliveryAt={result.offer?.data.estimatedDeliveryAt??null}/></>;
}
