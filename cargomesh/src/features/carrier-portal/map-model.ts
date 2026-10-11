import { CoverageGeometryV2Schema } from "@/shared/schemas/v2/catalog";
export function coordinatePair(location:unknown):{lat:number|null;lng:number|null}{
 if(!location||typeof location!=="object")return{lat:null,lng:null};
 const {lat,lng}=location as Record<string,unknown>;
 return typeof lat==="number"&&Number.isFinite(lat)&&Math.abs(lat)<=90&&typeof lng==="number"&&Number.isFinite(lng)&&Math.abs(lng)<=180?{lat,lng}:{lat:null,lng:null};
}
export function coverageGeometry(value:unknown){
 const parsed=CoverageGeometryV2Schema.safeParse(value);
 return parsed.success?parsed.data:null;
}
