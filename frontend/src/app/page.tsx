import styles from "./page.module.css";

export default function HomePage() {
  return (
    <main className={styles.main}>
      <p className={styles.eyebrow}>CargoMesh Network</p>
      <h1>Orquestación B2B de transporte preparada para agentes.</h1>
      <p className={styles.summary}>
        Las páginas provider se resuelven desde el registro de transportistas y exponen
        capacidades estructuradas mediante WebMCP.
      </p>
      <div className={styles.contract}>
        <code>/providers/[carrierSlug]</code>
        <span>Una sola plantilla para 0..N carriers registrados.</span>
      </div>
    </main>
  );
}
