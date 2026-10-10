import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "indigo" | "success" | "warning" | "danger" | "outline";
}

export function Badge({
  className,
  variant = "default",
  ...props
}: BadgeProps) {
  const baseStyles =
    "inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-medium tracking-wide transition-colors";

  const variantStyles = {
    default: "bg-[#1a2642] text-slate-300 border border-[#22304e]",
    indigo: "bg-indigo-950/70 text-indigo-300 border border-indigo-800/60",
    success: "bg-emerald-950/70 text-emerald-300 border border-emerald-800/60",
    warning: "bg-amber-950/70 text-amber-300 border border-amber-800/60",
    danger: "bg-rose-950/70 text-rose-300 border border-rose-800/60",
    outline: "text-slate-300 border border-[#22304e]",
  };

  return (
    <span
      className={cn(baseStyles, variantStyles[variant], className)}
      {...props}
    />
  );
}
