"use client";

import {
  ArrowRight,
  LoaderCircle,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { startDemoSession, type DemoLoginResult } from "@/features/auth/demo-login-client";
import type { LoginFormCopy } from "@/features/auth/login-copy";
import styles from "./demo-login.module.css";

export function DemoLogin({ copy }: { copy: LoginFormCopy }) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Exclude<DemoLoginResult, { ok: true }> | null>(null);

  async function handleDemoLogin() {
    if (isLoading) return;

    setIsLoading(true);
    setError(null);
    const result = await startDemoSession();

    if (result.ok) {
      router.replace("/dashboard");
      router.refresh();
      return;
    }

    setError(result);
    setIsLoading(false);
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

      <div className={styles.form}>
        <p className={styles.intro}>{copy.demoNotice}</p>

        {error ? (
          <p
            className={`${styles.errorMessage} ${error.kind === "unauthorized" ? styles.invalidError : styles.recoverableError}`}
            id="login-error"
            role="alert"
          >
            <strong>
              {error.kind === "unauthorized" ? copy.unauthorizedState : copy.recoverableState}
            </strong>
            {error.kind === "unavailable" ? copy.unavailableMessage : error.kind === "unauthorized" ? copy.unauthorizedMessage : copy.recoverableMessage}
          </p>
        ) : null}

        <button
          className={styles.primaryAction}
          type="button"
          onClick={() => void handleDemoLogin()}
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
      </div>
    </div>
  );
}

