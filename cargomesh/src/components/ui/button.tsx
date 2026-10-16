import { Loader2 } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

import styles from "./v2-ui.module.css";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "accent" | "secondary" | "ghost";
  size?: "regular" | "compact";
  isLoading?: boolean;
  loadingLabel?: string;
  children: ReactNode;
};

export function Button({
  variant = "primary",
  size = "regular",
  isLoading = false,
  loadingLabel = "Loading…",
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      data-cm-button data-variant={variant} data-size={size}
      className={[styles.button, styles[variant], className].filter(Boolean).join(" ")}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
    >
      {isLoading ? <Loader2 className={styles.spinner} size={16} aria-hidden="true" /> : null}
      {isLoading ? loadingLabel : children}
    </button>
  );
}
