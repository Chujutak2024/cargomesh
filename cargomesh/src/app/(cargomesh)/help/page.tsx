import Link from "next/link";
import { requireOperationalRouteAccess } from "@/server/auth/route-guard";
import styles from "../operational-page.module.css";
export default async function HelpPage() {
  await requireOperationalRouteAccess();
  return <div className={styles.page}><h1>Flujo CargoMesh V2</h1><section className={styles.panel}>
    <ol><li><Link href="/freight-request/new">Crea una carga</Link> y revisa ubicaciones, unidades y fechas.</li>
    <li>Guarda la solicitud y consulta la evaluación ROAD. Un estado desconocido no confirma disponibilidad.</li>
    <li><Link href="/requests">Mis cargas</Link> muestra las solicitudes persistidas de tu organización.</li>
    <li>Reservas y seguimiento muestran exclusivamente compromisos y ejecuciones V2 persistidos.</li></ol>
    <p>El flujo comercial completo requiere la entrega de sus pantallas correspondientes; no se sustituye por un demo de carriers.</p>
  </section></div>;
}
