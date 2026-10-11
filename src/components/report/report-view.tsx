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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { SAMPLE_REPORT } from "@/lib/mock-data";
import { getStoredReport, getStoredSetup } from "@/lib/storage";
import { initializeInterviewSession } from "@/lib/interview-engine";
import { useAuth } from "@/lib/auth-context";
import { useIsMounted } from "@/lib/use-mounted";
import { EvaluationReport } from "@/lib/types";

interface ReportViewProps {
  sessionId: string;
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

  const reportState = React.useMemo<{
    status: "loading" | "ok" | "not_found" | "forbidden";
    report: EvaluationReport;
  }>(() => {
    if (!isMounted || isLoading) {
      return { status: "loading", report: SAMPLE_REPORT };
    }
    if (sessionId === "demo-session") {
      return { status: "ok", report: SAMPLE_REPORT };
    }
    const stored = getStoredReport(sessionId);
    if (!stored) {
      return { status: "not_found", report: SAMPLE_REPORT };
    }
    // Check ownership if report is tied to a user account
    if (stored.userId && stored.userId !== "guest") {
      if (!user || user.id !== stored.userId) {
        return { status: "forbidden", report: stored };
      }
    }
    return { status: "ok", report: stored };
  }, [isMounted, isLoading, sessionId, user]);

  const report = reportState.report;

  const [expandedQuestion, setExpandedQuestion] = React.useState<string | null>(null);
  const currentExpandedId = expandedQuestion ?? report.answerRecords[0]?.questionId ?? null;

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

      {/* 2. Granular Competency Breakdown */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
          Competency & Skill-Level Breakdown
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {report.metrics.map((metric) => {
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
              <Card key={metric.category} className="bg-[#10182b] p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-semibold text-sm text-white">
                    {metric.category}
                  </span>
                  <Badge variant={metricBadgeVariant}>
                    {metric.level} • {metric.score}%
                  </Badge>
                </div>
                <Progress
                  value={metric.score}
                  indicatorColor={metricIndicatorColor}
                  size="md"
                />
                <p className="text-[11px] text-slate-400 mt-2">
                  Supported by {metric.totalEvaluated} answer turns with verified keyword density.
                </p>
              </Card>
            );
          })}
        </div>
      </div>

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
