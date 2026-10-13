"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Sparkles, ArrowRight, Lock, Mail, User, AlertCircle, ArrowLeft, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/lib/auth-context";

function SignupFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectParam = searchParams.get("redirect") || "/dashboard";

  const { user, refreshUser } = useAuth();
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // If already logged in, redirect
  React.useEffect(() => {
    if (user) {
      router.push(redirectParam);
    }
  }, [user, redirectParam, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanName = name.trim();
    const cleanEmail = email.trim();

    if (!cleanName || cleanName.length < 2) {
      setError("Please provide your full name (at least 2 characters).");
      return;
    }

    if (!cleanEmail || !cleanEmail.includes("@")) {
      setError("Please provide a valid email address.");
      return;
    }

    if (!password || password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      setError("Password must contain both letters and numbers.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: cleanName,
          email: cleanEmail,
          password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to create account. Please try again.");
        return;
      }

      await refreshUser();
      router.push(redirectParam);
    } catch (err) {
      console.error("Signup submission error:", err);
      setError("An unexpected network error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

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

        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-violet-800/60 bg-violet-950/60 px-3 py-1 text-xs font-medium text-violet-300">
            <Sparkles className="h-3 w-3 text-violet-400" />
            <span>Create Candidate Profile</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Get Started with InterviewIQ
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            Register to take adaptive technical interviews, save scorecards, and track progress.
          </p>
        </div>

        {/* Form Card */}
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
                <Label htmlFor="name" required className="text-xs font-semibold text-slate-300">
                  Full Name
                </Label>
                <div className="relative">
                  <Input
                    id="name"
                    type="text"
                    placeholder="Alex Rivera"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    autoFocus
                    className="pl-9 h-11 rounded-xl border-slate-700/80 bg-[#080d19] text-xs sm:text-sm"
                  />
                  <User className="absolute left-3 top-3.5 h-4 w-4 text-slate-500 pointer-events-none" />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="email" required className="text-xs font-semibold text-slate-300">
                  Email Address
                </Label>
                <div className="relative">
                  <Input
                    id="email"
                    type="email"
                    placeholder="alex@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
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
                    type="password"
                    placeholder="Min. 8 characters (letters + numbers)"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                    className="pl-9 h-11 rounded-xl border-slate-700/80 bg-[#080d19] text-xs sm:text-sm"
                  />
                  <Lock className="absolute left-3 top-3.5 h-4 w-4 text-slate-500 pointer-events-none" />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword" required className="text-xs font-semibold text-slate-300">
                  Confirm Password
                </Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="Re-enter password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                    className="pl-9 h-11 rounded-xl border-slate-700/80 bg-[#080d19] text-xs sm:text-sm"
                  />
                  <Lock className="absolute left-3 top-3.5 h-4 w-4 text-slate-500 pointer-events-none" />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-11 rounded-xl gap-2 justify-center bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold shadow-md shadow-violet-600/25 mt-2"
                isLoading={isSubmitting}
                disabled={isSubmitting}
              >
                Create Account & Continue
                <ArrowRight className="h-4 w-4" />
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Bottom Switcher */}
        <div className="text-center text-xs text-slate-400">
          Already have an account?{" "}
          <Link
            href={redirectParam && redirectParam !== "/dashboard" ? `/login?redirect=${encodeURIComponent(redirectParam)}` : "/login"}
            className="text-violet-400 hover:text-violet-300 font-semibold underline underline-offset-4"
          >
            Sign In Here
          </Link>
        </div>

        {/* Security Assurances */}
        <div className="rounded-2xl border border-slate-800/80 bg-[#080d19]/80 p-4 text-xs text-slate-400 space-y-1.5">
          <div className="flex items-center gap-2 text-slate-300 font-semibold">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            <span>Candidate Data Privacy Assurances</span>
          </div>
          <p className="text-[11px] leading-relaxed">
            Passwords are encrypted using secure PBKDF2 hashing. Sessions use secure HTTP-only cookies. No personal resumes are retained without explicit candidate consent.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <React.Suspense
      fallback={
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-14rem)] py-8 px-4 text-slate-400">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-400 border-t-transparent mb-3" />
          <p className="text-xs">Loading registration form...</p>
        </div>
      }
    >
      <SignupFormContent />
    </React.Suspense>
  );
}
