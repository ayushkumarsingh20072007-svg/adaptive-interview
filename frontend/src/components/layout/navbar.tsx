"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Sparkles, Menu, X, ArrowRight, LogIn, LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { useIsMounted } from "@/lib/use-mounted";

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const { user, isLoading, logout } = useAuth();
  const isMounted = useIsMounted();

  async function handleLogout() {
    await logout();
    setMobileMenuOpen(false);
    router.push("/login");
  }

  const navLinks = [
    { href: "/#how-it-works", label: "How It Works" },
    { href: "/#tracks", label: "Tracks" },
    { href: "/dashboard", label: "Dashboard" },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-[#090e1a]/95 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand identity */}
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-sm transition-transform group-hover:scale-105">
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
            <Badge variant="indigo">SaaS Platform</Badge>
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
          {isMounted && !isLoading ? (
            user ? (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#0e1628] border border-slate-800 text-xs text-slate-200">
                  <User className="h-3.5 w-3.5 text-indigo-400" />
                  <span className="max-w-[120px] truncate font-medium">{user.name}</span>
                  {user.role === "recruiter" && (
                    <Badge variant="indigo" className="text-[9px] py-0 px-1 ml-0.5">Recruiter</Badge>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLogout}
                  className="text-xs text-rose-300 border-rose-900/50 hover:text-white hover:bg-rose-950/40 gap-1.5 h-8 px-2.5"
                  title="Log out of account"
                >
                  <LogOut className="h-3.5 w-3.5 text-rose-400" />
                  <span>Log Out</span>
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link href="/login">
                  <Button variant="ghost" size="sm" className="text-slate-300 hover:text-white text-xs">
                    <LogIn className="h-3.5 w-3.5 mr-1 text-slate-400" />
                    Sign In
                  </Button>
                </Link>
                <Link href="/signup">
                  <Button variant="outline" size="sm" className="text-xs border-slate-800 hover:border-slate-700">
                    Get Started
                  </Button>
                </Link>
              </div>
            )
          ) : (
            <div className="w-[140px] h-8" />
          )}

          {!user && (
            <Link href="/login?redirect=/setup">
              <Button size="sm" className="gap-2 shadow-sm bg-indigo-600 hover:bg-indigo-500">
                Start Interview
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          )}
        </div>

        {/* Mobile Hamburger Button */}
        <div className="flex items-center md:hidden gap-2">
          {!user && (
            <Link href="/login?redirect=/setup">
              <Button size="sm" className="text-xs px-2.5 h-8 bg-indigo-600 hover:bg-indigo-500">
                Start
              </Button>
            </Link>
          )}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle Navigation Menu"
            className="rounded-lg p-2 text-slate-300 hover:bg-slate-800/60 focus:outline-none"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-slate-800 bg-[#090e1a] px-4 py-4 space-y-3">
          <div className="flex flex-col space-y-2">
            {navLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-lg px-3 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800/50 hover:text-white transition-colors"
              >
                {item.label}
              </Link>
            ))}
          </div>

          <div className="pt-2 border-t border-slate-800 flex flex-col gap-2">
            {isMounted && !isLoading && (
              user ? (
                <div className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-[#0e1628] border border-slate-800">
                  <div className="text-xs">
                    <div className="flex items-center gap-1.5">
                      <p className="font-semibold text-white">{user.name}</p>
                      {user.role === "recruiter" && (
                        <Badge variant="indigo" className="text-[9px] py-0 px-1">Recruiter</Badge>
                      )}
                    </div>
                    <p className="text-slate-400 text-[11px] truncate">{user.email}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleLogout}
                    className="text-xs text-rose-300 border-rose-900/50 hover:bg-rose-950/40 gap-1"
                  >
                    <LogOut className="h-3 w-3 text-rose-400" />
                    Log Out
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <Link href="/login" onClick={() => setMobileMenuOpen(false)}>
                    <Button variant="outline" className="w-full text-xs justify-center">
                      Sign In
                    </Button>
                  </Link>
                  <Link href="/signup" onClick={() => setMobileMenuOpen(false)}>
                    <Button variant="secondary" className="w-full text-xs justify-center">
                      Get Started
                    </Button>
                  </Link>
                </div>
              )
            )}

            <Link href={user ? "/setup" : "/login?redirect=/setup"} onClick={() => setMobileMenuOpen(false)}>
              <Button className="w-full gap-2 justify-center bg-indigo-600 hover:bg-indigo-500">
                Start Interview
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/dashboard" onClick={() => setMobileMenuOpen(false)}>
              <Button variant="secondary" className="w-full justify-center">
                {user?.role === "recruiter" ? "Recruiter Portal" : "Candidate Dashboard"}
              </Button>
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
