import {recordData} from '@/features/carrier-portal/records';
import {vehicleDisplayName} from '@/shared/lib/display-identity';
import type {Point,TowerItem,TowerSnapshot} from './tower-model';
import type {DemoRoadPath} from './tower-demo-route';
export type SimulatedVehiclePosition={assetId:string;itemId:string;label:string;position:Point;moving:boolean};
function seed(id:string){let n=0;for(const c of id)n=(n*31+c.charCodeAt(0))>>>0;return n;}
function atDistance(path:DemoRoadPath,distance:number):Point{
 const d=Math.min(path.length,Math.max(0,distance));let low=1,high=path.distances.length-1;
 while(low<high){const middle=(low+high)>>>1;if(path.distances[middle]<d)low=middle+1;else high=middle;}
 const a=path.points[low-1],b=path.points[low],length=path.distances[low]-path.distances[low-1],mix=length>0?(d-path.distances[low-1])/length:0;
 return {lat:a.lat+(b.lat-a.lat)*mix,lng:a.lng+(b.lng-a.lng)*mix};
}
/** Presentation only, x180 time. Provider road geometry is mandatory: never invent shortcuts. */
export function simulatedVehiclePositions(snapshot:TowerSnapshot|null,items:readonly TowerItem[],seconds:number,path?:DemoRoadPath|null):SimulatedVehiclePosition[]{
 if(!snapshot?.loaded.assets||!path||path.points.length<2)return [];
 const assets=new Map(snapshot.records.assets.filter(row=>recordData(row).mode==='ROAD').map(row=>[row.id,row]));
 const seen=new Set<string>(),result:SimulatedVehiclePosition[]=[];
 for(const item of items){
  if(item.position||['CANCELLED','COMPLETED'].includes(item.status))continue;
  for(const assetId of item.vehicleIds){
   const asset=assets.get(assetId);if(!asset||seen.has(assetId))continue;seen.add(assetId);
   const data=recordData(asset);if(['MAINTENANCE','OUT_OF_SERVICE'].includes(String(data.operatingStatus)))continue;
   const n=seed(assetId),elapsed=Math.max(0,seconds),delay=5+n%7;
   // A brief scheduled pause followed by steady highway motion. Stop at arrival, never wrap to Lima.
   const stop=Math.min(4,Math.max(0,elapsed-delay)),travel=Math.max(0,elapsed-stop),speed=(48+n%19)/3.6;
   const distance=path.length*(.08+result.length*.17)+travel*180*speed;
   const moving=distance<path.length&&!(elapsed>=delay&&elapsed<delay+4);
   const road=data.roadVehicle as {plate?:string}|undefined;
   result.push({assetId,itemId:item.id,label:vehicleDisplayName(assetId,String(data.code??assetId),road?.plate),position:atDistance(path,distance),moving});
   if(result.length===4)return result;
  }
 }
 return result;
}
