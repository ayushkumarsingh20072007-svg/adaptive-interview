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
  Search,
  Edit3,
  Save,
  Briefcase,
  Download,
  FileSpreadsheet,
  ChevronDown,
  ChevronUp,
  Quote,
  AlertTriangle,
  FileQuestion,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/ui/status-states";
import {
  CandidateSetup,
  EvaluationReport,
  TargetRole,
  ShortlistStatus,
  SkillStatusCategory,
} from "@/lib/types";
import { ROLE_LABELS, ROLE_SKILLS, SAMPLE_CANDIDATE } from "@/lib/mock-data";
import { getStoredSetup, getAllReports, updateCandidateShortlist } from "@/lib/storage";
import { initializeInterviewSession } from "@/lib/interview-engine";
import { useIsMounted } from "@/lib/use-mounted";
import { useAuth } from "@/lib/auth-context";

interface CompetencyStat {
  category: string;
  avgScore: number;
  level: "Needs Focus" | "Developing" | "Proficient" | "Mastery";
  count: number;
  status: SkillStatusCategory;
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const userRole = (user as { role?: string } | null)?.role;
  const isRecruiter = userRole === "recruiter";
  const [activeTab, setActiveTab] = React.useState<"overview" | "history" | "skills" | "settings" | "pipeline" | "analytics">(
    isRecruiter ? "pipeline" : "overview"
  );

  const isMounted = useIsMounted();
  const [refreshKey, setRefreshKey] = React.useState(0);

  const setup: CandidateSetup = React.useMemo(() => {
    if (!isMounted) return SAMPLE_CANDIDATE;
    return getStoredSetup(user?.id) || SAMPLE_CANDIDATE;
  }, [isMounted, user?.id]);

  const [reports, setReports] = React.useState<EvaluationReport[]>(() => {
    return getAllReports(user?.id, userRole as "candidate" | "recruiter" | undefined);
  });

