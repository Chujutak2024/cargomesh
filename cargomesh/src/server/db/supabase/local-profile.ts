/** Separate cookies for the explicitly enabled local fixture database. */
export function localScenarioCookieOptions(config:{profile?:string;url?:string;production:boolean}){
 if(!config.production&&config.profile==='hac52-client'&&config.url==='http://127.0.0.1:64621')return {name:'sb-cargomesh-hac52-client-auth-token'};
 return !config.production && config.profile==='fleet80' && config.url==='http://127.0.0.1:59730'
  ? {name:'sb-cargomesh-fleet80-auth-token'} : undefined;
}
