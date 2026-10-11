import * as React from "react";
import { ShieldCheck } from "lucide-react";

export function Footer() {
  return (
    <footer className="w-full border-t border-[#1a2642] bg-[#070b14]/70 py-6 text-xs text-slate-400">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 sm:flex-row sm:px-6 lg:px-8">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-indigo-400" />
          <span>InterviewIQ — Adaptive Interview Intelligence Platform</span>
        </div>
        <div className="flex items-center gap-4 text-slate-500">
          <span>Stage 1: Frontend Foundation</span>
          <span>•</span>
          <span>Next.js 16 • Tailwind CSS v4</span>
        </div>
      </div>
    </footer>
  );
}
