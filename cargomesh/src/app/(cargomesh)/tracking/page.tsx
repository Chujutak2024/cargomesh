import { TrackingList } from "@/features/shipper-portal/tracking-list";
import { readOperationsTrackingList } from "@/server/services/v2-workspace/tracking-server";
import { OperationsReadNotice } from "@/features/shipper-portal/operations-navigation";
import { parseTrackingQuery } from "@/features/shipper-portal/tracking-query";
export const dynamic="force-dynamic";
export default async function TrackingPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  const raw=await searchParams, params=new URLSearchParams();
  for(const [key,value] of Object.entries(raw))if(typeof value==="string")params.set(key,value);
  const query=parseTrackingQuery(params), result=await readOperationsTrackingList(query.offset);
  return <><OperationsReadNotice issues={result.issues}/><TrackingList items={result.items} offset={result.offset} nextOffset={result.nextOffset}/></>;
}
