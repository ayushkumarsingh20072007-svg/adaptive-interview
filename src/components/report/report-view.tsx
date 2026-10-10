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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { EvaluationReport } from "@/lib/types";
import { SAMPLE_REPORT } from "@/lib/mock-data";
import { getStoredReport, getStoredSetup } from "@/lib/storage";
import { initializeInterviewSession } from "@/lib/interview-engine";

interface ReportViewProps {
  sessionId: string;
}

export function ReportView({ sessionId }: ReportViewProps) {
  const router = useRouter();

  // Initialize report directly from storage without cascading renders
  const [report] = React.useState<EvaluationReport>(() => {
    return getStoredReport(sessionId) || SAMPLE_REPORT;
  });

  const [expandedQuestion, setExpandedQuestion] = React.useState<string | null>(() => {
    const rep = getStoredReport(sessionId) || SAMPLE_REPORT;
    return rep.answerRecords[0]?.questionId || null;
  });

  function handleRetakeInterview() {
    const setup = getStoredSetup();
    const newSession = initializeInterviewSession(setup);
    router.push(`/interview/${newSession.id}`);
  }

  const isStrong = report.overallScore >= 88;

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

      {/* Simulated Demonstration Banner */}
      <div className="flex items-center gap-3 rounded-xl border border-indigo-900/60 bg-indigo-950/30 p-3.5 text-xs text-indigo-200">
        <Sparkles className="h-4 w-4 text-indigo-400 shrink-0" />
        <span>
          <strong>Demonstration Mode:</strong> Evaluated using deterministic keyword and structure analysis. Scores reflect simulated performance benchmarks.
        </span>
      </div>

      {/* 1. Overall Scorecard & Summary Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left 2 Cols: Main Verdict Card */}
        <Card className="md:col-span-2 border-indigo-900/40 bg-gradient-to-br from-[#10182b] to-[#0c1222]">
          <CardHeader>
            <div className="flex items-center justify-between">
              <Badge variant={isStrong ? "success" : "indigo"}>
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
                <span className="text-2xl font-bold text-emerald-400 mt-1 block">
                  High
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
              Candidate demonstrated structured problem decomposition and consistent architectural articulation under adaptive prompting.
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
          {report.metrics.map((metric) => (
            <Card key={metric.category} className="bg-[#10182b] p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="font-semibold text-sm text-white">
                  {metric.category}
                </span>
                <Badge variant={metric.score >= 90 ? "success" : "indigo"}>
                  {metric.level} • {metric.score}%
                </Badge>
              </div>
              <Progress
                value={metric.score}
                indicatorColor={metric.score >= 90 ? "emerald" : "indigo"}
                size="md"
              />
              <p className="text-[11px] text-slate-400 mt-2">
                Supported by {metric.totalEvaluated} answer turns with verified keyword density.
              </p>
            </Card>
          ))}
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
              const isExpanded = expandedQuestion === ans.questionId;
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
