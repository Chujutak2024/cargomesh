import {isShipperDemoPath,workspaceApiPath} from "./paths";
/** Demo mutations are rejected locally as well as by the separate demo server. */
export const workspaceFetch:typeof fetch=(input,init)=>{
 const pathname=typeof window==="undefined"?"":window.location.pathname;
 const preview=typeof document!=="undefined"&&(pathname==='/clients'||pathname.startsWith('/clients/'))&&!!document.querySelector('[data-cm-client-preview="true"]');
 const modePath=preview?'/demo/shipper':pathname;
 const method=(init?.method??(input instanceof Request?input.method:"GET")).toUpperCase();
 if(isShipperDemoPath(modePath)&&method!=="GET"&&method!=="HEAD") {
  return Promise.resolve(Response.json({schemaVersion:"2.0",error:{code:"VISUAL_DEMO_READ_ONLY",message:"This demo is read only. No changes were submitted.",retryable:false}},{status:409}));
 }
 if(typeof input==="string")return fetch(workspaceApiPath(input,modePath),init);
 if(typeof window!=="undefined"&&isShipperDemoPath(modePath)) {
  const url=new URL(input instanceof Request?input.url:input.href);
  if(url.origin===window.location.origin){
   const routed=workspaceApiPath(url.pathname+url.search,modePath);
   if(routed!==url.pathname+url.search)return fetch(input instanceof Request?new Request(new URL(routed,url.origin),input):new URL(routed,url.origin),init);
  }
 }
 return fetch(input,init);
};
