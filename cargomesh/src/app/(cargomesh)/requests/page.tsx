import Link from "next/link";
import { listWorkspaceRequests } from "@/server/services/v2-workspace/workspace-server";
import styles from "../operational-page.module.css";
export const dynamic = "force-dynamic";
export default async function RequestsPage() {
  const requests = await listWorkspaceRequests();
  return <div className={styles.page}><header className={styles.header}><div><h1>Mis cargas</h1>
    <p>Solicitudes persistidas bajo el contrato V2 de tu organización.</p></div>
    <Link className={styles.primary} href="/freight-request/new">Nueva carga</Link></header>
    <section className={styles.panel}>{requests.length ? <ul className={styles.list}>{requests.map(request =>
      <li key={request.id}><Link href={`/requests/${request.id}`}>{request.referenceCode}</Link> · {request.origin.label} → {request.destination.label} · {request.status}</li>
    )}</ul> : <p>No hay solicitudes V2 registradas.</p>}</section></div>;
}
