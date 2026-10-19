
import 'server-only';
import { notFound } from 'next/navigation';
import type { CatalogKindV2, CatalogRecordV2 } from '@/shared/schemas/v2/catalog';
import {requireDemoPageAccess as assertVisualDemo} from "./access";
import { demoRequests, demoFacilities, demoWorkflow } from '@/features/shipper-demo-preview/demo-data';
export type WorkspaceWorkflowKind='routes'|'plans'|'opportunities'|'offers'|'ranking'|'decisions'|'bookings'|'holds'|'executions'|'incidents'|'execution-events';
export async function listWorkspaceRequests(){await assertVisualDemo();return structuredClone(demoRequests);}
export async function readWorkspaceRequest(id:string){await assertVisualDemo();const record=demoRequests.find(x=>x.id===id);if(!record)notFound();return structuredClone(record);}
export async function listWorkspaceWorkflow(kind:WorkspaceWorkflowKind,options:{requestId?:string|null;parentId?:string|null}={}){await assertVisualDemo();return structuredClone(demoWorkflow.filter(x=>x.kind===kind&&(!options.requestId||x.requestId===options.requestId)&&(!options.parentId||x.requestId===demoWorkflow.find(r=>r.id===options.parentId)?.requestId)));}
export async function listWorkspaceFacilities(){await assertVisualDemo();return structuredClone(demoFacilities);}
export async function listWorkspaceCatalog(_kind:Extract<CatalogKindV2,'preferences'|'cargo-profiles'>):Promise<CatalogRecordV2[]>{await assertVisualDemo();return [];}
export async function readWorkspaceRequestFlow(id:string){const request=await readWorkspaceRequest(id);const kinds:WorkspaceWorkflowKind[]=['routes','plans','opportunities','offers','ranking','decisions','bookings','executions','incidents'];return {request,workflow:Object.fromEntries(await Promise.all(kinds.map(async kind=>[kind,await listWorkspaceWorkflow(kind,{requestId:id})])))};}
