import {recordData} from '@/features/carrier-portal/records';
import {vehicleDisplayName} from '@/shared/lib/display-identity';
import type {Point,TowerItem,TowerSnapshot} from './tower-model';

export type SimulatedVehiclePosition={assetId:string;itemId:string;label:string;position:Point;moving:boolean};

// Presentation fixture only. These points are not GPS fixes or a calculated road route.
// Never write them into TowerItem.position, an execution, assignment or reservation.
const demoPoints:readonly Point[]=[
 {lat:-12.0464,lng:-77.0428},
 {lat:-12.27461,lng:-76.86901},
 {lat:-14.0667,lng:-75.7333},
 {lat:-16.409,lng:-71.5375},
];
function phase(id:string){let value=0;for(const char of id)value=(value*31+char.charCodeAt(0))>>>0;return (value%1000)/1000;}
function demoPosition(fraction:number):Point{
 const scaled=Math.min(.999999,Math.max(0,fraction))*(demoPoints.length-1),index=Math.floor(scaled),mix=scaled-index;
 const a=demoPoints[index],b=demoPoints[index+1];
 return {lat:a.lat+(b.lat-a.lat)*mix,lng:a.lng+(b.lng-a.lng)*mix};
}

/** Only depict assets in the authorized read and current filters; preserve all real facts. */
export function simulatedVehiclePositions(snapshot:TowerSnapshot|null,items:readonly TowerItem[],progress:number):SimulatedVehiclePosition[]{
 if(!snapshot?.loaded.assets)return [];
 const assets=new Map(snapshot.records.assets.filter(row=>recordData(row).mode==='ROAD').map(row=>[row.id,row]));
 const seen=new Set<string>(),result:SimulatedVehiclePosition[]=[];
 for(const item of items){
  if(item.position||['CANCELLED','COMPLETED'].includes(item.status))continue;
  for(const assetId of item.vehicleIds){
   const asset=assets.get(assetId);if(!asset||seen.has(assetId))continue;seen.add(assetId);
   const data=recordData(asset),road=data.roadVehicle as {plate?:string}|undefined;
   const moving=!['MAINTENANCE','OUT_OF_SERVICE'].includes(String(data.operatingStatus));
   const fraction=(phase(assetId)+(moving?Math.max(0,Math.min(100,progress))/100:0))%1;
   result.push({assetId,itemId:item.id,label:vehicleDisplayName(assetId,String(data.code??assetId),road?.plate),position:demoPosition(fraction),moving});
  }
 }
 return result;
}
