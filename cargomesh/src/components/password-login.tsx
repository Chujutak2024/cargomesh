"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { safeLoginReturnTo } from "@/shared/schemas/v2/carrier-portal";
import { useLocale } from "@/features/i18n/locale-provider";
import styles from "./password-login.module.css";
import { Button } from "@/components/ui";
export function PasswordLogin({returnTo}:{returnTo?:"/carrier-portal"|"/dashboard"|"/v2-workspace"}) {
  const router = useRouter();
  const { t } = useLocale();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [demoEmail, setDemoEmail] = useState("");
  const edited = useRef(false);
  useEffect(() => {
    // Private defaults are served by the loopback preview, never bundled or deployed.
    if (!['127.0.0.1', 'localhost'].includes(window.location.hostname) || window.location.port !== '3907') return;
    const controller = new AbortController();
    void fetch('/__demo/login-defaults', { cache: 'no-store', signal: controller.signal })
      .then(async response => response.ok ? response.json() : null)
      .then(value => {
        if (controller.signal.aborted || edited.current || !value || typeof value.email !== 'string' || typeof value.password !== 'string') return;
        setEmail(value.email); setPassword(value.password); setDemoEmail(value.email);
      }).catch(() => { /* Manual sign-in remains available if local defaults are unavailable. */ });
    return () => controller.abort();
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError("");
    const fields = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: fields.get("email"), password: fields.get("password"), returnTo }) });
      if (!response.ok) { setError(response.status === 401 ? t("Correo o contraseña incorrectos.", "Incorrect email or password.") : t("No se pudo iniciar sesión. Reintenta.", "Unable to sign in. Please try again.")); return; }
      const result=await response.json();
      const destination=safeLoginReturnTo(result.destination);
      if(!destination){setError(t("No se pudo resolver tu espacio de trabajo.", "Unable to find your workspace."));return;}
      // This public coordinator is a presentation preview. Real API scopes stay unchanged.
      const localDemo = demoEmail && String(fields.get('email')).trim() === demoEmail && returnTo === '/v2-workspace';
      router.replace(localDemo ? '/v2-workspace' : destination); router.refresh();
    } catch { setError(t("No se pudo conectar. Reintenta.", "Unable to connect. Please try again.")); }
    finally { setBusy(false); }
  }
  return <form data-cm-theme="carrier" className={styles.card} onSubmit={submit}><h1>{t("Iniciar sesión", "Sign in")}</h1>
    <p>{t("Accede con tu cuenta de CargoMesh V2.", "Sign in with your CargoMesh V2 account.")}</p>
    <div className={styles.form}>
    <label className={styles.field}>{t("Correo", "Email")}<span className={styles.inputFrame}><input name="email" type="email" autoComplete="username" value={email} onChange={event => { edited.current = true; setEmail(event.target.value); }} required /></span></label>
    <label className={styles.field}>{t("Contraseña", "Password")}<span className={styles.inputFrame}><input name="password" type="password" autoComplete="current-password" value={password} onChange={event => { edited.current = true; setPassword(event.target.value); }} required /></span></label>
    {error ? <p className={styles.errorMessage} role="alert">{error}</p> : null}
    <Button className={styles.primaryAction} isLoading={busy} loadingLabel={t("Ingresando…", "Signing in…")} type="submit">{t("Ingresar", "Sign in")}</Button>
    </div>
  </form>;
}
