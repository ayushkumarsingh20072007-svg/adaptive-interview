"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sparkles, Terminal, FileText, LayoutDashboard, PlayCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Overview", icon: Sparkles },
  { href: "/setup", label: "Candidate Setup", icon: Terminal },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/interview/demo-session", label: "Live Interview", icon: PlayCircle },
  { href: "/report/demo-session", label: "Report", icon: FileText },
];

export function Navbar() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-[#1e2d4f] bg-[#0c1222]/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand identity */}
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-950/60 transition-transform group-hover:scale-105">
              <Sparkles className="h-4.5 w-4.5" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold tracking-tight text-slate-100 text-base leading-none">
                Interview<span className="text-indigo-400">IQ</span>
              </span>
              <span className="text-[10px] text-slate-400 font-mono tracking-wider uppercase mt-1">
                Adaptive Intelligence
              </span>
            </div>
          </Link>
          <div className="hidden sm:block ml-2">
            <Badge variant="indigo">Foundation v0.1</Badge>
          </div>
        </div>

        {/* Navigation links */}
        <nav className="flex items-center gap-1 sm:gap-2">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href.replace("/demo-session", ""));

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs sm:text-sm font-medium transition-colors",
                  isActive
                    ? "bg-[#162244] text-indigo-300 border border-indigo-700/50"
                    : "text-slate-300 hover:bg-[#141e34] hover:text-slate-100"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden md:inline">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
