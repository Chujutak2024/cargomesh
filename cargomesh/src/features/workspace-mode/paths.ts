export const SHIPPER_DEMO_PREFIX = "/demo/shipper";
const shipperRoots = ["/dashboard", "/requests", "/freight-request", "/facilities", "/bookings", "/tracking", "/history", "/organization", "/support", "/help"];
export function isShipperDemoPath(pathname:string) { return pathname === SHIPPER_DEMO_PREFIX || pathname.startsWith(SHIPPER_DEMO_PREFIX + "/"); }
export function workspaceHref(href:string,pathname:string) {
 if(!isShipperDemoPath(pathname)||!shipperRoots.some(root=>href===root||href.startsWith(root+"/")||href.startsWith(root+"?")||href.startsWith(root+"#")))return href;
 return SHIPPER_DEMO_PREFIX+href;
}
export function workspaceApiPath(api:string,pathname:string) {
 return isShipperDemoPath(pathname)&&api.startsWith("/api/v2/") ? "/api/demo/v2/"+api.slice("/api/v2/".length) : api;
}
