"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Sparkles,
  ArrowRight,
  Lock,
  Mail,
  AlertCircle,
  ArrowLeft,
  LogOut,
  UserCheck,
  Eye,
  EyeOff,
  User,
  Briefcase,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth-context";

function LoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectParam = searchParams.get("redirect") || "/dashboard";

  const { user, refreshUser, logout } = useAuth();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [loadingDemoRole, setLoadingDemoRole] = React.useState<"candidate" | "recruiter" | null>(null);

  const handleDemoLogin = async (role: "candidate" | "recruiter") => {
    setError(null);
    setLoadingDemoRole(role);
    try {
      const res = await fetch("/api/auth/demo-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to sign in demo user.");
        return;
      }
      await refreshUser();
      router.push(redirectParam);
    } catch (err) {
      console.error("Demo login error:", err);
      setError("An unexpected network error occurred.");
    } finally {
      setLoadingDemoRole(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      setError("Please provide both email and password.");
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: cleanEmail, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to sign in. Please verify your credentials.");
        return;
      }

      await refreshUser();
      router.push(redirectParam);
    } catch (err) {
      console.error("Login submission error:", err);
      setError("An unexpected network error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-14rem)] py-8 px-4">
        <div className="w-full max-w-md space-y-6">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Landing Page</span>
          </Link>

          <Card className="border-[#1e2d4f] bg-[#0c1222] shadow-2xl shadow-indigo-950/40 p-6 text-center space-y-5">
            <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-2xl bg-indigo-950 border border-indigo-700/50 text-indigo-400">
              <UserCheck className="h-6 w-6" />
            </div>

            <div>
              <Badge variant="success" className="mb-2">Currently Signed In</Badge>
              <h2 className="text-xl font-bold text-white">Active Session Detected</h2>
              <p className="text-xs text-slate-400 mt-1">
                You are currently signed in as <strong className="text-white">{user.name}</strong> ({user.email}).
              </p>
              <p className="text-[11px] text-indigo-300 font-mono mt-1 capitalize">
                Account Role: {user.role}
              </p>
            </div>

            <div className="space-y-2.5 pt-2">
              <Link href={redirectParam} className="block">
                <Button className="w-full justify-center gap-2 h-10">
                  Continue to {redirectParam.startsWith("/interview") ? "Interview" : redirectParam.startsWith("/setup") ? "Setup" : "Dashboard"}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Button
                variant="outline"
                onClick={async () => {
                  await logout();
                }}
                className="w-full justify-center gap-2 text-rose-300 border-rose-900/50 hover:bg-rose-950/40 hover:text-white h-10"
              >
                <LogOut className="h-4 w-4 text-rose-400" />
                Log Out of Account
              </Button>
            </div>

            <div className="pt-2 border-t border-[#1a2642]">
              <p className="text-[11px] text-slate-500">
                Want to sign in with different credentials? Click <strong>Log Out of Account</strong> above.
              </p>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  const isGuardedRedirect = Boolean(redirectParam && redirectParam !== "/dashboard");

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-14rem)] py-8 px-4">
      <div className="w-full max-w-md space-y-6">
        {/* Back Link */}
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Landing Page</span>
        </Link>

        {/* Branding & Header */}
        <div className="text-center space-y-3">
          <div className="flex items-center justify-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-600/30">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="flex flex-col text-left">
              <span className="font-bold tracking-tight text-white text-lg leading-none">
                Interview<span className="text-indigo-400">IQ</span>
              </span>
              <span className="text-[10px] text-slate-400 font-mono tracking-wider uppercase mt-1">
                Adaptive Intelligence
              </span>
            </div>
          </div>

          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Welcome back
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Sign in to continue to your InterviewIQ workspace.
            </p>
          </div>
        </div>

        {/* Notification when redirected due to login guard */}
        {isGuardedRedirect && (
          <div className="rounded-xl border border-amber-800/80 bg-amber-950/40 p-3.5 text-xs text-amber-200 flex items-start gap-2.5 shadow-md">
            <ShieldAlert className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
            <div>
              <p className="font-semibold text-white">Authentication Required</p>
              <p className="text-amber-300/90 text-[11px] mt-0.5">
                You must sign in to access the requested interview workspace or dashboard.
              </p>
            </div>
          </div>
        )}

        {/* Sign-In Card */}
        <Card className="rounded-2xl border border-slate-800/80 bg-[#0c1427]/95 shadow-xl p-6 sm:p-7">
          <CardContent className="p-0 space-y-5">
            {error && (
              <div className="rounded-xl border border-rose-800/70 bg-rose-950/30 p-3.5 text-xs text-rose-300 flex items-start gap-2.5">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
                <p>{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email" required className="text-xs font-semibold text-slate-300">
                  Email Address
                </Label>
                <div className="relative">
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    autoFocus
                    className="pl-9 h-11 rounded-xl border-slate-700/80 bg-[#080d19] text-xs sm:text-sm"
                  />
                  <Mail className="absolute left-3 top-3.5 h-4 w-4 text-slate-500 pointer-events-none" />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" required className="text-xs font-semibold text-slate-300">
                  Password
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    className="pl-9 pr-10 h-11 rounded-xl border-slate-700/80 bg-[#080d19] text-xs sm:text-sm"
                  />
                  <Lock className="absolute left-3 top-3.5 h-4 w-4 text-slate-500 pointer-events-none" />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-3 top-3 h-5 w-5 text-slate-400 hover:text-slate-200 transition-colors focus:outline-none flex items-center justify-center"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-11 rounded-xl gap-2 justify-center bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-bold shadow-md shadow-indigo-600/25 mt-2"
                isLoading={isSubmitting}
                disabled={isSubmitting || loadingDemoRole !== null}
              >
                Sign In
                <ArrowRight className="h-4 w-4" />
              </Button>
            </form>

            {/* Optional Demo Access Section */}
            <div className="pt-5 border-t border-slate-800/80 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Instant Demo Access
                </span>
                <span className="text-[10px] text-slate-500 font-medium">1-Click Evaluation</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleDemoLogin("candidate")}
                  isLoading={loadingDemoRole === "candidate"}
                  disabled={isSubmitting || loadingDemoRole !== null}
                  className="h-10 text-xs font-semibold justify-center gap-2 border-slate-700/80 bg-slate-900/40 hover:bg-slate-800/80 text-slate-200 hover:text-white"
                >
                  <User className="h-3.5 w-3.5 text-indigo-400" />
                  Candidate Demo
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleDemoLogin("recruiter")}
                  isLoading={loadingDemoRole === "recruiter"}
                  disabled={isSubmitting || loadingDemoRole !== null}
                  className="h-10 text-xs font-semibold justify-center gap-2 border-slate-700/80 bg-slate-900/40 hover:bg-slate-800/80 text-slate-200 hover:text-white"
                >
                  <Briefcase className="h-3.5 w-3.5 text-purple-400" />
                  Recruiter Demo
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sign-up Link */}
        <div className="text-center text-xs text-slate-400">
          Don&apos;t have an account?{" "}
          <Link
            href={isGuardedRedirect ? `/signup?redirect=${encodeURIComponent(redirectParam)}` : "/signup"}
            className="text-indigo-400 hover:text-indigo-300 font-semibold underline underline-offset-4"
          >
            Create an Account
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <React.Suspense
      fallback={
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-14rem)] py-8 px-4 text-slate-400">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent mb-3" />
          <p className="text-xs">Loading sign-in form...</p>
        </div>
      }
    >
      <LoginFormContent />
    </React.Suspense>
  );
}
