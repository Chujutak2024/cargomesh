import { DemoLogin } from "@/components/demo-login";
import styles from "./page.module.css";

export default function LoginPage() {
  return (
    <main className={styles.page}>
      <section className={styles.brandPanel} aria-labelledby="login-brand-title">
        <div className={styles.brand}>
          <span className={styles.brandMark} aria-hidden="true">⬡</span>
          <span>CargoMesh</span>
        </div>
        <div className={styles.brandCopy}>
          <span className={styles.eyebrow}>Freight orchestration · WebMCP</span>
          <h2 id="login-brand-title">Decisiones de carga claras, desde la solicitud hasta el destino.</h2>
          <p>
            Coordina operaciones internacionales y mantén cada decisión visible para tu equipo.
          </p>
        </div>
        <div className={styles.signal}>
          <span aria-hidden="true" />
          Entorno demo disponible
        </div>
      </section>

      <section className={styles.formPanel} aria-label="Inicio de sesión de demostración">
        <DemoLogin />
        <p className={styles.footer}>CargoMesh Challenge Build · 2026</p>
      </section>
    </main>
  );
}

