"use client";

import clsx from "clsx";
import { forwardRef, type InputHTMLAttributes } from "react";

import styles from "./ui.module.css";

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, ...props },
  ref,
) {
  return <input ref={ref} className={clsx(styles.input, className)} {...props} />;
});
