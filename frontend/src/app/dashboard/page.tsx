"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Play,
  FileText,
  BrainCircuit,
  TrendingUp,
  TrendingDown,
  Sparkles,
  Award,
  CheckCircle2,
  Settings,
  History,
  Layers,
  ArrowRight,
  User,
  PlusCircle,
  Target,
  BarChart3,
  ExternalLink,
  RefreshCw,
  Clock,
  ShieldCheck,
  Zap,
  Users,
  Star,
  XCircle,
  Clock3,
  Building2,
  Filter,
  ChevronRight,
  LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/ui/status-states";
import { CandidateSetup, EvaluationReport, TargetRole } from "@/lib/types";
import { ROLE_LABELS, ROLE_SKILLS, SAMPLE_CANDIDATE } from "@/lib/mock-data";
import { getStoredSetup, getAllReports } from "@/lib/storage";
import { initializeInterviewSession } from "@/lib/interview-engine";
import { useIsMounted } from "@/lib/use-mounted";
import { useAuth } from "@/lib/auth-context";

interface CompetencyStat {
  category: string;
  avgScore: number;
  level: "Needs Focus" | "Developing" | "Proficient" | "Mastery";
  count: number;
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const userRole = (user as { role?: string } | null)?.role;
  const isRecruiter = userRole === "recruiter";
  const [activeTab, setActiveTab] = React.useState<"overview" | "history" | "skills" | "settings" | "pipeline">(
    isRecruiter ? "pipeline" : "overview"
  );

  const isMounted = useIsMounted();

  const setup: CandidateSetup = React.useMemo(() => {
    if (!isMounted) return SAMPLE_CANDIDATE;
    return getStoredSetup(user?.id) || SAMPLE_CANDIDATE;
  }, [isMounted, user?.id]);

  const reports: EvaluationReport[] = React.useMemo(() => {
    if (!isMounted) return [];
    return getAllReports(user?.id, userRole as "candidate" | "recruiter" | undefined);
  }, [isMounted, user?.id, userRole]);

  const [isStarting, setIsStarting] = React.useState(false);

  // --- PIPELINE STATE (Recruiter) ---
  const [pipelineFilter, setPipelineFilter] = React.useState<"all" | "pending" | "shortlisted" | "under-review" | "rejected">("all");
  const [pipelineShortlists, setPipelineShortlists] = React.useState<Record<string, string>>({});

  function handlePipelineStatusChange(sessionId: string, candidateName: string, status: string) {
    setPipelineShortlists((prev) => ({ ...prev, [sessionId]: status }));
    // Persist via storage
    import("@/lib/storage").then(({ updateCandidateShortlist }) => {
      updateCandidateShortlist(
        sessionId,
        candidateName,
        status as import("@/lib/types").ShortlistStatus,
        undefined,
        user?.name
      );
    });
  }

  function handleStartNewInterview(customRole?: TargetRole) {
    setIsStarting(true);
    const sessionSetup: CandidateSetup = {
      ...setup,
      targetRole: customRole || setup.targetRole,
      candidateName: user?.name || setup.candidateName || "Candidate",
      userId: user?.id,
    };
    const newSession = initializeInterviewSession(sessionSetup);
    setTimeout(() => {
      router.push(`/interview/${newSession.id}`);
    }, 200);
  }

  async function handleLogout() {
    await logout();
    router.push("/login");
  }

  // --- TRUTHFUL ANALYTICS CALCULATIONS ---
  const analytics = React.useMemo(() => {
    if (!reports || reports.length === 0) {
      return {
        completedCount: 0,
        averageScore: null as number | null,
        strongest: null as CompetencyStat | null,
        priority: null as CompetencyStat | null,
        competencies: [] as CompetencyStat[],
        scoreTrend: null as { delta: number; isUp: boolean; previous: number; latest: number } | null,
        allRecommendations: [] as string[],
      };
    }

    const completedCount = reports.length;
    const scores = reports
      .map((r) => r.overallScore)
      .filter((s) => typeof s === "number" && !isNaN(s));
    const averageScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;

    // Aggregate unique competencies across all completed reports
    const catMap = new Map<string, { total: number; count: number }>();
    for (const rep of reports) {
      for (const m of rep.metrics || []) {
        if (!m.category) continue;
        const current = catMap.get(m.category) || { total: 0, count: 0 };
        catMap.set(m.category, {
          total: current.total + m.score,
          count: current.count + 1,
        });
      }
    }

    const competencies: CompetencyStat[] = Array.from(catMap.entries())
      .map(([category, data]) => {
        const avg = Math.round(data.total / data.count);
        let level: CompetencyStat["level"] = "Proficient";
        if (avg >= 90) level = "Mastery";
        else if (avg < 75) level = "Needs Focus";
        else if (avg < 82) level = "Developing";

        return {
          category,
          avgScore: avg,
          level,
          count: data.count,
        };
      })
      .sort((a, b) => b.avgScore - a.avgScore);

    const strongest = competencies.length > 0 ? competencies[0] : null;
    const priority = competencies.length > 0 ? competencies[competencies.length - 1] : null;

    // Score trend: only calculate when multiple comparable historical evaluations exist
    let scoreTrend = null;
    if (reports.length >= 2) {
      const latest = reports[0].overallScore;
      const previous = reports[1].overallScore;
      const delta = latest - previous;
      scoreTrend = {
        delta,
        isUp: delta >= 0,
        previous,
        latest,
      };
    }

    // Extract recommendations from actual gaps & roadmaps without fabrication
    const recSet = new Set<string>();
    for (const rep of reports) {
      for (const gap of rep.areasToImprove || []) {
        if (gap && gap.trim()) recSet.add(gap.trim());
      }
      for (const road of rep.actionableRoadmap || []) {
        if (road && road.trim()) recSet.add(road.trim());
      }
    }
    const allRecommendations = Array.from(recSet).slice(0, 4);

    return {
      completedCount,
      averageScore,
      strongest,
      priority,
      competencies,
      scoreTrend,
      allRecommendations,
    };
  }, [reports]);

