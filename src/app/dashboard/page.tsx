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
  const { user } = useAuth();
  const [activeTab, setActiveTab] = React.useState<"overview" | "history" | "skills" | "settings">("overview");

  const isMounted = useIsMounted();

  const setup: CandidateSetup = React.useMemo(() => {
    if (!isMounted) return SAMPLE_CANDIDATE;
    return getStoredSetup(user?.id) || SAMPLE_CANDIDATE;
  }, [isMounted, user?.id]);

  const reports: EvaluationReport[] = React.useMemo(() => {
    if (!isMounted) return [];
    return getAllReports(user?.id);
  }, [isMounted, user?.id]);

  const [isStarting, setIsStarting] = React.useState(false);

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
    <div className="flex flex-col gap-8 max-w-6xl mx-auto w-full py-4">
      {/* 1. WELCOME HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1e2d4f] pb-5">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <Badge variant="indigo" className="font-semibold tracking-wide">Command Center</Badge>
            {user ? (
              <Badge variant="success" className="text-[10px]">Account: {user.email}</Badge>
            ) : (
              <Badge variant="default" className="text-[10px]">Guest Demo Mode</Badge>
            )}
            <span className="text-xs text-slate-400 font-mono">
              Track: {roleName}
            </span>
            <span className="text-xs text-slate-500">•</span>
            <span className="text-xs text-slate-400 capitalize">
              {setup.experienceLevel} Level
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Welcome back, {displayName}
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            AI interview performance analytics, evidence-backed evaluation scorecards, and calibrated competency diagnostics.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link href="/setup">
            <Button variant="secondary" size="sm" className="gap-1.5 text-xs">
              <Settings className="h-3.5 w-3.5 text-slate-400" />
              Recalibrate Profile
            </Button>
          </Link>

          {reports.length > 0 && (
            <Link href={`/report/${reports[0].sessionId}`}>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs border-[#22304e] hover:border-indigo-600/60">
                <FileText className="h-3.5 w-3.5 text-indigo-400" />
                Latest Report
              </Button>
            </Link>
          )}

          <Button
            size="sm"
            onClick={() => handleStartNewInterview()}
            isLoading={isStarting}
            className="gap-2 shadow-md shadow-indigo-950/70 font-semibold"
          >
            <Play className="h-3.5 w-3.5 fill-current" />
            Start New Interview
          </Button>
        </div>
      </div>

      {/* 2. ANALYTICS CARDS (Top Command Center Metrics) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Completed Interviews */}
        <Card className="p-4.5 bg-[#10182b] border-[#1e2d4f] hover:border-indigo-900/60 transition-colors">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-medium">Completed Audits</span>
            <FileText className="h-4 w-4 text-indigo-400" />
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-white mt-2 font-mono">
            {analytics.completedCount}
          </p>
          <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1.5">
            {analytics.completedCount > 0 ? (
              <>
                <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                <span className="text-emerald-400 font-medium">Verified evaluation records</span>
              </>
            ) : (
              <span className="text-slate-500">Awaiting initial evaluation</span>
            )}
          </p>
        </Card>

        {/* Card 2: Average Score */}
        <Card className="p-4.5 bg-[#10182b] border-[#1e2d4f] hover:border-indigo-900/60 transition-colors">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-medium">Composite Readiness</span>
            <TrendingUp className="h-4 w-4 text-indigo-400" />
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-indigo-300 mt-2 font-mono">
            {analytics.averageScore !== null ? `${analytics.averageScore}%` : "—"}
          </p>
          <p className="text-[11px] text-slate-400 mt-1 truncate">
            {analytics.averageScore !== null
              ? analytics.averageScore >= 88
                ? "Strong Hire Recommendation Range"
                : analytics.averageScore >= 72
                ? "Hire Recommendation Range"
                : "Additional Review Recommended"
              : "No evaluations recorded yet"}
          </p>
        </Card>

        {/* Card 3: Strongest Competency */}
        <Card className="p-4.5 bg-[#10182b] border-[#1e2d4f] hover:border-indigo-900/60 transition-colors">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-medium">Strongest Competency</span>
            <Award className="h-4 w-4 text-emerald-400" />
          </div>
          <p className="text-base sm:text-lg font-bold text-white mt-2 truncate">
            {analytics.strongest ? analytics.strongest.category : "Pending Analysis"}
          </p>
          <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
            {analytics.strongest ? (
              <span className="text-emerald-400 font-medium font-mono">
                {analytics.strongest.avgScore}% • {analytics.strongest.level}
              </span>
            ) : (
              <span className="text-slate-500">Unlocks after first evaluation</span>
            )}
          </p>
        </Card>

        {/* Card 4: Improvement Priority */}
        <Card className="p-4.5 bg-[#10182b] border-[#1e2d4f] hover:border-indigo-900/60 transition-colors">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-medium">Improvement Priority</span>
            <Target className="h-4 w-4 text-amber-400" />
          </div>
          <p className="text-base sm:text-lg font-bold text-white mt-2 truncate">
            {analytics.priority ? analytics.priority.category : "Pending Analysis"}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            {analytics.priority ? (
              <span className="text-amber-400 font-medium font-mono">
                {analytics.priority.avgScore}% • Calibrated Target
              </span>
            ) : (
              <span className="text-slate-500">Unlocks after first evaluation</span>
            )}
          </p>
        </Card>
      </div>

      {/* DASHBOARD SUB-NAVIGATION TABS */}
      <div className="flex items-center gap-1 border-b border-[#1e2d4f] pb-1 overflow-x-auto">
        <button
          onClick={() => setActiveTab("overview")}
          className={`flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
            activeTab === "overview"
              ? "bg-[#162244] text-indigo-300 border border-indigo-700/50"
              : "text-slate-400 hover:text-slate-200 hover:bg-[#141e34]"
          }`}
        >
          <Layers className="h-4 w-4" />
          Overview
        </button>

        <button
          onClick={() => setActiveTab("history")}
          className={`flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
            activeTab === "history"
              ? "bg-[#162244] text-indigo-300 border border-indigo-700/50"
              : "text-slate-400 hover:text-slate-200 hover:bg-[#141e34]"
          }`}
        >
          <History className="h-4 w-4" />
          Interview History ({reports.length})
        </button>

        <button
          onClick={() => setActiveTab("skills")}
          className={`flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
            activeTab === "skills"
              ? "bg-[#162244] text-indigo-300 border border-indigo-700/50"
              : "text-slate-400 hover:text-slate-200 hover:bg-[#141e34]"
          }`}
        >
          <BrainCircuit className="h-4 w-4" />
          Skills & Readiness
        </button>

        <button
          onClick={() => setActiveTab("settings")}
          className={`flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
            activeTab === "settings"
              ? "bg-[#162244] text-indigo-300 border border-indigo-700/50"
              : "text-slate-400 hover:text-slate-200 hover:bg-[#141e34]"
          }`}
        >
          <User className="h-4 w-4" />
          Profile Configuration
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: OVERVIEW                                                           */}
      {/* ========================================================================= */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* ZERO STATE (First-time Candidate Experience) */}
          {reports.length === 0 ? (
            <div className="space-y-6">
              {/* First-Time Hero Onboarding Card */}
              <Card className="border-indigo-900/50 bg-gradient-to-br from-[#10182b] via-[#0d1527] to-[#070b14] p-6 sm:p-8">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                  <div className="space-y-3 max-w-2xl">
                    <div className="inline-flex items-center gap-2 rounded-full border border-indigo-800/60 bg-indigo-950/60 px-3 py-1 text-xs text-indigo-300">
                      <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
                      <span>Ready for Initial Evaluation</span>
                    </div>
                    <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                      Launch Your Baseline AI Interview in {roleName}
                    </h2>
                    <p className="text-sm text-slate-300 leading-relaxed">
                      Your command center is configured and ready. Experience live adaptive technical inquiry: the AI evaluates your exact answers, asks dynamic architectural follow-ups, and produces an evidence-backed scorecard.
                    </p>
                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 pt-1">
                      <span className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-indigo-400" />
                        {setup.interviewLength || 20} Minutes duration
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Target className="h-3.5 w-3.5 text-indigo-400" />
                        Focus: {setup.interviewFocus.replace("-", " ").toUpperCase()}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                        Evidence-verified audit
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row md:flex-col gap-3 w-full md:w-auto shrink-0">
                    <Button
                      size="lg"
                      onClick={() => handleStartNewInterview()}
                      isLoading={isStarting}
                      className="gap-2 shadow-lg shadow-indigo-950/80 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 font-semibold"
                    >
                      <Play className="h-4 w-4 fill-current" />
                      Start Baseline Interview
                    </Button>
                    <Link href="/report/demo-session">
                      <Button variant="outline" size="sm" className="w-full gap-2 text-xs border-[#22304e] hover:border-indigo-600/60">
                        <ExternalLink className="h-3.5 w-3.5 text-indigo-400" />
                        Inspect Sample Demo Report
                      </Button>
                    </Link>
                  </div>
                </div>
              </Card>

              {/* 3-Step Guided Roadmap */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="p-5 bg-[#10182b] border-[#1e2d4f]">
                  <div className="flex items-center gap-3 mb-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-950/70 border border-indigo-800/50 text-indigo-300 font-bold text-xs">
                      01
                    </div>
                    <h3 className="font-semibold text-white text-sm">Role Calibration</h3>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Set your engineering track, difficulty tier, and interview focus. Upload an optional resume to guide question context.
                  </p>
                </Card>

                <Card className="p-5 bg-[#10182b] border-[#1e2d4f]">
                  <div className="flex items-center gap-3 mb-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-950/70 border border-indigo-800/50 text-indigo-300 font-bold text-xs">
                      02
                    </div>
                    <h3 className="font-semibold text-white text-sm">Adaptive AI Inquiry</h3>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Answer real-time technical questions. Strong reasoning unlocks deeper edge cases; gaps trigger targeted conceptual follow-ups.
                  </p>
                </Card>

                <Card className="p-5 bg-[#10182b] border-[#1e2d4f]">
                  <div className="flex items-center gap-3 mb-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-950/70 border border-indigo-800/50 text-indigo-300 font-bold text-xs">
                      03
                    </div>
                    <h3 className="font-semibold text-white text-sm">Evidence Scorecard</h3>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Receive a synthesis with quote citations, category readiness benchmarks, hiring recommendations, and actionable roadmap steps.
                  </p>
                </Card>
              </div>

              {/* Competency Readiness Outline (Honest Zero State) */}
              <Card className="bg-[#10182b] border-[#1e2d4f]">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base text-white">Target Competencies for {roleName}</CardTitle>
                      <CardDescription>
                        Key subject areas evaluated during your interview sessions.
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
                        className="flex items-center justify-between p-3 rounded-lg border border-[#1e2d4f] bg-[#0c1222] text-xs"
                      >
                        <span className="font-medium text-slate-300">{skill}</span>
                        <span className="text-[10px] text-slate-500 font-mono">Benchmark Pending</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            /* RETURNING CANDIDATE WITH REAL EVALUATION RECORDS */
            <div className="space-y-6">
              {/* Quick Launch & Competency Readiness Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left: Quick Launch Next Action */}
                <Card className="lg:col-span-2 border-indigo-900/40 bg-gradient-to-br from-[#10182b] to-[#0c1222]">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <Badge variant="indigo">Next Recommended Action</Badge>
                      <span className="text-xs text-slate-400 font-mono">Adaptive AI Session</span>
                    </div>
                    <CardTitle className="text-lg text-white">
                      Execute Live Technical Evaluation for {roleName}
                    </CardTitle>
                    <CardDescription>
                      Engage in real-time adaptive questioning that automatically follows up on your architectural decisions, trade-offs, and code depth.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="rounded-lg border border-[#1e2d4f] bg-[#070b14]/60 p-4 space-y-2 text-xs">
                      <div className="flex items-center justify-between text-slate-300 font-medium">
                        <span>Session Focus</span>
                        <span className="text-indigo-400 font-mono">{setup.interviewFocus.replace("-", " ").toUpperCase()}</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-400">
                        <span>Format & Duration</span>
                        <span>{setup.interviewLength || 20} Minutes (~3–4 dynamic questions)</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-400">
                        <span>Engine Mode</span>
                        <span className="text-emerald-400 font-medium">Gemini AI Adaptive Simulation</span>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                    <Button
                      onClick={() => handleStartNewInterview()}
                      isLoading={isStarting}
                      className="w-full sm:w-auto gap-2 shadow-lg shadow-indigo-950/60 font-semibold"
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
                <Card className="bg-[#10182b]">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm text-white">Competency Diagnostics</CardTitle>
                    <CardDescription>
                      Synthesized across {reports.length} verified interview evaluations.
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
                      className="w-full text-xs text-center text-slate-400 hover:text-indigo-300 transition-colors"
                    >
                      View Full Competency Breakdown →
                    </button>
                  </CardFooter>
                </Card>
              </div>

              {/* Score Trend (Displayed only when 2+ historical evaluations exist) */}
              {analytics.scoreTrend && (
                <Card className="bg-[#10182b] border-[#1e2d4f] p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-white text-base">Historical Evaluation Trajectory</h3>
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
                        className="p-3.5 rounded-lg border border-[#1e2d4f] bg-[#0c1222] space-y-1.5"
                      >
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-400 font-mono text-[10px]">
                            {i === 0 ? "Latest Session" : `Session -${i}`}
                          </span>
                          <span className="font-bold text-indigo-300 font-mono text-sm">
                            {r.overallScore}%
                          </span>
                        </div>
                        <p className="text-xs font-medium text-white truncate">{r.targetRole}</p>
                        <p className="text-[10px] text-slate-500">{r.completedAt}</p>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* Single Evaluation Note */}
              {reports.length === 1 && (
                <div className="rounded-xl border border-[#1e2d4f] bg-[#0c1222] p-4 text-xs text-slate-400 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2.5">
                    <BarChart3 className="h-4 w-4 text-indigo-400 shrink-0" />
                    <span>
                      <strong>1 Evaluation Recorded:</strong> Complete a second interview to unlock historical score progression trends and trajectory comparison.
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handleStartNewInterview()}
                    className="shrink-0 text-xs gap-1"
                  >
                    Take 2nd Interview
                  </Button>
                </div>
              )}

              {/* Recent Completed Evaluations Preview */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
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
                      className="hover:border-indigo-800/60 transition-colors bg-[#10182b]"
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
                          <Button variant="outline" size="sm" className="w-full gap-2 text-xs border-[#22304e] hover:border-indigo-600/60">
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

          {/* 3. SCORING SCALE EXPLANATION (Standardized Evaluation Rubric) */}
          <Card className="bg-[#10182b] border-[#1e2d4f]">
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
                <div className="p-3.5 rounded-lg border border-emerald-900/50 bg-emerald-950/20 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-emerald-300">88% – 100%</span>
                    <Badge variant="success" className="text-[10px]">Strong Hire</Badge>
                  </div>
                  <p className="text-slate-300 font-medium">Mastery & Architecture</p>
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    Proactively addresses trade-offs, concurrency bottlenecks, and failure edge cases with precise technical terminology.
                  </p>
                </div>

                <div className="p-3.5 rounded-lg border border-indigo-900/50 bg-indigo-950/20 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-indigo-300">72% – 87%</span>
                    <Badge variant="indigo" className="text-[10px]">Hire Recommendation</Badge>
                  </div>
                  <p className="text-slate-300 font-medium">Proficient & Practical</p>
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    Solid implementation ability and clear conceptual grasp; minor gaps in scalability extremes or recovery degradation.
                  </p>
                </div>

                <div className="p-3.5 rounded-lg border border-amber-900/50 bg-amber-950/20 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-amber-300">Below 72%</span>
                    <Badge variant="default" className="text-[10px]">Additional Review</Badge>
                  </div>
                  <p className="text-slate-300 font-medium">Foundational Review</p>
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
              <h2 className="text-base font-semibold text-white">
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
                  className="bg-[#10182b] hover:border-indigo-800/60 transition-colors"
                >
                  <div className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="space-y-1.5 max-w-2xl">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-white text-base">
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
                        className="gap-1.5 text-xs border-[#22304e] hover:border-indigo-600/60"
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
            <Card className="bg-[#10182b] border-[#1e2d4f] p-8 text-center space-y-4">
              <div className="h-12 w-12 rounded-full bg-indigo-950/60 border border-indigo-800/40 flex items-center justify-center text-indigo-400 mx-auto">
                <BrainCircuit className="h-6 w-6" />
              </div>
              <div className="space-y-1 max-w-md mx-auto">
                <h3 className="text-base font-semibold text-white">Competency Diagnostics Pending</h3>
                <p className="text-xs text-slate-400">
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
              <Card className="bg-[#10182b]">
                <CardHeader>
                  <CardTitle>Skill Matrix & Proficiency Diagnostics</CardTitle>
                  <CardDescription>
                    Granular competencies calibrated against your actual answers across {reports.length} evaluation sessions.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {analytics.competencies.map((metric) => (
                      <div
                        key={metric.category}
                        className="space-y-2 p-4 rounded-xl border border-[#1e2d4f] bg-[#0c1222]"
                      >
                        <div className="flex justify-between items-center text-sm">
                          <span className="font-semibold text-white truncate max-w-[200px]">
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
                    <div className="rounded-xl border border-indigo-900/40 bg-indigo-950/20 p-5 space-y-3.5">
                      <div className="flex items-center gap-2 text-indigo-300 font-semibold text-sm">
                        <Award className="h-4 w-4 text-indigo-400" />
                        <span>Data-Backed Practice Recommendations</span>
                      </div>
                      <p className="text-xs text-slate-400">
                        Derived from actual evaluation gaps identified in your recent interview reports:
                      </p>
                      <div className="space-y-2">
                        {analytics.allRecommendations.map((item, idx) => (
                          <div
                            key={idx}
                            className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3 rounded-lg border border-[#1e2d4f] bg-[#0c1222] text-xs"
                          >
                            <span className="text-slate-300 leading-relaxed font-medium">
                              • {item}
                            </span>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleStartNewInterview()}
                              className="shrink-0 text-[11px] h-7 border-[#22304e] hover:border-indigo-600/60"
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
          <Card className="bg-[#10182b]">
            <CardHeader>
              <CardTitle>Candidate Profile & Calibration Settings</CardTitle>
              <CardDescription>
                Active session configuration and ingested resume profile metadata.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3.5 rounded-lg border border-[#1e2d4f] bg-[#0c1222]">
                  <span className="text-slate-400 block mb-1">Candidate Name</span>
                  <span className="font-semibold text-white text-sm">
                    {setup.candidateName || (user ? user.name : "Candidate")}
                  </span>
                </div>
                <div className="p-3.5 rounded-lg border border-[#1e2d4f] bg-[#0c1222]">
                  <span className="text-slate-400 block mb-1">Target Role</span>
                  <span className="font-semibold text-indigo-300 text-sm">
                    {roleName}
                  </span>
                </div>
                <div className="p-3.5 rounded-lg border border-[#1e2d4f] bg-[#0c1222]">
                  <span className="text-slate-400 block mb-1">Seniority Calibration</span>
                  <span className="font-semibold text-white text-sm capitalize">
                    {setup.experienceLevel}
                  </span>
                </div>
                <div className="p-3.5 rounded-lg border border-[#1e2d4f] bg-[#0c1222]">
                  <span className="text-slate-400 block mb-1">Resume File</span>
                  <span className="font-semibold text-white text-sm">
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
        </div>
      )}
    </div>
  );
}