  React.useEffect(() => {
    if (!isMounted) return;
    const initial = getAllReports(user?.id, userRole as "candidate" | "recruiter" | undefined);
    setReports(initial);

    let cancelled = false;
    fetch("/api/interview/reports")
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          if (data.reports && !cancelled) {
            const mergedMap = new Map<string, EvaluationReport>();
            initial.forEach((r) => mergedMap.set(r.sessionId, r));
            data.reports.forEach((r: EvaluationReport) => mergedMap.set(r.sessionId, r));
            setReports(Array.from(mergedMap.values()).sort((a, b) => (a.completedAt < b.completedAt ? 1 : -1)));
          }
        }
      })
      .catch((err) => console.warn("Failed to load server reports:", err));

    return () => {
      cancelled = true;
    };
  }, [isMounted, user?.id, userRole, refreshKey]);

  const [isStarting, setIsStarting] = React.useState(false);

  // Switch to pipeline tab if recruiter logs in
  React.useEffect(() => {
    if (isRecruiter) {
      setActiveTab("pipeline");
    }
  }, [isRecruiter]);

  // --- PIPELINE STATE (Recruiter) ---
  const [pipelineFilter, setPipelineFilter] = React.useState<"all" | "pending" | "shortlisted" | "under-review" | "rejected">("all");
  const [pipelineRoleFilter, setPipelineRoleFilter] = React.useState<string>("all");
  const [pipelineScoreFilter, setPipelineScoreFilter] = React.useState<"all" | "top" | "solid" | "needs-work">("all");
  const [pipelineSearch, setPipelineSearch] = React.useState<string>("");
  const [pipelineShortlists, setPipelineShortlists] = React.useState<Record<string, ShortlistStatus>>({});
  const [pipelineNotes, setPipelineNotes] = React.useState<Record<string, string>>({});
  const [editingNoteSessionId, setEditingNoteSessionId] = React.useState<string | null>(null);
  const [editingNoteDraft, setEditingNoteDraft] = React.useState<string>("");
  const [expandedTranscriptSessionId, setExpandedTranscriptSessionId] = React.useState<string | null>(null);

  // Load persisted recruiter reviews from SQLite server API
  React.useEffect(() => {
    if (!isRecruiter) return;
    let cancelled = false;
    fetch("/api/interview/reviews")
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          if (data.reviews && !cancelled) {
            const statusMap: Record<string, ShortlistStatus> = {};
            const notesMap: Record<string, string> = {};
            data.reviews.forEach((r: any) => {
              if (r.status) statusMap[r.sessionId] = r.status;
              if (r.notes) notesMap[r.sessionId] = r.notes;
            });
            setPipelineShortlists((prev) => ({ ...prev, ...statusMap }));
            setPipelineNotes((prev) => ({ ...prev, ...notesMap }));
          }
        }
      })
      .catch((err) => console.warn("Failed to fetch recruiter reviews:", err));

    return () => {
      cancelled = true;
    };
  }, [isRecruiter, refreshKey]);

  function handlePipelineStatusChange(sessionId: string, candidateName: string, status: ShortlistStatus) {
    setPipelineShortlists((prev) => ({ ...prev, [sessionId]: status }));
    const currentNote = pipelineNotes[sessionId];
    updateCandidateShortlist(
      sessionId,
      candidateName,
      status,
      currentNote,
      user?.name || "Sarah Jenkins (Company Head)"
    );

    // Persist to SQLite via server API
    fetch("/api/interview/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        candidateName,
        status,
        notes: currentNote || undefined,
      }),
    }).catch((err) => console.warn("Failed to persist recruiter review:", err));
  }

  function handleSaveCandidateNote(sessionId: string, candidateName: string, effectiveStatus: ShortlistStatus) {
    const savedDraft = editingNoteDraft;
    setPipelineNotes((prev) => ({ ...prev, [sessionId]: savedDraft }));
    updateCandidateShortlist(
      sessionId,
      candidateName,
      effectiveStatus,
      savedDraft,
      user?.name || "Sarah Jenkins (Company Head)"
    );

    // Persist to SQLite via server API
    fetch("/api/interview/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        candidateName,
        status: effectiveStatus,
        notes: savedDraft,
      }),
    }).catch((err) => console.warn("Failed to persist candidate note:", err));

    setEditingNoteSessionId(null);
  }

  function handleExportPipelineCSV() {
    if (reports.length === 0) return;
    const headers = [
      "Candidate Name",
      "Target Role",
      "Experience Level",
      "Overall Score (%)",
      "AI Verdict",
      "Shortlist Status",
      "Reviewed By",
      "Hiring Committee Notes",
      "Completed At",
      "Duration (Mins)",
      "Questions Evaluated"
    ];
    const rows = reports.map((r) => {
      const effectiveStatus = pipelineShortlists[r.sessionId] ?? r.shortlistStatus ?? "pending";
      const currentNote = pipelineNotes[r.sessionId] ?? r.shortlistNotes ?? "";
      return [
        `"${(r.candidateName || "Candidate").replace(/"/g, '""')}"`,
        `"${(r.targetRole || "Software Engineer").replace(/"/g, '""')}"`,
        `"${r.experienceLevel || "intermediate"}"`,
        r.overallScore || 0,
        `"${(r.verdict || "Under Review").replace(/"/g, '""')}"`,
        `"${effectiveStatus}"`,
        `"${(user?.name || "Sarah Jenkins (Head of Talent)").replace(/"/g, '""')}"`,
        `"${currentNote.replace(/"/g, '""')}"`,
        `"${r.completedAt || ""}"`,
        r.durationMinutes || 0,
        r.answerRecords?.length || 0,
      ].join(",");
    });

    const csvString = [headers.join(","), ...rows].join("\r\n");
    const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `TechCorp_Talent_Pipeline_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // --- RECRUITER AGGREGATE STATS ---
  const recruiterStats = React.useMemo(() => {
    const total = reports.length;
    const shortlisted = reports.filter((r) => (pipelineShortlists[r.sessionId] ?? r.shortlistStatus ?? "pending") === "shortlisted").length;
    const underReview = reports.filter((r) => (pipelineShortlists[r.sessionId] ?? r.shortlistStatus ?? "pending") === "under-review").length;
    const rejected = reports.filter((r) => (pipelineShortlists[r.sessionId] ?? r.shortlistStatus ?? "pending") === "rejected").length;
    const pending = reports.filter((r) => (pipelineShortlists[r.sessionId] ?? r.shortlistStatus ?? "pending") === "pending").length;
    const avgScore = total > 0 ? Math.round(reports.reduce((acc, r) => acc + (r.overallScore || 0), 0) / total) : 0;
    const shortlistRate = total > 0 ? Math.round((shortlisted / total) * 100) : 0;

    const roleMap = new Map<string, { count: number; totalScore: number }>();
    reports.forEach((r) => {
      const entry = roleMap.get(r.targetRole) || { count: 0, totalScore: 0 };
      roleMap.set(r.targetRole, { count: entry.count + 1, totalScore: entry.totalScore + (r.overallScore || 0) });
    });

    const roleBreakdown = Array.from(roleMap.entries()).map(([role, data]) => ({
      role,
      count: data.count,
      avgScore: Math.round(data.totalScore / data.count),
    }));

    return {
      total,
      shortlisted,
      underReview,
      rejected,
      pending,
      avgScore,
      shortlistRate,
      roleBreakdown,
    };
  }, [reports, pipelineShortlists]);

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
        statusCounts: { demonstrated: 0, claimedUnvalidated: 0, notAssessed: 0 },
      };
    }

    const completedCount = reports.length;
    const scores = reports
      .map((r) => r.overallScore)
      .filter((s) => typeof s === "number" && !isNaN(s));
    const averageScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;

    // Aggregate unique competencies across all completed reports
    const catMap = new Map<string, { total: number; count: number; status?: SkillStatusCategory }>();
    for (const rep of reports) {
      for (const m of rep.metrics || []) {
        if (!m.category) continue;
        const current = catMap.get(m.category) || { total: 0, count: 0, status: m.status };
        catMap.set(m.category, {
          total: current.total + m.score,
          count: current.count + 1,
          status: m.status || current.status,
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

        const status: SkillStatusCategory =
          data.status ||
          (data.count === 0
            ? "not_assessed"
            : avg >= 75 && data.count >= 1
            ? "demonstrated"
            : "claimed_unvalidated");

        return {
          category,
          avgScore: avg,
          level,
          count: data.count,
          status,
        };
      })
      .sort((a, b) => b.avgScore - a.avgScore);

    const strongest = competencies.length > 0 ? competencies[0] : null;
    const priority = competencies.length > 0 ? competencies[competencies.length - 1] : null;

    const statusCounts = {
      demonstrated: competencies.filter((c) => c.status === "demonstrated").length,
      claimedUnvalidated: competencies.filter((c) => c.status === "claimed_unvalidated").length,
      notAssessed: competencies.filter((c) => c.status === "not_assessed").length,
    };

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
      statusCounts,
    };
  }, [reports]);

  const roleName = ROLE_LABELS[setup.targetRole] || "Software Engineer";
  const displayName = user?.name || setup.candidateName || "Candidate";
  const expectedSkills = ROLE_SKILLS[setup.targetRole] || [];

  return (
    <div className="flex flex-col gap-8 max-w-6xl mx-auto w-full py-2">
      {/* 1. ULTRA-PREMIUM COMMAND CENTER HEADER */}
      <div className={`relative rounded-3xl border ${isRecruiter ? "border-violet-500/30 bg-gradient-to-r from-[#120f29]/95 via-[#0c0d24]/95 to-[#070814]/95 shadow-violet-950/40" : "border-indigo-500/20 bg-gradient-to-r from-[#0d152a]/95 via-[#0b1021]/95 to-[#070b16]/95 shadow-indigo-950/40"} backdrop-blur-2xl p-6 sm:p-8 shadow-2xl overflow-hidden`}>
        {/* Ambient Top Glow Line */}
        <div className={`absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent ${isRecruiter ? "via-violet-500/60" : "via-indigo-500/60"} to-transparent`} />
        <div className={`absolute top-0 right-1/4 w-80 h-32 ${isRecruiter ? "bg-violet-500/10" : "bg-indigo-500/10"} rounded-full blur-3xl pointer-events-none`} />

        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold tracking-wide ${isRecruiter ? "bg-violet-950/80 text-violet-300 border-violet-700/40" : "bg-indigo-950/80 text-indigo-300 border-indigo-700/40"} border shadow-inner`}>
                <Sparkles className={`h-3.5 w-3.5 ${isRecruiter ? "text-violet-400" : "text-indigo-400"} animate-pulse`} />
                {isRecruiter ? "Company Head · TechCorp Global" : "Adaptive AI Intelligence Engine"}
              </span>

              {user ? (
                <div className="flex items-center gap-2">
                  <Badge variant="success" className="text-[11px]">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    {isRecruiter ? `Hiring Lead: ${user.name}` : `Verified: ${user.email}`}
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

              {isRecruiter ? (
                <span className="text-xs text-violet-300 font-mono flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-ping" />
                  Role: Company Head & Talent Committee
                </span>
              ) : (
                <span className="text-xs text-slate-400 font-mono flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                  Track: {roleName}
                </span>
              )}
            </div>

            <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              {isRecruiter ? (
                <>
                  Talent Pipeline & <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-indigo-400 bg-clip-text text-transparent">Shortlist Authority</span>
                </>
              ) : (
                <>
                  Welcome back, <span className="text-gradient-primary">{displayName}</span>
                </>
              )}
            </h1>

            <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
              {isRecruiter
                ? "Unified leadership portal. Access every candidate's technical interview records, inspect verbatim question & answer transcripts, and execute hiring decisions with persistent notes."
                : "Real-time technical interview analytics command center. Calibrate your profile, execute adaptive AI sessions, and inspect evidence-backed scorecards with quote citations."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {isRecruiter ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportPipelineCSV}
                  className="gap-2 text-xs h-10 px-4 border-violet-800/60 text-violet-300 hover:bg-violet-950/50 hover:text-white"
                  title="Export candidate pipeline as CSV"
                >
                  <Download className="h-3.5 w-3.5 text-violet-400" />
                  Export Pipeline (CSV)
                </Button>

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setRefreshKey((k) => k + 1)}
                  className="gap-2 text-xs h-10 px-3.5 border-slate-700/60"
                  title="Reload all stored candidate records"
                >
                  <RefreshCw className="h-3.5 w-3.5 text-slate-300" />
                  Refresh
                </Button>

                {reports.length > 0 && (
                  <Link href={`/report/${reports[0].sessionId}`}>
                    <Button variant="outline" size="sm" className="gap-2 text-xs h-10 px-4 border-indigo-900/40 hover:border-indigo-500/50">
                      <FileText className="h-3.5 w-3.5 text-indigo-400" />
                      Latest Audit
                    </Button>
                  </Link>
                )}
              </>
            ) : (
              <>
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
              </>
            )}
          </div>
        </div>
      </div>

      {/* 2. TOP 4 ANALYTICS COMMAND CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {isRecruiter ? (
          <>
            {/* Recruiter Card 1: Candidate Pool */}
            <Card className="p-5 relative overflow-hidden group hover:border-violet-500/40 transition-all duration-300 hover:-translate-y-1">
              <div className="absolute top-0 right-0 w-24 h-24 bg-violet-500/5 rounded-full blur-xl pointer-events-none group-hover:bg-violet-500/10 transition-colors" />
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-semibold uppercase tracking-wider text-[10px]">Candidate Pool</span>
                <div className="h-8 w-8 rounded-xl bg-violet-950/80 border border-violet-800/40 flex items-center justify-center text-violet-400">
                  <Users className="h-4 w-4" />
                </div>
              </div>
              <p className="text-3xl font-extrabold text-white mt-3 font-mono tracking-tight">
                {recruiterStats.total}
              </p>
              <div className="text-[11px] text-slate-400 mt-2 flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-emerald-400 font-medium">100% verified AI interviews</span>
              </div>
            </Card>

            {/* Recruiter Card 2: Shortlisted Talent */}
            <Card className="p-5 relative overflow-hidden group hover:border-emerald-500/40 transition-all duration-300 hover:-translate-y-1">
              <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl pointer-events-none group-hover:bg-emerald-500/10 transition-colors" />
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-semibold uppercase tracking-wider text-[10px]">Shortlisted Talent</span>
                <div className="h-8 w-8 rounded-xl bg-emerald-950/80 border border-emerald-800/40 flex items-center justify-center text-emerald-400">
                  <Star className="h-4 w-4 fill-current" />
                </div>
              </div>
              <p className="text-3xl font-extrabold text-emerald-400 mt-3 font-mono tracking-tight">
                {recruiterStats.shortlisted}
              </p>
              <div className="text-[11px] text-slate-400 mt-2">
                <span className="text-emerald-400 font-medium font-mono">{recruiterStats.shortlistRate}%</span>{" "}
                <span className="text-slate-400">conversion rate</span>
              </div>
            </Card>

            {/* Recruiter Card 3: Batch Average Score */}
            <Card className="p-5 relative overflow-hidden group hover:border-indigo-500/40 transition-all duration-300 hover:-translate-y-1">
              <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-xl pointer-events-none group-hover:bg-indigo-500/10 transition-colors" />
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-semibold uppercase tracking-wider text-[10px]">Batch Average Score</span>
                <div className="h-8 w-8 rounded-xl bg-indigo-950/80 border border-indigo-800/40 flex items-center justify-center text-indigo-400">
                  <TrendingUp className="h-4 w-4" />
                </div>
              </div>
              <p className="text-3xl font-extrabold text-gradient-primary mt-3 font-mono tracking-tight">
                {recruiterStats.avgScore}%
              </p>
              <div className="text-[11px] text-slate-400 mt-2 truncate">
                <span className={recruiterStats.avgScore >= 80 ? "text-emerald-400 font-medium" : "text-amber-400 font-medium"}>
                  {recruiterStats.avgScore >= 80 ? "High Caliber Applicant Pool" : "Standard Applicant Benchmark"}
                </span>
              </div>
            </Card>

            {/* Recruiter Card 4: Awaiting Decision */}
            <Card className="p-5 relative overflow-hidden group hover:border-amber-500/40 transition-all duration-300 hover:-translate-y-1">
              <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-xl pointer-events-none group-hover:bg-amber-500/10 transition-colors" />
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-semibold uppercase tracking-wider text-[10px]">Awaiting Decision</span>
                <div className="h-8 w-8 rounded-xl bg-amber-950/80 border border-amber-800/40 flex items-center justify-center text-amber-400">
                  <Clock3 className="h-4 w-4" />
                </div>
              </div>
              <p className="text-3xl font-extrabold text-amber-400 mt-3 font-mono tracking-tight">
                {recruiterStats.pending + recruiterStats.underReview}
              </p>
              <div className="text-[11px] text-slate-400 mt-2 truncate">
                <span className="text-amber-300 font-mono">{recruiterStats.pending}</span> pending ·{" "}
                <span className="text-amber-400 font-mono">{recruiterStats.underReview}</span> in review
              </div>
            </Card>
          </>
        ) : (
          <>
            {/* Candidate Card 1: Completed Audits */}
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

            {/* Candidate Card 2: Composite Score */}
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

            {/* Candidate Card 3: Strongest Competency */}
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

            {/* Candidate Card 4: Improvement Priority */}
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
          </>
        )}
      </div>

      {/* 3. SEGMENTED TABS NAVIGATION */}
      {isRecruiter ? (
        <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-[#0a0f1d]/90 border border-violet-950/80 backdrop-blur-xl overflow-x-auto">
          <button
            onClick={() => setActiveTab("pipeline")}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold rounded-xl transition-all whitespace-nowrap ${
              activeTab === "pipeline"
                ? "bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-md shadow-violet-950/80"
                : "text-slate-400 hover:text-slate-200 hover:bg-[#131d35]/60"
            }`}
          >
            <Users className="h-4 w-4" />
            Candidate Pipeline ({reports.length})
          </button>

          <button
            onClick={() => setActiveTab("analytics")}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold rounded-xl transition-all whitespace-nowrap ${
              activeTab === "analytics"
                ? "bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-md shadow-violet-950/80"
                : "text-slate-400 hover:text-slate-200 hover:bg-[#131d35]/60"
            }`}
          >
            <BarChart3 className="h-4 w-4" />
            Company Hiring Analytics
          </button>

          <button
            onClick={() => setActiveTab("history")}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold rounded-xl transition-all whitespace-nowrap ${
              activeTab === "history"
                ? "bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-md shadow-violet-950/80"
                : "text-slate-400 hover:text-slate-200 hover:bg-[#131d35]/60"
            }`}
          >
            <History className="h-4 w-4" />
            All Candidate Transcripts ({reports.length})
          </button>
        </div>
      ) : (
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
            My Evaluation History ({reports.length})
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
        </div>
      )}

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
              {/* CANDIDATE COMPANY APPLICATION & SHORTLIST DECISION BANNER (GLASSMORPHISM) */}
              {!isRecruiter && (() => {
                const candidateLatestReport = reports.length > 0 ? reports[0] : null;
                const candidateEffectiveStatus = (pipelineShortlists[candidateLatestReport?.sessionId || ""] ?? candidateLatestReport?.shortlistStatus ?? "pending") as ShortlistStatus;
                const candidateEffectiveNotes = pipelineNotes[candidateLatestReport?.sessionId || ""] ?? candidateLatestReport?.shortlistNotes;

                return (
                  <div className="relative rounded-3xl border border-white/10 bg-gradient-to-r from-[#0c1428]/95 via-[#0e162d]/90 to-[#18112e]/95 backdrop-blur-2xl p-6 sm:p-7 shadow-2xl shadow-indigo-950/60 overflow-hidden">
                    <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent" />
                    <div className="absolute -top-10 -right-10 w-60 h-60 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

                    <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
                      <div className="space-y-3 max-w-2xl">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-[#121c38] text-indigo-300 border border-indigo-700/40">
                            <Building2 className="h-3.5 w-3.5 text-indigo-400" />
                            Reviewing Company: TechCorp Global
                          </span>
                          <span className="text-xs text-slate-400 font-mono">
                            Hiring Lead: Sarah Jenkins
                          </span>
                        </div>

                        {candidateEffectiveStatus === "shortlisted" && (
                          <>
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-950/90 text-emerald-300 border border-emerald-500/60 shadow-lg shadow-emerald-950/60">
                                <Star className="h-3.5 w-3.5 text-emerald-400 fill-emerald-400" />
                                Application Shortlisted ⭐
                              </span>
                              <Badge variant="success" className="text-[10px]">Decision Confirmed</Badge>
                            </div>
                            <h2 className="text-2xl font-extrabold text-white tracking-tight">
                              Congratulations, {displayName}! You have been Shortlisted.
                            </h2>
                            <p className="text-sm text-slate-300 leading-relaxed">
                              Your interview performance met the hiring bar for the {roleName} role. Sarah Jenkins has advanced your profile to the candidate shortlist.
                            </p>
                          </>
                        )}

                        {candidateEffectiveStatus === "under-review" && (
                          <>
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-950/90 text-amber-300 border border-amber-500/60 shadow-lg shadow-amber-950/60">
                                <Clock3 className="h-3.5 w-3.5 text-amber-400" />
                                Under Active Review ⏳
                              </span>
                            </div>
                            <h2 className="text-2xl font-extrabold text-white tracking-tight">
                              Interview Record Under Review by Company Head
                            </h2>
                            <p className="text-sm text-slate-300 leading-relaxed">
                              Your interview transcript, answers, and competency metrics are currently being evaluated by the TechCorp Global talent committee.
                            </p>
                          </>
                        )}

                        {candidateEffectiveStatus === "rejected" && (
                          <>
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-950/90 text-rose-300 border border-rose-600/50">
                                <XCircle className="h-3.5 w-3.5 text-rose-400" />
                                Application Feedback Provided
                              </span>
                            </div>
                            <h2 className="text-2xl font-extrabold text-white tracking-tight">
                              Interview Completed — Diagnostic Review
                            </h2>
                            <p className="text-sm text-slate-300 leading-relaxed">
                              Thank you for completing the technical assessment. Review your competency breakdown below to target specific growth areas for future openings.
                            </p>
                          </>
                        )}

                        {candidateEffectiveStatus === "pending" && (
                          <>
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-950/90 text-indigo-300 border border-indigo-700/50">
                                <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
                                Interview Record Ready
                              </span>
                            </div>
                            <h2 className="text-2xl font-extrabold text-white tracking-tight">
                              Welcome to Your Candidate Portal
                            </h2>
                            <p className="text-sm text-slate-300 leading-relaxed">
                              Your evaluation history and scores are linked to this account and accessible only to you and authorized company evaluators.
                            </p>
                          </>
                        )}

                        {/* Recruiter Notes (if provided by company head) */}
                        {candidateEffectiveNotes && (
                          <div className="mt-3 p-3.5 rounded-2xl bg-white/[0.04] border border-white/10 backdrop-blur-md">
                            <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider mb-1 flex items-center gap-1">
                              <CheckCircle2 className="h-3.5 w-3.5 text-indigo-400" />
                              Hiring Manager Notes (Sarah Jenkins):
                            </p>
                            <p className="text-xs text-slate-200 italic font-medium leading-relaxed">
                              &ldquo;{candidateEffectiveNotes}&rdquo;
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col sm:flex-row md:flex-col gap-2.5 shrink-0">
                        {candidateLatestReport && (
                          <Link href={`/report/${candidateLatestReport.sessionId}`}>
                            <Button size="sm" variant="secondary" className="gap-2 text-xs h-9 w-full">
                              <FileText className="h-4 w-4 text-indigo-400" />
                              View Full Audit Report
                            </Button>
                          </Link>
                        )}
                        <Button
                          size="sm"
                          onClick={() => handleStartNewInterview()}
                          className="gap-2 text-xs h-9 w-full bg-indigo-600 hover:bg-indigo-500 font-bold shadow-lg shadow-indigo-600/30"
                        >
                          <Play className="h-3.5 w-3.5 fill-current" />
                          Retake Technical Interview
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })()}

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
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <CardTitle>Skill Matrix & Proficiency Diagnostics</CardTitle>
                      <CardDescription>
                        Granular competencies calibrated against your actual answers across {reports.length} evaluation session{reports.length > 1 ? "s" : ""}.
                      </CardDescription>
                    </div>

                    {/* Truthful 3-Tier Category Distribution Pills */}
                    <div className="flex items-center gap-2 flex-wrap text-xs">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/70 border border-emerald-500/50 text-emerald-300 font-semibold shadow-sm">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                        Demonstrated: {analytics.statusCounts.demonstrated}
                      </span>
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-950/70 border border-amber-500/50 text-amber-300 font-semibold shadow-sm">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                        Claimed but Unvalidated: {analytics.statusCounts.claimedUnvalidated}
                      </span>
                      {analytics.statusCounts.notAssessed > 0 && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900/90 border border-slate-700/60 text-slate-300 font-semibold shadow-sm">
                          <FileQuestion className="h-3.5 w-3.5 text-slate-400" />
                          Not Yet Assessed: {analytics.statusCounts.notAssessed}
                        </span>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {analytics.competencies.map((metric) => (
                      <div
                        key={metric.category}
                        className="space-y-2.5 p-4.5 rounded-2xl border border-[#1e2d4f] bg-[#0a0f1d] hover:border-indigo-700/50 transition-colors"
                      >
                        <div className="flex justify-between items-start gap-2">
                          <div>
                            <span className="font-bold text-white text-sm block">
                              {metric.category}
                            </span>
                            <span className="text-[11px] text-slate-400 font-mono">
                              {metric.count} answer turn{metric.count > 1 ? "s" : ""} evaluated
                            </span>
                          </div>

                          <div className="flex flex-col items-end gap-1">
                            <Badge
                              variant={metric.avgScore >= 90 ? "success" : metric.avgScore >= 82 ? "indigo" : "default"}
                            >
                              {metric.level} • {metric.avgScore}%
                            </Badge>
                            {/* 3-Tier Status Category Badge */}
                            {metric.status === "demonstrated" && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-500/50">
                                <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                                Demonstrated
                              </span>
                            )}
                            {metric.status === "claimed_unvalidated" && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950/80 text-amber-300 border border-amber-500/50">
                                <AlertTriangle className="h-3 w-3 text-amber-400" />
                                Claimed but Unvalidated
                              </span>
                            )}
                            {metric.status === "not_assessed" && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-900/90 text-slate-300 border border-slate-700/60">
                                <FileQuestion className="h-3 w-3 text-slate-400" />
                                Not Yet Assessed
                              </span>
                            )}
                          </div>
                        </div>
                        <Progress
                          value={metric.avgScore}
                          indicatorColor={metric.avgScore >= 90 ? "emerald" : metric.avgScore >= 82 ? "indigo" : "amber"}
                          size="md"
                        />
                        <p className="text-[11px] text-slate-400 pt-0.5">
                          Evaluated with verified keyword alignment and technical depth.
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
      {/* TAB 5: RECRUITER CANDIDATE PIPELINE (COMPANY HEAD ACCESS)                */}
      {/* ========================================================================= */}
      {activeTab === "pipeline" && isRecruiter && (() => {
        const statusMeta: Record<string, { label: string; color: string; icon: React.ReactNode; bg: string }> = {
          shortlisted:   { label: "Shortlisted",    color: "text-emerald-400", icon: <Star className="h-3.5 w-3.5" />, bg: "bg-emerald-950/80 border-emerald-500/60" },
          "under-review": { label: "Under Review",   color: "text-amber-400",   icon: <Clock3 className="h-3.5 w-3.5" />, bg: "bg-amber-950/80 border-amber-500/60" },
          rejected:      { label: "Rejected",       color: "text-rose-400",    icon: <XCircle className="h-3.5 w-3.5" />, bg: "bg-rose-950/80 border-rose-500/60" },
          pending:       { label: "Pending Review",  color: "text-slate-400",   icon: <Building2 className="h-3.5 w-3.5" />, bg: "bg-slate-900 border-slate-700" },
        };

        const filteredReports = reports.filter((rep) => {
          const effectiveStatus = (pipelineShortlists[rep.sessionId] ?? rep.shortlistStatus ?? "pending") as ShortlistStatus;
          const matchesStatus = pipelineFilter === "all" || effectiveStatus === pipelineFilter;
          const matchesRole = pipelineRoleFilter === "all" || rep.targetRole.toLowerCase().includes(pipelineRoleFilter.toLowerCase());
          const matchesScore =
            pipelineScoreFilter === "all" ||
            (pipelineScoreFilter === "top" && rep.overallScore >= 85) ||
            (pipelineScoreFilter === "solid" && rep.overallScore >= 75 && rep.overallScore < 85) ||
            (pipelineScoreFilter === "needs-work" && rep.overallScore < 75);
          const matchesSearch = !pipelineSearch.trim() || 
            rep.candidateName.toLowerCase().includes(pipelineSearch.toLowerCase()) ||
            rep.targetRole.toLowerCase().includes(pipelineSearch.toLowerCase()) ||
            (rep.shortlistNotes && rep.shortlistNotes.toLowerCase().includes(pipelineSearch.toLowerCase()));
          return matchesStatus && matchesRole && matchesScore && matchesSearch;
        });

        const pipelineCounts = {
          all: reports.length,
          shortlisted: reports.filter((r) => (pipelineShortlists[r.sessionId] ?? r.shortlistStatus ?? "pending") === "shortlisted").length,
          "under-review": reports.filter((r) => (pipelineShortlists[r.sessionId] ?? r.shortlistStatus ?? "pending") === "under-review").length,
          rejected: reports.filter((r) => (pipelineShortlists[r.sessionId] ?? r.shortlistStatus ?? "pending") === "rejected").length,
          pending: reports.filter((r) => (pipelineShortlists[r.sessionId] ?? r.shortlistStatus ?? "pending") === "pending").length,
        };

        const avgScore = reports.length > 0 
          ? Math.round(reports.reduce((acc, r) => acc + (r.overallScore || 0), 0) / reports.length) 
          : 0;

        return (
          <div className="space-y-6">
            {/* Pipeline Header (Glassmorphic Command Center) */}
            <div className="relative rounded-3xl border border-violet-500/20 bg-gradient-to-r from-[#0d0e24]/95 via-[#0b0c21]/95 to-[#070814]/95 backdrop-blur-2xl p-6 sm:p-8 shadow-2xl shadow-violet-950/30 overflow-hidden">
              <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-violet-500/50 to-transparent" />
              <div className="absolute top-0 right-1/4 w-80 h-32 bg-violet-500/10 rounded-full blur-3xl pointer-events-none" />
              <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold tracking-wide bg-violet-950/80 text-violet-300 border border-violet-700/40 shadow-inner">
                      <Users className="h-3.5 w-3.5 text-violet-400" />
                      Company Head Portal · TechCorp Global
                    </span>
                    <Badge variant="success" className="text-[11px]">
                      <ShieldCheck className="h-3 w-3 mr-1" />
                      Hiring Lead: {user?.name || "Sarah Jenkins"}
                    </Badge>
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                    Candidate Evaluation & Shortlist Authority
                  </h2>
                  <p className="text-sm text-slate-300 max-w-xl leading-relaxed">
                    Exclusive command center for company leadership. Full access to candidate transcripts, question breakdowns, and one-click Shortlist/Reject controls with persistent notes.
                  </p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 shrink-0">
                  <div className="rounded-xl border border-indigo-900/40 bg-[#0a0f1d] p-3 text-center">
                    <p className="text-xl font-extrabold font-mono text-indigo-300">{pipelineCounts.all}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Total Pool</p>
                  </div>
                  {(["shortlisted", "under-review", "pending", "rejected"] as const).map((s) => (
                    <div key={s} className="rounded-xl border border-[#1e2d4f] bg-[#0a0f1d] p-3 text-center">
                      <p className={`text-xl font-extrabold font-mono ${statusMeta[s].color}`}>{pipelineCounts[s]}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5 capitalize">{statusMeta[s].label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Pipeline Search & Filter Bar */}
            <div className="p-4 rounded-2xl border border-indigo-950/80 bg-[#0a0f1d]/90 backdrop-blur-xl flex flex-col gap-3">
              <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                {/* Search input */}
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search candidate by name, role, or keywords..."
                    value={pipelineSearch}
                    onChange={(e) => setPipelineSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-[#1e2d4f] bg-[#070b16] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 transition-colors"
                  />
                </div>

                {/* Role Selector */}
                <div className="flex items-center gap-2 shrink-0">
                  <Briefcase className="h-3.5 w-3.5 text-slate-400" />
                  <select
                    value={pipelineRoleFilter}
                    onChange={(e) => setPipelineRoleFilter(e.target.value)}
                    className="bg-[#070b16] border border-[#1e2d4f] rounded-xl text-xs text-slate-300 px-3 py-1.5 focus:outline-none focus:border-violet-500"
                  >
                    <option value="all">All Tracks ({reports.length})</option>
                    <option value="fullstack">Full Stack</option>
                    <option value="frontend">Frontend</option>
                    <option value="backend">Backend</option>
                    <option value="python">Python</option>
                    <option value="data-analyst">Data Analyst</option>
                  </select>
                </div>
              </div>

              {/* Secondary Filters: Status & Score Tiers */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#1a2542]">
                {/* Score Tier Buttons */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="flex items-center gap-1 text-xs text-slate-400 font-medium mr-1">
                    <Target className="h-3 w-3 text-indigo-400" /> Score Tier:
                  </span>
                  {(
                    [
                      { id: "all", label: "All Scores" },
                      { id: "top", label: "≥85% Top Talent" },
                      { id: "solid", label: "75–84% Solid" },
                      { id: "needs-work", label: "<75% Needs Drill" },
                    ] as const
                  ).map((sf) => (
                    <button
                      key={sf.id}
                      onClick={() => setPipelineScoreFilter(sf.id)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                        pipelineScoreFilter === sf.id
                          ? "bg-indigo-600 text-white border-indigo-400 shadow-sm"
                          : "bg-[#070b16] text-slate-400 border-[#1e2d4f] hover:text-slate-200"
                      }`}
                    >
                      {sf.label}
                    </button>
                  ))}
                </div>

                {/* Status Filter Buttons */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="flex items-center gap-1 text-xs text-slate-400 font-medium mr-1">
                    <Filter className="h-3 w-3 text-violet-400" /> Decision:
                  </span>
                  {(["all", "shortlisted", "under-review", "pending", "rejected"] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setPipelineFilter(f)}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                        pipelineFilter === f
                          ? "bg-violet-600 text-white border-violet-500 shadow-md"
                          : "bg-[#070b16] text-slate-400 border-[#1e2d4f] hover:border-violet-700/50 hover:text-slate-200"
                      }`}
                    >
                      {f !== "all" && statusMeta[f].icon}
                      {f === "all" ? `All (${pipelineCounts.all})` : `${statusMeta[f].label} (${pipelineCounts[f]})`}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Candidate Evaluation Cards */}
            {filteredReports.length === 0 ? (
              <Card className="p-10 text-center">
                <div className="h-12 w-12 rounded-2xl bg-violet-950/70 border border-violet-800/40 flex items-center justify-center text-violet-400 mx-auto mb-4">
                  <Users className="h-6 w-6" />
                </div>
                <h3 className="text-base font-bold text-white mb-1">No candidates match your filters</h3>
                <p className="text-xs text-slate-400">Clear search or change filter buttons above to view other candidate submissions.</p>
              </Card>
            ) : (
              <div className="space-y-4">
                {filteredReports.map((rep) => {
                  const effectiveStatus = (pipelineShortlists[rep.sessionId] ?? rep.shortlistStatus ?? "pending") as ShortlistStatus;
                  const currentNotes = pipelineNotes[rep.sessionId] ?? rep.shortlistNotes ?? "";
                  const meta = statusMeta[effectiveStatus] ?? statusMeta["pending"];
                  const isEditingNote = editingNoteSessionId === rep.sessionId;
                  const verdictColor = rep.overallScore >= 88 ? "text-emerald-400" : rep.overallScore >= 72 ? "text-indigo-400" : "text-amber-400";
                  const isQnaExpanded = expandedTranscriptSessionId === rep.sessionId;

                  return (
                    <Card
                      key={rep.sessionId}
                      className="border border-[#1e2d4f] hover:border-violet-600/50 transition-all bg-[#0a0f1d]/95 overflow-hidden shadow-xl"
                    >
                      <div className="p-5 sm:p-6 space-y-4">
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                          {/* Left: Candidate Info */}
                          <div className="flex items-start gap-4 flex-1 min-w-0">
                            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-violet-600/30 to-indigo-700/30 border border-violet-700/40 flex items-center justify-center text-violet-200 font-extrabold text-xl shrink-0 shadow-inner">
                              {rep.candidateName.charAt(0)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2 mb-1">
                                <span className="font-bold text-white text-lg tracking-tight">{rep.candidateName}</span>
                                <Badge
                                  variant={rep.overallScore >= 88 ? "success" : rep.overallScore >= 72 ? "indigo" : "default"}
                                  className="text-xs font-mono font-bold"
                                >
                                  {rep.overallScore}% Score
                                </Badge>
                                <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-0.5 rounded-full border ${meta.bg} ${meta.color}`}>
                                  {meta.icon}
                                  {meta.label}
                                </span>
                                {rep.isDemoSimulation ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-950/40 border border-amber-800/40 text-amber-300">
                                    Simulated Benchmark
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-950/40 border border-emerald-800/40 text-emerald-300">
                                    Live AI Assessment
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-400">
                                <span className="text-slate-300 font-medium">{rep.targetRole}</span> • Seniority: {rep.experienceLevel} • Duration: {rep.durationMinutes} min • Evaluated: {rep.completedAt}
                              </p>
                              <p className={`text-xs mt-1 font-semibold ${verdictColor}`}>
                                AI Verdict: {rep.verdict}
                              </p>
                              {rep.metrics && rep.metrics.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 mt-2.5">
                                  {rep.metrics.slice(0, 4).map((m) => (
                                    <span
                                      key={m.category}
                                      className="inline-flex items-center gap-1 text-[10px] bg-[#070b16] border border-[#1e2d4f] rounded-lg px-2 py-0.5 text-slate-300 font-medium"
                                    >
                                      {m.category}: <span className="text-indigo-400 font-mono font-bold">{m.score}%</span>
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Right: Authority Actions, Q&A Toggle & Full Report */}
                          <div className="flex flex-col sm:flex-row lg:flex-col items-start sm:items-end gap-2.5 shrink-0">
                            {/* Shortlist Decision Group */}
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[11px] text-slate-400 font-medium mr-1 hidden sm:inline">Authority:</span>
                              
                              {/* 1. SHORTLIST */}
                              <button
                                title="Shortlist candidate for next round"
                                onClick={() => handlePipelineStatusChange(rep.sessionId, rep.candidateName, "shortlisted")}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                                  effectiveStatus === "shortlisted"
                                    ? "bg-emerald-600 text-white border-emerald-400 shadow-md shadow-emerald-950/80 scale-105"
                                    : "bg-[#070b16] text-slate-400 border-[#1e2d4f] hover:text-emerald-300 hover:border-emerald-700/50"
                                }`}
                              >
                                <Star className="h-3.5 w-3.5 fill-current" />
                                <span>Shortlist</span>
                              </button>

                              {/* 2. UNDER REVIEW */}
                              <button
                                title="Mark candidate under review"
                                onClick={() => handlePipelineStatusChange(rep.sessionId, rep.candidateName, "under-review")}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                                  effectiveStatus === "under-review"
                                    ? "bg-amber-600 text-white border-amber-400 shadow-md shadow-amber-950/80 scale-105"
                                    : "bg-[#070b16] text-slate-400 border-[#1e2d4f] hover:text-amber-300 hover:border-amber-700/50"
                                }`}
                              >
                                <Clock3 className="h-3.5 w-3.5" />
                                <span>Under Review</span>
                              </button>

                              {/* 3. REJECT */}
                              <button
                                title="Reject candidate with feedback"
                                onClick={() => handlePipelineStatusChange(rep.sessionId, rep.candidateName, "rejected")}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                                  effectiveStatus === "rejected"
                                    ? "bg-rose-700 text-white border-rose-400 shadow-md shadow-rose-950/80 scale-105"
                                    : "bg-[#070b16] text-slate-400 border-[#1e2d4f] hover:text-rose-300 hover:border-rose-700/50"
                                }`}
                              >
                                <XCircle className="h-3.5 w-3.5" />
                                <span>Reject</span>
                              </button>
                            </div>

                            {/* Action Buttons: Quick Q&A Drawer Toggle & Full Audit */}
                            <div className="flex items-center gap-2 w-full sm:w-auto">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setExpandedTranscriptSessionId(isQnaExpanded ? null : rep.sessionId)}
                                className="gap-1.5 text-xs h-8 px-3 border-violet-800/60 hover:border-violet-500 text-violet-300 hover:bg-violet-950/40"
                              >
                                <Quote className="h-3.5 w-3.5 text-violet-400" />
                                {isQnaExpanded ? "Close Q&A" : `Quick Q&A (${rep.answerRecords?.length || 0})`}
                                {isQnaExpanded ? (
                                  <ChevronUp className="h-3 w-3" />
                                ) : (
                                  <ChevronDown className="h-3 w-3" />
                                )}
                              </Button>

                              <Link href={`/report/${rep.sessionId}`}>
                                <Button size="sm" variant="secondary" className="gap-2 text-xs h-8 px-3 border-indigo-900/50 hover:border-indigo-500/50">
                                  <FileText className="h-3.5 w-3.5 text-indigo-400" />
                                  Full Dossier
                                  <ChevronRight className="h-3 w-3 text-slate-400" />
                                </Button>
                              </Link>
                            </div>
                          </div>
                        </div>

                        {/* EXPANDABLE QUICK Q&A TRANSCRIPT DRAWER */}
                        {isQnaExpanded && (
                          <div className="mt-3 pt-3 border-t border-violet-900/40 rounded-xl bg-[#070b16]/90 p-4 space-y-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Quote className="h-4 w-4 text-violet-400" />
                                <span className="text-xs font-bold text-white uppercase tracking-wider">
                                  Verbatim Interview Q&A Transcript ({rep.answerRecords?.length || 0} Questions)
                                </span>
                              </div>
                              <Badge variant="indigo" className="text-[10px]">Gemini AI Evaluated</Badge>
                            </div>

                            {(!rep.answerRecords || rep.answerRecords.length === 0) ? (
                              <p className="text-xs text-slate-500 italic">No question-answer transcripts recorded for this session.</p>
                            ) : (
                              <div className="space-y-3.5">
                                {rep.answerRecords.map((ans, qIdx) => (
                                  <div key={ans.questionId || qIdx} className="rounded-xl border border-[#1e2d4f] bg-[#090e1c] p-3.5 space-y-2.5">
                                    <div className="flex items-center justify-between flex-wrap gap-2">
                                      <span className="text-xs font-bold text-violet-300">
                                        Question #{qIdx + 1}: <span className="text-slate-300 font-medium">{ans.category}</span>
                                      </span>
                                      <div className="flex items-center gap-1.5">
                                        <Badge variant="outline" className="text-[10px] capitalize text-slate-400 border-slate-700">
                                          {ans.difficulty}
                                        </Badge>
                                        <Badge variant={ans.feedback?.score >= 85 ? "success" : ans.feedback?.score >= 70 ? "indigo" : "default"} className="text-[10px] font-mono">
                                          {ans.feedback?.score ?? 0}% Score
                                        </Badge>
                                      </div>
                                    </div>

                                    <p className="text-xs text-slate-200 font-medium leading-relaxed bg-[#0f172a]/70 p-2.5 rounded-lg border border-[#1e2d4f]">
                                      {ans.questionText}
                                    </p>

                                    <div className="space-y-1">
                                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                                        Candidate&apos;s Verbatim Response:
                                      </span>
                                      <p className="text-xs text-slate-300 font-mono bg-[#050811] p-2.5 rounded-lg border border-[#16213b] leading-relaxed whitespace-pre-wrap">
                                        &ldquo;{ans.answerText}&rdquo;
                                      </p>
                                    </div>

                                    {ans.feedback && (
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-[11px]">
                                        {ans.feedback.strengths && ans.feedback.strengths.length > 0 && (
                                          <div className="p-2 rounded-lg bg-emerald-950/30 border border-emerald-800/40 space-y-1">
                                            <span className="text-emerald-400 font-bold block text-[10px] uppercase">Demonstrated Strengths:</span>
                                            <ul className="list-disc list-inside text-emerald-200/90 space-y-0.5">
                                              {ans.feedback.strengths.map((str, sIdx) => (
                                                <li key={sIdx}>{str}</li>
                                              ))}
                                            </ul>
                                          </div>
                                        )}
                                        {ans.feedback.gaps && ans.feedback.gaps.length > 0 && (
                                          <div className="p-2 rounded-lg bg-amber-950/30 border border-amber-800/40 space-y-1">
                                            <span className="text-amber-400 font-bold block text-[10px] uppercase">Gaps / Missed Concepts:</span>
                                            <ul className="list-disc list-inside text-amber-200/90 space-y-0.5">
                                              {ans.feedback.gaps.map((gp, gIdx) => (
                                                <li key={gIdx}>{gp}</li>
                                              ))}
                                            </ul>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {/* HIRING MANAGER NOTES & FEEDBACK SECTION */}
                        <div className="pt-3 border-t border-[#18233d] flex flex-col gap-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                              <ShieldCheck className="h-3.5 w-3.5 text-violet-400" />
                              Hiring Committee Notes (Visible to Candidate):
                            </span>
                            {!isEditingNote && (
                              <button
                                onClick={() => {
                                  setEditingNoteSessionId(rep.sessionId);
                                  setEditingNoteDraft(currentNotes);
                                }}
                                className="inline-flex items-center gap-1 text-[11px] text-violet-400 hover:text-violet-300 font-semibold"
                              >
                                <Edit3 className="h-3 w-3" />
                                {currentNotes ? "Edit Notes" : "+ Add Recruiter Note"}
                              </button>
                            )}
                          </div>

                          {isEditingNote ? (
                            <div className="space-y-2 mt-1">
                              <textarea
                                rows={2}
                                value={editingNoteDraft}
                                onChange={(e) => setEditingNoteDraft(e.target.value)}
                                placeholder="Enter evaluation notes, decision rationale, or interview invitation details..."
                                className="w-full p-2.5 rounded-xl border border-violet-600/50 bg-[#070b16] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-400 transition-colors"
                              />
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setEditingNoteSessionId(null)}
                                  className="h-7 text-xs text-slate-400 hover:text-white"
                                >
                                  Cancel
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => handleSaveCandidateNote(rep.sessionId, rep.candidateName, effectiveStatus)}
                                  className="h-7 text-xs bg-violet-600 hover:bg-violet-500 gap-1 text-white font-bold"
                                >
                                  <Save className="h-3 w-3" />
                                  Save Notes
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="p-3 rounded-xl bg-[#070b16] border border-[#192542] text-xs">
                              {currentNotes ? (
                                <p className="text-slate-200 italic leading-relaxed">
                                  &ldquo;{currentNotes}&rdquo;
                                </p>
                              ) : (
                                <p className="text-slate-500 italic">
                                  No notes added yet. Click &quot;+ Add Recruiter Note&quot; to leave feedback or next round details.
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}

            {/* Pipeline Footer Note */}
            <p className="text-[11px] text-center text-slate-500">
              Shortlist decisions & notes persist in local candidate profiles and sync with candidate view. Evaluated by Adaptive InterviewIQ Gemini AI Engine.
            </p>
          </div>
        );
      })()}

      {/* ========================================================================= */}
      {/* TAB 6: RECRUITER COMPANY HIRING ANALYTICS                                 */}
      {/* ========================================================================= */}
      {activeTab === "analytics" && isRecruiter && (
        <div className="space-y-6">
          {/* Header */}
          <div className="relative rounded-3xl border border-violet-500/20 bg-gradient-to-r from-[#0d0e24]/95 via-[#0b0c21]/95 to-[#070814]/95 backdrop-blur-2xl p-6 sm:p-8 shadow-2xl overflow-hidden">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold tracking-wide bg-violet-950/80 text-violet-300 border border-violet-700/40">
                  <BarChart3 className="h-3.5 w-3.5 text-violet-400" />
                  TechCorp Global · Hiring Intelligence
                </span>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
                  Company-Wide Talent Acquisition Analytics
                </h2>
                <p className="text-xs sm:text-sm text-slate-300 max-w-xl">
                  Aggregated performance metrics, track calibrations, and competency benchmarks across all evaluated candidates.
                </p>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={handleExportPipelineCSV}
                className="gap-2 text-xs border-violet-800/60 text-violet-300 hover:bg-violet-950/50 self-start md:self-auto"
              >
                <Download className="h-3.5 w-3.5 text-violet-400" />
                Export Analytics Dataset
              </Button>
            </div>
          </div>

          {/* Top 3 Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 1. Track Distribution */}
            <Card className="p-5 space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-semibold uppercase tracking-wider text-[10px]">Track Distribution</span>
                <Briefcase className="h-4 w-4 text-violet-400" />
              </div>
              <div className="space-y-2 pt-1">
                {recruiterStats.roleBreakdown.map((rb) => (
                  <div key={rb.role} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-300 font-medium capitalize">{rb.role}</span>
                      <span className="text-indigo-400 font-mono font-bold">{rb.count} candidates ({rb.avgScore}%)</span>
                    </div>
                    <Progress value={(rb.count / (recruiterStats.total || 1)) * 100} size="sm" indicatorColor="indigo" />
                  </div>
                ))}
              </div>
            </Card>

            {/* 2. Score Tier Distribution */}
            <Card className="p-5 space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-semibold uppercase tracking-wider text-[10px]">Score Tier Distribution</span>
                <Target className="h-4 w-4 text-emerald-400" />
              </div>
              <div className="space-y-2.5 pt-1 text-xs">
                <div className="p-2.5 rounded-xl bg-emerald-950/30 border border-emerald-800/40 flex items-center justify-between">
                  <span className="text-emerald-300 font-medium">Top Tier (≥85%)</span>
                  <span className="text-emerald-400 font-mono font-bold">
                    {reports.filter((r) => r.overallScore >= 85).length} candidates
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-indigo-950/30 border border-indigo-800/40 flex items-center justify-between">
                  <span className="text-indigo-300 font-medium">Solid Hire (75–84%)</span>
                  <span className="text-indigo-400 font-mono font-bold">
                    {reports.filter((r) => r.overallScore >= 75 && r.overallScore < 85).length} candidates
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-amber-950/30 border border-amber-800/40 flex items-center justify-between">
                  <span className="text-amber-300 font-medium">Needs Focus (&lt;75%)</span>
                  <span className="text-amber-400 font-mono font-bold">
                    {reports.filter((r) => r.overallScore < 75).length} candidates
                  </span>
                </div>
              </div>
            </Card>

            {/* 3. Conversion Funnel */}
            <Card className="p-5 space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-semibold uppercase tracking-wider text-[10px]">Hiring Committee Funnel</span>
                <TrendingUp className="h-4 w-4 text-fuchsia-400" />
              </div>
              <div className="space-y-2.5 pt-1 text-xs">
                <div className="flex justify-between items-center text-slate-300">
                  <span>Evaluated Pool</span>
                  <span className="font-mono font-bold text-white">{recruiterStats.total}</span>
                </div>
                <Progress value={100} size="sm" indicatorColor="indigo" />

                <div className="flex justify-between items-center text-slate-300">
                  <span>Under Active Review</span>
                  <span className="font-mono font-bold text-amber-400">{recruiterStats.underReview}</span>
                </div>
                <Progress value={(recruiterStats.underReview / (recruiterStats.total || 1)) * 100} size="sm" indicatorColor="amber" />

                <div className="flex justify-between items-center text-slate-300">
                  <span>Shortlisted for Round 2</span>
                  <span className="font-mono font-bold text-emerald-400">{recruiterStats.shortlisted} ({recruiterStats.shortlistRate}%)</span>
                </div>
                <Progress value={recruiterStats.shortlistRate} size="sm" indicatorColor="emerald" />
              </div>
            </Card>
          </div>

          {/* Collective Competencies Across All Candidates */}
          <Card className="p-6">
            <CardHeader className="p-0 pb-4">
              <CardTitle>Collective Technical Competency Benchmarks</CardTitle>
              <CardDescription>
                Aggregated category scores across all {reports.length} candidate technical interviews:
              </CardDescription>
            </CardHeader>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {analytics.competencies.map((c) => (
                <div key={c.category} className="p-3.5 rounded-xl border border-[#1e2d4f] bg-[#070b16] space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="font-bold text-white">{c.category}</span>
                    <span className="font-mono font-bold text-indigo-400">{c.avgScore}% • {c.level}</span>
                  </div>
                  <Progress value={c.avgScore} size="sm" indicatorColor={c.avgScore >= 85 ? "emerald" : c.avgScore >= 75 ? "indigo" : "amber"} />
                  <p className="text-[10px] text-slate-400">Tested across {c.count} candidate responses</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
