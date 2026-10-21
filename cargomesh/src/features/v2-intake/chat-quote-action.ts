import { z } from "zod";
import { workspaceFetch } from "@/features/workspace-mode/workspace-fetch";
import { FreightRequestV2ResponseSchema } from "@/shared/schemas/v2/freight-request";
import { findRequestQuotes } from "@/features/shipper-portal/quote-api";
import { QuoteSearchInputSchema, QuoteSearchResponseSchema } from "@/shared/schemas/v2/quote-automation";

export function wantsQuoteSearch(text:string) {
  return /^(?:por favor[, ]+)?(?:busca(?:r)?|solicita(?:r)?|pide|pedir|request|find|search)(?:\s+(?:las|mis|for|current))?\s+(?:cotizaciones|ofertas|quotes|offers)[.!?]?$/i.test(text.trim());
}

export type QuoteRequestSnapshot = { id:string; organizationId:string; draftVersion:number; status:string; pickupWindow:{startsAt:string} };
type Result = z.infer<typeof QuoteSearchResponseSchema>["data"];
export function quoteActionInput(request:QuoteRequestSnapshot,deadline:string,now=Date.now()) {
  if(request.status!=="PENDING") throw new Error("REQUEST_NOT_SUBMITTED");
  const time=Date.parse(deadline),pickup=Date.parse(request.pickupWindow.startsAt);
  if(!Number.isFinite(time)||!Number.isFinite(pickup)||time<=now||time>pickup) throw new Error("INVALID_RESPONSE_DEADLINE");
  z.string().uuid().parse(request.id);z.string().uuid().parse(request.organizationId);
  return QuoteSearchInputSchema.parse({schemaVersion:"2.0",expectedDraftVersion:request.draftVersion,responseDeadline:deadline,consent:"REQUEST_QUOTES"});
}
async function readCurrent(id:string):Promise<QuoteRequestSnapshot> {
  const response=await workspaceFetch(`/api/v2/freight/requests/${encodeURIComponent(id)}`,{credentials:"same-origin",cache:"no-store"});
  if(!response.ok) throw new Error(response.status===403?"FORBIDDEN":"REQUEST_READ_FAILED");
  return FreightRequestV2ResponseSchema.parse(await response.json()).data;
}
/** UI consent is explicit; the model cannot call this action or supply organization identity. */
export async function confirmChatQuoteAction(snapshot:QuoteRequestSnapshot,deadline:string,confirmed:boolean,keys:Map<string,string>,
  deps:{read?:(id:string)=>Promise<QuoteRequestSnapshot>;search?:typeof findRequestQuotes;newKey?:()=>string;now?:()=>number}={}) {
  if(!confirmed) throw new Error("CONSENT_REQUIRED");
  const input=quoteActionInput(snapshot,deadline,(deps.now??Date.now)());
  const current=await (deps.read??readCurrent)(snapshot.id);
  if(current.id!==snapshot.id||current.organizationId!==snapshot.organizationId) throw new Error("INVALID_REQUEST_SCOPE");
  if(current.draftVersion!==snapshot.draftVersion||current.status!==snapshot.status||current.pickupWindow.startsAt!==snapshot.pickupWindow.startsAt) throw new Error("STALE_DRAFT");
  const fingerprint=JSON.stringify([snapshot.organizationId,snapshot.id,input]);
  if(!keys.has(fingerprint)) keys.set(fingerprint,(deps.newKey??(()=>crypto.randomUUID()))());
  const raw:Result=await (deps.search??findRequestQuotes)(snapshot.id,input,keys.get(fingerprint)!);
  const result=QuoteSearchResponseSchema.shape.data.parse(raw);
  if(result.requestId!==snapshot.id||result.requestVersion!==snapshot.draftVersion) throw new Error("INVALID_QUOTE_RECEIPT");
  // Keep the original key even after success: repeated consent resumes the same native intent.
  return result;
}
