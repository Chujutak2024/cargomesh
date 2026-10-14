import {isShipperDemoPath,workspaceApiPath} from "./paths";
/** Demo mutations are rejected locally as well as by the separate demo server. */
export const workspaceFetch:typeof fetch=(input,init)=>{
 const pathname=typeof window==="undefined"?"":window.location.pathname;
 const method=(init?.method??(input instanceof Request?input.method:"GET")).toUpperCase();
 if(isShipperDemoPath(pathname)&&method!=="GET"&&method!=="HEAD") {
  return Promise.resolve(Response.json({schemaVersion:"2.0",error:{code:"VISUAL_DEMO_READ_ONLY",message:"This demo is read only. No changes were submitted.",retryable:false}},{status:409}));
 }
 if(typeof input==="string")return fetch(workspaceApiPath(input,pathname),init);
 if(typeof window!=="undefined"&&isShipperDemoPath(pathname)) {
  const url=new URL(input instanceof Request?input.url:input.href);
  if(url.origin===window.location.origin){
   const routed=workspaceApiPath(url.pathname+url.search,pathname);
   if(routed!==url.pathname+url.search)return fetch(input instanceof Request?new Request(new URL(routed,url.origin),input):new URL(routed,url.origin),init);
  }
 }
 return fetch(input,init);
};
