import type {V2IntakePrototypeDraft} from './prototype-model';
export type DraftCargoGroup={id:string;originalIndex?:number;unitPackageType:string;unitQuantity:string;unitWeightPerUnitKg:string;unitVolumePerUnitM3:string;unitLengthCm:string;unitWidthCm:string;unitHeightCm:string;unitIndivisible:boolean;unitStackable:boolean};
export function cargoGroups(d:V2IntakePrototypeDraft):DraftCargoGroup[]{return [{id:d.primaryGroupId??'group-0',originalIndex:d.primaryGroupId===undefined?0:d.primaryOriginalIndex,unitPackageType:d.unitPackageType,unitQuantity:d.unitQuantity,unitWeightPerUnitKg:d.unitWeightPerUnitKg,unitVolumePerUnitM3:d.unitVolumePerUnitM3,unitLengthCm:d.unitLengthCm,unitWidthCm:d.unitWidthCm,unitHeightCm:d.unitHeightCm,unitIndivisible:d.unitIndivisible,unitStackable:d.unitStackable},...(d.additionalUnits??[])];}
/** Weight and volume are independently known; never present a partial group sum as a total. */
export function groupTotals(groups:DraftCargoGroup[]){
 let weight=0,volume=0,weightKnown=groups.length>0,volumeKnown=groups.length>0;
 for(const group of groups){
  const quantity=Number(group.unitQuantity),w=Number(group.unitWeightPerUnitKg),v=Number(group.unitVolumePerUnitM3);
  const counted=Number.isInteger(quantity)&&quantity>0;
  if(!counted||!Number.isFinite(w)||w<=0)weightKnown=false;else weight+=quantity*w;
  if(!counted||!Number.isFinite(v)||v<=0)volumeKnown=false;else volume+=quantity*v;
 }
 return {totalWeightKg:weightKnown&&Number.isFinite(weight)?String(Number(weight.toFixed(6))):'',totalVolumeM3:volumeKnown&&Number.isFinite(volume)?String(Number(volume.toFixed(6))):''};
}
export function replaceCargoGroups(d:V2IntakePrototypeDraft,groups:DraftCargoGroup[]):V2IntakePrototypeDraft{if(!groups.length)throw Error('CARGO_GROUP_REQUIRED');const [first,...rest]=groups;const {id,originalIndex,...fields}=first;return {...d,...fields,primaryGroupId:id,primaryOriginalIndex:originalIndex,additionalUnits:rest,...groupTotals(groups)};}
export function appendCargoGroup(d:V2IntakePrototypeDraft):DraftCargoGroup[]{const groups=cargoGroups(d);let n=0;while(groups.some(g=>g.id==='group-'+n))n++;return [...groups,{id:'group-'+n,unitPackageType:d.packaging,unitQuantity:'1',unitWeightPerUnitKg:'',unitVolumePerUnitM3:'',unitLengthCm:'',unitWidthCm:'',unitHeightCm:'',unitIndivisible:true,unitStackable:false}];}
export function cargoGroupInput(g:DraftCargoGroup){return {packageType:g.unitPackageType,quantity:Number(g.unitQuantity),weightPerUnitKg:Number(g.unitWeightPerUnitKg),volumePerUnitM3:Number(g.unitVolumePerUnitM3),dimensionsCm:{length:Number(g.unitLengthCm),width:Number(g.unitWidthCm),height:Number(g.unitHeightCm)},indivisible:g.unitIndivisible,stackable:g.unitStackable};}
