import * as React from "react";
import { cn } from "@/lib/utils";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          "flex min-h-[80px] w-full rounded-lg border bg-[#0c1222] px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0c1222] disabled:cursor-not-allowed disabled:opacity-50",
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

Textarea.displayName = "Textarea";
