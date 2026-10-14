"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Award,
  ArrowLeft,
  RefreshCw,
  LayoutDashboard,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  BrainCircuit,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
  FileQuestion,
  Loader2,
  Star,
  Clock3,
  XCircle,
  Building2,
  Check,
  Copy,
  CheckCheck,
  Quote,
  ShieldCheck,
  HelpCircle,
  Camera,
  CameraOff,
  Users,
  UserX,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { SAMPLE_REPORT } from "@/lib/mock-data";
import { getStoredReport, saveStoredReport, getStoredSetup, updateCandidateShortlist } from "@/lib/storage";
import { initializeInterviewSession } from "@/lib/interview-engine";
import { useAuth } from "@/lib/auth-context";
import { useIsMounted } from "@/lib/use-mounted";
import {
  EvaluationReport,
  ShortlistStatus,
  SkillStatusCategory,
  RecruiterFollowUp,
  SkillMetric,
} from "@/lib/types";

interface ReportViewProps {
  sessionId: string;
}

function getSkillStatus(metric: SkillMetric): SkillStatusCategory {
  if (metric.status) return metric.status;
  // If never evaluated in live question turns, mark not_assessed
  if (!metric.totalEvaluated || metric.totalEvaluated === 0) return "not_assessed";
  // Demonstrated strictly requires BOTH adequate score AND concrete verbatim answer quote evidence
  const hasVerbatimEvidence = Boolean(metric.evidenceQuote && metric.evidenceQuote.trim().length >= 6);
  if (metric.score >= 75 && hasVerbatimEvidence) {
    return "demonstrated";
  }
  // High scores lacking verbatim answer citations or scores under threshold are marked unvalidated
  return "claimed_unvalidated";
}

function copyToClipboard(text: string, onSuccess: () => void) {
  if (typeof navigator !== "undefined" && navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).then(onSuccess).catch(() => {
      fallbackCopy(text, onSuccess);
    });
  } else {
    fallbackCopy(text, onSuccess);
  }
}

function fallbackCopy(text: string, onSuccess: () => void) {
  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
    onSuccess();
  } catch (err) {
    console.error("Clipboard copy fallback failed:", err);
  }
}

function getConsistencyAnalysis(
  answerRecords: EvaluationReport["answerRecords"],
  overallScore: number
): { label: "High" | "Moderate" | "Low" | "Variable" | "N/A"; colorClass: string } {
  if (!answerRecords || answerRecords.length === 0) {
    return { label: "N/A", colorClass: "text-slate-400" };
  }

  const scores = answerRecords.map((a) => a.feedback?.score ?? 0);

  // If candidate overall score is 0 or all answers scored 0
  if (overallScore === 0 || scores.every((s) => s === 0)) {
    return { label: "Low", colorClass: "text-rose-400" };
  }

  const mean = scores.reduce((sum, s) => sum + s, 0) / scores.length;
  const variance = scores.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / scores.length;
  const stdDev = Math.sqrt(variance);

  // High performance with low variance
  if (mean >= 75 && stdDev <= 16) {
    return { label: "High", colorClass: "text-emerald-400" };
  }

  // Large swing across questions (e.g. one question 90, another 20)
  if (stdDev > 22) {
    return { label: "Variable", colorClass: "text-amber-400" };
  }

  // Moderate score range with stable delivery
  if (mean >= 50) {
    return { label: "Moderate", colorClass: "text-indigo-300" };
  }

  return { label: "Low", colorClass: "text-rose-400" };
}

function getReadinessDescription(overallScore: number): string {
  if (overallScore >= 88) {
    return "Candidate demonstrated structured problem decomposition and consistent architectural articulation under adaptive prompting.";
  }
  if (overallScore >= 72) {
    return "Candidate exhibited solid foundational concepts and practical implementation skills, with minor gaps under complex probing.";
  }
  if (overallScore >= 45) {
    return "Candidate displayed developing competencies across core areas, but needs targeted practice in depth and system trade-offs.";
  }
  if (overallScore > 0) {
    return "Candidate attempted core questions but demonstrated significant conceptual gaps and incomplete responses across evaluated domains.";
  }
  return "Candidate responses lacked required technical depth or were left incomplete, requiring comprehensive foundational practice across all core domains.";
}

