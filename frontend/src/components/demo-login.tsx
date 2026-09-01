"use client";

import {
  ArrowRight,
  LoaderCircle,
  LockKeyhole,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useRef, useState } from "react";
import {
  RECOVERABLE_LOGIN_ERROR_MESSAGE,
  signInWithPassword,
  type PasswordLoginErrorKind,
} from "@/features/auth/password-login";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import styles from "./demo-login.module.css";

export function DemoLogin() {
  const router = useRouter();
  const emailInputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<{
    kind: PasswordLoginErrorKind;
    message: string;
  } | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setError(null);

    const formData = new FormData(event.currentTarget);
    let result;

    try {
      result = await signInWithPassword(createBrowserSupabaseClient(), {
        email: String(formData.get("email") ?? "").trim(),
        password: String(formData.get("password") ?? ""),
      });
    } catch {
      setError({ kind: "recoverable", message: RECOVERABLE_LOGIN_ERROR_MESSAGE });
      setIsLoading(false);
      emailInputRef.current?.focus();
      return;
    }

    if (result.ok) {
      router.replace("/dashboard");
      router.refresh();
      return;
    }

    setError({ kind: result.kind, message: result.message });
    setIsLoading(false);
    emailInputRef.current?.focus();
  }

  return (
    <div className={styles.card}>
      <div className={styles.cardTopline}>
        <span>
          <LockKeyhole size={14} aria-hidden="true" />
          Acceso seguro
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
        Inicia sesión con tu cuenta autorizada para supervisar solicitudes y operaciones de carga.
      </p>

      <form className={styles.form} onSubmit={handleSubmit} noValidate={false}>
        <div className={styles.field}>
          <label htmlFor="login-email">Correo electrónico</label>
          <div className={styles.inputFrame}>
            <Mail size={18} aria-hidden="true" />
            <input
              ref={emailInputRef}
              id="login-email"
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              required
              disabled={isLoading}
              aria-invalid={error?.kind === "invalid_credentials"}
              aria-describedby={error ? "login-error" : undefined}
            />
          </div>
        </div>

        <div className={styles.field}>
          <label htmlFor="login-password">Contraseña</label>
          <div className={styles.inputFrame}>
            <LockKeyhole size={18} aria-hidden="true" />
            <input
              id="login-password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              disabled={isLoading}
              aria-invalid={error?.kind === "invalid_credentials"}
              aria-describedby={error ? "login-error" : undefined}
            />
          </div>
        </div>

        {error ? (
          <p className={styles.errorMessage} id="login-error" role="alert">
            {error.message}
          </p>
        ) : null}

        <button className={styles.primaryAction} type="submit" disabled={isLoading}>
          {isLoading ? (
            <>
              <LoaderCircle className={styles.spinner} size={18} aria-hidden="true" />
              Verificando acceso…
            </>
          ) : (
            <>
              Iniciar sesión
              <ArrowRight size={18} aria-hidden="true" />
            </>
          )}
        </button>
      </form>

      <div className={styles.assurance}>
        <ShieldCheck size={17} aria-hidden="true" />
        <p>
          <strong>Autenticación empresarial</strong>
          <span>Las credenciales se validan de forma segura mediante Supabase Auth.</span>
        </p>
      </div>
    </div>
  );
}

