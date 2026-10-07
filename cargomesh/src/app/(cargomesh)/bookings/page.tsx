import { listWorkspaceWorkflow } from "@/server/services/v2-workspace/workspace-server";
import styles from "../operational-page.module.css";
export const dynamic = "force-dynamic";
export default async function BookingsPage() {
  const bookings = await listWorkspaceWorkflow("bookings");
  return <div className={styles.page}><header className={styles.header}><div><h1>Reservas V2</h1>
    <p>Compromisos persistidos de tu organización; no se generan reservas de demo.</p></div></header>
    <section className={styles.panel}>{bookings.length ? <ul>{bookings.map(booking =>
      <li key={booking.id}>{booking.id} · {booking.status}</li>)}</ul> : <p>No hay reservas V2 registradas.</p>}</section></div>;
}
