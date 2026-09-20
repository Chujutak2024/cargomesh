import clsx from "clsx";
import type { HTMLAttributes } from "react";

import styles from "./ui.module.css";

export type BadgeVariant = "draft" | "pending" | "confirmed";

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
};

export function Badge({ className, variant = "draft", ...props }: BadgeProps) {
  return <span className={clsx(styles.badge, styles[variant], className)} {...props} />;
}
