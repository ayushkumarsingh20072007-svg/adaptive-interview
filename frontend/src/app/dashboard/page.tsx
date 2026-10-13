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
  LayoutDashboard,
  PlayCircle,
  Menu,
  X,
  Compass,
  Lock,
  Loader2,
  Upload,
  BookOpen,
  ShieldAlert,
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
import { AiAssistantPanel } from "@/components/interview/ai-assistant-panel";

interface CompetencyStat {
  category: string;
  avgScore: number;
  level: "Needs Focus" | "Developing" | "Proficient" | "Mastery";
  count: number;
  status: SkillStatusCategory;
}

type TabType = "overview" | "history" | "skills" | "settings" | "pipeline" | "analytics" | "reviews" | "practice";

export default function DashboardPage() {
  const router = useRouter();
  const { user, logout, isLoading } = useAuth();
  const userRole = (user as { role?: string } | null)?.role;
  const isRecruiter = userRole === "recruiter";

  const [activeTab, setActiveTab] = React.useState<TabType>(
    isRecruiter ? "pipeline" : "overview"
  );
  const [mobileSidebarOpen, setMobileSidebarOpen] = React.useState(false);

  const isMounted = useIsMounted();
  const [refreshKey, setRefreshKey] = React.useState(0);

  // Authentication guard: unauthenticated users cannot view private candidate or recruiter dashboards
  React.useEffect(() => {
    if (isMounted && !isLoading && !user) {
      router.replace("/login?redirect=/dashboard");
    }
  }, [isMounted, isLoading, user, router]);

  const setup: CandidateSetup = React.useMemo(() => {
    if (!user) return SAMPLE_CANDIDATE;
    const stored = getStoredSetup(user.id);
    if (stored) return stored;
    return {
      candidateName: user.name || "Candidate",
      targetRole: "fullstack",
      experienceLevel: "intermediate",
      interviewFocus: "mixed",
      interviewLength: 20,
      skills: ROLE_SKILLS.fullstack,
      userId: user.id,
      isSampleResume: false,
      createdAt: new Date().toISOString(),
    };
  }, [user]);

  const hasConfiguredResume = Boolean(
    setup?.resumeFileName || setup?.resumeText || setup?.isSampleResume
  );

  const [reports, setReports] = React.useState<EvaluationReport[]>(() => {
    if (!user) return [];
    return getAllReports(user.id, userRole as "candidate" | "recruiter" | undefined);
  });

  React.useEffect(() => {
    if (!isMounted || !user) return;
    const initial = getAllReports(user.id, userRole as "candidate" | "recruiter" | undefined);
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
  }, [isMounted, user, userRole, refreshKey]);

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
      user?.name || "Talent Committee Lead (Demo)"
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
      user?.name || "Talent Committee Lead (Demo)"
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
        `"${(user?.name || "Talent Lead (Demo)").replace(/"/g, '""')}"`,
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
    link.setAttribute("download", `InterviewIQ_Talent_Pipeline_${new Date().toISOString().slice(0, 10)}.csv`);
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
    if (!user) {
      router.push("/login");
      return;
    }
    const storedSetup = getStoredSetup(user.id);
    const hasResume = Boolean(storedSetup?.resumeFileName || storedSetup?.resumeText || storedSetup?.isSampleResume);
    if (!hasResume) {
      router.push("/setup");
      return;
    }

    setIsStarting(true);
    const sessionSetup: CandidateSetup = {
      ...(storedSetup || setup),
      targetRole: customRole || storedSetup?.targetRole || setup.targetRole,
      candidateName: user.name || storedSetup?.candidateName || "Candidate",
      userId: user.id,
    };
    const newSession = initializeInterviewSession(sessionSetup);
    window.location.assign(`/interview/${newSession.id}`);
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

  // Navigation Items
  const candidateNavItems = [
    { id: "overview" as TabType, label: "Overview", icon: LayoutDashboard },
    { id: "history" as TabType, label: "My Reports", icon: FileText, count: reports.length },
    { id: "skills" as TabType, label: "Skills & Progress", icon: BrainCircuit },
    { id: "practice" as TabType, label: "AI Practice", icon: Sparkles },
    { id: "settings" as TabType, label: "Profile", icon: User },
  ];

  const recruiterNavItems = [
    { id: "overview" as TabType, label: "Overview", icon: LayoutDashboard },
    { id: "pipeline" as TabType, label: "Candidate Pipeline", icon: Users, count: reports.length },
    { id: "analytics" as TabType, label: "Analytics", icon: BarChart3 },
    { id: "reviews" as TabType, label: "Reviews & Shortlist", icon: Star, count: recruiterStats.shortlisted + recruiterStats.underReview },
  ];

  const navItems = isRecruiter ? recruiterNavItems : candidateNavItems;

  const currentTabTitle = React.useMemo(() => {
    switch (activeTab) {
      case "overview": return isRecruiter ? "Hiring Overview" : "Candidate Overview";
      case "history": return "Evaluation Reports & Archives";
      case "skills": return "Skills & Competency Diagnostics";
      case "settings": return "Profile & Track Calibration";
      case "pipeline": return "Candidate Pipeline";
      case "analytics": return "Company Hiring Analytics";
      case "reviews": return "Shortlist Decisions & Review Notes";
      case "practice": return "AI Practice Coach";
      default: return "Dashboard";
    }
  }, [activeTab, isRecruiter]);

  if (!isMounted || isLoading) {
    return (
      <div className="min-h-screen bg-[#090e1a] flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
          <p className="text-xs text-slate-400 font-medium">Verifying workspace session...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#090e1a] flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-8 border-slate-800 bg-[#0e1628] text-center space-y-5 shadow-2xl">
          <div className="h-12 w-12 rounded-xl bg-indigo-950/60 border border-indigo-700/50 flex items-center justify-center text-indigo-400 mx-auto">
            <Lock className="h-6 w-6" />
          </div>
          <div className="space-y-1.5">
            <Badge variant="indigo" className="text-[10px]">Private Workspace</Badge>
            <h2 className="text-xl font-bold text-white">Sign In Required</h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              You must be signed in to view your candidate interview dashboard or access the recruiter pipeline.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
            <Button
              className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold h-9"
              onClick={() => router.push("/login?redirect=/dashboard")}
            >
              Sign In
            </Button>
            <Button
              variant="outline"
              className="flex-1 text-xs border-slate-700 hover:bg-slate-800/60 h-9"
              onClick={() => router.push("/signup")}
            >
              Create Account
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6 w-full max-w-7xl mx-auto pt-2 pb-10">
      {/* ========================================================================= */}
      {/* SAAS RESPONSIVE APPLICATION SHELL: LEFT SIDEBAR                          */}
      {/* ========================================================================= */}
      <aside className="lg:w-72 shrink-0 flex flex-col gap-3.5 lg:sticky lg:top-20 self-start">
        {/* Workspace Card */}
        <div className="p-4 rounded-2xl border border-slate-800/80 bg-[#0c1427] shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/30 font-bold text-xs">
                IQ
              </div>
              <div>
                <span className="font-bold text-sm text-white block leading-tight tracking-tight">InterviewIQ</span>
                <span className="text-[10px] text-slate-400 font-mono uppercase tracking-wider block mt-0.5">
                  {isRecruiter ? "Recruiter Portal" : "Candidate Hub"}
                </span>
              </div>
            </div>
            {/* Mobile toggle button */}
            <button
              onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
              className="lg:hidden p-2 rounded-xl border border-slate-700/80 text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors"
              aria-label="Toggle Navigation"
            >
              {mobileSidebarOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>

          <div className="mt-3.5 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
            <span className="text-slate-400">Environment:</span>
            <Badge variant="indigo" className="text-[10px] py-0.5 px-2 font-mono">SQLite Active</Badge>
          </div>
        </div>

        {/* Candidate Target Track Card (Candidate Only) */}
        {!isRecruiter && (
          <div className={`p-4 rounded-2xl border border-slate-800/80 bg-[#0c1427] shadow-lg flex flex-col gap-2.5 ${mobileSidebarOpen ? "block" : "hidden lg:flex"}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-indigo-400" />
                <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                  Target Track
                </span>
              </div>
              <Link
                href="/setup"
                className="text-[10px] text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
              >
                Change
              </Link>
            </div>
            <div className="rounded-xl border border-slate-800 bg-[#080e1c] p-2.5 space-y-1">
              <span className="text-xs font-semibold text-white block truncate">
                {roleName}
              </span>
              <div className="flex items-center gap-1.5 flex-wrap text-[10px] text-slate-400">
                <span className="capitalize">{setup.experienceLevel}</span>
                <span>•</span>
                <span className="capitalize">{setup.interviewFocus} Focus</span>
              </div>
            </div>
          </div>
        )}

        {/* Sidebar Nav: Desktop or open Mobile Drawer */}
        <div className={`flex flex-col gap-1 p-2 rounded-2xl border border-slate-800/80 bg-[#0c1427] shadow-lg ${mobileSidebarOpen ? "block" : "hidden lg:flex"}`}>
          <span className="px-3 py-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
            Workspace Navigation
          </span>
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            const Icon = item.icon;

            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setMobileSidebarOpen(false);
                }}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all text-left ${
                  isActive
                    ? "bg-indigo-600/20 text-indigo-200 border border-indigo-500/40 font-semibold shadow-sm"
                    : "text-slate-300 hover:text-white hover:bg-slate-800/60"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`h-4 w-4 ${isActive ? "text-indigo-400" : "text-slate-400"}`} />
                  <span>{item.label}</span>
                </div>
                {item.count !== undefined && (
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${isActive ? "bg-indigo-500/30 text-indigo-200" : "bg-slate-800 text-slate-400"}`}>
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Candidate Readiness Checklist Widget (Candidate Only) */}
        {!isRecruiter && (
          <div className={`p-4 rounded-2xl border border-slate-800/80 bg-[#0c1427] shadow-lg flex flex-col gap-3 ${mobileSidebarOpen ? "block" : "hidden lg:flex"}`}>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                Interview Readiness
              </span>
              <Badge
                variant={hasConfiguredResume ? "success" : "default"}
                className="text-[10px] py-0 px-1.5"
              >
                {hasConfiguredResume ? "100% Ready" : "50% Pending"}
              </Badge>
            </div>

            <Progress value={hasConfiguredResume ? 100 : 50} className="h-1.5 bg-slate-800" />

            <div className="space-y-2 pt-1 text-[11px]">
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <span className={`h-1.5 w-1.5 rounded-full ${hasConfiguredResume ? "bg-emerald-400" : "bg-amber-400"}`} />
                  Resume / CV
                </span>
                <span className={hasConfiguredResume ? "text-emerald-400 font-medium" : "text-amber-400 font-semibold"}>
                  {hasConfiguredResume ? "Attached" : "Required"}
                </span>
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <span className={`h-1.5 w-1.5 rounded-full ${hasConfiguredResume ? "bg-emerald-400" : "bg-slate-600"}`} />
                  AI Question Calibrator
                </span>
                <span className={hasConfiguredResume ? "text-emerald-400 font-medium" : "text-slate-500"}>
                  {hasConfiguredResume ? "Calibrated" : "Waiting for CV"}
                </span>
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <span className={`h-1.5 w-1.5 rounded-full ${hasConfiguredResume ? "bg-emerald-400" : "bg-slate-600"}`} />
                  Technical Round
                </span>
                <span className={hasConfiguredResume ? "text-emerald-400 font-medium" : "text-slate-500"}>
                  {hasConfiguredResume ? "Unlocked" : "Locked"}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* User Card at bottom of Sidebar */}
        <div className={`p-4 rounded-2xl border border-slate-800/80 bg-[#0c1427] shadow-lg flex flex-col gap-3 ${mobileSidebarOpen ? "block" : "hidden lg:flex"}`}>
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-slate-800 border border-slate-700/80 flex items-center justify-center font-bold text-xs text-indigo-300 shadow-inner">
              {displayName.slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <span className="font-semibold text-xs text-white block truncate">{displayName}</span>
              <span className="text-[10px] text-slate-400 block truncate font-mono">
                {user ? user.email : "Local Demo User"}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2.5 border-t border-slate-800/80">
            <Badge variant={isRecruiter ? "indigo" : "default"} className="text-[10px] py-0.5 px-2">
              {isRecruiter ? "Recruiter" : "Candidate"}
            </Badge>

            {user ? (
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 text-xs text-rose-400 hover:text-rose-300 transition-colors font-medium"
                title="Sign out of account"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Log Out</span>
              </button>
            ) : (
              <Link href="/login" className="text-xs text-indigo-400 hover:underline font-medium">
                Sign In
              </Link>
            )}
          </div>
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* MAIN CONTENT AREA                                                         */}
      {/* ========================================================================= */}
      <main className="flex-1 min-w-0 flex flex-col gap-6">
        {/* Compact Breadcrumb / Action Header */}
        <div className="p-5 sm:p-6 rounded-2xl border border-slate-800/80 bg-gradient-to-r from-[#0d162c]/90 via-[#0a1122]/90 to-[#0e172e]/90 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-md backdrop-blur-md">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
              <span>InterviewIQ</span>
              <span className="text-slate-600">/</span>
              <span className="text-indigo-400 font-medium">{currentTabTitle}</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">{currentTabTitle}</h1>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
            {isRecruiter ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportPipelineCSV}
                  className="gap-1.5 text-xs h-9 px-3.5 rounded-xl border-slate-700/80 text-slate-300 hover:text-white"
                >
                  <Download className="h-3.5 w-3.5 text-slate-400" />
                  Export CSV
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setRefreshKey((k) => k + 1)}
                  className="gap-1.5 text-xs h-9 px-3.5 rounded-xl border-slate-700/80"
                >
                  <RefreshCw className="h-3.5 w-3.5 text-slate-400" />
                  Refresh
                </Button>
              </>
            ) : (
              <Link href="/setup">
                <Button variant="outline" size="sm" className="gap-2 text-xs h-9 px-4 rounded-xl border-slate-700/80 text-slate-300 hover:text-white">
                  {hasConfiguredResume ? (
                    <>
                      <Settings className="h-3.5 w-3.5 text-slate-400" />
                      Configure Track / CV
                    </>
                  ) : (
                    <>
                      <Upload className="h-3.5 w-3.5 text-amber-400" />
                      Upload Resume / CV
                    </>
                  )}
                </Button>
              </Link>
            )}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* TAB 1: OVERVIEW (CANDIDATE OR RECRUITER)                                  */}
        {/* ========================================================================= */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {isRecruiter ? (
              /* --- RECRUITER EXECUTIVE OVERVIEW --- */
              <div className="space-y-6">
                {/* 4 Clean Metric Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="p-5 sm:p-6 rounded-2xl border border-slate-800/80 bg-gradient-to-br from-[#0e1628] via-[#0b1224] to-[#080e1c] shadow-md shadow-black/20 hover:border-slate-700/80 transition-all flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Candidate Pool</span>
                      <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                        <Users className="h-4 w-4" />
                      </div>
                    </div>
                    <div>
                      <span className="text-3xl font-extrabold font-mono text-white block tracking-tight">{recruiterStats.total}</span>
                      <span className="text-xs text-slate-400 mt-2 block">Total evaluated records</span>
                    </div>
                  </div>

                  <div className="p-5 sm:p-6 rounded-2xl border border-slate-800/80 bg-gradient-to-br from-[#0e1628] via-[#0b1224] to-[#080e1c] shadow-md shadow-black/20 hover:border-slate-700/80 transition-all flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Shortlisted</span>
                      <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <Star className="h-4 w-4" />
                      </div>
                    </div>
                    <div>
                      <span className="text-3xl font-extrabold font-mono text-emerald-400 block tracking-tight">{recruiterStats.shortlisted}</span>
                      <span className="text-xs text-emerald-400/90 mt-2 block">{recruiterStats.shortlistRate}% conversion rate</span>
                    </div>
                  </div>

                  <div className="p-5 sm:p-6 rounded-2xl border border-slate-800/80 bg-gradient-to-br from-[#0e1628] via-[#0b1224] to-[#080e1c] shadow-md shadow-black/20 hover:border-slate-700/80 transition-all flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Active Review</span>
                      <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        <Clock3 className="h-4 w-4" />
                      </div>
                    </div>
                    <div>
                      <span className="text-3xl font-extrabold font-mono text-amber-400 block tracking-tight">{recruiterStats.underReview + recruiterStats.pending}</span>
                      <span className="text-xs text-slate-400 mt-2 block">{recruiterStats.underReview} review · {recruiterStats.pending} pending</span>
                    </div>
                  </div>

                  <div className="p-5 sm:p-6 rounded-2xl border border-slate-800/80 bg-gradient-to-br from-[#0e1628] via-[#0b1224] to-[#080e1c] shadow-md shadow-black/20 hover:border-slate-700/80 transition-all flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Average Score</span>
                      <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                        <Award className="h-4 w-4" />
                      </div>
                    </div>
                    <div>
                      <span className="text-3xl font-extrabold font-mono text-indigo-400 block tracking-tight">{recruiterStats.avgScore}%</span>
                      <span className="text-xs text-slate-400 mt-2 block">Benchmark calibration</span>
                    </div>
                  </div>
                </div>

                {/* Quick Pipeline Summary Card */}
                <Card className="rounded-2xl border border-slate-800/80 bg-[#0c1427]/90 shadow-md overflow-hidden">
                  <CardHeader className="p-6 border-b border-slate-800/80">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-base sm:text-lg">Recent Candidate Evaluations</CardTitle>
                        <CardDescription className="text-xs mt-0.5">Top candidates across evaluated technical tracks.</CardDescription>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => setActiveTab("pipeline")} className="text-xs gap-1.5 h-8.5 rounded-xl border-slate-700">
                        View Pipeline ({reports.length})
                        <ChevronRight className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6 space-y-3">
                    {reports.slice(0, 4).map((rep) => {
                      const status = pipelineShortlists[rep.sessionId] ?? rep.shortlistStatus ?? "pending";
                      return (
                        <div key={rep.sessionId} className="p-4 rounded-xl border border-slate-800/80 bg-[#090e1a]/80 hover:bg-[#0f172a] hover:border-slate-700 transition-all flex items-center justify-between gap-4">
                          <div className="space-y-1">
                            <span className="font-semibold text-sm text-white block">{rep.candidateName}</span>
                            <span className="text-xs text-slate-400">{rep.targetRole} · {rep.completedAt}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <Badge variant={rep.overallScore >= 85 ? "success" : rep.overallScore >= 70 ? "indigo" : "warning"} className="text-xs font-mono py-0.5 px-2">
                              {rep.overallScore}%
                            </Badge>
                            <Badge variant="outline" className="text-[11px] capitalize">
                              {status}
                            </Badge>
                            <Link href={`/report/${rep.sessionId}`}>
                              <Button size="sm" variant="ghost" className="h-8 text-xs text-indigo-400 hover:text-white px-2.5">
                                Inspect
                              </Button>
                            </Link>
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              </div>
            ) : (
              /* --- CANDIDATE OVERVIEW --- */
              <div className="space-y-6">
                {/* 4 Clean Metric Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="p-5 sm:p-6 rounded-2xl border border-slate-800/80 bg-gradient-to-br from-[#0e1628] via-[#0b1224] to-[#080e1c] shadow-md shadow-black/20 hover:border-slate-700/80 transition-all flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Completed Interviews</span>
                      <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <CheckCircle2 className="h-4 w-4" />
                      </div>
                    </div>
                    <div>
                      <span className="text-3xl font-extrabold font-mono text-white block tracking-tight">{analytics.completedCount}</span>
                      <span className="text-xs text-slate-400 mt-2 block">
                        {analytics.completedCount > 0 ? "Evaluation sessions logged" : "0 sessions yet"}
                      </span>
                    </div>
                  </div>

                  <div className="p-5 sm:p-6 rounded-2xl border border-slate-800/80 bg-gradient-to-br from-[#0e1628] via-[#0b1224] to-[#080e1c] shadow-md shadow-black/20 hover:border-slate-700/80 transition-all flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Readiness Score</span>
                      <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                        <Sparkles className="h-4 w-4" />
                      </div>
                    </div>
                    <div>
                      <span className="text-3xl font-extrabold font-mono text-indigo-400 block tracking-tight">
                        {analytics.averageScore !== null ? `${analytics.averageScore}%` : "—"}
                      </span>
                      <span className="text-xs text-slate-400 mt-2 block">
                        {analytics.averageScore !== null ? (analytics.averageScore >= 85 ? "Strong Hire Tier" : "Proficient Tier") : "Pending first audit"}
                      </span>
                    </div>
                  </div>

                  <div className="p-5 sm:p-6 rounded-2xl border border-slate-800/80 bg-gradient-to-br from-[#0e1628] via-[#0b1224] to-[#080e1c] shadow-md shadow-black/20 hover:border-slate-700/80 transition-all flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Top Competency</span>
                      <div className="p-2 rounded-xl bg-violet-500/10 text-violet-400 border border-violet-500/20">
                        <Award className="h-4 w-4" />
                      </div>
                    </div>
                    <div>
                      <span className="text-sm font-bold text-emerald-400 block truncate" title={analytics.strongest?.category || ""}>
                        {analytics.strongest ? analytics.strongest.category : "—"}
                      </span>
                      <span className="text-xs text-slate-400 mt-2 block">
                        {analytics.strongest ? `${analytics.strongest.avgScore}% (${analytics.strongest.level})` : "Unlocks after session"}
                      </span>
                    </div>
                  </div>

                  <div className="p-5 sm:p-6 rounded-2xl border border-slate-800/80 bg-gradient-to-br from-[#0e1628] via-[#0b1224] to-[#080e1c] shadow-md shadow-black/20 hover:border-slate-700/80 transition-all flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Priority Drill</span>
                      <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        <Target className="h-4 w-4" />
                      </div>
                    </div>
                    <div>
                      <span className="text-sm font-bold text-amber-400 block truncate" title={analytics.priority?.category || ""}>
                        {analytics.priority ? analytics.priority.category : "—"}
                      </span>
                      <span className="text-xs text-slate-400 mt-2 block">
                        {analytics.priority ? `${analytics.priority.avgScore}% Focus` : "Unlocks after session"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Single Primary Action Card: Gated by Resume Upload */}
                {!hasConfiguredResume ? (
                  <div className="p-6 sm:p-8 rounded-2xl border border-amber-500/40 bg-gradient-to-br from-amber-950/25 via-[#141220] to-[#0c101e] shadow-xl shadow-amber-950/20 relative overflow-hidden flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    <div className="space-y-2.5 max-w-2xl relative z-10">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                          <Upload className="h-4 w-4" />
                        </div>
                        <span className="font-bold text-base sm:text-lg text-white">Step 1: Upload Resume / CV to Unlock Interview</span>
                        <Badge variant="warning" className="text-xs font-semibold">Action Required</Badge>
                      </div>
                      <p className="text-xs sm:text-sm text-slate-300/90 leading-relaxed">
                        To calibrate realistic, adaptive AI technical questions according to your real projects and background, please upload your resume first.
                      </p>
                    </div>
                    <Link href="/setup" className="shrink-0 relative z-10">
                      <Button
                        size="lg"
                        className="w-full sm:w-auto h-12 px-7 rounded-xl gap-2.5 font-bold text-sm bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white shadow-lg shadow-amber-600/30 active:scale-[0.98] transition-all"
                      >
                        <Upload className="h-4 w-4" />
                        Upload Resume / CV First
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="p-6 sm:p-8 rounded-2xl border border-indigo-500/30 bg-gradient-to-br from-[#121c38] via-[#0d152a] to-[#090e1c] shadow-xl shadow-indigo-950/40 relative overflow-hidden flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    {/* Ambient Glows */}
                    <div className="absolute -right-20 -top-20 w-64 h-64 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />
                    <div className="absolute -left-16 -bottom-16 w-52 h-52 bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />

                    <div className="space-y-3 max-w-2xl relative z-10">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                          <Sparkles className="h-4 w-4" />
                        </div>
                        <span className="font-bold text-base sm:text-lg text-white">Target Track: {roleName}</span>
                        <Badge variant="indigo" className="text-xs capitalize">{setup.experienceLevel}</Badge>
                        <Badge variant="success" className="text-xs">CV Calibrated</Badge>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-slate-400">Calibrated File:</span>
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-indigo-950/80 border border-indigo-700/60 text-xs text-indigo-300 font-mono shadow-inner">
                          <FileText className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                          <span className="max-w-[220px] sm:max-w-sm truncate">{setup.resumeFileName || "Custom Resume Profile"}</span>
                        </div>
                      </div>

                      <p className="text-xs sm:text-sm text-slate-300/90 leading-relaxed">
                        Ready to begin your adaptive technical interview. Gemini AI will ask probing questions calibrated to your experience and evaluate your answers against production rubrics.
                      </p>
                    </div>

                    <Button
                      size="lg"
                      onClick={() => handleStartNewInterview()}
                      isLoading={isStarting}
                      className="w-full sm:w-auto h-12 px-7 rounded-xl gap-2.5 font-bold text-sm shrink-0 bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white shadow-lg shadow-indigo-600/30 hover:shadow-indigo-500/50 hover:scale-[1.02] active:scale-[0.98] transition-all relative z-10"
                    >
                      <Play className="h-4 w-4 fill-current" />
                      Start Live Interview
                      <ArrowRight className="h-4 w-4 ml-0.5" />
                    </Button>
                  </div>
                )}

                {/* Recent Evaluation Reports */}
                <Card className="rounded-2xl border border-slate-800/80 bg-[#0c1427]/90 shadow-md overflow-hidden">
                  <CardHeader className="p-6 border-b border-slate-800/80">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-base sm:text-lg">Recent Evaluation Scorecards</CardTitle>
                        <CardDescription className="text-xs mt-0.5">Synthesized scorecards from your completed technical sessions.</CardDescription>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => setActiveTab("history")} className="text-xs gap-1.5 h-8.5 rounded-xl border-slate-700">
                        View All ({reports.length})
                        <ChevronRight className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6 space-y-3.5">
                    {reports.length === 0 ? (
                      <div className="text-center py-10 text-slate-400 text-xs">
                        <FileText className="h-9 w-9 mx-auto text-slate-600 mb-2.5" />
                        <p className="text-sm font-medium text-slate-300">No evaluation scorecards yet.</p>
                        <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                          Launch your first live interview to generate complete rubric performance diagnostics and gap roadmaps.
                        </p>
                        {!hasConfiguredResume ? (
                          <Link href="/setup">
                            <Button size="sm" variant="outline" className="mt-4 text-xs gap-1.5 h-9 px-4 rounded-xl border-amber-500/40 text-amber-300 hover:bg-amber-950/30">
                              <Upload className="h-3.5 w-3.5" />
                              Upload Resume / CV First
                            </Button>
                          </Link>
                        ) : (
                          <Button size="sm" onClick={() => handleStartNewInterview()} className="mt-4 text-xs gap-1.5 h-9 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20">
                            <Play className="h-3.5 w-3.5 fill-current" />
                            Launch First Interview
                          </Button>
                        )}
                      </div>
                    ) : (
                      reports.slice(0, 3).map((rep) => (
                        <div key={rep.sessionId} className="p-4 sm:p-5 rounded-xl border border-slate-800/80 bg-[#090e1a]/80 hover:bg-[#0f172a] hover:border-slate-700 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2.5 flex-wrap">
                              <span className="font-semibold text-sm text-white">{rep.targetRole}</span>
                              <Badge variant={rep.overallScore >= 85 ? "success" : rep.overallScore >= 70 ? "indigo" : "warning"} className="text-xs font-mono py-0.5 px-2">
                                {rep.overallScore}% Score
                              </Badge>
                              <Badge variant="outline" className="text-xs">{rep.verdict}</Badge>
                            </div>
                            <span className="text-xs text-slate-400 block mt-1">
                              Completed {rep.completedAt} · {rep.durationMinutes}m duration · {rep.answerRecords.length} questions
                            </span>
                          </div>
                          <Link href={`/report/${rep.sessionId}`}>
                            <Button size="sm" variant="outline" className="text-xs gap-1.5 h-8.5 px-3.5 rounded-xl border-slate-700 text-slate-300 hover:text-white">
                              <FileText className="h-3.5 w-3.5 text-indigo-400" />
                              View Report
                            </Button>
                          </Link>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        )}


        {/* ========================================================================= */}
        {/* TAB 3: EVALUATION HISTORY (CANDIDATE OR RECRUITER)                       */}
        {/* ========================================================================= */}
        {activeTab === "history" && (
          <div className="space-y-4">
            {reports.length === 0 ? (
              <EmptyState
                title="No interview sessions recorded yet"
                description="Launch your first adaptive technical session to populate your evaluation history."
                actionLabel="Launch First Interview"
                onAction={() => handleStartNewInterview()}
              />
            ) : (
              reports.map((rep) => (
                <Card key={rep.sessionId} className="rounded-2xl border border-slate-800/80 bg-[#0c1427]/90 shadow-md hover:border-slate-700/80 transition-all overflow-hidden">
                  <div className="p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
                    <div className="space-y-2 max-w-2xl">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="font-bold text-white text-base tracking-tight">{rep.targetRole}</span>
                        <Badge variant={rep.overallScore >= 85 ? "success" : rep.overallScore >= 70 ? "indigo" : "warning"} className="font-mono text-xs py-0.5 px-2">
                          {rep.overallScore}% Score
                        </Badge>
                        <Badge variant="outline" className="text-xs">{rep.verdict}</Badge>
                        <span className="text-xs text-slate-400 font-mono">Ref: {rep.sessionId}</span>
                      </div>
                      <p className="text-xs text-slate-400">
                        Completed {rep.completedAt} · {rep.durationMinutes}m duration · {rep.answerRecords.length} questions evaluated
                      </p>
                      {rep.strengths && rep.strengths[0] && (
                        <p className="text-xs text-slate-300">
                          <span className="text-emerald-400 font-medium">Demonstrated: </span>
                          {rep.strengths[0]}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2.5 shrink-0 w-full sm:w-auto">
                      <Link href={`/report/${rep.sessionId}`} className="w-full sm:w-auto">
                        <Button size="sm" variant="secondary" className="gap-2 text-xs h-9 px-4 rounded-xl w-full border-slate-700">
                          <FileText className="h-3.5 w-3.5 text-indigo-400" />
                          View Dossier
                        </Button>
                      </Link>
                      {!isRecruiter && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleStartNewInterview(rep.targetRole as TargetRole)}
                          className="gap-2 text-xs h-9 px-3.5 rounded-xl border-slate-700 text-slate-300 hover:text-white"
                        >
                          <RefreshCw className="h-3.5 w-3.5 text-slate-400" />
                          Retake
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: SKILLS & PROGRESS (CANDIDATE)                                      */}
        {/* ========================================================================= */}
        {activeTab === "skills" && (
          <div className="space-y-6">
            <Card className="rounded-2xl border border-slate-800/80 bg-[#0c1427]/90 shadow-md overflow-hidden">
              <CardHeader className="p-6 border-b border-slate-800/80">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-base sm:text-lg">Skill Matrix & Proficiency Diagnostics</CardTitle>
                    <CardDescription className="text-xs mt-0.5">
                      Granular competencies calibrated against your actual answers across {reports.length} evaluation session{reports.length > 1 ? "s" : ""}.
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/70 border border-emerald-500/50 text-emerald-300 font-semibold">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                      Demonstrated: {analytics.statusCounts.demonstrated}
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-950/70 border border-amber-500/50 text-amber-300 font-semibold">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                      Claimed: {analytics.statusCounts.claimedUnvalidated}
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                {analytics.competencies.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-8">Complete your first interview to generate skill diagnostics.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {analytics.competencies.map((metric) => (
                      <div key={metric.category} className="p-4 sm:p-5 rounded-xl border border-slate-800/80 bg-[#090e1a]/80 hover:bg-[#0f172a] hover:border-slate-700 transition-all space-y-2.5">
                        <div className="flex justify-between items-start gap-2">
                          <div>
                            <span className="font-semibold text-sm text-white block">{metric.category}</span>
                            <span className="text-xs text-slate-400 font-mono mt-0.5 block">{metric.count} turn(s) evaluated</span>
                          </div>
                          <Badge variant={metric.avgScore >= 85 ? "success" : metric.avgScore >= 70 ? "indigo" : "warning"} className="font-mono text-xs py-0.5 px-2">
                            {metric.avgScore}%
                          </Badge>
                        </div>
                        <Progress value={metric.avgScore} indicatorColor={metric.avgScore >= 85 ? "emerald" : metric.avgScore >= 70 ? "indigo" : "amber"} size="sm" />
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 5: PROFILE & CONFIGURATION (CANDIDATE)                                */}
        {/* ========================================================================= */}
        {activeTab === "settings" && (
          <div className="space-y-6">
            <Card className="rounded-2xl border border-slate-800/80 bg-[#0c1427]/90 shadow-md overflow-hidden">
              <CardHeader className="p-6 border-b border-slate-800/80">
                <CardTitle className="text-base sm:text-lg">Candidate Profile & Calibration</CardTitle>
                <CardDescription className="text-xs mt-0.5">Your current engineering track and interview calibration parameters.</CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="p-4 rounded-xl border border-slate-800/80 bg-[#090e1a]/80 space-y-1">
                    <span className="text-slate-400 font-semibold block uppercase tracking-wider text-[10px]">Candidate Name</span>
                    <span className="text-sm font-bold text-white block">{displayName}</span>
                  </div>
                  <div className="p-4 rounded-xl border border-slate-800/80 bg-[#090e1a]/80 space-y-1">
                    <span className="text-slate-400 font-semibold block uppercase tracking-wider text-[10px]">Target Track</span>
                    <span className="text-sm font-bold text-indigo-300 block">{roleName}</span>
                  </div>
                  <div className="p-4 rounded-xl border border-slate-800/80 bg-[#090e1a]/80 space-y-1">
                    <span className="text-slate-400 font-semibold block uppercase tracking-wider text-[10px]">Seniority Level</span>
                    <span className="text-sm font-bold text-white block capitalize">{setup.experienceLevel}</span>
                  </div>
                  <div className="p-4 rounded-xl border border-slate-800/80 bg-[#090e1a]/80 space-y-1">
                    <span className="text-slate-400 font-semibold block uppercase tracking-wider text-[10px]">Session Duration</span>
                    <span className="text-sm font-bold text-white block">{setup.interviewLength || 20} Minutes</span>
                  </div>
                </div>
                <div className="pt-2">
                  <Link href="/setup">
                    <Button size="sm" className="gap-2 text-xs h-9 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-md shadow-indigo-600/20">
                      <Settings className="h-3.5 w-3.5" />
                      Recalibrate Track & Upload Resume
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 5: AI PRACTICE COACH (CANDIDATE ONLY)                                 */}
        {/* ========================================================================= */}
        {activeTab === "practice" && !isRecruiter && (
          <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-indigo-400" />
                  AI Practice Coach
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Full AI tutoring outside of interviews. Ask anything — concepts, mock answers, code review, study strategies.
                </p>
              </div>
              <Badge variant="success" className="gap-1.5 px-3 py-1 self-start sm:self-auto">
                <Sparkles className="h-3 w-3" />
                Practice Mode Active
              </Badge>
            </div>

            {/* Two-column layout: assistant + tips */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Assistant Panel — full width on mobile, 2/3 on desktop */}
              <div className="lg:col-span-2">
                <AiAssistantPanel
                  mode="practice"
                  targetRole={setup.targetRole}
                  experienceLevel={setup.experienceLevel}
                  defaultCollapsed={false}
                />
              </div>

              {/* Tips Sidebar */}
              <div className="space-y-4">
                <Card className="rounded-2xl border border-indigo-800/40 bg-gradient-to-b from-[#0d1227] to-[#080e1e] shadow-md overflow-hidden">
                  <CardHeader className="p-5 border-b border-indigo-900/40">
                    <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
                      <BookOpen className="h-4 w-4 text-indigo-400" />
                      What to Practice
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-5 space-y-3 text-xs text-slate-300">
                    <div className="space-y-2">
                      <p className="font-semibold text-indigo-300 uppercase tracking-wider text-[10px]">Suggested Prompts</p>
                      {[
                        `Explain how ${setup.targetRole === "frontend" ? "React reconciliation" : setup.targetRole === "backend" ? "database indexing" : setup.targetRole === "data-analyst" ? "SQL window functions" : "system design load balancing"} works`,
                        "Give me a mock answer for a behavioral STAR question",
                        "Review this code I wrote and suggest improvements",
                        "What are the most common interview topics for my role?",
                        "Help me explain my approach to a complex problem",
                      ].map((prompt) => (
                        <button
                          key={prompt}
                          className="w-full text-left px-3 py-2 rounded-lg border border-slate-800/60 bg-slate-900/60 text-slate-300 hover:bg-indigo-950/40 hover:border-indigo-700/50 hover:text-white transition-colors text-[11px] leading-relaxed"
                          onClick={() => {
                            // Scroll to the AI panel input and pre-fill
                            const el = document.getElementById("ai-assistant-input");
                            if (el) {
                              el.focus();
                              const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;
                              nativeInputValueSetter?.call(el, prompt);
                              el.dispatchEvent(new Event("input", { bubbles: true }));
                            }
                          }}
                        >
                          &ldquo;{prompt}&rdquo;
                        </button>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card className="rounded-2xl border border-slate-800/60 bg-[#0c1427]/80 shadow-md overflow-hidden">
                  <CardContent className="p-4 space-y-2 text-xs text-slate-400">
                    <p className="font-semibold text-slate-300 flex items-center gap-1.5">
                      <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                      Practice Mode Privacy
                    </p>
                    <p>Practice conversations are not recorded in your interview history or shown to recruiters. They are purely for self-directed learning.</p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 6: RECRUITER CANDIDATE PIPELINE OR REVIEWS                            */}
        {/* ========================================================================= */}
        {(activeTab === "pipeline" || activeTab === "reviews") && isRecruiter && (() => {
          const statusMeta: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
            shortlisted:   { label: "Shortlisted",    color: "text-emerald-400", icon: <Star className="h-3 w-3" /> },
            "under-review": { label: "Under Review",   color: "text-amber-400",   icon: <Clock3 className="h-3 w-3" /> },
            rejected:      { label: "Rejected",       color: "text-rose-400",    icon: <XCircle className="h-3 w-3" /> },
            pending:       { label: "Pending Review",  color: "text-slate-400",   icon: <Building2 className="h-3 w-3" /> },
          };

          const isReviewsOnly = activeTab === "reviews";

          const filteredReports = reports.filter((rep) => {
            const effectiveStatus = (pipelineShortlists[rep.sessionId] ?? rep.shortlistStatus ?? "pending") as ShortlistStatus;
            if (isReviewsOnly && effectiveStatus !== "shortlisted" && effectiveStatus !== "under-review") {
              return false;
            }
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

          return (
            <div className="space-y-6">
              {/* Search & Filter Bar */}
              <div className="p-4 rounded-xl border border-slate-800 bg-[#0e1628] space-y-3">
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                    <input
                      type="text"
                      placeholder="Search candidate name, role, or notes..."
                      value={pipelineSearch}
                      onChange={(e) => setPipelineSearch(e.target.value)}
                      className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-800 bg-[#090e1a] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <select
                    value={pipelineRoleFilter}
                    onChange={(e) => setPipelineRoleFilter(e.target.value)}
                    className="bg-[#090e1a] border border-slate-800 rounded-lg text-xs text-slate-300 px-3 py-1.5 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="all">All Roles ({reports.length})</option>
                    <option value="fullstack">Full Stack</option>
                    <option value="frontend">Frontend</option>
                    <option value="backend">Backend</option>
                    <option value="python">Python</option>
                    <option value="data-analyst">Data Analyst</option>
                  </select>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] text-slate-400 mr-1">Status:</span>
                    {(["all", "shortlisted", "under-review", "pending", "rejected"] as const).map((st) => (
                      <button
                        key={st}
                        onClick={() => setPipelineFilter(st)}
                        className={`px-2.5 py-1 rounded text-xs capitalize transition-colors ${
                          pipelineFilter === st
                            ? "bg-indigo-600 text-white font-semibold"
                            : "bg-slate-900 text-slate-400 hover:text-white"
                        }`}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                  <span className="text-xs text-slate-400 font-mono">
                    Showing {filteredReports.length} candidates
                  </span>
                </div>
              </div>

              {/* Candidate Cards List */}
              <div className="space-y-4">
                {filteredReports.length === 0 ? (
                  <Card className="p-8 text-center text-slate-400 text-xs border-slate-800">
                    <Users className="h-8 w-8 mx-auto text-slate-600 mb-2" />
                    <p>No candidates match your current filter criteria.</p>
                  </Card>
                ) : (
                  filteredReports.map((rep) => {
                    const effectiveStatus = (pipelineShortlists[rep.sessionId] ?? rep.shortlistStatus ?? "pending") as ShortlistStatus;
                    const currentNote = pipelineNotes[rep.sessionId] ?? rep.shortlistNotes ?? "";
                    const isEditingNote = editingNoteSessionId === rep.sessionId;
                    const isExpandedTranscript = expandedTranscriptSessionId === rep.sessionId;

                    return (
                      <Card key={rep.sessionId} className="border-slate-800">
                        <div className="p-5 space-y-4">
                          {/* Card Header */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-base text-white">{rep.candidateName}</span>
                                <Badge variant={rep.overallScore >= 85 ? "success" : rep.overallScore >= 70 ? "indigo" : "warning"} className="font-mono">
                                  {rep.overallScore}%
                                </Badge>
                                <Badge variant="outline" className="text-[11px]">{rep.verdict}</Badge>
                                {rep.integrityStatus === "terminated_integrity" || rep.verdict?.includes("Terminated") ? (
                                  <Badge variant="danger" className="text-[10px] gap-1 py-0.5 px-2 font-medium">
                                    <ShieldAlert className="h-2.5 w-2.5" />
                                    Terminated (Focus Limit)
                                  </Badge>
                                ) : rep.integrityStatus === "warning_issued" ? (
                                  <Badge variant="warning" className="text-[10px] gap-1 py-0.5 px-2 font-medium">
                                    <AlertTriangle className="h-2.5 w-2.5" />
                                    1 Focus Incident
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-[10px] gap-1 py-0.5 px-2 border-emerald-500/40 text-emerald-400 bg-emerald-950/20">
                                    <ShieldCheck className="h-2.5 w-2.5" />
                                    Focus Verified
                                  </Badge>
                                )}
                              </div>
                              <span className="text-xs text-slate-400">
                                {rep.targetRole} · {rep.experienceLevel} · Completed {rep.completedAt}
                              </span>
                            </div>

                            {/* Shortlist Action Buttons */}
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {(["shortlisted", "under-review", "rejected", "pending"] as ShortlistStatus[]).map((s) => (
                                <button
                                  key={s}
                                  onClick={() => handlePipelineStatusChange(rep.sessionId, rep.candidateName, s)}
                                  className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold border transition-all ${
                                    effectiveStatus === s
                                      ? s === "shortlisted"
                                        ? "border-emerald-600 bg-emerald-950/60 text-emerald-300"
                                        : s === "under-review"
                                        ? "border-amber-600 bg-amber-950/60 text-amber-300"
                                        : s === "rejected"
                                        ? "border-rose-600 bg-rose-950/60 text-rose-300"
                                        : "border-slate-600 bg-slate-800 text-slate-200"
                                      : "border-slate-800 bg-[#090e1a] text-slate-400 hover:text-white"
                                  }`}
                                >
                                  {statusMeta[s].icon}
                                  <span className="capitalize">{statusMeta[s].label}</span>
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Recruiter Notes Area */}
                          <div className="p-3 rounded-lg border border-slate-800/80 bg-[#090e1a] space-y-2">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                                Private Hiring Notes (Persisted in SQLite)
                              </span>
                              {!isEditingNote ? (
                                <button
                                  onClick={() => {
                                    setEditingNoteDraft(currentNote);
                                    setEditingNoteSessionId(rep.sessionId);
                                  }}
                                  className="text-indigo-400 hover:underline flex items-center gap-1 text-[11px]"
                                >
                                  <Edit3 className="h-3 w-3" />
                                  Edit Note
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleSaveCandidateNote(rep.sessionId, rep.candidateName, effectiveStatus)}
                                  className="text-emerald-400 hover:text-emerald-300 flex items-center gap-1 text-[11px] font-semibold"
                                >
                                  <CheckCircle2 className="h-3 w-3" />
                                  Save to DB
                                </button>
                              )}
                            </div>

                            {isEditingNote ? (
                              <textarea
                                value={editingNoteDraft}
                                onChange={(e) => setEditingNoteDraft(e.target.value)}
                                rows={2}
                                className="w-full text-xs text-white bg-slate-900 border border-slate-700 rounded p-2 focus:outline-none focus:border-indigo-500"
                                placeholder="Add internal recruiter notes..."
                              />
                            ) : (
                              <p className="text-xs text-slate-300 italic">
                                {currentNote || <span className="text-slate-500">No review notes recorded yet.</span>}
                              </p>
                            )}
                          </div>

                          {/* Footer Actions */}
                          <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs">
                            <button
                              onClick={() => setExpandedTranscriptSessionId(isExpandedTranscript ? null : rep.sessionId)}
                              className="text-slate-400 hover:text-white flex items-center gap-1"
                            >
                              {isExpandedTranscript ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                              <span>{isExpandedTranscript ? "Collapse Answers" : "Preview Question Turns"}</span>
                            </button>
                            <Link href={`/report/${rep.sessionId}`}>
                              <Button size="sm" variant="secondary" className="gap-1.5 text-xs h-7 border-slate-700">
                                <FileText className="h-3.5 w-3.5 text-indigo-400" />
                                Inspect Full Evaluation Dossier
                              </Button>
                            </Link>
                          </div>

                          {/* Transcript Preview */}
                          {isExpandedTranscript && rep.answerRecords && (
                            <div className="pt-3 border-t border-slate-800 space-y-2">
                              {rep.answerRecords.map((ans, idx) => (
                                <div key={ans.questionId} className="p-2.5 rounded bg-slate-900/40 border border-slate-800/60 text-xs space-y-1">
                                  <span className="font-semibold text-indigo-300 block">Q{idx + 1}: {ans.questionText}</span>
                                  <p className="text-slate-300 italic">&ldquo;{ans.answerText}&rdquo;</p>
                                  <span className="text-[10px] text-emerald-400 block font-mono">Score: {ans.feedback?.score}%</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </Card>
                    );
                  })
                )}
              </div>
            </div>
          );
        })()}

        {/* ========================================================================= */}
        {/* TAB 7: HIRING ANALYTICS (RECRUITER)                                       */}
        {/* ========================================================================= */}
        {activeTab === "analytics" && isRecruiter && (
          <div className="space-y-6">
            <Card className="border-slate-800">
              <CardHeader>
                <CardTitle>Hiring Track & Role Distribution</CardTitle>
                <CardDescription>Aggregate evaluation performance across active technical candidate pools.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {recruiterStats.roleBreakdown.map((item) => (
                    <div key={item.role} className="p-4 rounded-xl border border-slate-800 bg-slate-900/50 flex justify-between items-center">
                      <div>
                        <span className="font-bold text-sm text-white block capitalize">{item.role}</span>
                        <span className="text-xs text-slate-400">{item.count} evaluated candidate(s)</span>
                      </div>
                      <Badge variant="indigo" className="font-mono text-xs">
                        Avg: {item.avgScore}%
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
