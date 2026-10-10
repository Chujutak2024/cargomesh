import Link from "next/link";
import { listWorkspaceRequests } from "@/server/services/v2-workspace/workspace-server";
import styles from "./page.module.css";
export const dynamic = "force-dynamic";
export default async function DashboardPage() {
  const requests = await listWorkspaceRequests();
  return <div className={styles.page}>
    <section className={styles.hero}><div><span className={styles.eyebrow}>CargoMesh V2</span>
      <h1>Control de operaciones</h1><p>Solicitudes V2 de tu organización. La disponibilidad se verifica con el servicio ROAD.</p></div>
      <Link href="/freight-request/new">Nueva carga</Link></section>
    <section><h2>Solicitudes recientes</h2>
      {requests.length ? <ul>{requests.map(request => <li key={request.id}>
        <Link href={`/requests/${request.id}`}>{request.referenceCode}</Link> · {request.origin.label} → {request.destination.label} · {request.status}
      </li>)}</ul> : <p>No tienes solicitudes V2. Crea tu primera carga.</p>}
      <Link href="/requests">Ver todas las solicitudes</Link>
    </section>
  </div>;
}
