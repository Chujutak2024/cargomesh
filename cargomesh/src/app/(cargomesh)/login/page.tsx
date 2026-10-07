import { PasswordLogin } from "@/components/password-login";
import { redirectAuthenticatedMemberFromLogin } from "@/server/auth/route-guard";
import styles from "./page.module.css";
export const dynamic = "force-dynamic";
export default async function LoginPage() {
  await redirectAuthenticatedMemberFromLogin();
  return <main className={styles.page}><section className={styles.brandPanel}>
    <h1>CargoMesh V2</h1><p>Captura solicitudes, evalúa servicios de transporte y consulta tus operaciones.</p>
  </section><section className={styles.formPanel}><PasswordLogin /></section></main>;
}
