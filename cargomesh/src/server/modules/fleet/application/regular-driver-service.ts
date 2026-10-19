import {z} from 'zod';
import {RegularDriverRecord,RegularDriverValue} from '@/shared/schemas/v2/regular-driver';
import {V2DraftError} from '../../freight-requests/application/draft-service';
const Id=z.string().uuid();
export type RegularDriverActor={operatorId:string;carrierId:string};
export interface RegularDriverRepository {run(actor:RegularDriverActor,assetId:string|null,value:unknown,key:string|null,offset:number):Promise<unknown>}
export class RegularDriverService {
 constructor(private readonly repository:RegularDriverRepository){}
 async execute(actor:RegularDriverActor,assetId:string|null,body?:unknown,key?:string,offset=0){
  Id.parse(actor.carrierId);Id.parse(actor.operatorId);z.number().int().min(0).max(100000).parse(offset);
  const input=assetId?RegularDriverValue.parse(body):null;
  const raw=z.object({data:z.unknown(),replay:z.boolean().optional()}).strict().parse(await this.repository.run(actor,assetId?Id.parse(assetId):null,input,assetId?Id.parse(key):null,offset));
  const check=(value:unknown)=>{const row=RegularDriverRecord.parse(value);
   if(row.carrierId!==actor.carrierId||assetId&&(row.assetId!==assetId||row.serviceId!==input!.serviceId||row.driverId!==input!.driverId))throw new V2DraftError('FORBIDDEN_REGULAR_DRIVER_SCOPE','Regular driver scope mismatch.',403);
   return row;
  };
  const data=assetId?check(raw.data):z.array(z.unknown()).max(100).parse(raw.data).map(check);
  return {schemaVersion:'2.0' as const,data,meta:{idempotentReplay:raw.replay??false,nextOffset:Array.isArray(data)&&data.length===100?offset+100:null}};
 }
}
