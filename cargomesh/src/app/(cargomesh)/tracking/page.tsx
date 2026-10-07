import { listWorkspaceWorkflow } from "@/server/services/v2-workspace/workspace-server";
import styles from "../operational-page.module.css";
export const dynamic = "force-dynamic";
export default async function TrackingPage() {
  const executions = await listWorkspaceWorkflow("executions");
  return <div className={styles.page}><header className={styles.header}><div><h1>Seguimiento V2</h1>
    <p>Ejecuciones persistidas de tu organización. No se muestra telemetría inventada.</p></div></header>
    <section className={styles.panel}>{executions.length ? <ul>{executions.map(execution =>
      <li key={execution.id}>{execution.id} · {execution.status}</li>)}</ul> : <p>No hay ejecuciones V2 registradas.</p>}</section></div>;
}
