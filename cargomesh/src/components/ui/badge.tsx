import type { HTMLAttributes } from "react";
import { twMerge } from "tailwind-merge";

export type BadgeVariant = "draft" | "pending" | "confirmed";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variantClasses: Record<BadgeVariant, string> = {
  draft: "border-[#d2a95f] bg-[#142722] text-[#a8bbb4]",
  pending: "border-[#57c79a] bg-[#142722] text-[#57c79a]",
  confirmed: "border-[#d2a95f] bg-[#d2a95f] text-[#07110f]",
};

export function Badge({ className, variant = "draft", ...props }: BadgeProps) {
  return (
    <span
      className={twMerge(
        "inline-flex min-h-6 items-center rounded-full border px-2.5 py-1 text-xs font-semibold leading-none",
        variantClasses[variant],
        className,
      )}
      data-variant={variant}
      {...props}
    />
  );
}
