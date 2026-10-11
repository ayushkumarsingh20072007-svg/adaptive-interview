import * as React from "react";
import { Loader2, AlertCircle, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

export interface LoadingStateProps {
  title?: string;
  description?: string;
  className?: string;
}

export function LoadingState({
  title = "Loading interview data...",
  description = "Please hold while we prepare your session environment.",
  className,
}: LoadingStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center p-8 text-center rounded-xl border border-[#1e2d4f] bg-[#10182b]/60",
        className
      )}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-950/60 text-indigo-400 mb-4 border border-indigo-800/40">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
      <h4 className="text-base font-semibold text-slate-100">{title}</h4>
      <p className="mt-1 text-sm text-slate-400 max-w-sm">{description}</p>
    </div>
  );
}

export interface EmptyStateProps {
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({
  title = "No interviews found",
  description = "Get started by configuring your first candidate interview session.",
  actionLabel,
  onAction,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center p-8 text-center rounded-xl border border-dashed border-[#22304e] bg-[#10182b]/40",
        className
      )}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#141e34] text-slate-400 mb-4 border border-[#22304e]">
        <Inbox className="h-6 w-6" />
      </div>
      <h4 className="text-base font-semibold text-slate-100">{title}</h4>
      <p className="mt-1 text-sm text-slate-400 max-w-sm mb-4">{description}</p>
      {actionLabel && (
        <Button size="sm" variant="secondary" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

export interface ErrorStateProps {
  title?: string;
  description?: string;
  retryLabel?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title = "Session initialization error",
  description = "We encountered an issue preparing this interview session.",
  retryLabel = "Try again",
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center p-8 text-center rounded-xl border border-rose-900/40 bg-rose-950/20",
        className
      )}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-950/60 text-rose-400 mb-4 border border-rose-800/40">
        <AlertCircle className="h-6 w-6" />
      </div>
      <h4 className="text-base font-semibold text-slate-100">{title}</h4>
      <p className="mt-1 text-sm text-slate-400 max-w-sm mb-4">{description}</p>
      {onRetry && (
        <Button size="sm" variant="danger" onClick={onRetry}>
          {retryLabel}
        </Button>
      )}
    </div>
  );
}
