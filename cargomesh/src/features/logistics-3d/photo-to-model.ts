const endpoint = "/api/local/truck-3d";
type Pending = { fingerprint: string; token: string | null; submissionId: string; startedAt: number };
const jobKey = (requestId: string) => `cargomesh-truck-generation-v1:${requestId}`;
async function fingerprint(photo: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(photo));
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2,"0")).join("");
}
async function pending(photo: string, requestId: string): Promise<Pending | null> {
  const raw=localStorage.getItem(jobKey(requestId));if(!raw)return null;
  const data=JSON.parse(raw) as Pending;
  if(data.fingerprint!==await fingerprint(photo))return null;
  if(!Number.isFinite(data.startedAt)||typeof data.submissionId!=="string"
    ||data.token!==null&&(typeof data.token!=="string"||data.token.length>512))throw new Error("GENERATION_EXPIRED");
  if(Date.now()-data.startedAt>40*60_000)throw new Error("GENERATION_EXPIRED");
  return data;
}
export async function hasPendingTruckGeneration(photo: string,requestId: string) {
  return !!await pending(photo,requestId);
}
/** Persist the job separately from request data. Resume polling without creating another billed task. */
export async function photoToTruckModel(photo: string, requestId: string, signal: AbortSignal,
  report: (phase:"starting"|"processing"|"saving",progress:number|null)=>void): Promise<Blob> {
  let job=await pending(photo,requestId);
  if(!job){
    job={fingerprint:await fingerprint(photo),token:null,submissionId:crypto.randomUUID(),startedAt:Date.now()};
    // A storage failure must occur before any billable submission.
    localStorage.setItem(jobKey(requestId),JSON.stringify(job));
    report("starting",null);
    const response=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json","Idempotency-Key":job.submissionId},body:JSON.stringify({photoDataUrl:photo,consent:true}),signal});
    const created=await response.json();
    if(!response.ok||typeof created.token!=="string"){
      // Only known, rejected submissions may be submitted anew. Keep ambiguous attempts for manual reconciliation.
      if(["NOT_CONFIGURED","CREDITS","DEMO_LIMIT","INVALID_PHOTO","FORBIDDEN"].includes(created.error))localStorage.removeItem(jobKey(requestId));
      throw new Error(created.error??"SUBMISSION_UNKNOWN");
    }
    job.token=created.token;localStorage.setItem(jobKey(requestId),JSON.stringify(job));
  }
  if(!job.token)throw new Error("SUBMISSION_UNKNOWN");
  const taskUrl=`${endpoint}?task=${encodeURIComponent(job.token)}`,deadline=Date.now()+10*60_000;
  while(Date.now()<deadline){
    signal.throwIfAborted();
    const result=await fetch(taskUrl,{signal,cache:"no-store"}),state=await result.json();
    if(state.state==="failed"){localStorage.removeItem(jobKey(requestId));throw new Error("PROVIDER");}
    if(!result.ok)throw new Error(state.error??"PROVIDER");
    if(state.state==="ready"){
      report("saving",null);
      const asset=await fetch(`${taskUrl}&asset=1`,{signal,cache:"no-store"});
      if(!asset.ok)throw new Error("PROVIDER");return asset.blob();
    }
    report("processing",typeof state.progress==="number"?state.progress:null);
    await new Promise<void>((resolve,reject)=>{
      const cancelled=()=>{window.clearTimeout(timer);reject(new Error("CANCELLED"));};
      const timer=window.setTimeout(()=>{signal.removeEventListener("abort",cancelled);resolve();},5000);
      signal.addEventListener("abort",cancelled,{once:true});
    });
  }
  throw new Error("GENERATION_PENDING");
}
export function clearCompletedTruckGeneration(requestId:string) { localStorage.removeItem(jobKey(requestId)); }
