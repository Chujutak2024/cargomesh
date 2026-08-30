import { DemoLogin } from "@/components/demo-login";
import { Activity, Boxes, Network, Route, ShieldCheck } from "lucide-react";
import styles from "./page.module.css";

export default function LoginPage() {
  return (
    <main className={styles.page}>
      <section className={styles.brandPanel} aria-labelledby="login-brand-title">
        <div className={styles.brand}>
          <span className={styles.brandMark} aria-hidden="true">
            <Network size={22} strokeWidth={1.8} />
          </span>
          <span>
            <strong>CargoMesh</strong>
            <small>Control tower</small>
          </span>
        </div>
        <div className={styles.brandCopy}>
          <span className={styles.eyebrow}>Freight orchestration · WebMCP</span>
          <h2 id="login-brand-title">Tu red logística en una sola vista.</h2>
          <p>
            Coordina cargas, capacidad y seguimiento internacional con decisiones visibles para todo el equipo.
          </p>

          <div className={styles.capabilities} aria-label="Capacidades de CargoMesh">
            <span><Boxes size={16} aria-hidden="true" /> Solicitudes centralizadas</span>
            <span><Route size={16} aria-hidden="true" /> Operación conectada</span>
            <span><Activity size={16} aria-hidden="true" /> Estado en tiempo real</span>
          </div>
        </div>

        <div className={styles.networkPreview} aria-hidden="true">
          <span className={styles.routeLine} />
          <span className={`${styles.node} ${styles.nodeCallao}`}>Callao</span>
          <span className={`${styles.node} ${styles.nodeSantiago}`}>Santiago</span>
          <span className={styles.vehicle}><Route size={18} /></span>
        </div>

        <div className={styles.signal}>
          <ShieldCheck size={16} aria-hidden="true" />
          Entorno de demostración protegido
        </div>
      </section>

      <section className={styles.formPanel} aria-label="Inicio de sesión de demostración">
        <div className={styles.formContent}>
          <DemoLogin />
          <p className={styles.footer}>CargoMesh · WebMCP Challenge 2026</p>
        </div>
      </section>
    </main>
  );
}

