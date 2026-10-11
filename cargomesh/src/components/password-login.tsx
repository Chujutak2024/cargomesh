"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { safeLoginReturnTo } from "@/shared/schemas/v2/carrier-portal";
import styles from "./password-login.module.css";
export function PasswordLogin({returnTo}:{returnTo?:"/carrier-portal"|"/dashboard"|"/v2-workspace"}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError("");
    const fields = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: fields.get("email"), password: fields.get("password"), returnTo }) });
      if (!response.ok) { setError(response.status === 401 ? "Correo o contraseña incorrectos." : "No se pudo iniciar sesión. Reintenta."); return; }
      const result=await response.json();
      const destination=safeLoginReturnTo(result.destination);
      if(!destination){setError("No se pudo resolver tu espacio de trabajo.");return;}
      router.replace(destination); router.refresh();
    } catch { setError("No se pudo conectar. Reintenta."); }
    finally { setBusy(false); }
  }
  return <form className={styles.card} onSubmit={submit}><h1>Iniciar sesión</h1>
    <p>Accede con tu cuenta de CargoMesh V2.</p>
    <div className={styles.form}>
    <label className={styles.field}>Correo<span className={styles.inputFrame}><input name="email" type="email" autoComplete="username" required /></span></label>
    <label className={styles.field}>Contraseña<span className={styles.inputFrame}><input name="password" type="password" autoComplete="current-password" required /></span></label>
    {error ? <p className={styles.errorMessage} role="alert">{error}</p> : null}
    <button className={styles.primaryAction} disabled={busy} type="submit">{busy ? "Ingresando…" : "Ingresar"}</button>
    </div>
  </form>;
}
