import {CarrierPortalAccessListV2Schema} from '@/shared/schemas/v2/carrier-portal';
import {syntheticCarrierAccess,syntheticClientAccess} from './assigned-demo-policy';
import {workspaceDemoSyntheticEmail,type DemoWorkspace,type DemoAccount} from './workspace-demo-policy';
type User={id:string;email?:string;email_confirmed_at?:string|null};
type SessionAccess={current:()=>Promise<User|null>;signIn:(account:DemoAccount)=>Promise<User|null>;
 member:(userId:string,organizationId:string)=>Promise<unknown>;carriers:()=>Promise<unknown>;commit:()=>void};
/** The cookie commit is the last operation, after real target identity/scope validation. */
export async function activateDemoSession(workspace:DemoWorkspace,account:DemoAccount,organizationId:string|undefined,access:SessionAccess){
 if(!workspaceDemoSyntheticEmail(account.email))return false;
 let user=await access.current();
 if(user?.email!==account.email)user=await access.signIn(account);
 if(!user||user.email!==account.email||!user.email_confirmed_at)return false;
 if(workspace==='client'){
  if(!organizationId||!syntheticClientAccess(await access.member(user.id,organizationId),organizationId))return false;
 }else{
  const carriers=CarrierPortalAccessListV2Schema.safeParse(await access.carriers());
  if(!carriers.success||!syntheticCarrierAccess(carriers.data))return false;
 }
 access.commit();return true;
}
