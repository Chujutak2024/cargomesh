import { z } from 'zod';
import {pointInPolygon} from './point-coverage';
import { CatalogInputsV2, parseCatalogRecordV2, type CatalogRecordV2 } from '@/shared/schemas/v2/catalog';
import { CarrierCoverageDecisionV2Schema, type CarrierCoverageDecisionV2 } from '@/shared/schemas/v2/carrier-road-routing';

export type CoverageKind = 'carriers' | 'services' | 'areas' | 'lanes' | 'partners';
export type CoverageRecord<K extends CoverageKind> = Omit<CatalogRecordV2, 'value'> & {
  value: z.infer<(typeof CatalogInputsV2)[K]>;
};
export type CoverageSnapshot = {carrier: CoverageRecord<'carriers'>; service: CoverageRecord<'services'>;
  areas: CoverageRecord<'areas'>[]; lanes: CoverageRecord<'lanes'>[]; partners: CoverageRecord<'partners'>[];
  complete: boolean};
export function coverageRecord<K extends CoverageKind>(kind: K, row: unknown): CoverageRecord<K> {
  return parseCatalogRecordV2(kind, row) as CoverageRecord<K>;
}
type Window = {startsAt:string; endsAt:string};
type Location = {countryCode:string; city:string|null; lat?:number; lng?:number; region?:string|null; postalCode?:string|null};
type Check = CarrierCoverageDecisionV2['pickup'];
const check = (status:Check['status'], reason:string|null, recordIds:string[]=[]):Check =>
  ({status,reasons:reason?[reason]:[],recordIds:[...recordIds].sort()});
const at = (value:string) => Date.parse(value);
const covers = (from:string|null,until:string|null,w:Window) => from!==null
  && at(from)<=at(w.startsAt) && (until===null||at(until)>=at(w.endsAt));
const outside = (from:string|null,until:string|null,w:Window) =>
  from!==null&&at(from)>=at(w.endsAt)||until!==null&&at(until)<=at(w.startsAt);

/** Tri-state administrative matching: missing region/postal/polygon support cannot mean true. */
function geographyMatch(g:CoverageRecord<'areas'>['value']['geography'], location:Location):'yes'|'no'|'unknown' {
  if(g.countryCode!==location.countryCode)return 'no';
  if(g.granularity==='POLYGON')return location.lat===undefined||location.lng===undefined||g.geometry?.type!=='Polygon'?'unknown':pointInPolygon({lat:location.lat,lng:location.lng},g.geometry.coordinates);
  // POINTS has no published service radius; never infer one from proximity.
  if(g.granularity==='POINTS')return 'unknown';
  if(g.granularity==='COUNTRY')return 'yes';
  if(g.region&&!location.region)return 'unknown';
  if(g.region&&g.region!==location.region)return 'no';
  if(g.granularity==='REGION')return 'yes';
  if(g.city&&!location.city)return 'unknown';
  if(g.city&&g.city!==location.city)return 'no';
  if(g.granularity==='CITY')return 'yes';
  if(!location.postalCode)return 'unknown';
  return g.postalCode===location.postalCode?'yes':'no';
}
function evidence(record:CoverageRecord<'areas'>|CoverageRecord<'lanes'>,w:Window,now:string,
  partners:CoverageRecord<'partners'>[]) {
  const v=record.value;
  if(!v.evidence||!v.verifiedAt||at(v.verifiedAt)>at(now)||!covers(v.validFrom,v.validUntil,w))return false;
  if('source' in v&&v.source==='PARTNER') {
    const partner=partners.find(p=>p.id===v.partnerId)?.value;
    // A persisted partner agreement is the identity; platform membership is not required.
    return !!partner&&partner.status==='ACTIVE'&&!!partner.coverageEvidence
      &&covers(partner.agreementValidFrom,partner.agreementValidUntil,w);
  }
  return true;
}
function areaCheck(snapshot:CoverageSnapshot,role:'PICKUP'|'DELIVERY',location:Location,w:Window,now:string):Check {
  const rows=snapshot.areas.filter(r=>r.value.active&&r.value.role===role);
  const applicable=rows.map(r=>({r,match:geographyMatch(r.value.geography,location)}))
    .filter(x=>x.match!=='no'&&!outside(x.r.value.validFrom,x.r.value.validUntil,w));
  const exclusion=applicable.filter(x=>x.r.value.inclusion==='EXCLUDE');
  // Even a partial overlap with an evidenced exclusion blocks the complete activity window.
  const blocked=exclusion.filter(x=>x.match==='yes'&&x.r.value.validFrom!==null
    &&!!x.r.value.evidence&&!!x.r.value.verifiedAt&&at(x.r.value.verifiedAt)<=at(now)
    &&(x.r.value.source==='OWN'||evidence(x.r,w,now,snapshot.partners)));
  if(blocked.length)return check('ineligible',`${role}_EXCLUDED`,blocked.map(x=>x.r.id));
  if(exclusion.length)return check('unknown',`${role}_EXCLUSION_EVIDENCE_UNKNOWN`,exclusion.map(x=>x.r.id));
  const includes=applicable.filter(x=>x.r.value.inclusion==='INCLUDE');
  const eligible=includes.filter(x=>x.match==='yes'&&evidence(x.r,w,now,snapshot.partners));
  if(eligible.length)return check('eligible',null,eligible.map(x=>x.r.id));
  if(includes.length)return check('unknown',`${role}_COVERAGE_EVIDENCE_UNKNOWN`,includes.map(x=>x.r.id));
  // An expired matching inclusion is stale evidence, rather than confirmed absence of service.
  if(rows.some(r=>r.value.inclusion==='INCLUDE'&&geographyMatch(r.value.geography,location)!=='no'))
    return check('unknown',`${role}_COVERAGE_NOT_CURRENT`);
  const evidencedFootprint=rows.some(r=>r.value.inclusion==='INCLUDE'&&evidence(r,w,now,snapshot.partners));
  return evidencedFootprint?check('ineligible',`NO_${role}_COVERAGE`):check('unknown',`${role}_COVERAGE_UNKNOWN`);
}

