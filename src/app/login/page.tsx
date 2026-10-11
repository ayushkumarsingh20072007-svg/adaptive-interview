"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sparkles, ArrowRight, Lock, Mail, AlertCircle, ArrowLeft, LogOut, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth-context";

export default function LoginPage() {
  const router = useRouter();
  const { user, refreshUser, logout } = useAuth();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError("Please provide both email and password.");
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to sign in. Please verify your credentials.");
        return;
      }

      await refreshUser();
      router.push("/dashboard");
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
              <Link href="/dashboard" className="block">
                <Button className="w-full justify-center gap-2 h-10">
                  Continue to Dashboard
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
          <div className="inline-flex items-center gap-1.5 rounded-full border border-indigo-800/60 bg-indigo-950/60 px-3 py-1 text-xs font-medium text-indigo-300">
            <Sparkles className="h-3 w-3 text-indigo-400" />
            <span>Secure Candidate Portal</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Sign In to InterviewIQ
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            Access your interview history, persistent scorecards, and tailored roadmaps.
          </p>
        </div>

        {/* Card Form */}
        <Card className="border-[#1e2d4f] bg-[#0c1222] shadow-2xl shadow-indigo-950/40">
          <CardContent className="pt-6 space-y-4">
            {error && (
              <div className="rounded-lg border border-rose-800/70 bg-rose-950/30 p-3 text-xs text-rose-300 flex items-start gap-2.5">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
                <p>{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email" required>
                  Email Address
                </Label>
                <div className="relative">
                  <Input
                    id="email"
                    type="email"
                    placeholder="candidate@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    className="pl-9"
                  />
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-500 pointer-events-none" />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" required>
                    Password
                  </Label>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    className="pl-9"
                  />
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-500 pointer-events-none" />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full gap-2 justify-center bg-indigo-600 hover:bg-indigo-500 h-10 mt-2"
                isLoading={isSubmitting}
              >
                Sign In
                <ArrowRight className="h-4 w-4" />
              </Button>
            </form>

            {/* Alternative: Guest Demo Flow */}
            <div className="pt-3 border-t border-[#1a2642] space-y-3">
              <div className="text-center">
                <span className="text-xs text-slate-400">
                  Prefer not to create an account?
                </span>
              </div>
              <Link href="/setup" className="block">
                <Button
                  variant="secondary"
                  className="w-full justify-center text-xs h-9 border-[#1e2d4f] hover:border-indigo-600/50"
                >
                  Continue as Guest (No Sign In)
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Bottom Switcher */}
        <div className="text-center text-xs text-slate-400">
          Don&apos;t have an account yet?{" "}
          <Link href="/signup" className="text-indigo-400 hover:text-indigo-300 font-semibold underline underline-offset-4">
            Create an Account
          </Link>
        </div>

        {/* Security Assurance */}
        <div className="text-center">
          <Badge variant="outline" className="text-[11px] text-slate-400 border-[#1a2642]">
            Password salted with PBKDF2 · Encrypted HTTP-only Session
          </Badge>
        </div>
      </div>
    </div>
  );
}
