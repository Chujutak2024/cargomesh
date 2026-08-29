"use client";

import { ArrowRight, LoaderCircle, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import styles from "./demo-login.module.css";

const DEMO_SESSION_KEY = "cargomesh.demo-session";

export function DemoLogin() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  function startDemoSession() {
    setIsLoading(true);
    window.sessionStorage.setItem(DEMO_SESSION_KEY, "active");
    router.push("/dashboard");
  }

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <span className={styles.securityMark} aria-hidden="true">
          <ShieldCheck size={20} strokeWidth={1.8} />
        </span>
        <div>
          <span className={styles.eyebrow}>Entorno de evaluación</span>
          <h1>Accede al control tower</h1>
        </div>
      </div>

      <p className={styles.intro}>
        Ingresa con la organización demo para revisar solicitudes y operaciones de carga internacional.
      </p>

      <div className={styles.organization} aria-label="Organización de demostración">
        <span className={styles.avatar} aria-hidden="true">AM</span>
        <div>
          <strong>ACME Mining Perú</strong>
          <span>Carlos Mendoza · Owner</span>
        </div>
        <span className={styles.ready}>Lista</span>
      </div>

      <button
        className={styles.primaryAction}
        type="button"
        disabled={isLoading}
        onClick={startDemoSession}
      >
        {isLoading ? (
          <>
            <LoaderCircle className={styles.spinner} size={18} aria-hidden="true" />
            Abriendo sesión…
          </>
        ) : (
          <>
            Entrar a la demo
            <ArrowRight size={18} aria-hidden="true" />
          </>
        )}
      </button>

      <p className={styles.note}>
        Esta entrada es exclusiva para la demo. La autenticación empresarial se conecta mediante Supabase.
      </p>
    </div>
  );
}

