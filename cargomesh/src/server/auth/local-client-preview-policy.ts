import {createHmac, timingSafeEqual} from 'node:crypto';
export const CLIENT_PREVIEW_COOKIE='cm-client-preview';
export const CLIENT_PREVIEW_TTL=2*60*60;
export function localClientPreviewAllowed(config:{enabled:boolean;production:boolean;secret?:string},host:string|null){
 return config.enabled&&!config.production&&!!config.secret&&config.secret.length>=32&&['127.0.0.1:8080','localhost:8080'].includes(host??'');
}
export function signClientPreview(secret:string,now=Date.now()){
 const payload=`client-preview-v1:${Math.floor(now/1000)+CLIENT_PREVIEW_TTL}`;
 return payload+':'+createHmac('sha256',secret).update(payload).digest('hex');
}
export function validClientPreview(value:string|undefined,secret:string,now=Date.now()){
 if(!value||value.length>180)return false;
 const match=/^(client-preview-v1):(\d{10}):([a-f0-9]{64})$/.exec(value);if(!match)return false;
 const expiry=Number(match[2]),remaining=expiry-Math.floor(now/1000);
 if(remaining<=0||remaining>CLIENT_PREVIEW_TTL)return false;
 const expected=createHmac('sha256',secret).update(match[1]+':'+match[2]).digest();
 return timingSafeEqual(Buffer.from(match[3],'hex'),expected);
}
