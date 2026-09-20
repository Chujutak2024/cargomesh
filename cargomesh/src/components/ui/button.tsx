"use client";

import { Loader2 } from "lucide-react";
import { forwardRef, type ButtonHTMLAttributes } from "react";
import clsx from "clsx";

import styles from "./ui.module.css";

export type ButtonVariant = "primary" | "secondary" | "ghost";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  isLoading?: boolean;
  variant?: ButtonVariant;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    children,
    className,
    disabled,
    isLoading = false,
    type = "button",
    variant = "secondary",
    ...props
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={clsx(styles.button, styles[variant], className)}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      {...props}
    >
      {isLoading ? <Loader2 size={16} aria-hidden="true" className="animate-spin" /> : null}
      {children}
    </button>
  );
});
