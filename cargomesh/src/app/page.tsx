import Link from "next/link";
import styles from "./page.module.css";
export default function HomePage() {
  return <main className={styles.page}><nav className={styles.nav}><strong>CargoMesh V2</strong>
    <Link href="/login">Iniciar sesión</Link></nav><section className={styles.hero}>
    <div className={styles.heroCopy}><h1>Organiza tus cargas con información verificable</h1>
    <p>Captura solicitudes y evalúa servicios de transporte según ubicaciones, carga, capacidad y fecha.</p>
    <Link className={styles.primaryAction} href="/login">Acceder a CargoMesh</Link>
    <p>La elegibilidad no equivale a una oferta o reserva confirmada. Los datos desconocidos se muestran como tales.</p></div></section></main>;
}
