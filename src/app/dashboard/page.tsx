"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Play,
  FileText,
  BrainCircuit,
  TrendingUp,
  Sparkles,
  Award,
  CheckCircle2,
  Settings,
  History,
  Layers,
  ArrowRight,
  User,
  PlusCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/ui/status-states";
import { CandidateSetup, EvaluationReport } from "@/lib/types";
import { ROLE_LABELS, SAMPLE_CANDIDATE, SAMPLE_REPORT } from "@/lib/mock-data";
import { getStoredSetup, getAllReports } from "@/lib/storage";
import { initializeInterviewSession } from "@/lib/interview-engine";
import { useIsMounted } from "@/lib/use-mounted";

export default function DashboardPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = React.useState<"overview" | "history" | "skills" | "settings">("overview");

  const isMounted = useIsMounted();

  const setup: CandidateSetup = React.useMemo(() => {
    if (!isMounted) return SAMPLE_CANDIDATE;
    return getStoredSetup() || SAMPLE_CANDIDATE;
  }, [isMounted]);

  const reports: EvaluationReport[] = React.useMemo(() => {
    if (!isMounted) return [SAMPLE_REPORT];
    return getAllReports() || [SAMPLE_REPORT];
  }, [isMounted]);

  const [isStarting, setIsStarting] = React.useState(false);

  function handleStartNewInterview() {
    setIsStarting(true);
    const newSession = initializeInterviewSession(setup);
    setTimeout(() => {
      router.push(`/interview/${newSession.id}`);
    }, 200);
  }

  const roleName = ROLE_LABELS[setup.targetRole] || "Software Engineer";

  return (
    <div className="flex flex-col gap-8 max-w-6xl mx-auto w-full py-4">
      {/* Top Header & Greeting */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1e2d4f] pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="indigo">Candidate Workspace</Badge>
            <span className="text-xs text-slate-400 font-mono">
              Target Track: {roleName}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">
            Welcome back, {setup.candidateName || "Candidate"}
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Track evaluation trajectories, review evidence-backed interview audits, and launch adaptive sessions.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/setup">
            <Button variant="secondary" size="sm" className="gap-1.5">
              <Settings className="h-4 w-4" />
              Re-calibrate Profile
            </Button>
          </Link>
          <Button
            size="sm"
            onClick={handleStartNewInterview}
            isLoading={isStarting}
            className="gap-2 shadow-md shadow-indigo-950/60"
          >
            <Play className="h-3.5 w-3.5 fill-current" />
            Launch Live Interview
          </Button>
        </div>
      </div>

      {/* Dashboard Sub-navigation Tabs */}
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

      {/* TAB CONTENT: 1. OVERVIEW */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Top Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-4 bg-[#10182b] border-[#1e2d4f]">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Completed Audits</span>
                <FileText className="h-4 w-4 text-indigo-400" />
              </div>
              <p className="text-2xl font-bold text-white mt-2">{reports.length}</p>
              <p className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Evidence-verified sessions
              </p>
            </Card>

            <Card className="p-4 bg-[#10182b] border-[#1e2d4f]">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Composite Readiness</span>
                <TrendingUp className="h-4 w-4 text-indigo-400" />
              </div>
              <p className="text-2xl font-bold text-indigo-300 mt-2">
                {reports[0]?.overallScore || 88}%
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                {reports[0]?.verdict || "Strong Hire Track"}
              </p>
            </Card>

            <Card className="p-4 bg-[#10182b] border-[#1e2d4f]">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Calibrated Target</span>
                <Award className="h-4 w-4 text-amber-400" />
              </div>
              <p className="text-base font-semibold text-white mt-2 truncate">
                {roleName}
              </p>
              <p className="text-[11px] text-slate-400 mt-1 capitalize">
                {setup.experienceLevel} • {setup.interviewLength || 20} min format
              </p>
            </Card>

            <Card className="p-4 bg-[#10182b] border-[#1e2d4f]">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Resume Status</span>
                <Sparkles className="h-4 w-4 text-emerald-400" />
              </div>
              <p className="text-sm font-semibold text-white mt-2 truncate">
                {setup.resumeFileName || "Sample Profile"}
              </p>
              <p className="text-[11px] text-indigo-300 mt-1">
                {setup.skills.length} competencies indexed
              </p>
            </Card>
          </div>

          {/* Quick Launch & Readiness Summary Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Quick Launch Card */}
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
                  Engage in real-time adaptive questioning that automatically follows up on your architectural decisions, state bounds, and code depth.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border border-[#1e2d4f] bg-[#070b14]/60 p-4 space-y-2 text-xs">
                  <div className="flex items-center justify-between text-slate-300 font-medium">
                    <span>Session Calibration</span>
                    <span className="text-indigo-400">{setup.interviewFocus.replace("-", " ").toUpperCase()}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Target Duration</span>
                    <span>{setup.interviewLength || 20} Minutes (~3-4 dynamic questions)</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Engine Mode</span>
                    <span>Deterministic Adaptive Simulation (Hackathon Demo)</span>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                <Button
                  onClick={handleStartNewInterview}
                  isLoading={isStarting}
                  className="w-full sm:w-auto gap-2 shadow-lg shadow-indigo-950/60"
                >
                  <Play className="h-4 w-4 fill-current" />
                  Start Live Session Now
                </Button>
                <Link href="/setup" className="text-xs text-slate-400 hover:text-indigo-300">
                  Switch Target Role or Focus →
                </Link>
              </CardFooter>
            </Card>

            {/* Right: Key Skills Readiness Radar */}
            <Card className="bg-[#10182b]">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Competency Readiness</CardTitle>
                <CardDescription>
                  Synthesized across historical interview performances.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {(reports[0]?.metrics || [
                  { category: "System Architecture", score: 92, level: "Mastery" },
                  { category: "Frontend Performance", score: 89, level: "Mastery" },
                  { category: "Concurrency & State", score: 84, level: "Proficient" },
                  { category: "Technical Precision", score: 87, level: "Proficient" },
                ]).slice(0, 4).map((m) => (
                  <div key={m.category} className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-300 font-medium">{m.category}</span>
                      <span className="text-indigo-400 font-mono font-semibold">{m.score}%</span>
                    </div>
                    <Progress
                      value={m.score}
                      indicatorColor={m.score >= 90 ? "emerald" : "indigo"}
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
                  View Comprehensive Breakdown →
                </button>
              </CardFooter>
            </Card>
          </div>

          {/* Recent Interview History Preview */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
                Recent Completed Evaluations
              </h2>
              <button
                onClick={() => setActiveTab("history")}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-medium"
              >
                View all ({reports.length})
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
                      <Badge variant={rep.overallScore >= 88 ? "success" : "indigo"}>
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
                      {rep.answerRecords.length} questions answered • {rep.durationMinutes} min elapsed
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="text-xs text-slate-300">
                    <p className="line-clamp-2 text-slate-400">
                      Top strength: {rep.strengths[0]}
                    </p>
                  </CardContent>
                  <CardFooter className="pt-2">
                    <Link href={`/report/${rep.sessionId}`} className="w-full">
                      <Button variant="outline" size="sm" className="w-full gap-2">
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

      {/* TAB CONTENT: 2. INTERVIEW HISTORY */}
      {activeTab === "history" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-white">
              Evaluation Archives & Audit Logs
            </h2>
            <Button size="sm" onClick={handleStartNewInterview} className="gap-2">
              <PlusCircle className="h-4 w-4" />
              New Interview
            </Button>
          </div>

          {reports.length === 0 ? (
            <EmptyState
              title="No interview sessions recorded yet"
              description="Launch your first adaptive technical session to populate your evaluation history."
              actionLabel="Launch First Interview"
              onAction={handleStartNewInterview}
            />
          ) : (
            <div className="space-y-3">
              {reports.map((rep) => (
                <Card
                  key={rep.sessionId}
                  className="bg-[#10182b] hover:border-indigo-800/60 transition-colors"
                >
                  <div className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white text-base">
                          {rep.targetRole}
                        </span>
                        <Badge variant={rep.overallScore >= 88 ? "success" : "indigo"}>
                          {rep.overallScore}% Score
                        </Badge>
                        <span className="text-xs text-slate-400 font-mono">
                          Session: {rep.sessionId}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">
                        Completed on {rep.completedAt} • {rep.durationMinutes} minutes • {rep.answerRecords.length} questions evaluated
                      </p>
                      <p className="text-xs text-slate-300">
                        <span className="text-emerald-400 font-medium">Demonstrated: </span>
                        {rep.strengths[0]}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <Link href={`/report/${rep.sessionId}`} className="w-full sm:w-auto">
                        <Button size="sm" variant="secondary" className="gap-2 w-full">
                          <FileText className="h-4 w-4 text-indigo-400" />
                          View Full Report
                        </Button>
                      </Link>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT: 3. SKILLS & READINESS */}
      {activeTab === "skills" && (
        <div className="space-y-6">
          <Card className="bg-[#10182b]">
            <CardHeader>
              <CardTitle>Skill Matrix & Proficiency Diagnostics</CardTitle>
              <CardDescription>
                Granular competencies calibrated against your answers in {roleName}.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {(reports[0]?.metrics || []).map((metric) => (
                  <div key={metric.category} className="space-y-2 p-4 rounded-xl border border-[#1e2d4f] bg-[#0c1222]">
                    <div className="flex justify-between items-center text-sm">
                      <span className="font-semibold text-white">{metric.category}</span>
                      <Badge variant={metric.score >= 90 ? "success" : "indigo"}>
                        {metric.level} • {metric.score}%
                      </Badge>
                    </div>
                    <Progress
                      value={metric.score}
                      indicatorColor={metric.score >= 90 ? "emerald" : "indigo"}
                      size="md"
                    />
                    <p className="text-[11px] text-slate-400 pt-1">
                      Evaluated across {metric.totalEvaluated} adaptive inquiry turns with keyword alignment.
                    </p>
                  </div>
                ))}
              </div>

              {/* Actionable recommendations */}
              <div className="rounded-xl border border-indigo-900/40 bg-indigo-950/20 p-5 space-y-3">
                <div className="flex items-center gap-2 text-indigo-300 font-semibold text-sm">
                  <Award className="h-4 w-4" />
                  Targeted Learning Roadmap
                </div>
                <ul className="space-y-2 text-xs text-slate-300 list-disc list-inside">
                  {(reports[0]?.actionableRoadmap || [
                    "Deepen drill-down on distributed state synchronization patterns.",
                    "Implement real-world benchmarking tests for memory allocations and network round-trips.",
                    "Formulate structured responses using the trade-off matrix during architectural questions.",
                  ]).map((item, idx) => (
                    <li key={idx} className="leading-relaxed">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB CONTENT: 4. SETTINGS & PROFILE */}
      {activeTab === "settings" && (
        <div className="space-y-4">
          <Card className="bg-[#10182b]">
            <CardHeader>
              <CardTitle>Candidate Profile & Calibration Settings</CardTitle>
              <CardDescription>
                Current session configuration and ingested resume metadata.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3.5 rounded-lg border border-[#1e2d4f] bg-[#0c1222]">
                  <span className="text-slate-400 block mb-1">Candidate Name</span>
                  <span className="font-semibold text-white text-sm">
                    {setup.candidateName || "Candidate"}
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
                    {setup.resumeFileName || "Sample Resume"}
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
