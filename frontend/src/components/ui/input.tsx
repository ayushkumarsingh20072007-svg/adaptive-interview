import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", error, ...props }, ref) => {
    return (
      <input
        type={type}
        ref={ref}
        className={cn(
          "flex h-10 w-full rounded-lg border bg-[#0c1222] px-3.5 py-2 text-sm text-slate-100 placeholder:text-slate-500 transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0c1222] disabled:cursor-not-allowed disabled:opacity-50",
          error
            ? "border-rose-500/80 focus-visible:ring-rose-500"
            : "border-[#1e2d4f] hover:border-[#2b3e6b] focus-visible:border-indigo-500 focus-visible:ring-indigo-500",
          className
        )}
        {...props}
      />
    );
  }
);

Input.displayName = "Input";
