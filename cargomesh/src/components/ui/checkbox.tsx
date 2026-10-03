"use client";

import { useId, type InputHTMLAttributes } from "react";

import styles from "./v2-ui.module.css";

export type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label: string;
  hint?: string;
};

export function Checkbox({ id, label, hint, className, ...props }: CheckboxProps) {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  const hintId = hint ? `${controlId}-hint` : undefined;
  return (
    <label className={[styles.checkboxField, className].filter(Boolean).join(" ")} htmlFor={controlId}>
      <input {...props} id={controlId} type="checkbox" aria-describedby={hintId} />
      <span>
        <strong>{label}</strong>
        {hint ? <small id={hintId}>{hint}</small> : null}
      </span>
    </label>
  );
}
