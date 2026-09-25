"use client";

import { useId, type SelectHTMLAttributes } from "react";

import styles from "./v2-ui.module.css";

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  hint?: string;
  error?: string;
  fieldClassName?: string;
};

export function Select({ id, label, hint, error, fieldClassName, className, children, ...props }: SelectProps) {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  const hintId = hint ? `${controlId}-hint` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  return (
    <label className={[styles.field, fieldClassName].filter(Boolean).join(" ")} htmlFor={controlId}>
      <span className={styles.fieldLabel}>{label}</span>
      <select
        {...props}
        id={controlId}
        className={[styles.control, className].filter(Boolean).join(" ")}
        aria-invalid={Boolean(error)}
        aria-describedby={[hintId, errorId].filter(Boolean).join(" ") || undefined}
      >
        {children}
      </select>
      {hint ? <span className={styles.fieldHint} id={hintId}>{hint}</span> : null}
      {error ? <span className={styles.fieldError} id={errorId}>{error}</span> : null}
    </label>
  );
}
