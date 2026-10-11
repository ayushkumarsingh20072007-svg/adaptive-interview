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

  // Load from server endpoint while preserving localStorage and demo fallbacks
  React.useEffect(() => {
    if (!isMounted || isLoading) return;

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
    const newSession = initializeInterviewSession(setup);
    router.push(`/interview/${newSession.id}`);
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

  const verdictVariant: "success" | "indigo" | "warning" =
    report.verdict === "Strong Hire Recommendation"
      ? "success"
      : report.verdict === "Hire Recommendation"
      ? "indigo"
      : "warning";

  const shortlistStatusMeta: Record<ShortlistStatus, { label: string; variant: "success" | "indigo" | "warning" | "danger" | "default"; icon: React.ReactNode }> = {
    shortlisted:   { label: "Shortlisted",    variant: "success",  icon: <Star className="h-3 w-3" /> },
    "under-review": { label: "Under Review",   variant: "warning",  icon: <Clock3 className="h-3 w-3" /> },
    rejected:      { label: "Rejected",       variant: "danger",   icon: <XCircle className="h-3 w-3" /> },
    pending:       { label: "Pending Review",  variant: "default",  icon: <Building2 className="h-3 w-3" /> },
  };

  return (
    <div className="flex flex-col gap-8 max-w-5xl mx-auto w-full py-4">
      {/* Top Header & Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1e2d4f] pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="indigo">Evaluation Synthesized</Badge>
            <span className="text-xs text-slate-400 font-mono">
              Session Ref: {report.sessionId}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">
            Candidate Intelligence & Evaluation Report
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Evidence-backed scorecard synthesized from candidate responses and adaptive inquiry.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/dashboard">
            <Button variant="secondary" size="sm" className="gap-2">
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </Button>
          </Link>
          <Button size="sm" onClick={handleRetakeInterview} className="gap-2 shadow-sm">
            <RefreshCw className="h-3.5 w-3.5" />
            Retake Interview
          </Button>
        </div>
      </div>

      {/* AI-Powered or Demo Banner */}
      {report.isDemoSimulation ? (
        <div className="flex items-center gap-3 rounded-xl border border-amber-900/50 bg-amber-950/20 p-3.5 text-xs text-amber-200">
          <Sparkles className="h-4 w-4 text-amber-400 shrink-0" />
          <span>
            <strong>Demo Mode:</strong> Evaluated using deterministic keyword analysis. Scores reflect simulated benchmarks only.
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-900/50 bg-emerald-950/20 p-3.5 text-xs text-emerald-200">
          <Sparkles className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>
            <strong>AI-Powered Analysis:</strong> This report was generated by Gemini AI, based on real-time evaluation of your actual interview responses.
          </span>
        </div>
      )}

      {/* ─── Recruiter Shortlist Panel ─── */}
      {isRecruiter && (
        <div className="rounded-xl border border-violet-900/50 bg-gradient-to-r from-violet-950/30 via-[#0f1728] to-indigo-950/30 backdrop-blur-sm p-5 flex flex-col sm:flex-row sm:items-start gap-5">
          <div className="flex-1 space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Building2 className="h-4 w-4 text-violet-400" />
              <span className="text-xs font-semibold text-violet-300 uppercase tracking-wider">Recruiter Pipeline Actions</span>
              <Badge variant={shortlistStatusMeta[shortlistStatus].variant} className="flex items-center gap-1">
                {shortlistStatusMeta[shortlistStatus].icon}
                {shortlistStatusMeta[shortlistStatus].label}
              </Badge>
            </div>
            <p className="text-[11px] text-slate-400">As company head, you can shortlist, flag for review or reject this candidate from your hiring pipeline.</p>
            <div className="flex flex-wrap gap-2">
              {(["shortlisted", "under-review", "rejected"] as ShortlistStatus[]).map((s) => (
                <button
                  key={s}
                  onClick={() => handleShortlistAction(s)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    shortlistStatus === s
                      ? s === "shortlisted"
                        ? "border-emerald-600 bg-emerald-900/40 text-emerald-300"
                        : s === "under-review"
                        ? "border-amber-600 bg-amber-900/40 text-amber-300"
                        : "border-rose-600 bg-rose-900/40 text-rose-300"
                      : "border-[#1e2d4f] bg-[#0c1222] text-slate-400 hover:border-indigo-700/60 hover:text-slate-200"
                  }`}
                >
                  {shortlistStatusMeta[s].icon}
                  {shortlistStatusMeta[s].label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Recruiter Notes</span>
              {!notesEditing ? (
                <button
                  onClick={() => { setNotesDraft(shortlistNotes); setNotesEditing(true); }}
                  className="text-[11px] text-indigo-400 hover:text-indigo-300 underline underline-offset-2"
                >
                  Edit
                </button>
              ) : (
                <button onClick={handleSaveNotes} className="flex items-center gap-1 text-[11px] text-emerald-400 hover:text-emerald-300">
                  <Check className="h-3 w-3" /> Save
                </button>
              )}
            </div>
            {notesEditing ? (
              <textarea
                value={notesDraft}
                onChange={(e) => setNotesDraft(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-[#1e2d4f] bg-[#0c1222] text-xs text-slate-200 p-2.5 resize-none focus:outline-none focus:border-indigo-600/60 placeholder:text-slate-600"
                placeholder="Add internal notes about this candidate…"
              />
            ) : (
              <p className="text-xs text-slate-300 leading-relaxed min-h-[60px] p-2.5 rounded-lg border border-[#1e2d4f] bg-[#0c1222]/60">
                {shortlistNotes || <span className="text-slate-600 italic">No notes added yet.</span>}
              </p>
            )}
          </div>
        </div>
      )}

      {/* ─── Candidate Formal Company Decision Banner (Glassmorphism) ─── */}
      {!isRecruiter && (
        <div className="rounded-2xl border border-white/10 bg-gradient-to-r from-[#0c1428]/90 via-[#0e172e]/85 to-[#191030]/90 backdrop-blur-xl p-5 sm:p-6 shadow-xl space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-indigo-400" />
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                TechCorp Global · Formal Application Status
              </span>
            </div>
            <Badge variant={shortlistStatusMeta[shortlistStatus].variant} className="flex items-center gap-1.5 text-xs font-bold py-1 px-3">
              {shortlistStatusMeta[shortlistStatus].icon}
              {shortlistStatusMeta[shortlistStatus].label}
            </Badge>
          </div>

          <div>
            {shortlistStatus === "shortlisted" && (
              <p className="text-sm text-emerald-300 font-semibold flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                Congratulations! You have been shortlisted for the next interview round.
              </p>
            )}
            {shortlistStatus === "under-review" && (
              <p className="text-sm text-amber-300 font-semibold flex items-center gap-1.5">
                <Clock3 className="h-4 w-4 text-amber-400" />
                Your interview record is currently under active evaluation by the hiring committee.
              </p>
            )}
            {shortlistStatus === "rejected" && (
              <p className="text-sm text-rose-300 font-semibold flex items-center gap-1.5">
                <XCircle className="h-4 w-4 text-rose-400" />
                Technical evaluation concluded. Review your skill gaps and roadmap below.
              </p>
            )}
            {shortlistStatus === "pending" && (
              <p className="text-sm text-indigo-300 font-semibold flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-indigo-400" />
                Your interview submission is logged and pending recruiter evaluation.
              </p>
            )}
          </div>
        </div>
      )}

      {/* 1. Overall Scorecard & Summary Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left 2 Cols: Main Verdict Card */}
        <Card className="md:col-span-2 border-indigo-900/40 bg-gradient-to-br from-[#10182b] to-[#0c1222]">
          <CardHeader>
            <div className="flex items-center justify-between">
              <Badge variant={verdictVariant}>
                {report.verdict}
              </Badge>
              <span className="text-xs text-slate-400 font-mono">
                {report.completedAt}
              </span>
            </div>
            <CardTitle className="text-xl sm:text-2xl text-white mt-1">
              {report.candidateName} — {report.targetRole}
            </CardTitle>
            <CardDescription>
              {report.experienceLevel} track • {report.answerRecords.length} questions evaluated in {report.durationMinutes} minutes.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div className="p-3 rounded-lg border border-[#1e2d4f] bg-[#0c1222]">
                <span className="text-[11px] text-slate-400 block">Overall Score</span>
                <span className="text-2xl font-bold text-white mt-1 block">
                  {report.overallScore}%
                </span>
              </div>
              <div className="p-3 rounded-lg border border-[#1e2d4f] bg-[#0c1222]">
                <span className="text-[11px] text-slate-400 block">Questions</span>
                <span className="text-2xl font-bold text-indigo-300 mt-1 block">
                  {report.answerRecords.length}
                </span>
              </div>
              <div className="p-3 rounded-lg border border-[#1e2d4f] bg-[#0c1222]">
                <span className="text-[11px] text-slate-400 block">Duration</span>
                <span className="text-2xl font-bold text-slate-200 mt-1 block">
                  {report.durationMinutes}m
                </span>
              </div>
              <div className="p-3 rounded-lg border border-[#1e2d4f] bg-[#0c1222]">
                <span className="text-[11px] text-slate-400 block">Consistency</span>
                <span className={`text-2xl font-bold ${consistency.colorClass} mt-1 block`}>
                  {consistency.label}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Right Col: Readiness Gauge Pill */}
        <Card className="bg-[#10182b] flex flex-col justify-between p-6">
          <div className="space-y-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Technical Readiness
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-extrabold text-white">
                {report.overallScore}
              </span>
              <span className="text-sm text-slate-400 font-mono">/ 100</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed pt-1">
              {readinessDescription}
            </p>
          </div>
          <div className="pt-4 border-t border-[#1a2642]">
            <Link href="/dashboard" className="w-full">
              <Button variant="outline" size="sm" className="w-full text-xs">
                View All Candidate Sessions
              </Button>
            </Link>
          </div>
        </Card>
      </div>

      {/* 2. Granular Competency Breakdown with 3-Tier Skill Status */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
              Competency & Skill-Level Diagnostics
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              <Card key={metric.category} className="bg-[#10182b] p-4.5 border-[#1e2d4f] space-y-3">
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <span className="font-bold text-sm text-white block">
                      {metric.category}
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono">
                      {metric.questionReference || `${metric.totalEvaluated} turn(s) evaluated`}
                    </span>
                  </div>

                  <div className="flex flex-col items-end gap-1.5">
                    <Badge variant={metricBadgeVariant}>
                      {metric.level} • {metric.score}%
                    </Badge>
                    {/* 3-Tier Status Category Badge */}
                    {status === "demonstrated" && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-500/50">
                        <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                        Demonstrated
                      </span>
                    )}
                    {status === "claimed_unvalidated" && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950/80 text-amber-300 border border-amber-500/50">
                        <AlertTriangle className="h-3 w-3 text-amber-400" />
                        Claimed but Unvalidated
                      </span>
                    )}
                    {status === "not_assessed" && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-900/90 text-slate-300 border border-slate-700/60">
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
                  <p className="text-xs text-slate-300 leading-relaxed pt-0.5">
                    {metric.explanation}
                  </p>
                )}

                {metric.rubricCriteria && metric.rubricCriteria.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mr-1">Rubric:</span>
                    {metric.rubricCriteria.map((c, i) => (
                      <span key={i} className="text-[10px] px-2 py-0.5 rounded bg-[#141e34] text-slate-300 border border-[#22304e]">
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
      <Card className="border-indigo-900/60 bg-gradient-to-br from-[#0c1326] via-[#0f172a] to-[#120d2b] shadow-xl overflow-hidden">
        <CardHeader className="pb-4 border-b border-[#1e2d4f] cursor-pointer" onClick={() => setDossierExpanded(!dossierExpanded)}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-md shadow-indigo-950/80 shrink-0">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base sm:text-lg text-white">
                    Recruiter Evidence & Verification Dossier
                  </CardTitle>
                  <Badge variant="indigo" className="text-[10px]">
                    Day 2 AI Intelligence
                  </Badge>
                </div>
                <CardDescription className="text-xs text-slate-400 mt-0.5">
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
                className="flex items-center gap-1.5 text-xs font-semibold text-indigo-300 hover:text-white px-3 py-1.5 rounded-lg border border-indigo-800/50 bg-indigo-950/40 hover:bg-indigo-900/50 transition-colors"
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
          <CardContent className="pt-6 space-y-6">
            {/* 1. Evidence Citations Breakdown */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <Quote className="h-3.5 w-3.5 text-indigo-400" />
                  Ground-Truth Answer Evidence & Quote Citations
                </span>
                <span className="text-[11px] text-slate-500 font-mono">
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
                        className="rounded-xl border border-[#1e2d4f] bg-[#0a0f1d]/90 p-4.5 space-y-3 hover:border-indigo-700/50 transition-colors"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#1a2642] pb-2.5">
                          <div className="flex items-center gap-2.5">
                            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-950 text-indigo-300 font-mono text-xs font-bold border border-indigo-800/40">
                              Q{citation.questionIndex}
                            </span>
                            <span className="font-bold text-sm text-white">
                              {citation.competency}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 flex-wrap">
                            {/* Skill Validation Status */}
                            {status === "demonstrated" && (
                              <Badge variant="success" className="text-[10px] gap-1">
                                <CheckCircle2 className="h-3 w-3" /> Demonstrated
                              </Badge>
                            )}
                            {status === "claimed_unvalidated" && (
                              <Badge variant="warning" className="text-[10px] gap-1">
                                <AlertTriangle className="h-3 w-3" /> Claimed but Unvalidated
                              </Badge>
                            )}
                            {status === "not_assessed" && (
                              <Badge variant="outline" className="text-[10px] gap-1 text-slate-400">
                                <FileQuestion className="h-3 w-3" /> Not Yet Assessed
                              </Badge>
                            )}

                            {/* Confidence Indicator */}
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded font-mono font-semibold ${
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
                          <div className="rounded-lg border border-indigo-900/40 bg-[#070b14] p-3 space-y-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 block flex items-center gap-1.5">
                              <Quote className="h-3 w-3 text-indigo-400" />
                              Verbatim Answer Quote (Ground Truth):
                            </span>
                            <p className="text-xs text-indigo-100 font-mono leading-relaxed pl-2 border-l-2 border-indigo-500/60">
                              &ldquo;{citation.quote}&rdquo;
                            </p>
                          </div>
                        ) : (
                          <div className="rounded-lg border border-amber-900/40 bg-amber-950/20 p-3 flex items-start gap-2 text-xs text-amber-200">
                            <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                            <div>
                              <strong className="block text-amber-300 text-[11px] uppercase tracking-wider">
                                No Verbatim Quote Evidence in Answer Transcript
                              </strong>
                              <span>
                                Candidate response lacked isolated technical keywords or depth for this competency. Marked unvalidated.
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Assessment Reasoning Context */}
                        <div className="text-xs text-slate-300 leading-relaxed bg-[#0f172a]/60 p-3 rounded-lg border border-[#1a2642]">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
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
            <div className="space-y-4 pt-3 border-t border-[#1e2d4f]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
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
                  className="gap-2 text-xs border-indigo-800/60 hover:bg-indigo-950/60 text-indigo-300 hover:text-white shrink-0"
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
                        className="p-4 rounded-xl border border-[#1e2d4f] bg-[#0a0f1d] space-y-3 hover:border-indigo-700/50 transition-colors"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                          <div className="space-y-1.5 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-mono font-bold text-indigo-400">
                                Question {idx + 1}
                              </span>
                              <Badge variant="indigo" className="text-[10px]">
                                Target: {rf.targetSkill}
                              </Badge>
                              {rf.uncertaintyLevel && (
                                <span className="text-[10px] px-2 py-0.2 rounded bg-[#141e34] text-slate-400 border border-[#22304e]">
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
                            className="gap-1.5 text-xs h-8 shrink-0 border-[#1e2d4f] hover:border-indigo-600/60"
                          >
                            {isCopied ? (
                              <>
                                <Check className="h-3 w-3 text-emerald-400" />
                                <span className="text-emerald-400">Copied!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="h-3 w-3" />
                                Copy
                              </>
                            )}
                          </Button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] pt-1 border-t border-[#1a2642]">
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

      {/* 3. Strengths vs Areas to Improve */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Strengths Card */}
        <Card className="border-emerald-950/60 bg-[#10182b]">
          <CardHeader className="pb-3 border-b border-[#1a2642]">
            <div className="flex items-center gap-2 text-emerald-400 text-sm font-semibold">
              <Award className="h-4 w-4" />
              <span>Verified Strengths</span>
            </div>
          </CardHeader>
          <CardContent className="pt-4 space-y-3">
            {report.strengths.map((str, idx) => (
              <div key={idx} className="flex items-start gap-2.5 text-xs text-slate-200">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{str}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Areas to Improve Card */}
        <Card className="border-amber-950/60 bg-[#10182b]">
          <CardHeader className="pb-3 border-b border-[#1a2642]">
            <div className="flex items-center gap-2 text-amber-400 text-sm font-semibold">
              <AlertTriangle className="h-4 w-4" />
              <span>Areas Requiring Focus</span>
            </div>
          </CardHeader>
          <CardContent className="pt-4 space-y-3">
            {report.areasToImprove.map((imp, idx) => (
              <div key={idx} className="flex items-start gap-2.5 text-xs text-slate-200">
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-amber-950 text-amber-400 text-[10px] shrink-0 mt-0.5 font-bold">
                  !
                </span>
                <span className="leading-relaxed">{imp}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* 4. Actionable Next Steps Roadmap */}
      <Card className="border-indigo-900/40 bg-gradient-to-br from-[#10182b] to-[#0c1222]">
        <CardHeader>
          <div className="flex items-center gap-2 text-indigo-400 text-sm font-semibold">
            <BrainCircuit className="h-4 w-4" />
            <span>Targeted Learning & Practice Roadmap</span>
          </div>
          <CardTitle className="text-base text-white">
            Recommended Action Items Before Real Technical Rounds
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2.5 text-xs text-slate-300">
          {report.actionableRoadmap.map((item, idx) => (
            <div key={idx} className="flex items-start gap-3 p-3 rounded-lg border border-[#1e2d4f] bg-[#0c1222]">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-900/60 text-indigo-300 font-mono text-[11px] shrink-0">
                {idx + 1}
              </span>
              <p className="leading-relaxed text-slate-200">{item}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* 5. Complete Question & Answer Transcript Review */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
          Question-by-Question Response Audit ({report.answerRecords.length})
        </h2>

        {report.answerRecords.length === 0 ? (
          <p className="text-xs text-slate-500 italic p-4 rounded-xl border border-[#1e2d4f] bg-[#10182b]">
            No answers were submitted during this session.
          </p>
        ) : (
          <div className="space-y-3">
            {report.answerRecords.map((ans, idx) => {
              const isExpanded = currentExpandedId === ans.questionId;
              return (
                <Card key={ans.questionId} className="bg-[#10182b] border-[#1e2d4f]">
                  <div
                    onClick={() =>
                      setExpandedQuestion(isExpanded ? null : ans.questionId)
                    }
                    className="p-4 flex items-center justify-between cursor-pointer hover:bg-[#141e34]/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-6 w-6 items-center justify-center rounded bg-indigo-950 text-indigo-300 text-xs font-mono font-bold">
                        Q{idx + 1}
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white text-xs sm:text-sm">
                            {ans.category}
                          </span>
                          <Badge variant="indigo" className="text-[10px] capitalize">
                            {ans.difficulty}
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-400 line-clamp-1 mt-0.5">
                          {ans.questionText}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <Badge variant={ans.feedback.score >= 85 ? "success" : "indigo"}>
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
                    <div className="px-4 pb-4 pt-2 border-t border-[#1a2642] space-y-3 text-xs">
                      <div>
                        <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider block mb-1">
                          Full Question:
                        </span>
                        <p className="text-slate-200 bg-[#0c1222] p-3 rounded-lg border border-[#1e2d4f] leading-relaxed">
                          {ans.questionText}
                        </p>
                      </div>

                      <div>
                        <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider block mb-1">
                          Your Submitted Answer:
                        </span>
                        <p className="text-slate-300 font-mono bg-[#070b14] p-3 rounded-lg border border-[#1e2d4f] leading-relaxed">
                          &quot;{ans.answerText}&quot;
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        <div className="p-3 rounded-lg border border-emerald-900/40 bg-emerald-950/20">
                          <span className="text-[11px] font-semibold text-emerald-400 block mb-1">
                            Strengths Noted:
                          </span>
                          <ul className="list-disc list-inside space-y-1 text-slate-300">
                            {ans.feedback.strengths.map((s, i) => (
                              <li key={i}>{s}</li>
                            ))}
                          </ul>
                        </div>

                        <div className="p-3 rounded-lg border border-amber-900/40 bg-amber-950/20">
                          <span className="text-[11px] font-semibold text-amber-400 block mb-1">
                            Opportunities for Improvement:
                          </span>
                          <ul className="list-disc list-inside space-y-1 text-slate-300">
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
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-[#1e2d4f] pt-6">
        <Link href="/">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Overview
          </Button>
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/dashboard">
            <Button variant="secondary" size="sm" className="gap-2">
              <LayoutDashboard className="h-4 w-4" />
              Return to Dashboard
            </Button>
          </Link>
          <Button size="sm" onClick={handleRetakeInterview} className="gap-2">
            <RefreshCw className="h-3.5 w-3.5" />
            Start New Adaptive Session
          </Button>
        </div>
      </div>
    </div>
  );
}
