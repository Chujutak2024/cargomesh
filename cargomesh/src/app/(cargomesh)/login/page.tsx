import {AssignedDemoEntry} from '@/components/assigned-demo-entry';
import {workspaceDemoEnabled,automaticWorkspaceDemoEntry} from '@/server/auth/workspace-demo';
import {LocalClientLogin} from '@/components/local-client-login';
import {hasLocalClientPreviewSession,localClientPreviewEnabled,localClientFrontendPreviewEnabled} from '@/server/auth/local-client-preview';
import {PasswordLogin} from "@/components/password-login";
import {authenticatedLoginDestination} from "@/server/auth/carrier-portal";
import {safeLoginReturnTo} from "@/shared/schemas/v2/carrier-portal";
import {redirect} from "next/navigation";
import styles from "./page.module.css";
export const dynamic="force-dynamic";
export default async function LoginPage({searchParams}:{searchParams:Promise<{returnTo?:string;connected?:string}>}){
 const query=await searchParams,returnTo=safeLoginReturnTo(query.returnTo);
 if(query.connected!=='1'&&await workspaceDemoEnabled()){
  const automatic=await automaticWorkspaceDemoEntry();
  if(returnTo==='/clients')return <AssignedDemoEntry workspace="client" automatic={automatic}/>;
  if(returnTo==='/carriers'||returnTo==='/carriers/fleet'||returnTo==='/v2-workspace#/fleet')return <AssignedDemoEntry workspace="carrier" automatic={automatic}/>;
 }
 const frontendPreview=await localClientFrontendPreviewEnabled();
 const clientPreview=returnTo==='/clients'&&(query.connected!=='1'||frontendPreview)&&await localClientPreviewEnabled();
 if(clientPreview&&await hasLocalClientPreviewSession())redirect('/clients');
 const destination=clientPreview?null:await authenticatedLoginDestination(returnTo);
 if(destination)redirect(destination);
 return <main className={styles.page}><section className={styles.brandPanel}><h1>CargoMesh V2</h1>
 <p>{returnTo==='/clients'?'Access your Client workspace.':'Access your shipper or carrier workspace.'}</p></section><section className={styles.formPanel}>{clientPreview?<LocalClientLogin connectedAvailable={!frontendPreview}/>:<PasswordLogin returnTo={returnTo}/>}</section></main>;
}
