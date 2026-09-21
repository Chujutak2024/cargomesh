"use client";

import { Loader2 } from "lucide-react";
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { twMerge } from "tailwind-merge";

export type ButtonVariant = "primary" | "secondary" | "ghost";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  isLoading?: boolean;
  variant?: ButtonVariant;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-[#d2a95f] px-[18px] text-[#07110f] hover:brightness-105 active:brightness-95",
  secondary:
    "border border-[#29463d] bg-[#142722] px-4 text-[#f3f7f5] hover:brightness-105 active:brightness-95",
  ghost:
    "bg-transparent px-3 text-[#a8bbb4] hover:bg-[#142722] hover:text-[#f3f7f5]",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    children,
    className,
    disabled = false,
    isLoading = false,
    type = "button",
    variant = "primary",
    ...props
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={twMerge(
        "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg font-semibold transition-[filter,background-color,color,opacity] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#57c79a] disabled:cursor-not-allowed disabled:opacity-50",
        variantClasses[variant],
        className,
      )}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      data-loading={isLoading || undefined}
      data-variant={variant}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
      ) : null}
      {children}
    </button>
  );
});

Button.displayName = "Button";
