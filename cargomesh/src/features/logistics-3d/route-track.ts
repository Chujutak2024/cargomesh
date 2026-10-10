import { validCoordinate, type Coordinate } from "@/features/v2-road-map/road-map-model";

const radians=(n:number)=>n*Math.PI/180;
const longitudeDelta=(a:number,b:number)=>((b-a+540)%360)-180;
export function routeDistance(a:Coordinate,b:Coordinate){const dlat=radians(b.lat-a.lat),dlng=radians(longitudeDelta(a.lng,b.lng));const h=Math.sin(dlat/2)**2+Math.cos(radians(a.lat))*Math.cos(radians(b.lat))*Math.sin(dlng/2)**2;return 6371000*2*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)));}
/** Preserve declared geometry. Never invent a route across missing or disconnected legs. */
export function buildRouteTrack(paths:Coordinate[][]){
  const points:Coordinate[]=[],distances:number[]=[];let total=0;
  for(const path of paths){
    if(path.length<2||path.some(p=>!validCoordinate(p.lat,p.lng)))return null;
    if(points.length&&routeDistance(points.at(-1)!,path[0])>100)return null;
    for(const point of path){const last=points.at(-1),distance=last?routeDistance(last,point):0;if(last&&distance<.05)continue;total+=distance;points.push({...point});distances.push(total);}
  }
  if(points.length<2||total<1)return null;
  return {points,distances,total};
}
export type RouteTrack=NonNullable<ReturnType<typeof buildRouteTrack>>;
export function routePointAt(track:RouteTrack,distance:number):Coordinate{
  const position=Math.max(0,Math.min(track.total,distance));let low=0,high=track.distances.length-1;
  while(low<high){const mid=Math.floor((low+high)/2);if(track.distances[mid]<position)low=mid+1;else high=mid;}
  const end=Math.max(1,low),a=track.points[end-1],b=track.points[end],start=track.distances[end-1],ratio=(position-start)/(track.distances[end]-start);
  return {lat:a.lat+(b.lat-a.lat)*ratio,lng:((a.lng+longitudeDelta(a.lng,b.lng)*ratio+540)%360)-180};
}
export function routePose(track:RouteTrack,distance:number){
  const point=routePointAt(track,distance),ahead=routePointAt(track,Math.min(track.total,distance+45));
  const from=distance>=track.total-1?routePointAt(track,Math.max(0,track.total-45)):point,to=distance>=track.total-1?point:ahead;
  const latitude=radians(from.lat),nextLatitude=radians(to.lat),delta=radians(longitudeDelta(from.lng,to.lng));
  const heading=(Math.atan2(Math.sin(delta)*Math.cos(nextLatitude),Math.cos(latitude)*Math.sin(nextLatitude)-Math.sin(latitude)*Math.cos(nextLatitude)*Math.cos(delta))*180/Math.PI+360)%360;
  return {point,ahead,heading,progress:Math.max(0,Math.min(1,distance/track.total))};
}
