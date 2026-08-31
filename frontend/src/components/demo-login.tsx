"use client";

import {
  ArrowRight,
  Building2,
  CheckCircle2,
  LoaderCircle,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";
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
      <div className={styles.cardTopline}>
        <span>
          <LockKeyhole size={14} aria-hidden="true" />
          Acceso de demostración
        </span>
        <span className={styles.status}>
          <span aria-hidden="true" />
          Disponible
        </span>
      </div>

      <div className={styles.cardHeader}>
        <span className={styles.securityMark} aria-hidden="true">
          <ShieldCheck size={22} strokeWidth={1.8} />
        </span>
        <div>
          <span className={styles.eyebrow}>Control tower B2B</span>
          <h1>Bienvenido a CargoMesh</h1>
        </div>
      </div>

      <p className={styles.intro}>
        Ingresa al entorno seguro de evaluación para supervisar solicitudes y operaciones de carga.
      </p>

      <div className={styles.organization} aria-label="Organización de demostración">
        <span className={styles.organizationIcon} aria-hidden="true">
          <Building2 size={20} strokeWidth={1.8} />
        </span>
        <div className={styles.organizationCopy}>
          <span>Organización activa</span>
          <strong>ACME Mining Perú</strong>
          <small>Carlos Mendoza · Administrador</small>
        </div>
        <CheckCircle2 className={styles.readyIcon} size={20} aria-label="Organización lista" />
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
            Ingresar al dashboard
            <ArrowRight size={18} aria-hidden="true" />
          </>
        )}
      </button>

      <div className={styles.assurance}>
        <ShieldCheck size={17} aria-hidden="true" />
        <p>
          <strong>Sesión demo controlada</strong>
          <span>La autenticación empresarial se conectará mediante Supabase.</span>
        </p>
      </div>
    </div>
  );
}

