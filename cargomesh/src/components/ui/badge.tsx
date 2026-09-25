import type { HTMLAttributes, ReactNode } from "react";

import styles from "./v2-ui.module.css";

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: "preliminary" | "unknown" | "confirmed" | "neutral";
  children: ReactNode;
};

export function Badge({ tone = "neutral", className, children, ...props }: BadgeProps) {
  return <span {...props} className={[styles.badge, styles[tone], className].filter(Boolean).join(" ")}>{children}</span>;
}
