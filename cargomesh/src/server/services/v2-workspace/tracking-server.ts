import "server-only";
import { z } from "zod";
import { operationsReader } from "./operations-server";
import { readWorkspaceRequest } from "./workspace-server";
import { WorkflowServiceV2 } from "@/server/modules/workflow/application/workflow-service";
import { workflowRepositoryV2 } from "@/server/modules/workflow/infrastructure/supabase-workflow-repository";
import { OperationsReadContractError } from "./operations-collection";
import { collectTrackingDetail, collectTrackingItem, TrackingScopeError, type TrackingSource } from "@/features/shipper-portal/tracking-data";
import {ExecutionPreparationSchema} from '@/shared/schemas/v2/execution-preparation';
import {quoteRpc} from '@/server/modules/commercial/infrastructure/supabase-quotes';
async function trackingReader() {
  const reader=await operationsReader(), actor=reader.actor;
  const service=new WorkflowServiceV2(await workflowRepositoryV2());
  const source: TrackingSource={
    request:readWorkspaceRequest,
    record:async(kind,id)=>{
      z.string().uuid().parse(id);
      const response=await service.read(actor,kind,{id,requestId:null,parentId:null,carrierId:null},{limit:1,offset:0});
      if(Array.isArray(response.data))throw new OperationsReadContractError("Expected exact tracking record.");
      return response.data;
    },
    children:(kind,parentId)=>reader.workflow(kind,null,parentId),
  };
  return {source,actor,service};
}
export async function readOperationsTrackingDetail(id:string) {
  const {source,actor}=await trackingReader();const result=await collectTrackingDetail(id,actor.organizationId,source);
  let preparation=null;
  try{
    const value=ExecutionPreparationSchema.parse(await quoteRpc('read_v2_execution_preparation',{
      p_organization_id:actor.organizationId,p_member_id:actor.memberId,p_execution_id:id}));
    if(value.organizationId!==actor.organizationId||value.executionId!==id||value.requestId!==result.request.id)
      throw new TrackingScopeError('Preparation scope mismatch.');
    preparation=value;
  }catch(error){
    if(error instanceof TrackingScopeError)throw error;
    result.issues.push({resource:'execution-preparation',reason:'unavailable'});
  }
  return {...result,item:{...result.item,preparation}};
}
export async function readOperationsTrackingList(offset=0) {
  if(!Number.isInteger(offset)||offset<0||offset>100000)throw new OperationsReadContractError("Invalid tracking offset.");
  const {source,actor,service}=await trackingReader(),limit=25;
  const page=await service.read(actor,"executions",{id:null,requestId:null,parentId:null,carrierId:null},{limit,offset});
  if(!Array.isArray(page.data)||!page.meta||page.data.length>limit||page.meta.offset!==offset||page.meta.limit!==limit
    ||(page.meta.nextOffset!==null&&(page.meta.nextOffset!==offset+limit||page.data.length!==limit))
    ||new Set(page.data.map(row=>row.id)).size!==page.data.length)throw new OperationsReadContractError("Invalid tracking page.");
  const items=[], issues=[];
  for(let start=0;start<page.data.length;start+=4){
    const batch=await Promise.all(page.data.slice(start,start+4).map(row=>{
      if(row.kind!=="executions"||row.organizationId!==actor.organizationId)throw new TrackingScopeError("Invalid tracking execution.");
      return collectTrackingItem(row,actor.organizationId,source);
    }));
    items.push(...batch.map(result=>result.item));issues.push(...batch.flatMap(result=>result.issues));
  }
  return {items,issues,offset,nextOffset:page.meta.nextOffset};
}
