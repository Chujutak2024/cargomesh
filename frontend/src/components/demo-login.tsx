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
import type { LoginFormCopy } from "@/features/auth/login-copy";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import styles from "./demo-login.module.css";

export function DemoLogin({ copy }: { copy: LoginFormCopy }) {
  const router = useRouter();
  const emailInputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<{
    kind: PasswordLoginErrorKind;
    message: string;
  } | null>(null);

  function restoreEmailFocus() {
    window.requestAnimationFrame(() => emailInputRef.current?.focus());
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isLoading) return;

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
      restoreEmailFocus();
      return;
    }

    if (result.ok) {
      router.replace("/dashboard");
      router.refresh();
      return;
    }

    setError({ kind: result.kind, message: result.message });
    setIsLoading(false);
    restoreEmailFocus();
  }

  return (
    <div className={styles.card}>
      <div className={styles.cardTopline}>
        <span>
          <LockKeyhole size={14} aria-hidden="true" />
          {copy.securityLabel}
        </span>
      </div>

      <div className={styles.cardHeader}>
        <span className={styles.securityMark} aria-hidden="true">
          <ShieldCheck size={22} strokeWidth={1.8} />
        </span>
        <div>
          <span className={styles.eyebrow}>{copy.eyebrow}</span>
          <h1>{copy.title}</h1>
        </div>
      </div>

      <p className={styles.intro}>{copy.intro}</p>

      <form className={styles.form} onSubmit={handleSubmit} noValidate={false}>
        <div className={styles.field}>
          <label htmlFor="login-email">{copy.emailLabel}</label>
          <div className={styles.inputFrame}>
            <Mail size={18} aria-hidden="true" />
            <input
              ref={emailInputRef}
              id="login-email"
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              placeholder={copy.emailPlaceholder}
              required
              disabled={isLoading}
              aria-invalid={error?.kind === "invalid_credentials"}
              aria-describedby={error ? "login-error" : undefined}
            />
          </div>
        </div>

        <div className={styles.field}>
          <label htmlFor="login-password">{copy.passwordLabel}</label>
          <div className={styles.inputFrame}>
            <LockKeyhole size={18} aria-hidden="true" />
            <input
              id="login-password"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder={copy.passwordPlaceholder}
              required
              disabled={isLoading}
              aria-invalid={error?.kind === "invalid_credentials"}
              aria-describedby={error ? "login-error" : undefined}
            />
          </div>
        </div>

        {error ? (
          <p
            className={`${styles.errorMessage} ${error.kind === "invalid_credentials" ? styles.invalidError : styles.recoverableError}`}
            id="login-error"
            role="alert"
          >
            <strong>
              {error.kind === "invalid_credentials"
                ? copy.invalidCredentialsState
                : copy.recoverableState}
            </strong>
            {error.message}
          </p>
        ) : null}

        <button
          className={styles.primaryAction}
          type="submit"
          disabled={isLoading}
          aria-busy={isLoading}
        >
          {isLoading ? (
            <>
              <LoaderCircle className={styles.spinner} size={18} aria-hidden="true" />
              {copy.loading}
            </>
          ) : (
            <>
              {copy.submit}
              <ArrowRight size={18} aria-hidden="true" />
            </>
          )}
        </button>
      </form>
    </div>
  );
}

