"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sparkles, Menu, X, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function Navbar() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  const navLinks = [
    { href: "/#features", label: "Features" },
    { href: "/#how-it-works", label: "How It Works" },
    { href: "/#about", label: "About" },
    { href: "/dashboard", label: "Dashboard" },
  ];

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
            <Badge variant="indigo">Hackathon Demo</Badge>
          </div>
        </div>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-6">
          {navLinks.map((item) => {
            const isDashboard = item.href === "/dashboard";
            const isActive = isDashboard ? pathname.startsWith("/dashboard") : false;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "text-sm font-medium transition-colors hover:text-indigo-300",
                  isActive ? "text-indigo-400 font-semibold" : "text-slate-300"
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Right Action buttons */}
        <div className="hidden sm:flex items-center gap-3">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm" className="text-slate-300">
              Demo Portal
            </Button>
          </Link>
          <Link href="/setup">
            <Button size="sm" className="gap-2 shadow-sm">
              Start Your Interview
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>

        {/* Mobile Hamburger Button */}
        <div className="flex items-center md:hidden gap-2">
          <Link href="/setup">
            <Button size="sm" className="text-xs px-2.5 h-8">
              Start
            </Button>
          </Link>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle Navigation Menu"
            className="rounded-lg p-2 text-slate-300 hover:bg-[#162244] focus:outline-none"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-[#1e2d4f] bg-[#0c1222] px-4 py-4 space-y-3">
          <div className="flex flex-col space-y-2">
            {navLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-lg px-3 py-2 text-sm font-medium text-slate-300 hover:bg-[#141e34] hover:text-white transition-colors"
              >
                {item.label}
              </Link>
            ))}
          </div>
          <div className="pt-2 border-t border-[#1e2d4f] flex flex-col gap-2">
            <Link href="/setup" onClick={() => setMobileMenuOpen(false)}>
              <Button className="w-full gap-2 justify-center">
                Start Your Interview
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/dashboard" onClick={() => setMobileMenuOpen(false)}>
              <Button variant="secondary" className="w-full justify-center">
                Candidate Dashboard
              </Button>
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
