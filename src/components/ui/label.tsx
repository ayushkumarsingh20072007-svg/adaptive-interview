import * as React from "react";
import { cn } from "@/lib/utils";

export interface LabelProps
  extends React.LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean;
}

export function Label({
  className,
  required,
  children,
  ...props
}: LabelProps) {
  return (
    <label
      className={cn(
        "text-xs font-semibold tracking-wide text-slate-300 select-none block mb-1.5",
        className
      )}
      {...props}
    >
      {children}
      {required && <span className="ml-1 text-rose-400">*</span>}
    </label>
  );
}
