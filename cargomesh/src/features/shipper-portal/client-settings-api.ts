import {z} from 'zod';
export class ClientSettingsError extends Error{
  constructor(public code:string,public status:number,message:string){super(message);}
}
export function settingsError(error:unknown){
  if(error instanceof ClientSettingsError){
    if(error.status===409)return error.code==='STALE_DRAFT'
      ?'This record changed in another session. Your edits are retained. Reload the latest version before saving again.'
      :'This command conflicts with saved data. Your edits are retained. Review the record before retrying.';
    if(error.status===403)return 'Your account does not have permission for this action.';
    if(error.status===401)return 'Your session expired. Sign in again to continue.';
    if(error.status===404)return 'This record is no longer available in your organization.';
    if(error.status===400)return error.message;
  }
  if(error instanceof z.ZodError)return error.issues.map(v=>v.path.join('.')+': '+v.message).join('; ');
  return 'The connection is unavailable. Your edits are retained. Retry to check whether the same command was saved.';
}
export async function settingsRequest<T>(route:string,schema:z.ZodType<T>,init:RequestInit={},fetcher:typeof fetch=fetch):Promise<T>{
  const response=await fetcher('/api/v2'+route,{...init,credentials:'same-origin',cache:'no-store',
    signal:init.signal??AbortSignal.timeout(20000),headers:{'Content-Type':'application/json',...init.headers}});
  const raw=await response.json().catch(()=>null);
  if(!response.ok){
    if(typeof window!=='undefined'&&[401,403].includes(response.status)&&(init.method??'GET').toUpperCase()==='GET')window.dispatchEvent(new Event('cm-client-access-revoked'));
    throw new ClientSettingsError(raw?.error?.code??'UNAVAILABLE',response.status,raw?.error?.message??'The request could not be completed.');
  }
  return schema.parse(raw);
}
export function collectionSchema<T>(schema:z.ZodType<T>){return z.object({schemaVersion:z.literal('2.0'),data:z.array(schema),
  meta:z.object({limit:z.number(),offset:z.number(),nextOffset:z.number().nullable()})});}
export function recordSchema<T>(schema:z.ZodType<T>){return z.object({schemaVersion:z.literal('2.0'),data:schema,
  meta:z.object({idempotentReplay:z.boolean()})});}
export type SettingsCommand={route:string;body:string;key:string};
export function settingsCommand(route:string,body:unknown,previous?:SettingsCommand|null):SettingsCommand{
  const serialized=JSON.stringify(body);
  return previous?.route===route&&previous.body===serialized?previous:{route,body:serialized,key:crypto.randomUUID()};
}
export async function sendSettingsCommand<T>(command:SettingsCommand,schema:z.ZodType<T>,fetcher:typeof fetch=fetch){
  return settingsRequest(command.route,schema,{method:'POST',headers:{'Idempotency-Key':command.key},body:command.body},fetcher);
}
