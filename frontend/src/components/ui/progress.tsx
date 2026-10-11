import * as React from "react";
import { cn } from "@/lib/utils";

export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number; // 0 to 100
  indicatorColor?: "indigo" | "emerald" | "amber" | "rose" | "cyan";
  size?: "sm" | "md" | "lg";
}

export function Progress({
  value,
  indicatorColor = "indigo",
  size = "md",
  className,
  ...props
}: ProgressProps) {
  const clamped = Math.min(100, Math.max(0, value));

  const sizeStyles = {
    sm: "h-1.5",
    md: "h-2.5",
    lg: "h-3.5",
  };

  const indicatorColors = {
    indigo: "bg-indigo-500",
    emerald: "bg-emerald-500",
    amber: "bg-amber-500",
    rose: "bg-rose-500",
    cyan: "bg-cyan-500",
  };

  return (
    <div
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn(
        "w-full overflow-hidden rounded-full bg-[#162244] border border-[#1e2d4f]/50",
        sizeStyles[size],
        className
      )}
      {...props}
    >
      <div
        className={cn(
          "h-full transition-all duration-500 ease-out rounded-full",
          indicatorColors[indicatorColor]
        )}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