export function evaluateCarrierCoverage(snapshot:CoverageSnapshot,input:{origin:Location;destination:Location;
  pickupWindow:Window;deliveryWindow:Window;now:string}):CarrierCoverageDecisionV2 {
  const window={startsAt:input.pickupWindow.startsAt,endsAt:input.deliveryWindow.endsAt};
  const pickup=areaCheck(snapshot,'PICKUP',input.origin,input.pickupWindow,input.now);
  const delivery=areaCheck(snapshot,'DELIVERY',input.destination,input.deliveryWindow,input.now);
  let lane:Check=check('unknown','LANE_NOT_EVALUABLE'),selectedLane:CoverageRecord<'lanes'>|undefined;
  if(pickup.status==='eligible'&&delivery.status==='eligible') {
    const matching=snapshot.lanes.filter(r=>r.value.active&&r.value.mode==='ROAD'
      &&pickup.recordIds.includes(r.value.pickupAreaId)&&delivery.recordIds.includes(r.value.deliveryAreaId));
    const valid=matching.filter(r=>evidence(r,window,input.now,snapshot.partners));
    const allowed=valid.filter(r=>!r.value.crossBorderProhibited).sort((a,b)=>a.id.localeCompare(b.id));
    selectedLane=allowed[0];
    lane=selectedLane?check('eligible',null,[selectedLane.id]):valid.length
      ?check('ineligible','BORDER_CROSSING_PROHIBITED',valid.map(r=>r.id))
      :matching.length?check('unknown','LANE_EVIDENCE_UNKNOWN',matching.map(r=>r.id))
      :snapshot.lanes.some(r=>r.value.active&&r.value.mode==='ROAD'&&evidence(r,window,input.now,snapshot.partners))
        ?check('ineligible','NO_DIRECTED_LANE'):check('unknown','LANE_UNKNOWN');
  }
  const reasons=[...new Set([...pickup.reasons,...delivery.reasons,...lane.reasons])];
  if(snapshot.carrier.value.status!=='ACTIVE')reasons.push('CARRIER_INACTIVE');
  if(snapshot.service.value.status!=='ACTIVE')reasons.push('SERVICE_INACTIVE');
  if(snapshot.service.value.mode!=='ROAD')reasons.push('MODE_NOT_SUPPORTED');
  if(!snapshot.complete)reasons.push('CATALOG_INCOMPLETE');
  const hard=reasons.some(r=>['CARRIER_INACTIVE','SERVICE_INACTIVE','MODE_NOT_SUPPORTED'].includes(r))
    ||[pickup,delivery,lane].some(c=>c.status==='ineligible');
  const status=hard?'ineligible':!snapshot.complete||[pickup,delivery,lane].some(c=>c.status==='unknown')?'unknown':'eligible';
  const refs:CarrierCoverageDecisionV2['references']=[];
  for(const kind of ['carriers','services','areas','lanes','partners'] as const) {
    const records=kind==='carriers'?[snapshot.carrier]:kind==='services'?[snapshot.service]:snapshot[kind];
    for(const r of records) {
      const v=r.value;
      refs.push({kind,id:r.id,version:r.version,evidence:'evidence' in v?v.evidence
        :'coverageEvidence' in v?v.coverageEvidence:null,verifiedAt:'verifiedAt' in v?v.verifiedAt:null,
        validFrom:'validFrom' in v?v.validFrom:'agreementValidFrom' in v?v.agreementValidFrom:null,
        validUntil:'validUntil' in v?v.validUntil:'agreementValidUntil' in v?v.agreementValidUntil:null,
        source:'source' in v?v.source:'CATALOG'});
    }
  }
  return CarrierCoverageDecisionV2Schema.parse({status,reasons,pickup,delivery,lane,selectedLaneId:selectedLane?.id??null,
    borderReviewRequired:input.origin.countryCode!==input.destination.countryCode||!!selectedLane?.value.borderReviewRequired,
    references:refs,policyVersion:input.origin.lat!==undefined&&input.destination.lat!==undefined?'carrier-point-coverage/v1':'carrier-city-coverage/v1',scope:input.origin.lat!==undefined&&input.destination.lat!==undefined?'PUBLISHED_POINT_COVERAGE_ONLY':'PUBLISHED_CITY_REFERENCE_COVERAGE_ONLY'});
}
