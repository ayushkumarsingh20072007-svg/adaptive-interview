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
    "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-wide transition-all backdrop-blur-md";

  const variantStyles = {
    default: "bg-[#141e34]/80 text-slate-300 border border-[#22304e]/90 shadow-sm",
    indigo: "bg-indigo-950/70 text-indigo-300 border border-indigo-700/50 shadow-sm shadow-indigo-950/50",
    success: "bg-emerald-950/70 text-emerald-300 border border-emerald-700/50 shadow-sm shadow-emerald-950/50",
    warning: "bg-amber-950/70 text-amber-300 border border-amber-700/50 shadow-sm shadow-amber-950/50",
    danger: "bg-rose-950/70 text-rose-300 border border-rose-700/50 shadow-sm shadow-rose-950/50",
    outline: "text-slate-300 border border-[#22304e] hover:border-indigo-500/50 hover:text-white",
  };

  return (
    <span
      className={cn(baseStyles, variantStyles[variant], className)}
      {...props}
    />
  );
}
