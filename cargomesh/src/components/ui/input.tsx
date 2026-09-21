"use client";

import { forwardRef, type InputHTMLAttributes } from "react";
import { twMerge } from "tailwind-merge";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      className={twMerge(
        "h-10 w-full rounded-lg border border-[#29463d] bg-[#0e1d19] px-3 text-[#f3f7f5] placeholder:text-[#6c867c] focus:outline-none focus:ring-2 focus:ring-[#57c79a] disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
});

Input.displayName = "Input";
