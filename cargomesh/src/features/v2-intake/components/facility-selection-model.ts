import type {IntakeFacilityOption} from "../contracts";
export type FacilityViewport={north:number;south:number;east:number;west:number};
export function locatedFacility(facility:IntakeFacilityOption){return facility.lat!==null&&facility.lng!==null&&Number.isFinite(facility.lat)&&Number.isFinite(facility.lng)&&Math.abs(facility.lat)<=90&&Math.abs(facility.lng)<=180;}
