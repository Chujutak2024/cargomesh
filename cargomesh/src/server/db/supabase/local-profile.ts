/** Separate cookies for the explicitly enabled local fixture database. */
export function localScenarioCookieOptions(config:{profile?:string;url?:string;production:boolean}){
 return !config.production && config.profile==='fleet80' && config.url==='http://127.0.0.1:59730'
  ? {name:'sb-cargomesh-fleet80-auth-token'} : undefined;
}
