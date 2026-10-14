import {PasswordLogin} from "@/components/password-login";
import {authenticatedLoginDestination} from "@/server/auth/carrier-portal";
import {safeLoginReturnTo} from "@/shared/schemas/v2/carrier-portal";
import {redirect} from "next/navigation";
import styles from "./page.module.css";
export const dynamic="force-dynamic";
export default async function LoginPage({searchParams}:{searchParams:Promise<{returnTo?:string}>}){
 const returnTo=safeLoginReturnTo((await searchParams).returnTo),destination=await authenticatedLoginDestination(returnTo);
 if(destination)redirect(destination);
 return <main className={styles.page}><section className={styles.brandPanel}><h1>CargoMesh V2</h1>
 <p>Access your shipper or carrier workspace.</p></section><section className={styles.formPanel}><PasswordLogin returnTo={returnTo}/></section></main>;
}