export function ReportView({ sessionId }: ReportViewProps) {
  const router = useRouter();
  const isMounted = useIsMounted();
  const { user, isLoading } = useAuth();

  const [reportState, setReportState] = React.useState<{
    status: "loading" | "ok" | "not_found" | "forbidden";
    report: EvaluationReport;
  }>(() => {
    if (sessionId === "demo-session") {
      return { status: "ok", report: SAMPLE_REPORT };
    }
    const stored = getStoredReport(sessionId);
    if (stored) {
      return { status: "ok", report: stored };
    }
    return { status: "loading", report: SAMPLE_REPORT };
  });

  // Redirect unauthenticated users to login
  React.useEffect(() => {
    if (isMounted && !isLoading && !user) {
      router.replace(`/login?redirect=/report/${encodeURIComponent(sessionId)}`);
    }
  }, [isMounted, isLoading, user, sessionId, router]);

  // Load from server endpoint while preserving localStorage and demo fallbacks
  React.useEffect(() => {
    if (!isMounted || isLoading || !user) return;

    if (sessionId === "demo-session") {
      setReportState({ status: "ok", report: SAMPLE_REPORT });
      return;
    }

    const stored = getStoredReport(sessionId);
    let cancelled = false;

    // Check localStorage authorization first if available
    if (stored) {
      const isRecruiter = (user as { role?: string } | null)?.role === "recruiter";
      if (stored.userId && stored.userId !== "guest" && !isRecruiter) {
        if (!user || user.id !== stored.userId) {
          setReportState({ status: "forbidden", report: stored });
          return;
        }
      }
      setReportState({ status: "ok", report: stored });
    } else {
      setReportState((prev) => (prev.status === "loading" ? prev : { status: "loading", report: SAMPLE_REPORT }));
    }

    // Always reconcile with server endpoint
    fetch(`/api/interview/report/${sessionId}`)
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 403) {
          setReportState({ status: "forbidden", report: stored || SAMPLE_REPORT });
          return;
        }
        if (res.status === 404) {
          if (!stored) {
            setReportState({ status: "not_found", report: SAMPLE_REPORT });
          }
          return;
        }
        if (res.ok) {
          const data = await res.json();
          if (data.report && !cancelled) {
            saveStoredReport(data.report);
            setReportState({ status: "ok", report: data.report });
          }
        }
      })
      .catch((err) => {
        if (cancelled) return;
        console.warn("Server report retrieval failed, keeping local fallback:", err);
        if (!stored) {
          setReportState({ status: "not_found", report: SAMPLE_REPORT });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isMounted, isLoading, sessionId, user]);

  const report = reportState.report;
  const isRecruiter = (user as { role?: string } | null)?.role === "recruiter";

  const [expandedQuestion, setExpandedQuestion] = React.useState<string | null>(null);
  const currentExpandedId = expandedQuestion ?? report.answerRecords[0]?.questionId ?? null;

  const [dossierExpanded, setDossierExpanded] = React.useState(true);
  const [copiedQuestionId, setCopiedQuestionId] = React.useState<string | null>(null);
  const [copiedAll, setCopiedAll] = React.useState(false);

  const statusCounts = React.useMemo(() => {
    if (report.skillStatusCounts) {
      return report.skillStatusCounts;
    }
    const demonstrated = report.metrics.filter((m) => getSkillStatus(m) === "demonstrated").length;
    const claimedUnvalidated = report.metrics.filter((m) => getSkillStatus(m) === "claimed_unvalidated").length;
    const notAssessed = report.metrics.filter((m) => getSkillStatus(m) === "not_assessed").length;
    return { demonstrated, claimedUnvalidated, notAssessed };
  }, [report]);

  function handleCopyAllQuestions() {
    const followUps = report.recruiterFollowUps || [];
    if (followUps.length === 0) return;
    const formatted = followUps
      .map(
        (rf, i) =>
          `Question ${i + 1} [Target: ${rf.targetSkill}]:\n${rf.question}\nRationale: ${rf.rationale}${
            rf.verificationContext ? `\nContext: ${rf.verificationContext}` : ""
          }`
      )
      .join("\n\n---\n\n");
    copyToClipboard(formatted, () => {
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    });
  }

  function handleCopySingleQuestion(q: RecruiterFollowUp, id: string) {
    const text = `Follow-Up Question [${q.targetSkill}]: ${q.question}\nRationale: ${q.rationale}`;
    copyToClipboard(text, () => {
      setCopiedQuestionId(id);
      setTimeout(() => setCopiedQuestionId(null), 2000);
    });
  }

  const [shortlistStatus, setShortlistStatus] = React.useState<ShortlistStatus>(
    report.shortlistStatus ?? "pending"
  );
  const [shortlistNotes, setShortlistNotes] = React.useState(report.shortlistNotes ?? "");
  const [notesEditing, setNotesEditing] = React.useState(false);
  const [notesDraft, setNotesDraft] = React.useState(report.shortlistNotes ?? "");

  React.useEffect(() => {
    if (report.shortlistStatus) {
      setShortlistStatus(report.shortlistStatus);
    }
    if (report.shortlistNotes) {
      setShortlistNotes(report.shortlistNotes);
      setNotesDraft(report.shortlistNotes);
    }
  }, [report.shortlistStatus, report.shortlistNotes]);

  function handleShortlistAction(status: ShortlistStatus) {
    setShortlistStatus(status);
    updateCandidateShortlist(report.sessionId, report.candidateName, status, shortlistNotes, user?.name);

    if (isRecruiter) {
      fetch("/api/interview/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: report.sessionId,
          candidateName: report.candidateName,
          status,
          notes: shortlistNotes || undefined,
        }),
      }).catch((err) => console.warn("Failed to persist shortlist review:", err));
    }
  }

  function handleSaveNotes() {
    setShortlistNotes(notesDraft);
    setNotesEditing(false);
    updateCandidateShortlist(report.sessionId, report.candidateName, shortlistStatus, notesDraft, user?.name);

    if (isRecruiter) {
      fetch("/api/interview/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: report.sessionId,
          candidateName: report.candidateName,
          status: shortlistStatus,
          notes: notesDraft,
        }),
      }).catch((err) => console.warn("Failed to persist review notes:", err));
    }
  }

  function handleRetakeInterview() {
    const setup = getStoredSetup(user?.id);
    if (!setup) {
      router.push("/setup");
      return;
    }
    const newSession = initializeInterviewSession(setup);
    router.push(`/interview/${newSession.id}`);
  }

  if (!isMounted || isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 text-center text-slate-400">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-400 mb-3" />
        <p className="text-sm">Authenticating scorecard session...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center max-w-md mx-auto py-20 text-center space-y-4">
        <div className="h-14 w-14 rounded-2xl bg-amber-950/40 border border-amber-800/60 flex items-center justify-center text-amber-400">
          <ShieldAlert className="h-7 w-7" />
        </div>
        <div className="space-y-1">
          <Badge variant="warning">Authentication Required</Badge>
          <h2 className="text-xl font-bold text-white mt-2">Sign In Required</h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            You must be signed in to view candidate performance reports and scorecards.
          </p>
        </div>
        <div className="flex items-center gap-3 pt-2">
          <Link href={`/login?redirect=/report/${encodeURIComponent(sessionId)}`}>
            <Button size="sm" className="bg-indigo-600 hover:bg-indigo-500">Sign In</Button>
          </Link>
          <Link href={`/signup?redirect=/report/${encodeURIComponent(sessionId)}`}>
            <Button variant="outline" size="sm" className="border-slate-800">Create Account</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (reportState.status === "loading") {
    return (
      <div className="flex flex-col items-center justify-center p-16 text-center text-slate-400">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-400 mb-3" />
        <p className="text-sm">Synthesizing candidate report...</p>
      </div>
    );
  }

  if (reportState.status === "not_found") {
    return (
      <div className="flex flex-col items-center justify-center max-w-md mx-auto py-20 text-center space-y-4">
        <div className="h-14 w-14 rounded-2xl bg-[#141e34] border border-[#1e2d4f] flex items-center justify-center text-slate-400">
          <FileQuestion className="h-7 w-7 text-indigo-400" />
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Badge variant="outline">404 Not Found</Badge>
          </div>
          <h2 className="text-xl font-bold text-white">Evaluation Report Not Found</h2>
          <p className="text-sm text-slate-400">
            No report was found matching session reference <code className="text-indigo-300 font-mono text-xs">{sessionId}</code>.
          </p>
        </div>
        <div className="flex items-center gap-3 pt-2">
          <Link href="/dashboard">
            <Button variant="secondary" size="sm" className="gap-2">
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </Button>
          </Link>
          <Link href="/setup">
            <Button size="sm" className="gap-2">
              <RefreshCw className="h-3.5 w-3.5" />
              Start Interview
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  if (reportState.status === "forbidden") {
    return (
      <div className="flex flex-col items-center justify-center max-w-md mx-auto py-20 text-center space-y-4">
        <div className="h-14 w-14 rounded-2xl bg-rose-950/40 border border-rose-800/60 flex items-center justify-center text-rose-400">
          <ShieldAlert className="h-7 w-7" />
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Badge variant="danger">403 Access Denied</Badge>
            <Badge variant="default">Confidential Record</Badge>
          </div>
          <h2 className="text-xl font-bold text-white">Private Evaluation Report</h2>
          <p className="text-sm text-slate-400">
            This candidate evaluation report belongs to an authenticated user account. You do not have permission to view or modify this report.
          </p>
        </div>
        <div className="flex items-center gap-3 pt-2">
          <Link href="/login">
            <Button size="sm" className="gap-2">
              Sign In with Account
            </Button>
          </Link>
          <Link href="/dashboard">
            <Button variant="secondary" size="sm" className="gap-2">
              <LayoutDashboard className="h-4 w-4" />
              Return to Dashboard
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const consistency = getConsistencyAnalysis(report.answerRecords, report.overallScore);
  const readinessDescription = getReadinessDescription(report.overallScore);

  const verdictVariant: "success" | "indigo" | "warning" | "danger" =
    report.verdict === "Strong Hire Recommendation"
      ? "success"
      : report.verdict === "Hire Recommendation"
      ? "indigo"
      : report.verdict === "Terminated (Integrity Policy)"
      ? "danger"
      : "warning";

  const shortlistStatusMeta: Record<ShortlistStatus, { label: string; variant: "success" | "indigo" | "warning" | "danger" | "default"; icon: React.ReactNode }> = {
    shortlisted:   { label: "Shortlisted",    variant: "success",  icon: <Star className="h-3 w-3" /> },
    "under-review": { label: "Under Review",   variant: "warning",  icon: <Clock3 className="h-3 w-3" /> },
    rejected:      { label: "Rejected",       variant: "danger",   icon: <XCircle className="h-3 w-3" /> },
    pending:       { label: "Pending Review",  variant: "default",  icon: <Building2 className="h-3 w-3" /> },
  };

  return (
    <div className="flex flex-col gap-8 max-w-5xl mx-auto w-full py-6 sm:py-8 px-4 sm:px-6">
      {/* Top Header & Navigation Bar */}
      <div className="rounded-2xl border border-slate-800/80 bg-gradient-to-r from-[#0c1427]/95 via-[#0d162a]/95 to-[#0c1427]/95 backdrop-blur-md p-6 sm:p-7 flex flex-col sm:flex-row sm:items-center justify-between gap-5 shadow-lg shadow-black/20">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5 flex-wrap">
            <Badge variant="indigo" className="px-2.5 py-0.5 text-xs font-semibold">Evaluation Synthesized</Badge>
            <span className="text-xs text-slate-400 font-mono bg-slate-900/80 px-2 py-0.5 rounded border border-slate-800">
              Session Ref: {report.sessionId}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Candidate Intelligence & Evaluation Report
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            Evidence-backed scorecard synthesized from candidate responses and adaptive inquiry.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <Link href="/dashboard">
            <Button variant="secondary" size="sm" className="gap-2 h-10 px-4 rounded-xl border-slate-700/80 hover:bg-slate-800 font-medium">
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </Button>
          </Link>
          <Button size="sm" onClick={handleRetakeInterview} className="gap-2 h-10 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 font-medium shadow-md shadow-indigo-600/20">
            <RefreshCw className="h-3.5 w-3.5" />
            Retake Interview
          </Button>
        </div>
      </div>

      {/* AI-Powered or Demo Banner */}
      {report.isDemoSimulation ? (
        <div className="flex items-center gap-3.5 rounded-2xl border border-amber-800/60 bg-amber-950/30 p-4 sm:p-5 text-xs text-amber-200 shadow-md">
          <Sparkles className="h-5 w-5 text-amber-400 shrink-0" />
          <span>
            <strong className="text-amber-300 font-semibold">Demo Mode:</strong> Evaluated using deterministic keyword analysis. Scores reflect simulated benchmarks only.
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-3.5 rounded-2xl border border-emerald-800/60 bg-emerald-950/30 p-4 sm:p-5 text-xs text-emerald-200 shadow-md">
          <Sparkles className="h-5 w-5 text-emerald-400 shrink-0" />
          <span>
            <strong className="text-emerald-300 font-semibold">AI-Powered Analysis:</strong> This report was generated by Gemini AI, based on real-time evaluation of your actual interview responses.
          </span>
        </div>
      )}

      {/* ─── Recruiter Shortlist Panel ─── */}
      {isRecruiter && (
        <div className="rounded-2xl border border-slate-800/80 bg-[#0c1427]/95 p-6 sm:p-7 flex flex-col lg:flex-row lg:items-start gap-6 shadow-md">
          <div className="flex-1 space-y-3.5">
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="h-8 w-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                <Building2 className="h-4 w-4" />
              </div>
              <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">Recruiter Pipeline Actions</span>
              <Badge variant={shortlistStatusMeta[shortlistStatus].variant} className="flex items-center gap-1.5 px-2.5 py-0.5">
                {shortlistStatusMeta[shortlistStatus].icon}
                {shortlistStatusMeta[shortlistStatus].label}
              </Badge>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              As an authorized recruiter, you can shortlist, flag for review, or archive this candidate in the recruitment pipeline.
            </p>
            <div className="flex flex-wrap gap-2.5 pt-1">
              {(["shortlisted", "under-review", "rejected"] as ShortlistStatus[]).map((s) => (
                <button
                  key={s}
                  onClick={() => handleShortlistAction(s)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all ${
                    shortlistStatus === s
                      ? s === "shortlisted"
                        ? "border-emerald-500/80 bg-emerald-950/50 text-emerald-300 shadow-sm shadow-emerald-900/30"
                        : s === "under-review"
                        ? "border-amber-500/80 bg-amber-950/50 text-amber-300 shadow-sm shadow-amber-900/30"
                        : "border-rose-500/80 bg-rose-950/50 text-rose-300 shadow-sm shadow-rose-900/30"
                      : "border-slate-800 bg-[#080d19] text-slate-400 hover:border-slate-700 hover:text-slate-200"
                  }`}
                >
                  {shortlistStatusMeta[s].icon}
                  {shortlistStatusMeta[s].label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 space-y-2.5 lg:border-l lg:border-slate-800/80 lg:pl-6">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-300 font-bold uppercase tracking-wider">Recruiter Notes</span>
              {!notesEditing ? (
                <button
                  onClick={() => { setNotesDraft(shortlistNotes); setNotesEditing(true); }}
                  className="text-xs font-medium text-indigo-400 hover:text-indigo-300 underline underline-offset-4"
                >
                  Edit
                </button>
              ) : (
                <button onClick={handleSaveNotes} className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 hover:text-emerald-300">
                  <Check className="h-3.5 w-3.5" /> Save
                </button>
              )}
            </div>
            {notesEditing ? (
              <textarea
                value={notesDraft}
                onChange={(e) => setNotesDraft(e.target.value)}
                rows={3}
                className="w-full rounded-xl border border-slate-700/80 bg-[#080d19] text-xs text-slate-200 p-3.5 resize-none focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 placeholder:text-slate-600 leading-relaxed"
                placeholder="Add internal notes about this candidate…"
              />
            ) : (
              <p className="text-xs text-slate-300 leading-relaxed min-h-[64px] p-3.5 rounded-xl border border-slate-800/80 bg-[#080d19]/80">
                {shortlistNotes || <span className="text-slate-500 italic">No notes added yet.</span>}
              </p>
            )}
          </div>
        </div>
      )}

      {/* ─── Candidate Formal Decision Banner ─── */}
      {!isRecruiter && (
        <div className="rounded-2xl border border-slate-800/80 bg-[#0c1427]/95 p-6 sm:p-7 shadow-md space-y-3.5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                <Building2 className="h-4 w-4" />
              </div>
              <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                {user?.companyName ? `${user.companyName} · Formal Application Status` : "Hiring Organization · Formal Application Status"}
              </span>
            </div>
            <Badge variant={shortlistStatusMeta[shortlistStatus].variant} className="flex items-center gap-1.5 text-xs font-bold py-1.5 px-3 rounded-lg">
              {shortlistStatusMeta[shortlistStatus].icon}
              {shortlistStatusMeta[shortlistStatus].label}
            </Badge>
          </div>

          <div>
            {shortlistStatus === "shortlisted" && (
              <p className="text-sm text-emerald-300 font-semibold flex items-center gap-2">
                <CheckCircle2 className="h-4.5 w-4.5 text-emerald-400 shrink-0" />
                Congratulations! You have been shortlisted for the next interview round.
              </p>
            )}
            {shortlistStatus === "under-review" && (
              <p className="text-sm text-amber-300 font-semibold flex items-center gap-2">
                <Clock3 className="h-4.5 w-4.5 text-amber-400 shrink-0" />
                Your interview record is currently under active evaluation by the hiring committee.
              </p>
            )}
            {shortlistStatus === "rejected" && (
              <p className="text-sm text-rose-300 font-semibold flex items-center gap-2">
                <XCircle className="h-4.5 w-4.5 text-rose-400 shrink-0" />
                Technical evaluation concluded. Review your skill gaps and roadmap below.
              </p>
            )}
            {shortlistStatus === "pending" && (
              <p className="text-sm text-indigo-300 font-semibold flex items-center gap-2">
                <Sparkles className="h-4.5 w-4.5 text-indigo-400 shrink-0" />
                Your interview submission is logged and pending recruiter evaluation.
              </p>
            )}
          </div>
        </div>
      )}

      {/* 1. Overall Scorecard & Summary Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left 2 Cols: Main Verdict Card */}
        <Card className="md:col-span-2 rounded-2xl border-slate-800/80 bg-[#0c1427]/95 shadow-md p-6 sm:p-7">
          <CardHeader className="p-0 pb-5">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <Badge variant={verdictVariant} className="px-3 py-1 text-xs font-semibold">
                {report.verdict}
              </Badge>
              <span className="text-xs text-slate-400 font-mono bg-slate-900/80 px-2.5 py-1 rounded-md border border-slate-800">
                {report.completedAt}
              </span>
            </div>
            <CardTitle className="text-xl sm:text-2xl font-bold text-white mt-3">
              {report.candidateName} — {report.targetRole}
            </CardTitle>
            <CardDescription className="text-slate-400 text-xs sm:text-sm mt-1">
              {report.experienceLevel} track • {report.answerRecords.length} questions evaluated in {report.durationMinutes} minutes.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 pt-2 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div className="p-4 rounded-xl border border-slate-800/80 bg-[#080d19]/80">
                <span className="text-xs font-medium text-slate-400 block">Overall Score</span>
                <span className="text-2xl sm:text-3xl font-extrabold text-white mt-1 block tracking-tight">
                  {report.overallScore}%
                </span>
              </div>
              <div className="p-4 rounded-xl border border-slate-800/80 bg-[#080d19]/80">
                <span className="text-xs font-medium text-slate-400 block">Questions</span>
                <span className="text-2xl sm:text-3xl font-extrabold text-indigo-400 mt-1 block tracking-tight">
                  {report.answerRecords.length}
                </span>
              </div>
              <div className="p-4 rounded-xl border border-slate-800/80 bg-[#080d19]/80">
                <span className="text-xs font-medium text-slate-400 block">Duration</span>
                <span className="text-2xl sm:text-3xl font-extrabold text-slate-200 mt-1 block tracking-tight">
                  {report.durationMinutes}m
                </span>
              </div>
              <div className="p-4 rounded-xl border border-slate-800/80 bg-[#080d19]/80">
                <span className="text-xs font-medium text-slate-400 block">Consistency</span>
                <span className={`text-2xl sm:text-3xl font-extrabold ${consistency.colorClass} mt-1 block tracking-tight`}>
                  {consistency.label}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Right Col: Readiness Gauge Pill */}
        <Card className="rounded-2xl border border-indigo-500/25 bg-gradient-to-br from-[#0f172e] via-[#0c1427] to-[#080d19] flex flex-col justify-between p-6 sm:p-7 shadow-md">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider">
                Technical Readiness
              </span>
              <Award className="h-4 w-4 text-indigo-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight">
                {report.overallScore}
              </span>
              <span className="text-sm font-semibold text-slate-400 font-mono">/ 100</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed pt-1">
              {readinessDescription}
            </p>
          </div>
          <div className="pt-5 border-t border-slate-800/80">
            <Link href="/dashboard" className="w-full">
              <Button variant="outline" size="sm" className="w-full text-xs h-10 rounded-xl border-slate-700/80 hover:bg-slate-800 text-slate-200">
                View All Candidate Sessions
              </Button>
            </Link>
          </div>
        </Card>
      </div>

      {/* 2. Granular Competency Breakdown with 3-Tier Skill Status */}
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-300">
              Competency & Skill-Level Diagnostics
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Calibrated against actual answer turns, keyword specificity, and architectural reasoning.
            </p>
          </div>

          {/* Truthful 3-Tier Skill Status Counts */}
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/70 border border-emerald-500/50 text-emerald-300 font-semibold shadow-sm">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              Demonstrated: {statusCounts.demonstrated}
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-950/70 border border-amber-500/50 text-amber-300 font-semibold shadow-sm">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
              Claimed but Unvalidated: {statusCounts.claimedUnvalidated}
            </span>
            {statusCounts.notAssessed > 0 && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900/90 border border-slate-700/60 text-slate-300 font-semibold shadow-sm">
                <FileQuestion className="h-3.5 w-3.5 text-slate-400" />
                Not Yet Assessed: {statusCounts.notAssessed}
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {report.metrics.map((metric) => {
            const status = getSkillStatus(metric);
            const metricBadgeVariant: "success" | "indigo" | "warning" | "danger" =
              metric.score >= 85
                ? "success"
                : metric.score >= 60
                ? "indigo"
                : metric.score >= 35
                ? "warning"
                : "danger";

            const metricIndicatorColor: "emerald" | "indigo" | "amber" | "rose" =
              metric.score >= 85
                ? "emerald"
                : metric.score >= 60
                ? "indigo"
                : metric.score >= 35
                ? "amber"
                : "rose";

            return (
              <Card key={metric.category} className="rounded-2xl bg-[#0c1427]/90 p-5 sm:p-6 border border-slate-800/80 space-y-4 shadow-md">
                <div className="flex justify-between items-start gap-3">
                  <div>
                    <span className="font-bold text-sm sm:text-base text-white block">
                      {metric.category}
                    </span>
                    <span className="text-xs text-slate-400 font-mono mt-0.5 block">
                      {metric.questionReference || `${metric.totalEvaluated} turn(s) evaluated`}
                    </span>
                  </div>

                  <div className="flex flex-col items-end gap-1.5">
                    <Badge variant={metricBadgeVariant} className="font-semibold text-xs px-2.5 py-0.5">
                      {metric.level} • {metric.score}%
                    </Badge>
                    {/* 3-Tier Status Category Badge */}
                    {status === "demonstrated" && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-500/50">
                        <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                        Demonstrated
                      </span>
                    )}
                    {status === "claimed_unvalidated" && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-amber-950/80 text-amber-300 border border-amber-500/50">
                        <AlertTriangle className="h-3 w-3 text-amber-400" />
                        Claimed but Unvalidated
                      </span>
                    )}
                    {status === "not_assessed" && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-slate-900/90 text-slate-300 border border-slate-700/60">
                        <FileQuestion className="h-3 w-3 text-slate-400" />
                        Not Yet Assessed
                      </span>
                    )}
                  </div>
                </div>

                <Progress
                  value={metric.score}
                  indicatorColor={metricIndicatorColor}
                  size="md"
                />

                {metric.explanation && (
                  <p className="text-xs sm:text-[13px] text-slate-300 leading-relaxed pt-1">
                    {metric.explanation}
                  </p>
                )}

                {metric.rubricCriteria && metric.rubricCriteria.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-800/60">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Rubric:</span>
                    {metric.rubricCriteria.map((c, i) => (
                      <span key={i} className="text-[11px] px-2.5 py-1 rounded-md bg-[#080d19] text-slate-300 border border-slate-800">
                        {c}
                      </span>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </div>

      {/* ─── RECRUITER EVIDENCE & VERIFICATION DOSSIER (DAY 2 INTELLIGENCE) ─── */}
      <Card className="rounded-2xl border border-slate-800/80 bg-[#0c1427]/95 shadow-md overflow-hidden">
        <CardHeader className="p-5 sm:p-6 border-b border-slate-800/80 cursor-pointer hover:bg-slate-800/20 transition-colors" onClick={() => setDossierExpanded(!dossierExpanded)}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="h-10 w-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 border border-indigo-500/20 shrink-0">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <CardTitle className="text-base sm:text-lg font-bold text-white">
                    Recruiter Evidence & Verification Dossier
                  </CardTitle>
                  <Badge variant="indigo" className="text-[10px] px-2 py-0.5">
                    AI Intelligence Dossier
                  </Badge>
                </div>
                <CardDescription className="text-xs text-slate-400 mt-1">
                  Verbatim candidate quotes, answer citations, and round-2 follow-up probing questions.
                </CardDescription>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setDossierExpanded(!dossierExpanded);
                }}
                className="flex items-center gap-2 text-xs font-semibold text-indigo-300 hover:text-white px-3.5 py-2 rounded-xl border border-slate-800 bg-[#080d19] hover:bg-slate-800/60 transition-colors"
              >
                {dossierExpanded ? (
                  <>
                    <ChevronUp className="h-4 w-4" /> Collapse Dossier
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4" /> Expand Dossier ({report.metrics.length} Competencies)
                  </>
                )}
              </button>
            </div>
          </div>
        </CardHeader>

        {dossierExpanded && (
          <CardContent className="p-5 sm:p-6 space-y-6">
            {/* 1. Evidence Citations Breakdown */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <Quote className="h-3.5 w-3.5 text-indigo-400" />
                  Ground-Truth Answer Evidence & Quote Citations
                </span>
                <span className="text-xs text-slate-500 font-mono">
                  All quotes verified against candidate answers
                </span>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {(() => {
                  // Fallback: If report has explicit evidenceCitations use them, otherwise map from metrics
                  const citations = (report.evidenceCitations && report.evidenceCitations.length > 0)
                    ? report.evidenceCitations
                    : report.metrics.map((m, idx) => ({
                        quote: m.evidenceQuote || "",
                        context: m.explanation || `Assessed with score ${m.score}% based on response keyword density.`,
                        competency: m.category,
                        questionIndex: idx + 1,
                        questionText: report.answerRecords[idx]?.questionText,
                        confidence: m.confidence || (m.evidenceQuote ? "high" : "low"),
                        status: getSkillStatus(m),
                      }));

                  return citations.map((citation, idx) => {
                    const status = citation.status || "demonstrated";
                    return (
                      <div
                        key={idx}
                        className="rounded-xl border border-slate-800/80 bg-[#080d19]/90 p-5 space-y-3.5 transition-colors"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-slate-800/80 pb-3">
                          <div className="flex items-center gap-2.5">
                            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400 font-mono text-xs font-bold border border-indigo-500/20">
                              Q{citation.questionIndex}
                            </span>
                            <span className="font-bold text-sm text-white">
                              {citation.competency}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 flex-wrap">
                            {/* Skill Validation Status */}
                            {status === "demonstrated" && (
                              <Badge variant="success" className="text-[10px] gap-1 px-2 py-0.5">
                                <CheckCircle2 className="h-3 w-3" /> Demonstrated
                              </Badge>
                            )}
                            {status === "claimed_unvalidated" && (
                              <Badge variant="warning" className="text-[10px] gap-1 px-2 py-0.5">
                                <AlertTriangle className="h-3 w-3" /> Claimed but Unvalidated
                              </Badge>
                            )}
                            {status === "not_assessed" && (
                              <Badge variant="outline" className="text-[10px] gap-1 text-slate-400 px-2 py-0.5">
                                <FileQuestion className="h-3 w-3" /> Not Yet Assessed
                              </Badge>
                            )}

                            {/* Confidence Indicator */}
                            <span
                              className={`text-[10px] px-2.5 py-0.5 rounded-md font-mono font-semibold ${
                                citation.confidence === "high"
                                  ? "bg-emerald-950/60 text-emerald-400 border border-emerald-800/40"
                                  : citation.confidence === "medium"
                                  ? "bg-indigo-950/60 text-indigo-300 border border-indigo-800/40"
                                  : "bg-rose-950/60 text-rose-300 border border-rose-800/40"
                              }`}
                            >
                              {citation.confidence === "high"
                                ? "High Confidence"
                                : citation.confidence === "medium"
                                ? "Moderate Confidence"
                                : "Uncertain / Low Evidence"}
                            </span>
                          </div>
                        </div>

                        {/* Verbatim Supporting Candidate Quote */}
                        {citation.quote ? (
                          <div className="rounded-xl border border-indigo-500/30 bg-gradient-to-r from-indigo-950/40 to-[#0c1427] p-3.5 space-y-1.5">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-300 flex items-center gap-1.5">
                              <Quote className="h-3 w-3 text-indigo-400" />
                              Verbatim Answer Quote (Ground Truth):
                            </span>
                            <p className="text-xs text-indigo-100 font-mono leading-relaxed pl-3 border-l-2 border-indigo-500/70">
                              &ldquo;{citation.quote}&rdquo;
                            </p>
                          </div>
                        ) : (
                          <div className="rounded-xl border border-amber-900/40 bg-amber-950/20 p-3.5 flex items-start gap-2.5 text-xs text-amber-200">
                            <AlertTriangle className="h-4.5 w-4.5 text-amber-400 shrink-0 mt-0.5" />
                            <div>
                              <strong className="block text-amber-300 text-xs uppercase tracking-wider font-semibold">
                                No Verbatim Quote Evidence in Answer Transcript
                              </strong>
                              <span className="text-slate-300 text-xs">
                                Candidate response lacked isolated technical keywords or depth for this competency. Marked unvalidated.
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Assessment Reasoning Context */}
                        <div className="text-xs text-slate-300 leading-relaxed bg-[#0c1427]/80 p-3.5 rounded-xl border border-slate-800/80">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                            Assessment Justification:
                          </span>
                          {citation.context}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>

            {/* 2. Recruiter Follow-Up Questions Checklist with Working 1-Click Copy */}
            <div className="space-y-4 pt-4 border-t border-slate-800/80">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                    <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
                    Recommended Follow-Up Questions (Round 2 Probing Checklist)
                  </span>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Targeted questions for interviewers to probe unvalidated resume claims and architectural boundaries.
                  </p>
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCopyAllQuestions}
                  className="gap-2 text-xs h-9 px-3.5 rounded-xl border-slate-700/80 hover:bg-slate-800 text-indigo-300 hover:text-white shrink-0 font-medium"
                >
                  {copiedAll ? (
                    <>
                      <CheckCheck className="h-3.5 w-3.5 text-emerald-400" />
                      <span className="text-emerald-400 font-semibold">Copied All Questions!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      Copy All Probing Questions
                    </>
                  )}
                </Button>
              </div>

              {/* Follow-up question cards */}
              <div className="space-y-3">
                {(() => {
                  const followUps: RecruiterFollowUp[] = (report.recruiterFollowUps && report.recruiterFollowUps.length > 0)
                    ? report.recruiterFollowUps
                    : [
                        {
                          id: "rf-fb-1",
                          question: `Can you walk through a concrete production failure you resolved related to ${report.metrics[0]?.category || "System Design"}, including how you diagnosed it under monitoring?`,
                          targetSkill: report.metrics[0]?.category || "System Design",
                          rationale: "Verify practical operational debugging and deep system recovery experience.",
                          verificationContext: "Probes real-world edge cases beyond theoretical concepts.",
                          uncertaintyLevel: "medium",
                        },
                        {
                          id: "rf-fb-2",
                          question: `How would your proposed architecture scale when user concurrency increases by 10x while maintaining latency budgets?`,
                          targetSkill: report.metrics[1]?.category || "Performance & Scaling",
                          rationale: "Tests horizontal scaling limits, bottlenecks, and database partition tolerances.",
                          verificationContext: "Assesses boundary resilience.",
                          uncertaintyLevel: "low",
                        },
                      ];

                  return followUps.map((rf, idx) => {
                    const qId = rf.id || `rf-${idx}`;
                    const isCopied = copiedQuestionId === qId;

                    return (
                      <div
                        key={qId}
                        className="p-4.5 sm:p-5 rounded-xl border border-slate-800/80 bg-[#080d19]/90 space-y-3.5 transition-colors"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                          <div className="space-y-1.5 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-mono font-bold text-indigo-400">
                                Question {idx + 1}
                              </span>
                              <Badge variant="indigo" className="text-[10px] px-2 py-0.5">
                                Target: {rf.targetSkill}
                              </Badge>
                              {rf.uncertaintyLevel && (
                                <span className="text-[10px] px-2 py-0.5 rounded-md bg-[#0c1427] text-slate-400 border border-slate-800 font-mono">
                                  Uncertainty: {rf.uncertaintyLevel.toUpperCase()}
                                </span>
                              )}
                            </div>

                            <p className="text-xs sm:text-sm font-semibold text-white leading-relaxed">
                              &ldquo;{rf.question}&rdquo;
                            </p>
                          </div>

                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleCopySingleQuestion(rf, qId)}
                            className="gap-1.5 text-xs h-8.5 px-3 rounded-xl shrink-0 border-slate-700/80 hover:border-slate-600 font-medium"
                          >
                            {isCopied ? (
                              <>
                                <Check className="h-3 w-3 text-emerald-400" />
                                <span className="text-emerald-400 font-semibold">Copied!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="h-3 w-3" />
                                Copy
                              </>
                            )}
                          </Button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-2 border-t border-slate-800/80">
                          <div className="text-slate-300">
                            <strong className="text-slate-400 font-semibold">Recruiter Rationale: </strong>
                            {rf.rationale}
                          </div>
                          {rf.verificationContext && (
                            <div className="text-slate-400 italic">
                              <strong className="text-slate-400 font-semibold not-italic">Trigger Context: </strong>
                              {rf.verificationContext}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* ─── WORKSPACE INTEGRITY & CAMERA MONITORING TELEMETRY ─── */}
      <Card className="rounded-2xl border border-slate-800/80 bg-[#0c1427]/95 shadow-md overflow-hidden">
        <CardHeader className="p-5 sm:p-6 border-b border-slate-800/80">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div
                className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 border ${
                  report.integrityStatus === "terminated_integrity"
                    ? "bg-rose-500/10 text-rose-400 border-rose-500/25"
                    : report.integrityStatus === "warning_issued"
                    ? "bg-amber-500/10 text-amber-400 border-amber-500/25"
                    : "bg-emerald-500/10 text-emerald-400 border-emerald-500/25"
                }`}
              >
                {report.integrityStatus === "terminated_integrity" ? (
                  <ShieldAlert className="h-5 w-5" />
                ) : (
                  <ShieldCheck className="h-5 w-5" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <CardTitle className="text-base sm:text-lg font-bold text-white">
                    Workspace & Camera Integrity Telemetry
                  </CardTitle>
                  <Badge
                    variant={
                      report.integrityStatus === "terminated_integrity"
                        ? "danger"
                        : report.integrityStatus === "warning_issued"
                        ? "warning"
                        : "success"
                    }
                    className="text-[10px] px-2 py-0.5"
                  >
                    {report.integrityStatus === "terminated_integrity"
                      ? "Policy Triggered · Terminated"
                      : report.integrityStatus === "warning_issued"
                      ? "Integrity Events Logged"
                      : "Verified Focus & Camera · Clean"}
                  </Badge>
                </div>
                <CardDescription className="text-xs text-slate-400 mt-1">
                  Browser window visibility and on-device camera presence telemetry recorded under policy {report.integritySummary?.policyVersion || "v1.0"}.
                </CardDescription>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <span className="text-xs font-mono px-3 py-1.5 rounded-xl border border-slate-800 bg-[#080d19] text-slate-300">
                Incidents: <strong className={report.integrityStatus === "terminated_integrity" ? "text-rose-400" : report.integrityStatus === "warning_issued" ? "text-amber-400" : "text-emerald-400"}>{report.integritySummary?.incidents ?? 0} / 2</strong>
              </span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-5 sm:p-6 space-y-5">
          {/* Metadata Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div className="p-3.5 rounded-xl border border-slate-800/80 bg-[#080d19]/80">
              <span className="text-[11px] font-medium text-slate-400 block">Policy Version</span>
              <span className="text-sm font-semibold text-white mt-0.5 block font-mono">
                {report.integritySummary?.policyVersion || "v1.0 (Focus & Camera Presence)"}
              </span>
            </div>
            <div className="p-3.5 rounded-xl border border-slate-800/80 bg-[#080d19]/80">
              <span className="text-[11px] font-medium text-slate-400 block">Candidate Policy Consent</span>
              <span className="text-sm font-semibold text-indigo-300 mt-0.5 block font-mono">
                {report.integritySummary?.acknowledgedAt
                  ? new Date(report.integritySummary.acknowledgedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                  : "Acknowledged Pre-Interview"}
              </span>
            </div>
            <div className="p-3.5 rounded-xl border border-slate-800/80 bg-[#080d19]/80">
              <span className="text-[11px] font-medium text-slate-400 block">Authoritative Enforcement</span>
              <span className={`text-sm font-semibold mt-0.5 block ${report.integrityStatus === "terminated_integrity" ? "text-rose-400" : "text-emerald-400"}`}>
                {report.integrityStatus === "terminated_integrity"
                  ? "Interview Terminated Early"
                  : "Session Active / Concluded Normally"}
              </span>
            </div>
          </div>

          {/* Event Telemetry Audit Log */}
          {report.integritySummary?.events && report.integritySummary.events.length > 0 ? (
            <div className="space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300 block">
                Recorded Telemetry Events ({report.integritySummary.events.length})
              </span>
              <div className="space-y-2.5">
                {report.integritySummary.events.map((evt, idx) => {
                  const isCameraEvent = evt.eventType.startsWith("camera_");
                  let meta: any = null;
                  try {
                    if (evt.metadata) meta = JSON.parse(evt.metadata);
                  } catch {}

                  let eventTitle = "Focus-Loss Transition";
                  let eventCategory = "Browser Focus";
                  let IconComponent = Eye;
                  let iconColor = "text-amber-400";
                  let iconBg = "bg-amber-500/10 border-amber-500/20";
                  let eventDetail = "Interview window or tab lost active browser focus.";

                  if (evt.eventType === "camera_multiple_faces") {
                    eventTitle = "Multiple Faces Detected";
                    eventCategory = "Camera Integrity";
                    IconComponent = Users;
                    iconColor = "text-rose-400";
                    iconBg = "bg-rose-500/10 border-rose-500/20";
                    eventDetail = meta?.facesDetected
                      ? `${meta.facesDetected} faces detected in frame during active verification.`
                      : "More than one face was detected in camera view.";
                  } else if (evt.eventType === "camera_missing_face") {
                    eventTitle = "Face Not Detected in Frame";
                    eventCategory = "Camera Presence";
                    IconComponent = UserX;
                    iconColor = "text-amber-400";
                    iconBg = "bg-amber-500/10 border-amber-500/20";
                    eventDetail = meta?.gracePeriodSec
                      ? `Candidate face left camera view (grace period: ${meta.gracePeriodSec}s).`
                      : "Candidate face was not detected in camera view.";
                  } else if (evt.eventType === "camera_detector_crashed" || evt.eventType === "camera_detector_recovered") {
                    eventTitle = evt.eventType === "camera_detector_crashed" ? "Detector Paused" : "Detector Resumed";
                    eventCategory = "Camera Diagnostics";
                    IconComponent = CameraOff;
                    iconColor = "text-slate-400";
                    iconBg = "bg-slate-500/10 border-slate-500/20";
                    eventDetail = "Local browser face detector state transition.";
                  } else if (evt.eventType === "visibility_hidden") {
                    eventTitle = "Tab Switched / Page Hidden";
                    eventDetail = "Browser tab was hidden or minimized.";
                  } else if (evt.eventType === "window_blur") {
                    eventTitle = "Window Unfocused";
                    eventDetail = "Candidate shifted focus away from interview window.";
                  }

                  const isTerminating = evt.actionTaken === "interview_terminated";
                  const actionBadgeText = isTerminating
                    ? "Action: Session Terminated"
                    : evt.eventType === "camera_missing_face"
                    ? "Action: Presence Advisory Logged"
                    : isCameraEvent
                    ? "Action: Camera Warning"
                    : `Action: Warning ${evt.eventNumber || 1} of 2 Displayed`;

                  return (
                    <div
                      key={evt.id || idx}
                      className="p-3.5 rounded-xl border border-slate-800/90 bg-[#080d19] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${iconBg} ${iconColor} border shrink-0`}>
                          <IconComponent className="h-4 w-4" />
                        </span>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-slate-200">
                              {eventTitle}
                            </span>
                            <span className="font-mono text-[10px] text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                              {eventCategory}
                            </span>
                            <span className="font-mono text-[10px] text-slate-500 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                              {evt.eventType}
                            </span>
                          </div>
                          <p className="text-slate-400 text-[11px] mt-0.5">
                            {eventDetail} • {evt.stageQuestionId ? `Question ${evt.stageQuestionId}` : "Active Interview Turn"}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 sm:text-right shrink-0">
                        <div className="space-y-0.5">
                          <span className="text-slate-400 font-mono text-[11px] block">
                            {new Date(evt.serverTimestamp).toLocaleString()}
                          </span>
                          <Badge
                            variant={isTerminating ? "danger" : "warning"}
                            className="text-[10px] px-2 py-0.5"
                          >
                            {actionBadgeText}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl border border-emerald-950/40 bg-emerald-950/20 flex items-center gap-3 text-xs text-emerald-200">
              <CheckCircle2 className="h-4.5 w-4.5 text-emerald-400 shrink-0" />
              <span>
                <strong>Zero Integrity Incidents:</strong> Candidate maintained active page visibility and continuous single-candidate camera presence throughout the entire monitored session.
              </span>
            </div>
          )}

          {/* Neutral Advisory Notice */}
          <div className="p-3.5 rounded-xl border border-slate-800/80 bg-[#080d19]/60 text-slate-400 text-[11px] leading-relaxed flex items-start gap-2.5">
            <HelpCircle className="h-4 w-4 text-slate-500 shrink-0 mt-0.5" />
            <span>
              <strong>Integrity Telemetry Policy:</strong> Workspace focus shifts and camera presence signals are recorded locally to ensure interview fairness. Focus events indicate window or tab state transitions; camera monitoring verifies single-candidate presence. In strict adherence to candidate privacy, face detection runs client-side in the browser—no video frames or biometrics are ever transmitted, saved, or processed on the server.
            </span>
          </div>
        </CardContent>
      </Card>

      {/* 3. Strengths vs Areas to Improve */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Strengths Card */}
        <Card className="rounded-2xl border-slate-800/80 bg-[#0c1427]/95 shadow-md p-6 sm:p-7">
          <CardHeader className="p-0 pb-4 border-b border-slate-800/80">
            <div className="flex items-center gap-2 text-emerald-400 text-sm font-bold">
              <Award className="h-4.5 w-4.5" />
              <span>Verified Strengths</span>
            </div>
          </CardHeader>
          <CardContent className="p-0 pt-4 space-y-3">
            {report.strengths.map((str, idx) => (
              <div key={idx} className="flex items-start gap-3 p-3 rounded-xl border border-emerald-950/60 bg-emerald-950/20 text-xs text-slate-200">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{str}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Areas to Improve Card */}
        <Card className="rounded-2xl border-slate-800/80 bg-[#0c1427]/95 shadow-md p-6 sm:p-7">
          <CardHeader className="p-0 pb-4 border-b border-slate-800/80">
            <div className="flex items-center gap-2 text-amber-400 text-sm font-bold">
              <AlertTriangle className="h-4.5 w-4.5" />
              <span>Areas Requiring Focus</span>
            </div>
          </CardHeader>
          <CardContent className="p-0 pt-4 space-y-3">
            {report.areasToImprove.map((imp, idx) => (
              <div key={idx} className="flex items-start gap-3 p-3 rounded-xl border border-amber-950/60 bg-amber-950/20 text-xs text-slate-200">
                <span className="flex h-4.5 w-4.5 items-center justify-center rounded-full bg-amber-900/80 text-amber-300 text-[10px] shrink-0 mt-0.5 font-bold">
                  !
                </span>
                <span className="leading-relaxed">{imp}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* 4. Actionable Next Steps Roadmap */}
      <Card className="rounded-2xl border-slate-800/80 bg-[#0c1427]/95 shadow-md p-6 sm:p-7">
        <CardHeader className="p-0 pb-5">
          <div className="flex items-center gap-2 text-indigo-400 text-sm font-bold">
            <BrainCircuit className="h-4.5 w-4.5" />
            <span>Targeted Learning & Practice Roadmap</span>
          </div>
          <CardTitle className="text-base sm:text-lg font-bold text-white mt-1">
            Recommended Action Items Before Real Technical Rounds
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 space-y-3 text-xs sm:text-sm text-slate-300">
          {report.actionableRoadmap.map((item, idx) => (
            <div key={idx} className="flex items-start gap-3.5 p-4 rounded-xl border border-slate-800/80 bg-[#080d19]/80">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-900/60 text-indigo-300 font-mono text-xs font-bold shrink-0 border border-indigo-500/20">
                {idx + 1}
              </span>
              <p className="leading-relaxed text-slate-200 text-xs sm:text-sm">{item}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* 5. Complete Question & Answer Transcript Review */}
      <div className="space-y-4">
        <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-300">
          Question-by-Question Response Audit ({report.answerRecords.length})
        </h2>

        {report.answerRecords.length === 0 ? (
          <p className="text-xs text-slate-500 italic p-5 rounded-2xl border border-slate-800/80 bg-[#0c1427]/90">
            No answers were submitted during this session.
          </p>
        ) : (
          <div className="space-y-3.5">
            {report.answerRecords.map((ans, idx) => {
              const isExpanded = currentExpandedId === ans.questionId;
              return (
                <Card key={ans.questionId} className="rounded-2xl bg-[#0c1427]/90 border border-slate-800/80 shadow-md overflow-hidden">
                  <div
                    onClick={() =>
                      setExpandedQuestion(isExpanded ? null : ans.questionId)
                    }
                    className="p-4 sm:p-5 flex items-center justify-between cursor-pointer hover:bg-slate-800/40 transition-colors"
                  >
                    <div className="flex items-center gap-3.5">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400 text-xs font-mono font-bold border border-indigo-500/20">
                        Q{idx + 1}
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white text-xs sm:text-sm">
                            {ans.category}
                          </span>
                          <Badge variant="indigo" className="text-[10px] capitalize px-2 py-0.5">
                            {ans.difficulty}
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-400 line-clamp-1 mt-1">
                          {ans.questionText}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <Badge variant={ans.feedback.score >= 85 ? "success" : "indigo"} className="px-2.5 py-0.5 text-xs font-semibold">
                        {ans.feedback.score}%
                      </Badge>
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-slate-400" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-slate-400" />
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="px-5 pb-5 pt-3 border-t border-slate-800/80 space-y-4 text-xs">
                      <div>
                        <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider block mb-1.5">
                          Full Question:
                        </span>
                        <p className="text-slate-200 bg-[#080d19] p-4 rounded-xl border border-slate-800/80 leading-relaxed text-xs sm:text-sm">
                          {ans.questionText}
                        </p>
                      </div>

                      <div>
                        <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider block mb-1.5">
                          Your Submitted Answer:
                        </span>
                        <p className="text-slate-300 font-mono bg-[#080d19] p-4 rounded-xl border border-slate-800/80 leading-relaxed text-xs">
                          &quot;{ans.answerText}&quot;
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                        <div className="p-4 rounded-xl border border-emerald-900/40 bg-emerald-950/20">
                          <span className="text-xs font-bold text-emerald-400 block mb-1.5">
                            Strengths Noted:
                          </span>
                          <ul className="list-disc list-inside space-y-1 text-slate-300 text-xs">
                            {ans.feedback.strengths.map((s, i) => (
                              <li key={i}>{s}</li>
                            ))}
                          </ul>
                        </div>

                        <div className="p-4 rounded-xl border border-amber-900/40 bg-amber-950/20">
                          <span className="text-xs font-bold text-amber-400 block mb-1.5">
                            Opportunities for Improvement:
                          </span>
                          <ul className="list-disc list-inside space-y-1 text-slate-300 text-xs">
                            {ans.feedback.gaps.map((g, i) => (
                              <li key={i}>{g}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* 6. Bottom Navigation Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-800/80 pt-6">
        <Link href="/">
          <Button variant="ghost" size="sm" className="gap-2 h-10 px-4 rounded-xl hover:bg-slate-800/60 text-slate-400 hover:text-white font-medium">
            <ArrowLeft className="h-4 w-4" />
            Back to Overview
          </Button>
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/dashboard">
            <Button variant="secondary" size="sm" className="gap-2 h-10 px-4 rounded-xl border-slate-700/80 hover:bg-slate-800 font-medium">
              <LayoutDashboard className="h-4 w-4" />
              Return to Dashboard
            </Button>
          </Link>
          <Button size="sm" onClick={handleRetakeInterview} className="gap-2 h-10 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 font-medium shadow-md shadow-indigo-600/20">
            <RefreshCw className="h-3.5 w-3.5" />
            Start New Adaptive Session
          </Button>
        </div>
      </div>
    </div>
  );
}
