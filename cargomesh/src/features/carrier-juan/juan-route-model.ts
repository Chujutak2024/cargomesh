import {carrierHashFromPath,carrierHref} from '@/shared/navigation/workspaces';
/** Map Juan's UI routes through the existing application destinations. */
export function juanHref(hash:string){
 const clean=hash.replace(/^#\/?/,'').replace(/^fleet\/demo\//,'fleet/');
 return carrierHref('#/'+clean.replace(/^request(?=\/|$)/,'desk'));
}
export function juanHash(pathname:string){
 return carrierHashFromPath(pathname).replace(/^#\/orders(?=\/|$)/,'#/tracking');
}