  const roleName = ROLE_LABELS[setup.targetRole] || "Software Engineer";
  const displayName = user?.name || setup.candidateName || "Candidate";
  const expectedSkills = ROLE_SKILLS[setup.targetRole] || [];

  return (
    <div className="flex flex-col gap-8 max-w-6xl mx-auto w-full py-2">
      {/* 1. ULTRA-PREMIUM COMMAND CENTER HEADER */}
      <div className="relative rounded-3xl border border-indigo-500/20 bg-gradient-to-r from-[#0d152a]/95 via-[#0b1021]/95 to-[#070b16]/95 backdrop-blur-2xl p-6 sm:p-8 shadow-2xl shadow-indigo-950/40 overflow-hidden">
        {/* Ambient Top Glow Line */}
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-indigo-500/60 to-transparent" />
        <div className="absolute top-0 right-1/4 w-80 h-32 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold tracking-wide bg-indigo-950/80 text-indigo-300 border border-indigo-700/40 shadow-inner">
                <Sparkles className="h-3.5 w-3.5 text-indigo-400 animate-pulse" />
                Adaptive AI Intelligence Engine
              </span>

              {user ? (
                <div className="flex items-center gap-2">
                  <Badge variant="success" className="text-[11px]">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Verified: {user.email}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleLogout}
                    className="h-6 px-2 text-[11px] text-rose-300 hover:text-white hover:bg-rose-950/40 gap-1"
                    title="Log out of account"
                  >
                    <LogOut className="h-3 w-3 text-rose-400" />
                    Log Out
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Badge variant="default" className="text-[11px]">
                    Guest Demo Sandbox
                  </Badge>
                  <Link href="/login">
                    <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px] text-indigo-300 hover:text-white hover:bg-indigo-950/40 gap-1">
                      Sign In
                    </Button>
                  </Link>
                </div>
              )}

              <span className="text-xs text-slate-400 font-mono flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                Track: {roleName}
              </span>
            </div>

            <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Welcome back, <span className="text-gradient-primary">{displayName}</span>
            </h1>

            <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
              Real-time technical interview analytics command center. Calibrate your profile, execute adaptive AI sessions, and inspect evidence-backed scorecards with quote citations.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {user && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
                className="gap-1.5 text-xs h-10 px-3.5 border-rose-900/50 text-rose-300 hover:bg-rose-950/40 hover:text-white"
                title="Log out of account"
              >
                <LogOut className="h-3.5 w-3.5 text-rose-400" />
                <span className="hidden sm:inline">Log Out</span>
              </Button>
            )}

            <Link href="/setup">
              <Button variant="secondary" size="sm" className="gap-2 text-xs h-10 px-4">
                <Settings className="h-3.5 w-3.5 text-slate-400" />
                Recalibrate Track
              </Button>
            </Link>

            {reports.length > 0 && (
              <Link href={`/report/${reports[0].sessionId}`}>
                <Button variant="outline" size="sm" className="gap-2 text-xs h-10 px-4 border-indigo-900/40 hover:border-indigo-500/50">
                  <FileText className="h-3.5 w-3.5 text-indigo-400" />
                  Latest Audit
                </Button>
              </Link>
            )}

            <Button
              size="md"
              onClick={() => handleStartNewInterview()}
              isLoading={isStarting}
              className="gap-2 font-bold shadow-xl shadow-indigo-600/25 h-10 px-5"
            >
              <Play className="h-4 w-4 fill-current" />
              Launch Live Interview
            </Button>
          </div>
        </div>
      </div>

      {/* 2. TOP 4 ANALYTICS COMMAND CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Completed Audits */}
        <Card className="p-5 relative overflow-hidden group hover:border-indigo-500/40 transition-all duration-300 hover:-translate-y-1">
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-xl pointer-events-none group-hover:bg-indigo-500/10 transition-colors" />
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-semibold uppercase tracking-wider text-[10px]">Completed Audits</span>
            <div className="h-8 w-8 rounded-xl bg-indigo-950/80 border border-indigo-800/40 flex items-center justify-center text-indigo-400">
              <FileText className="h-4 w-4" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-white mt-3 font-mono tracking-tight">
            {analytics.completedCount}
          </p>
          <div className="text-[11px] text-slate-400 mt-2 flex items-center gap-1.5">
            {analytics.completedCount > 0 ? (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-emerald-400 font-medium">Verified evaluation records</span>
              </>
            ) : (
              <span className="text-slate-500 font-mono">0 sessions logged yet</span>
            )}
          </div>
        </Card>

        {/* Card 2: Composite Score */}
        <Card className="p-5 relative overflow-hidden group hover:border-violet-500/40 transition-all duration-300 hover:-translate-y-1">
          <div className="absolute top-0 right-0 w-24 h-24 bg-violet-500/5 rounded-full blur-xl pointer-events-none group-hover:bg-violet-500/10 transition-colors" />
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-semibold uppercase tracking-wider text-[10px]">Composite Readiness</span>
            <div className="h-8 w-8 rounded-xl bg-violet-950/80 border border-violet-800/40 flex items-center justify-center text-violet-400">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-gradient-primary mt-3 font-mono tracking-tight">
            {analytics.averageScore !== null ? `${analytics.averageScore}%` : "—"}
          </p>
          <div className="text-[11px] text-slate-400 mt-2 truncate">
            {analytics.averageScore !== null ? (
              <span className={analytics.averageScore >= 88 ? "text-emerald-400 font-medium" : analytics.averageScore >= 72 ? "text-indigo-300 font-medium" : "text-amber-400 font-medium"}>
                {analytics.averageScore >= 88 ? "Strong Hire Tier" : analytics.averageScore >= 72 ? "Hire Recommendation Tier" : "Additional Review Tier"}
              </span>
            ) : (
              <span className="text-slate-500 font-mono">Benchmark pending 1st session</span>
            )}
          </div>
        </Card>

        {/* Card 3: Strongest Competency */}
        <Card className="p-5 relative overflow-hidden group hover:border-emerald-500/40 transition-all duration-300 hover:-translate-y-1">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl pointer-events-none group-hover:bg-emerald-500/10 transition-colors" />
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-semibold uppercase tracking-wider text-[10px]">Top Competency</span>
            <div className="h-8 w-8 rounded-xl bg-emerald-950/80 border border-emerald-800/40 flex items-center justify-center text-emerald-400">
              <Award className="h-4 w-4" />
            </div>
          </div>
          <p className="text-lg font-bold text-white mt-3 truncate">
            {analytics.strongest ? analytics.strongest.category : "Pending Analysis"}
          </p>
          <div className="text-[11px] text-slate-400 mt-2">
            {analytics.strongest ? (
              <span className="text-emerald-400 font-medium font-mono">
                {analytics.strongest.avgScore}% • {analytics.strongest.level}
              </span>
            ) : (
              <span className="text-slate-500 font-mono">Unlocks after 1st interview</span>
            )}
          </div>
        </Card>

        {/* Card 4: Improvement Priority */}
        <Card className="p-5 relative overflow-hidden group hover:border-amber-500/40 transition-all duration-300 hover:-translate-y-1">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-xl pointer-events-none group-hover:bg-amber-500/10 transition-colors" />
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-semibold uppercase tracking-wider text-[10px]">Improvement Focus</span>
            <div className="h-8 w-8 rounded-xl bg-amber-950/80 border border-amber-800/40 flex items-center justify-center text-amber-400">
              <Target className="h-4 w-4" />
            </div>
          </div>
          <p className="text-lg font-bold text-white mt-3 truncate">
            {analytics.priority ? analytics.priority.category : "Pending Analysis"}
          </p>
          <div className="text-[11px] text-slate-400 mt-2">
            {analytics.priority ? (
              <span className="text-amber-400 font-medium font-mono">
                {analytics.priority.avgScore}% • Priority Drill
              </span>
            ) : (
              <span className="text-slate-500 font-mono">Unlocks after 1st interview</span>
            )}
          </div>
        </Card>
      </div>

      {/* 3. SEGMENTED TABS NAVIGATION */}
      <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-[#0a0f1d]/90 border border-indigo-950/80 backdrop-blur-xl overflow-x-auto">
        <button
          onClick={() => setActiveTab("overview")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold rounded-xl transition-all whitespace-nowrap ${
            activeTab === "overview"
              ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-950/80"
              : "text-slate-400 hover:text-slate-200 hover:bg-[#131d35]/60"
          }`}
        >
          <Layers className="h-4 w-4" />
          Overview Command
        </button>

        <button
          onClick={() => setActiveTab("history")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold rounded-xl transition-all whitespace-nowrap ${
            activeTab === "history"
              ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-950/80"
              : "text-slate-400 hover:text-slate-200 hover:bg-[#131d35]/60"
          }`}
        >
          <History className="h-4 w-4" />
          Evaluation History ({reports.length})
        </button>

        <button
          onClick={() => setActiveTab("skills")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold rounded-xl transition-all whitespace-nowrap ${
            activeTab === "skills"
              ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-950/80"
              : "text-slate-400 hover:text-slate-200 hover:bg-[#131d35]/60"
          }`}
        >
          <BrainCircuit className="h-4 w-4" />
          Skills & Diagnostics
        </button>

        <button
          onClick={() => setActiveTab("settings")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold rounded-xl transition-all whitespace-nowrap ${
            activeTab === "settings"
              ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-950/80"
              : "text-slate-400 hover:text-slate-200 hover:bg-[#131d35]/60"
          }`}
        >
          <User className="h-4 w-4" />
          Profile Configuration
        </button>

        {isRecruiter && (
          <button
            onClick={() => setActiveTab("pipeline")}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold rounded-xl transition-all whitespace-nowrap ${
              activeTab === "pipeline"
                ? "bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-md shadow-violet-950/80"
                : "text-slate-400 hover:text-slate-200 hover:bg-[#131d35]/60"
            }`}
          >
            <Users className="h-4 w-4" />
            Candidate Pipeline
            <span className="ml-0.5 h-4.5 min-w-[1.125rem] rounded-full bg-violet-600/80 text-[10px] font-bold flex items-center justify-center px-1">
              {reports.length}
            </span>
          </button>
        )}
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: OVERVIEW                                                           */}
      {/* ========================================================================= */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* ZERO STATE: High Impact, Non-Fabricated First Time Command Center */}
          {reports.length === 0 ? (
            <div className="space-y-6">
              {/* Luminous Hero Onboarding Card */}
              <div className="relative rounded-3xl border border-indigo-500/30 bg-gradient-to-br from-[#10182b] via-[#0c1222] to-[#070b14] p-6 sm:p-8 overflow-hidden shadow-2xl">
                <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />

                <div className="relative flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
                  <div className="space-y-3 max-w-2xl">
                    <div className="inline-flex items-center gap-2 rounded-full border border-indigo-700/50 bg-indigo-950/70 px-3.5 py-1 text-xs text-indigo-300">
                      <Zap className="h-3.5 w-3.5 text-indigo-400" />
                      <span>Ready for Baseline Adaptive Evaluation</span>
                    </div>

                    <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                      Calibrate and Launch Your AI Interview in {roleName}
                    </h2>

                    <p className="text-sm text-slate-300 leading-relaxed">
                      Experience rigorous technical evaluation: Gemini AI asks open-ended architectural and implementation questions, dynamically analyzes your exact quotes, and builds your evidence scorecard.
                    </p>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 pt-2">
                      <span className="flex items-center gap-1.5 bg-[#141e34]/80 px-3 py-1 rounded-lg border border-[#22304e]">
                        <Clock className="h-3.5 w-3.5 text-indigo-400" />
                        {setup.interviewLength || 20} Min format (~3–4 dynamic questions)
                      </span>
                      <span className="flex items-center gap-1.5 bg-[#141e34]/80 px-3 py-1 rounded-lg border border-[#22304e]">
                        <Target className="h-3.5 w-3.5 text-indigo-400" />
                        Focus: {setup.interviewFocus.replace("-", " ").toUpperCase()}
                      </span>
                      <span className="flex items-center gap-1.5 bg-[#141e34]/80 px-3 py-1 rounded-lg border border-[#22304e]">
                        <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                        Evidence-verified citations
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row lg:flex-col gap-3 w-full lg:w-auto shrink-0">
                    <Button
                      size="lg"
                      onClick={() => handleStartNewInterview()}
                      isLoading={isStarting}
                      className="gap-2.5 font-bold shadow-xl shadow-indigo-600/30 text-sm h-12 px-7"
                    >
                      <Play className="h-4 w-4 fill-current" />
                      Start Baseline Interview
                    </Button>
                    <Link href="/report/demo-session">
                      <Button variant="outline" size="sm" className="w-full gap-2 text-xs h-10 border-indigo-900/40 hover:border-indigo-500/50">
                        <ExternalLink className="h-3.5 w-3.5 text-indigo-400" />
                        Inspect Sample Demo Report
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>

              {/* 3-Step Guided Roadmap */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="p-5.5 hover:border-indigo-500/40 transition-all duration-300">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-950/60">
                      01
                    </div>
                    <h3 className="font-bold text-white text-base">Role Calibration</h3>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Configure your engineering track, experience level, and optional resume. Questions adapt directly to your profile.
                  </p>
                </Card>

                <Card className="p-5.5 hover:border-indigo-500/40 transition-all duration-300">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-700 text-white font-bold text-xs shadow-md shadow-purple-950/60">
                      02
                    </div>
                    <h3 className="font-bold text-white text-base">Adaptive AI Inquiry</h3>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Answer real-time technical questions. Strong reasoning unlocks deeper edge cases; gaps trigger targeted conceptual follow-ups.
                  </p>
                </Card>

                <Card className="p-5.5 hover:border-indigo-500/40 transition-all duration-300">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white font-bold text-xs shadow-md shadow-emerald-950/60">
                      03
                    </div>
                    <h3 className="font-bold text-white text-base">Evidence Scorecard</h3>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Receive a synthesis with quote citations, category readiness benchmarks, hiring recommendations, and actionable roadmap steps.
                  </p>
                </Card>
              </div>

              {/* Target Competencies Preview (Honest Zero State) */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base text-white">Target Competencies for {roleName}</CardTitle>
                      <CardDescription>
                        Key subject areas evaluated during your live adaptive interview sessions.
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className="text-[11px]">0 Sessions Logged</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {expectedSkills.map((skill) => (
                      <div
                        key={skill}
                        className="flex items-center justify-between p-3.5 rounded-xl border border-[#1e2d4f] bg-[#0a0f1d] text-xs hover:border-indigo-700/50 transition-colors"
                      >
                        <span className="font-medium text-slate-200">{skill}</span>
                        <span className="text-[10px] text-slate-500 font-mono">Benchmark Pending</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            /* RETURNING CANDIDATE EXPERIENCE WITH REAL EVALUATIONS */
            <div className="space-y-6">
              {/* Quick Launch & Competency Readiness Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left: Quick Launch Card */}
                <Card className="lg:col-span-2 border-indigo-900/40 bg-gradient-to-br from-[#10182b] via-[#0c1222] to-[#070b14]">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <Badge variant="indigo" className="gap-1">
                        <Sparkles className="h-3 w-3" />
                        Next Recommended Action
                      </Badge>
                      <span className="text-xs text-slate-400 font-mono">Adaptive AI Session</span>
                    </div>
                    <CardTitle className="text-xl text-white mt-1">
                      Execute Live Technical Evaluation for {roleName}
                    </CardTitle>
                    <CardDescription>
                      Engage in real-time adaptive questioning that dynamically probes your architectural decisions, trade-offs, and failure recovery.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="rounded-xl border border-[#1e2d4f] bg-[#070b14]/70 p-4 space-y-2 text-xs">
                      <div className="flex items-center justify-between text-slate-300 font-medium">
                        <span>Session Calibration</span>
                        <span className="text-indigo-400 font-mono font-semibold">{setup.interviewFocus.replace("-", " ").toUpperCase()}</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-400">
                        <span>Format & Duration</span>
                        <span>{setup.interviewLength || 20} Minutes (~3–4 dynamic questions)</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-400">
                        <span>Engine Mode</span>
                        <span className="text-emerald-400 font-medium flex items-center gap-1">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Gemini AI Real-time Evaluation
                        </span>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                    <Button
                      onClick={() => handleStartNewInterview()}
                      isLoading={isStarting}
                      className="w-full sm:w-auto gap-2 shadow-lg shadow-indigo-600/25 font-bold h-10 px-5"
                    >
                      <Play className="h-4 w-4 fill-current" />
                      Start Live Session Now
                    </Button>
                    <Link href="/setup" className="text-xs text-slate-400 hover:text-indigo-300 transition-colors">
                      Switch Target Role or Focus →
                    </Link>
                  </CardFooter>
                </Card>

                {/* Right: Key Skills Readiness Radar */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm text-white">Competency Diagnostics</CardTitle>
                    <CardDescription>
                      Synthesized across {reports.length} verified interview evaluation{reports.length > 1 ? "s" : ""}.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3.5">
                    {analytics.competencies.slice(0, 4).map((m) => (
                      <div key={m.category} className="space-y-1.5">
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-300 font-medium truncate max-w-[170px]">{m.category}</span>
                          <span className="text-indigo-400 font-mono font-semibold">{m.avgScore}%</span>
                        </div>
                        <Progress
                          value={m.avgScore}
                          indicatorColor={m.avgScore >= 90 ? "emerald" : m.avgScore >= 82 ? "indigo" : "amber"}
                          size="sm"
                        />
                      </div>
                    ))}
                  </CardContent>
                  <CardFooter className="pt-2">
                    <button
                      onClick={() => setActiveTab("skills")}
                      className="w-full text-xs text-center text-slate-400 hover:text-indigo-300 transition-colors font-medium"
                    >
                      View Full Competency Breakdown →
                    </button>
                  </CardFooter>
                </Card>
              </div>

              {/* Score Trend (Displayed only when 2+ historical evaluations exist) */}
              {analytics.scoreTrend && (
                <Card className="p-5 hover:border-indigo-500/40 transition-all">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-white text-base">Historical Evaluation Trajectory</h3>
                        <Badge
                          variant={analytics.scoreTrend.isUp ? "success" : "default"}
                          className="font-mono text-xs gap-1"
                        >
                          {analytics.scoreTrend.isUp ? (
                            <TrendingUp className="h-3 w-3" />
                          ) : (
                            <TrendingDown className="h-3 w-3" />
                          )}
                          {analytics.scoreTrend.delta >= 0 ? `+${analytics.scoreTrend.delta}%` : `${analytics.scoreTrend.delta}%`} vs previous
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-400">
                        Score progression comparison across consecutive evaluation sessions.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-1">
                    {reports.slice(0, 4).map((r, i) => (
                      <div
                        key={r.sessionId}
                        className="p-4 rounded-xl border border-[#1e2d4f] bg-[#0a0f1d] space-y-2 hover:border-indigo-700/50 transition-all"
                      >
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-400 font-mono text-[10px]">
                            {i === 0 ? "Latest Session" : `Session -${i}`}
                          </span>
                          <span className="font-bold text-indigo-300 font-mono text-base">
                            {r.overallScore}%
                          </span>
                        </div>
                        <p className="text-xs font-semibold text-white truncate">{r.targetRole}</p>
                        <p className="text-[10px] text-slate-500 font-mono">{r.completedAt}</p>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* Single Evaluation Note */}
              {reports.length === 1 && (
                <div className="rounded-2xl border border-indigo-900/40 bg-gradient-to-r from-indigo-950/40 via-[#0c1222] to-[#070b14] p-4.5 text-xs text-slate-300 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-indigo-950 flex items-center justify-center text-indigo-400 border border-indigo-800/60 shrink-0">
                      <BarChart3 className="h-4 w-4" />
                    </div>
                    <span>
                      <strong>1 Evaluation Recorded:</strong> Complete a second interview to unlock historical score progression trends and trajectory comparison.
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handleStartNewInterview()}
                    className="shrink-0 text-xs gap-1.5"
                  >
                    <PlusCircle className="h-3.5 w-3.5" />
                    Take 2nd Interview
                  </Button>
                </div>
              )}

              {/* Recent Completed Evaluations Preview */}
              <div className="space-y-3.5">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Recent Completed Evaluations
                  </h2>
                  <button
                    onClick={() => setActiveTab("history")}
                    className="text-xs text-indigo-400 hover:text-indigo-300 font-medium"
                  >
                    View all ({reports.length}) →
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {reports.slice(0, 2).map((rep) => (
                    <Card
                      key={rep.sessionId}
                      className="hover:border-indigo-600/50 transition-all bg-[#0f172a]/95 hover:-translate-y-0.5"
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <Badge variant={rep.overallScore >= 88 ? "success" : rep.overallScore >= 72 ? "indigo" : "default"}>
                            {rep.overallScore}% Score • {rep.verdict}
                          </Badge>
                          <span className="text-xs text-slate-400 font-mono">
                            {rep.completedAt}
                          </span>
                        </div>
                        <CardTitle className="text-base text-white mt-1">
                          {rep.targetRole}
                        </CardTitle>
                        <CardDescription>
                          {rep.answerRecords.length} questions evaluated • {rep.durationMinutes} min session
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="text-xs text-slate-300">
                        <p className="line-clamp-2 text-slate-400">
                          <strong className="text-emerald-400 font-medium">Demonstrated: </strong>
                          {rep.strengths[0] || "Solid architectural grasp"}
                        </p>
                      </CardContent>
                      <CardFooter className="pt-2">
                        <Link href={`/report/${rep.sessionId}`} className="w-full">
                          <Button variant="outline" size="sm" className="w-full gap-2 text-xs border-indigo-900/40 hover:border-indigo-500/60">
                            Inspect Verified Report
                            <ArrowRight className="h-3.5 w-3.5" />
                          </Button>
                        </Link>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 4. SCORING SCALE EXPLANATION (Standardized Evaluation Rubric) */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-indigo-400" />
                <CardTitle className="text-sm text-white">Evaluation Scale & Hiring Rubric Standards</CardTitle>
              </div>
              <CardDescription>
                How InterviewIQ synthesizes candidate scores against industry engineering benchmarks.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 text-xs">
                <div className="p-4 rounded-xl border border-emerald-800/40 bg-emerald-950/20 space-y-1.5 hover:border-emerald-700/60 transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-emerald-300 text-sm">88% – 100%</span>
                    <Badge variant="success" className="text-[10px]">Strong Hire</Badge>
                  </div>
                  <p className="text-slate-200 font-semibold">Mastery & Architecture</p>
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    Proactively addresses trade-offs, concurrency bottlenecks, and failure edge cases with precise technical terminology.
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-indigo-800/40 bg-indigo-950/20 space-y-1.5 hover:border-indigo-700/60 transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-indigo-300 text-sm">72% – 87%</span>
                    <Badge variant="indigo" className="text-[10px]">Hire Recommendation</Badge>
                  </div>
                  <p className="text-slate-200 font-semibold">Proficient & Practical</p>
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    Solid implementation ability and clear conceptual grasp; minor gaps in scalability extremes or recovery degradation.
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-amber-800/40 bg-amber-950/20 space-y-1.5 hover:border-amber-700/60 transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-amber-300 text-sm">Below 72%</span>
                    <Badge variant="default" className="text-[10px]">Additional Review</Badge>
                  </div>
                  <p className="text-slate-200 font-semibold">Foundational Review</p>
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    Answers lack depth or miss essential core keywords; targeted practice recommended to solidify fundamental patterns.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: INTERVIEW HISTORY                                                  */}
      {/* ========================================================================= */}
      {activeTab === "history" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white">
                Evaluation Archives & Audit Logs
              </h2>
              <p className="text-xs text-slate-400">
                All completed sessions stored locally in this browser account.
              </p>
            </div>
            <Button size="sm" onClick={() => handleStartNewInterview()} className="gap-2">
              <PlusCircle className="h-4 w-4" />
              New Interview
            </Button>
          </div>

          {reports.length === 0 ? (
            <EmptyState
              title="No interview sessions recorded yet"
              description="Launch your first adaptive technical session to populate your evaluation history."
              actionLabel="Launch First Interview"
              onAction={() => handleStartNewInterview()}
            />
          ) : (
            <div className="space-y-3">
              {reports.map((rep) => (
                <Card
                  key={rep.sessionId}
                  className="hover:border-indigo-700/60 transition-colors"
                >
                  <div className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="space-y-1.5 max-w-2xl">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-white text-base">
                          {rep.targetRole}
                        </span>
                        <Badge variant={rep.overallScore >= 88 ? "success" : rep.overallScore >= 72 ? "indigo" : "default"}>
                          {rep.overallScore}% Score • {rep.verdict}
                        </Badge>
                        <span className="text-xs text-slate-400 font-mono">
                          Ref: {rep.sessionId}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">
                        Completed on {rep.completedAt} • {rep.durationMinutes} min session • {rep.answerRecords.length} questions evaluated
                      </p>
                      {rep.strengths && rep.strengths[0] && (
                        <p className="text-xs text-slate-300">
                          <span className="text-emerald-400 font-medium">Demonstrated: </span>
                          {rep.strengths[0]}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                      <Link href={`/report/${rep.sessionId}`} className="w-full sm:w-auto">
                        <Button size="sm" variant="secondary" className="gap-2 w-full text-xs">
                          <FileText className="h-4 w-4 text-indigo-400" />
                          View Full Report
                        </Button>
                      </Link>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleStartNewInterview(rep.targetRole as TargetRole)}
                        className="gap-1.5 text-xs border-indigo-900/40 hover:border-indigo-600/60"
                      >
                        <RefreshCw className="h-3.5 w-3.5 text-slate-400" />
                        Retake
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: SKILLS & READINESS                                                 */}
      {/* ========================================================================= */}
      {activeTab === "skills" && (
        <div className="space-y-6">
          {reports.length === 0 ? (
            <Card className="p-8 text-center space-y-4">
              <div className="h-12 w-12 rounded-2xl bg-indigo-950/70 border border-indigo-800/40 flex items-center justify-center text-indigo-400 mx-auto">
                <BrainCircuit className="h-6 w-6" />
              </div>
              <div className="space-y-1 max-w-md mx-auto">
                <h3 className="text-base font-bold text-white">Competency Diagnostics Pending</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Granular skill analytics and targeted learning roadmaps are synthesized from your actual responses during live interviews. Complete an interview to unlock this data.
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => handleStartNewInterview()}
                className="gap-2"
              >
                <Play className="h-3.5 w-3.5 fill-current" />
                Start Calibration Interview
              </Button>
            </Card>
          ) : (
            <>
              {/* Competency Grid */}
              <Card>
                <CardHeader>
                  <CardTitle>Skill Matrix & Proficiency Diagnostics</CardTitle>
                  <CardDescription>
                    Granular competencies calibrated against your actual answers across {reports.length} evaluation session{reports.length > 1 ? "s" : ""}.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {analytics.competencies.map((metric) => (
                      <div
                        key={metric.category}
                        className="space-y-2 p-4.5 rounded-2xl border border-[#1e2d4f] bg-[#0a0f1d] hover:border-indigo-700/50 transition-colors"
                      >
                        <div className="flex justify-between items-center text-sm">
                          <span className="font-bold text-white truncate max-w-[200px]">
                            {metric.category}
                          </span>
                          <Badge
                            variant={metric.avgScore >= 90 ? "success" : metric.avgScore >= 82 ? "indigo" : "default"}
                          >
                            {metric.level} • {metric.avgScore}%
                          </Badge>
                        </div>
                        <Progress
                          value={metric.avgScore}
                          indicatorColor={metric.avgScore >= 90 ? "emerald" : metric.avgScore >= 82 ? "indigo" : "amber"}
                          size="md"
                        />
                        <p className="text-[11px] text-slate-400 pt-1">
                          Evaluated across {metric.count} turn{metric.count > 1 ? "s" : ""} with keyword alignment.
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* 5. PERSONALIZED PRACTICE RECOMMENDATIONS */}
                  {analytics.allRecommendations.length > 0 && (
                    <div className="rounded-2xl border border-indigo-800/40 bg-indigo-950/20 p-5.5 space-y-3.5">
                      <div className="flex items-center gap-2 text-indigo-300 font-bold text-sm">
                        <Award className="h-4.5 w-4.5 text-indigo-400" />
                        <span>Data-Backed Practice Recommendations</span>
                      </div>
                      <p className="text-xs text-slate-400">
                        Derived from actual evaluation gaps identified in your recent interview reports:
                      </p>
                      <div className="space-y-2.5">
                        {analytics.allRecommendations.map((item, idx) => (
                          <div
                            key={idx}
                            className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-[#1e2d4f] bg-[#0a0f1d] text-xs hover:border-indigo-700/50 transition-colors"
                          >
                            <span className="text-slate-200 leading-relaxed font-medium">
                              • {item}
                            </span>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleStartNewInterview()}
                              className="shrink-0 text-xs h-8 border-indigo-900/50 hover:border-indigo-500/60"
                            >
                              Practice Drill →
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: PROFILE SETTINGS                                                   */}
      {/* ========================================================================= */}
      {activeTab === "settings" && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Candidate Profile & Calibration Settings</CardTitle>
              <CardDescription>
                Active session configuration and ingested resume profile metadata.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-[#1e2d4f] bg-[#0a0f1d]">
                  <span className="text-slate-400 block mb-1 font-medium">Candidate Name</span>
                  <span className="font-bold text-white text-sm">
                    {setup.candidateName || (user ? user.name : "Candidate")}
                  </span>
                </div>
                <div className="p-4 rounded-xl border border-[#1e2d4f] bg-[#0a0f1d]">
                  <span className="text-slate-400 block mb-1 font-medium">Target Role</span>
                  <span className="font-bold text-indigo-300 text-sm">
                    {roleName}
                  </span>
                </div>
                <div className="p-4 rounded-xl border border-[#1e2d4f] bg-[#0a0f1d]">
                  <span className="text-slate-400 block mb-1 font-medium">Seniority Calibration</span>
                  <span className="font-bold text-white text-sm capitalize">
                    {setup.experienceLevel} Level
                  </span>
                </div>
                <div className="p-4 rounded-xl border border-[#1e2d4f] bg-[#0a0f1d]">
                  <span className="text-slate-400 block mb-1 font-medium">Resume File</span>
                  <span className="font-bold text-white text-sm truncate block">
                    {setup.resumeFileName || "Default Candidate Profile"}
                  </span>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Link href="/setup">
                <Button size="sm" variant="secondary" className="gap-2">
                  <Settings className="h-4 w-4" />
                  Modify Calibration in Setup
                </Button>
              </Link>
            </CardFooter>
          </Card>

          {/* Account & Session Card */}
          <Card className="border-[#1e2d4f]">
            <CardHeader>
              <CardTitle>Account & Authentication Session</CardTitle>
              <CardDescription>
                Manage your credentials and active session state.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              {user ? (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-indigo-950/60 bg-[#0a0f1d]">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-sm">{user.name}</span>
                      <Badge variant="indigo" className="text-[10px] capitalize">{user.role}</Badge>
                    </div>
                    <p className="text-slate-400 font-mono">{user.email}</p>
                    <p className="text-[11px] text-emerald-400 flex items-center gap-1 mt-1">
                      <CheckCircle2 className="h-3 w-3" /> Secure session cookie active
                    </p>
                  </div>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={handleLogout}
                    className="gap-2 text-xs shrink-0 self-start sm:self-auto"
                  >
                    <LogOut className="h-4 w-4" />
                    Log Out of Account
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-[#1e2d4f] bg-[#0a0f1d]">
                  <div className="space-y-1">
                    <p className="font-semibold text-white text-sm">Guest Sandbox Mode</p>
                    <p className="text-slate-400">
                      You are using a browser-local demo session. Sign in to permanently link evaluation reports.
                    </p>
                  </div>
                  <Link href="/login" className="shrink-0">
                    <Button size="sm" className="gap-2 text-xs">
                      Sign In / Register
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: RECRUITER CANDIDATE PIPELINE                                       */}
      {/* ========================================================================= */}
      {activeTab === "pipeline" && isRecruiter && (() => {
        const statusMeta: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
          shortlisted:   { label: "Shortlisted",    color: "text-emerald-400", icon: <Star className="h-3.5 w-3.5" /> },
          "under-review": { label: "Under Review",   color: "text-amber-400",   icon: <Clock3 className="h-3.5 w-3.5" /> },
          rejected:      { label: "Rejected",       color: "text-rose-400",    icon: <XCircle className="h-3.5 w-3.5" /> },
          pending:       { label: "Pending Review",  color: "text-slate-400",   icon: <Building2 className="h-3.5 w-3.5" /> },
        };

        const filteredReports = reports.filter((rep) => {
          const effectiveStatus = pipelineShortlists[rep.sessionId] ?? rep.shortlistStatus ?? "pending";
          return pipelineFilter === "all" || effectiveStatus === pipelineFilter;
        });

        const pipelineCounts = {
          all: reports.length,
          shortlisted: reports.filter((r) => (pipelineShortlists[r.sessionId] ?? r.shortlistStatus ?? "pending") === "shortlisted").length,
          "under-review": reports.filter((r) => (pipelineShortlists[r.sessionId] ?? r.shortlistStatus ?? "pending") === "under-review").length,
          rejected: reports.filter((r) => (pipelineShortlists[r.sessionId] ?? r.shortlistStatus ?? "pending") === "rejected").length,
          pending: reports.filter((r) => (pipelineShortlists[r.sessionId] ?? r.shortlistStatus ?? "pending") === "pending").length,
        };

        return (
          <div className="space-y-6">
            {/* Pipeline Header */}
            <div className="relative rounded-3xl border border-violet-500/20 bg-gradient-to-r from-[#0d0e24]/95 via-[#0b0c21]/95 to-[#070814]/95 backdrop-blur-2xl p-6 sm:p-8 shadow-2xl shadow-violet-950/30 overflow-hidden">
              <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-violet-500/50 to-transparent" />
              <div className="absolute top-0 right-1/4 w-80 h-32 bg-violet-500/8 rounded-full blur-3xl pointer-events-none" />
              <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-5">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold tracking-wide bg-violet-950/80 text-violet-300 border border-violet-700/40 shadow-inner">
                      <Users className="h-3.5 w-3.5 text-violet-400" />
                      Talent Acquisition Pipeline
                    </span>
                    {user?.name && (
                      <Badge variant="success" className="text-[11px]">
                        <ShieldCheck className="h-3 w-3 mr-1" />
                        {user.name}
                      </Badge>
                    )}
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                    Candidate Evaluation Pipeline
                  </h2>
                  <p className="text-sm text-slate-300 max-w-xl leading-relaxed">
                    Review AI-verified evaluation reports, manage shortlist decisions, and track candidate readiness across all completed interview sessions.
                  </p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0">
                  {(["shortlisted", "under-review", "pending", "rejected"] as const).map((s) => (
                    <div key={s} className="rounded-xl border border-[#1e2d4f] bg-[#0a0f1d] p-3 text-center">
                      <p className={`text-xl font-extrabold font-mono ${statusMeta[s].color}`}>{pipelineCounts[s]}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5 capitalize">{statusMeta[s].label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Pipeline Filter Bar */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="flex items-center gap-1.5 text-xs text-slate-400 font-medium mr-1">
                <Filter className="h-3.5 w-3.5" /> Filter:
              </span>
              {(["all", "shortlisted", "under-review", "pending", "rejected"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setPipelineFilter(f)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    pipelineFilter === f
                      ? "bg-violet-600 text-white border-violet-500 shadow-md"
                      : "bg-[#0a0f1d] text-slate-400 border-[#1e2d4f] hover:border-violet-700/50 hover:text-slate-200"
                  }`}
                >
                  {f !== "all" && statusMeta[f].icon}
                  {f === "all" ? `All (${pipelineCounts.all})` : `${statusMeta[f].label} (${pipelineCounts[f]})`}
                </button>
              ))}
            </div>

            {/* Candidate Cards */}
            {filteredReports.length === 0 ? (
              <Card className="p-10 text-center">
                <div className="h-12 w-12 rounded-2xl bg-violet-950/70 border border-violet-800/40 flex items-center justify-center text-violet-400 mx-auto mb-4">
                  <Users className="h-6 w-6" />
                </div>
                <h3 className="text-base font-bold text-white mb-1">No candidates in this filter</h3>
                <p className="text-xs text-slate-400">Change the filter above to see other pipeline stages.</p>
              </Card>
            ) : (
              <div className="space-y-3">
                {filteredReports.map((rep) => {
                  const effectiveStatus = (pipelineShortlists[rep.sessionId] ?? rep.shortlistStatus ?? "pending") as string;
                  const meta = statusMeta[effectiveStatus] ?? statusMeta["pending"];
                  const verdictColor = rep.overallScore >= 88 ? "text-emerald-400" : rep.overallScore >= 72 ? "text-indigo-400" : "text-amber-400";

                  return (
                    <Card key={rep.sessionId} className="hover:border-violet-700/60 transition-all bg-[#0c1120]/95">
                      <div className="p-5">
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                          {/* Left: Candidate Info */}
                          <div className="flex items-start gap-4 flex-1 min-w-0">
                            <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-violet-600/30 to-indigo-700/30 border border-violet-800/40 flex items-center justify-center text-violet-300 font-bold text-lg shrink-0">
                              {rep.candidateName.charAt(0)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2 mb-1">
                                <span className="font-bold text-white text-base">{rep.candidateName}</span>
                                <Badge variant={rep.overallScore >= 88 ? "success" : rep.overallScore >= 72 ? "indigo" : "default"} className="text-[11px]">
                                  {rep.overallScore}% Score
                                </Badge>
                                <span className={`flex items-center gap-1 text-[11px] font-medium ${meta.color}`}>
                                  {meta.icon} {meta.label}
                                </span>
                              </div>
                              <p className="text-xs text-slate-400">
                                {rep.targetRole} • {rep.experienceLevel} • {rep.durationMinutes} min • {rep.completedAt}
                              </p>
                              <p className={`text-xs mt-1 font-medium ${verdictColor}`}>
                                {rep.verdict}
                              </p>
                              {rep.metrics.slice(0, 3).length > 0 && (
                                <div className="flex flex-wrap gap-2 mt-2">
                                  {rep.metrics.slice(0, 3).map((m) => (
                                    <span key={m.category} className="inline-flex items-center gap-1 text-[10px] bg-[#0a0f1d] border border-[#1e2d4f] rounded-md px-2 py-0.5 text-slate-300 font-medium">
                                      {m.category}: <span className="text-indigo-400 font-mono">{m.score}%</span>
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Right: Actions */}
                          <div className="flex flex-col sm:flex-row lg:flex-col xl:flex-row items-start sm:items-center gap-3 shrink-0">
                            {/* Status Selector */}
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {(["shortlisted", "under-review", "pending", "rejected"] as const).map((s) => (
                                <button
                                  key={s}
                                  title={statusMeta[s].label}
                                  onClick={() => handlePipelineStatusChange(rep.sessionId, rep.candidateName, s)}
                                  className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold border transition-all ${
                                    effectiveStatus === s
                                      ? s === "shortlisted" ? "bg-emerald-600 text-white border-emerald-500"
                                        : s === "under-review" ? "bg-amber-600 text-white border-amber-500"
                                        : s === "rejected" ? "bg-rose-700 text-white border-rose-500"
                                        : "bg-slate-700 text-white border-slate-500"
                                      : "bg-[#0a0f1d] text-slate-400 border-[#1e2d4f] hover:text-slate-200 hover:border-violet-700/50"
                                  }`}
                                >
                                  <span className={effectiveStatus === s ? "" : statusMeta[s].color}>
                                    {statusMeta[s].icon}
                                  </span>
                                  <span className="hidden sm:inline">{statusMeta[s].label}</span>
                                </button>
                              ))}
                            </div>
                            <Link href={`/report/${rep.sessionId}`}>
                              <Button size="sm" variant="secondary" className="gap-1.5 text-xs whitespace-nowrap h-8">
                                <FileText className="h-3.5 w-3.5 text-indigo-400" />
                                Full Report
                                <ChevronRight className="h-3 w-3 text-slate-500" />
                              </Button>
                            </Link>
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}

            {/* Pipeline Footer Note */}
            <p className="text-[11px] text-center text-slate-500">
              Shortlist decisions are saved locally and reflected in candidate reports. Evaluated by InterviewIQ Gemini AI Engine.
            </p>
          </div>
        );
      })()}
    </div>
  );
}
