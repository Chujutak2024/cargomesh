import {navigateCarrier} from '@/features/carrier-navigation/carrier-link';

export {juanHref,juanHash} from './juan-route-model';
import {juanHref,juanHash} from './juan-route-model';
export function readJuanHash(){
 return window.location.hash.startsWith('#/')?window.location.hash:juanHash(window.location.pathname);
}
export function navigateJuanHash(hash:string){return navigateCarrier(juanHref(hash));}
export function subscribeJuanRoute(notify:()=>void){
 const events=['hashchange','cm-carrier-route','popstate'];
 events.forEach(event=>window.addEventListener(event,notify));
 return ()=>events.forEach(event=>window.removeEventListener(event,notify));
}
