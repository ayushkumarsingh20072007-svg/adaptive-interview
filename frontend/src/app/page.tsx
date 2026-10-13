import Link from "next/link";
import {
  ArrowRight,
  Sparkles,
  FileText,
  BrainCircuit,
  CheckCircle2,
  Terminal,
  LineChart,
  Layers,
  Code2,
  Cpu,
  LogIn,
  UserPlus,
  Compass,
  Check,
  XCircle,
  HelpCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function HomePage() {
  return (
    <div className="flex flex-col gap-24 py-8 sm:py-12 px-4 sm:px-6 md:px-8 max-w-7xl mx-auto">
      {/* 1. HERO SECTION */}
      <section className="relative flex flex-col items-center text-center gap-7 max-w-5xl mx-auto pt-6 pb-4">
        {/* Subtle radial ambient background glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[640px] h-[340px] bg-gradient-to-tr from-indigo-600/20 via-violet-600/20 to-transparent blur-3xl pointer-events-none -z-10 rounded-full" />

        {/* Top Innovation Pill */}
        <div className="inline-flex items-center gap-2 rounded-full border border-indigo-700/60 bg-indigo-950/60 px-4 py-1.5 text-xs font-semibold text-indigo-300 shadow-inner">
          <Sparkles className="h-3.5 w-3.5 text-indigo-400 animate-pulse" />
          <span>Production AI Technical Interview Simulation</span>
          <span className="hidden sm:inline text-indigo-600">|</span>
          <span className="hidden sm:inline text-indigo-400/80">Adaptive Branching Engine</span>
        </div>

        {/* Hero Headline */}
        <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight text-white leading-[1.1]">
          Master Technical Interviews <br className="hidden sm:inline" />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 via-violet-300 to-indigo-200">
            With Adaptive AI Rigor.
          </span>
        </h1>

        {/* Hero Value Subtitle */}
        <p className="text-base sm:text-lg md:text-xl text-slate-300 max-w-3xl leading-relaxed">
          InterviewIQ analyzes your resume, asks role-specific engineering questions, and dynamically drills into your answers—generating an evidence-backed scorecard with exact quotes and knowledge gap analysis.
        </p>

        {/* Hero Action CTAs */}
        <div className="flex flex-wrap items-center justify-center gap-4 pt-3">
          <Link href="/setup">
            <Button size="lg" className="gap-2.5 h-12 px-7 rounded-xl shadow-lg shadow-indigo-600/30 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-bold">
              Start Free Interview
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/signup">
            <Button variant="secondary" size="lg" className="gap-2 h-12 px-6 rounded-xl border-slate-700/80 hover:border-slate-600 font-semibold">
              <UserPlus className="h-4 w-4 text-indigo-400" />
              Get Started
            </Button>
          </Link>
          <Link href="/login">
            <Button variant="outline" size="lg" className="gap-2 h-12 px-5 rounded-xl text-slate-300 hover:text-white border-slate-800 hover:bg-slate-800/60 font-semibold">
              <LogIn className="h-4 w-4 text-slate-400" />
              Sign In
            </Button>
          </Link>
        </div>

        {/* Frictionless indicator */}
        <p className="text-xs text-slate-400 flex items-center justify-center gap-3 pt-1">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> Instant 1-Click Demo Accounts
          </span>
          <span>•</span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> No credit card required
          </span>
          <span>•</span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> Private & local-ready
          </span>
        </p>

        {/* Real-time Technical Interview Simulation Showcase */}
        <div className="w-full mt-6 rounded-2xl border border-slate-800/80 bg-[#0c1427]/90 p-3 sm:p-5 shadow-2xl shadow-indigo-950/40 text-left">
          <div className="rounded-xl border border-slate-800/80 bg-[#080d19] overflow-hidden">
            {/* Terminal Top Bar */}
            <div className="flex items-center justify-between border-b border-slate-800/80 px-4 py-3 bg-[#0c1427]/90">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-500/90" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500/90" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/90" />
                <span className="ml-2 text-xs font-mono text-slate-400">
                  interviewiq-engine // live-session #782-arch
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="indigo">Resume-Calibrated: Staff / Senior</Badge>
                <span className="hidden sm:inline-flex h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
              </div>
            </div>

            {/* Terminal Body */}
            <div className="p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Question & Candidate Response Analysis */}
              <div className="lg:col-span-2 space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="indigo">Question 2 of 4</Badge>
                    <span className="text-xs text-slate-400 font-mono">Distributed Systems & Reliability</span>
                  </div>
                  <h4 className="text-sm sm:text-base font-semibold text-slate-100">
                    &quot;How do you prevent split-brain anomalies and stale reads when a leader node experiences prolonged garbage collection in your Raft cluster?&quot;
                  </h4>
                </div>

                <div className="rounded-lg border border-[#1e2d4f] bg-[#070b14] p-3.5 text-xs text-slate-300 font-mono leading-relaxed space-y-2">
                  <div className="flex items-center justify-between text-slate-500 text-[11px] border-b border-[#1a2642] pb-1.5">
                    <span>CANDIDATE SUBMITTED EXPLANATION</span>
                    <span className="text-emerald-400 font-sans">Answer Recorded</span>
                  </div>
                  <p className="text-slate-200">
                    &quot;To avoid split-brain execution during prolonged stop-the-world pauses, I configure <span className="text-indigo-400 font-semibold underline decoration-indigo-500/60">lease read mechanisms</span> with pre-vote stages and <span className="text-indigo-400 font-semibold underline decoration-indigo-500/60">fencing tokens</span>. Any state mutation verifies the epoch token against the storage boundary before committing.&quot;
                  </p>
                </div>

                {/* Adaptive follow-up box */}
                <div className="rounded-lg border border-violet-900/60 bg-violet-950/20 p-3 space-y-1.5 text-xs">
                  <div className="flex items-center gap-2 text-violet-300 font-semibold">
                    <BrainCircuit className="h-4 w-4 text-violet-400" />
                    <span>Dynamic Follow-Up (Triggered by mention of &quot;fencing tokens&quot;):</span>
                  </div>
                  <p className="text-slate-300 text-xs pl-6">
                    &quot;You highlighted fencing tokens for storage validation. If a client receives a stale token during clock drift between cluster nodes, how does your storage backplane reject the write deterministically?&quot;
                  </p>
                </div>
              </div>

              {/* Evidence & Competency Signal Sidebar */}
              <div className="rounded-lg border border-[#1e2d4f] bg-[#0c1222]/80 p-4 flex flex-col justify-between gap-3">
                <div>
                  <div className="flex items-center justify-between pb-2 border-b border-[#1a2642]">
                    <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                      Live Metric Rubric
                    </span>
                    <Badge variant="success">96% Confirmed</Badge>
                  </div>
                  <div className="space-y-3 pt-3 text-xs">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-slate-400">Consensus Guarantees</span>
                        <span className="text-emerald-400 font-mono font-medium">Verified Mastery</span>
                      </div>
                      <div className="w-full bg-[#1a2642] h-1.5 rounded-full overflow-hidden">
                        <div className="bg-emerald-500 h-full w-[94%]" />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-slate-400">Concurrency Bounds</span>
                        <span className="text-indigo-400 font-mono font-medium">Strong Evidence</span>
                      </div>
                      <div className="w-full bg-[#1a2642] h-1.5 rounded-full overflow-hidden">
                        <div className="bg-indigo-500 h-full w-[88%]" />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-slate-400">Fault Tolerance</span>
                        <span className="text-violet-400 font-mono font-medium">In Depth</span>
                      </div>
                      <div className="w-full bg-[#1a2642] h-1.5 rounded-full overflow-hidden">
                        <div className="bg-violet-500 h-full w-[82%]" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-[#1a2642] text-[11px] text-slate-400 leading-normal flex items-start gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Evaluation scorecard cites candidate technical phrasing directly in the final report.</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. THREE CORE PILLARS (THE PILLARS OF ADAPTIVE INTELLIGENCE) */}
      <section className="space-y-8 scroll-mt-20">
        <div className="text-center max-w-3xl mx-auto space-y-2">
          <Badge variant="indigo">Architecture Principles</Badge>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white">
            Built Different Than Static Quiz Apps
          </h2>
          <p className="text-sm sm:text-base text-slate-400">
            InterviewIQ replaces generic scripted questions with an intelligent, multi-stage evaluation engine designed for software engineers.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Pillar 1 */}
          <Card className="rounded-2xl border border-slate-800/80 bg-[#0c1427]/90 shadow-md hover:border-indigo-500/60 transition-all hover:-translate-y-1 p-6 sm:p-7">
            <CardHeader className="p-0 pb-4">
              <div className="h-12 w-12 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-4 border border-indigo-500/20 shadow-inner">
                <FileText className="h-6 w-6" />
              </div>
              <CardTitle className="text-xl font-bold text-white">1. Resume-Aware Calibration</CardTitle>
              <CardDescription className="text-slate-300 pt-2 leading-relaxed text-xs sm:text-sm">
                Upload your resume or pick from pre-configured engineering profiles. The system extracts your demonstrated tech stack, years of experience, and project scope so questions test your actual capabilities, not irrelevant trivia.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 pt-2 border-t border-slate-800/80">
              <ul className="space-y-2.5 text-xs text-slate-400 pt-2">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-indigo-400 shrink-0" />
                  Calibrates difficulty between junior, intermediate, and senior tiers
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-indigo-400 shrink-0" />
                  Focuses on real tools you claim experience with
                </li>
              </ul>
            </CardContent>
          </Card>

          {/* Pillar 2 */}
          <Card className="rounded-2xl border border-slate-800/80 bg-[#0c1427]/90 shadow-md hover:border-indigo-500/60 transition-all hover:-translate-y-1 p-6 sm:p-7">
            <CardHeader className="p-0 pb-4">
              <div className="h-12 w-12 rounded-xl bg-violet-500/10 text-violet-400 flex items-center justify-center mb-4 border border-violet-500/20 shadow-inner">
                <BrainCircuit className="h-6 w-6" />
              </div>
              <CardTitle className="text-xl font-bold text-white">2. Answer-Dependent Follow-Ups</CardTitle>
              <CardDescription className="text-slate-300 pt-2 leading-relaxed text-xs sm:text-sm">
                Like a principal engineer in a live technical screen, the AI evaluates your specific claims. If you mention microservices, it tests your consistency patterns. If your answer misses a key trade-off, it prompts you to defend your decision.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 pt-2 border-t border-slate-800/80">
              <ul className="space-y-2.5 text-xs text-slate-400 pt-2">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-violet-400 shrink-0" />
                  Dynamic branching based on candidate explanations
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-violet-400 shrink-0" />
                  Uncovers true depth vs rehearsed buzzwords
                </li>
              </ul>
            </CardContent>
          </Card>

          {/* Pillar 3 */}
          <Card className="rounded-2xl border border-slate-800/80 bg-[#0c1427]/90 shadow-md hover:border-indigo-500/60 transition-all hover:-translate-y-1 p-6 sm:p-7">
            <CardHeader className="p-0 pb-4">
              <div className="h-12 w-12 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-4 border border-indigo-500/20 shadow-inner">
                <LineChart className="h-6 w-6" />
              </div>
              <CardTitle className="text-xl font-bold text-white">3. Evidence-Based Evaluations</CardTitle>
              <CardDescription className="text-slate-300 pt-2 leading-relaxed text-xs sm:text-sm">
                Never settle for arbitrary 0-100 scores with generic platitudes. Every scorecard pinpoints exact sentences from your answers, correlates them against industry standards, and outlines concrete reading material to bridge gaps.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 pt-2 border-t border-slate-800/80">
              <ul className="space-y-2.5 text-xs text-slate-400 pt-2">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-indigo-400 shrink-0" />
                  Direct citations of candidate statements
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-indigo-400 shrink-0" />
                  Actionable improvement roadmap for interview day
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* 3. PLATFORM COMPARISON SECTION */}
      <section className="space-y-8 scroll-mt-20">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <Badge variant="indigo">Comparative Advantage</Badge>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Why Realistic Simulation Matters
          </h2>
          <p className="text-sm text-slate-400">
            Comparing conventional prep methods with InterviewIQ&apos;s adaptive architecture.
          </p>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-800/80 bg-[#0c1427]/90 shadow-md">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#080d19] text-xs uppercase tracking-wider text-slate-400 border-b border-slate-800/80">
              <tr>
                <th className="py-4.5 px-6 font-semibold">Capability</th>
                <th className="py-4.5 px-6 text-slate-400 font-semibold">Static Question Banks</th>
                <th className="py-4.5 px-6 text-slate-400 font-semibold">Generic Chatbots</th>
                <th className="py-4.5 px-6 text-indigo-300 font-bold bg-indigo-950/40 border-l border-r border-indigo-800/50">InterviewIQ Engine</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 text-xs sm:text-sm">
              <tr>
                <td className="py-4.5 px-6 font-medium text-slate-200">Resume Context Awareness</td>
                <td className="py-4.5 px-6 text-slate-400 flex items-center gap-1.5"><XCircle className="h-4 w-4 text-rose-500" /> None</td>
                <td className="py-4.5 px-6 text-slate-400"><HelpCircle className="h-4 w-4 text-amber-500 inline mr-1" /> Partial / Forgets context</td>
                <td className="py-4.5 px-6 text-emerald-300 font-semibold bg-indigo-950/30 border-l border-r border-indigo-800/40"><CheckCircle2 className="h-4 w-4 text-emerald-400 inline mr-1.5" /> Full Resume & Stack Ingestion</td>
              </tr>
              <tr>
                <td className="py-4.5 px-6 font-medium text-slate-200">Answer-Dependent Follow-Ups</td>
                <td className="py-4.5 px-6 text-slate-400 flex items-center gap-1.5"><XCircle className="h-4 w-4 text-rose-500" /> Hardcoded scripts</td>
                <td className="py-4.5 px-6 text-slate-400"><HelpCircle className="h-4 w-4 text-amber-500 inline mr-1" /> Superficial agreeableness</td>
                <td className="py-4.5 px-6 text-emerald-300 font-semibold bg-indigo-950/30 border-l border-r border-indigo-800/40"><CheckCircle2 className="h-4 w-4 text-emerald-400 inline mr-1.5" /> Probing Engineering Cross-Exam</td>
              </tr>
              <tr>
                <td className="py-4.5 px-6 font-medium text-slate-200">Evaluation Integrity</td>
                <td className="py-4.5 px-6 text-slate-400 flex items-center gap-1.5"><XCircle className="h-4 w-4 text-rose-500" /> Binary pass/fail unit tests</td>
                <td className="py-4.5 px-6 text-slate-400"><HelpCircle className="h-4 w-4 text-amber-500 inline mr-1" /> Generic subjective praise</td>
                <td className="py-4.5 px-6 text-emerald-300 font-semibold bg-indigo-950/30 border-l border-r border-indigo-800/40"><CheckCircle2 className="h-4 w-4 text-emerald-400 inline mr-1.5" /> Evidence-Cited Rubric Scorecard</td>
              </tr>
              <tr>
                <td className="py-4.5 px-6 font-medium text-slate-200">Realistic Interview Pacing</td>
                <td className="py-4.5 px-6 text-slate-400 flex items-center gap-1.5"><XCircle className="h-4 w-4 text-rose-500" /> No time bounds or hints</td>
                <td className="py-4.5 px-6 text-slate-400"><XCircle className="h-4 w-4 text-rose-500 inline mr-1" /> Unstructured dialogue</td>
                <td className="py-4.5 px-6 text-emerald-300 font-semibold bg-indigo-950/30 border-l border-r border-indigo-800/40"><CheckCircle2 className="h-4 w-4 text-emerald-400 inline mr-1.5" /> Structured Timer, Hints & Safety</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* 4. TRACKS / ROLES EXPLORATION */}
      <section id="tracks" className="space-y-8 scroll-mt-20">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <Badge variant="indigo">Supported Tracks</Badge>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Comprehensive Role Coverage
          </h2>
          <p className="text-sm text-slate-400">
            Practice scenarios calibrated for the core specializations in high-growth tech companies.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="rounded-2xl border border-slate-800/80 bg-[#0c1427]/90 p-6 space-y-2.5 hover:border-indigo-500/60 transition-all shadow-sm">
            <div className="flex items-center gap-2.5 text-indigo-400 font-bold text-sm">
              <Code2 className="h-4.5 w-4.5" />
              <span>Frontend Engineering</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              React 19 internals, SSR hydration pitfalls, Core Web Vitals, state management, and modern DOM paradigms.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800/80 bg-[#0c1427]/90 p-6 space-y-2.5 hover:border-indigo-500/60 transition-all shadow-sm">
            <div className="flex items-center gap-2.5 text-violet-400 font-bold text-sm">
              <Cpu className="h-4.5 w-4.5" />
              <span>Backend Systems</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Distributed consensus, idempotent transactions, database indexing, caching strategies, and API contracts.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800/80 bg-[#0c1427]/90 p-6 space-y-2.5 hover:border-indigo-500/60 transition-all shadow-sm">
            <div className="flex items-center gap-2.5 text-indigo-400 font-bold text-sm">
              <Layers className="h-4.5 w-4.5" />
              <span>Full-Stack Architecture</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              End-to-end data synchronization, edge compute, auth flows, microfrontends, and schema evolution.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800/80 bg-[#0c1427]/90 p-6 space-y-2.5 hover:border-indigo-500/60 transition-all shadow-sm">
            <div className="flex items-center gap-2.5 text-violet-400 font-bold text-sm">
              <Terminal className="h-4.5 w-4.5" />
              <span>Python & Data Systems</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Async I/O, data pipelines, model serving architectures, memory management, and data consistency models.
            </p>
          </div>
        </div>
      </section>

      {/* 5. HOW IT WORKS WORKFLOW */}
      <section id="how-it-works" className="space-y-8 scroll-mt-20">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <Badge variant="indigo">Step-by-Step Methodology</Badge>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            How An Interview Session Unfolds
          </h2>
          <p className="text-sm text-slate-400">
            From profile calibration to detailed forensic evaluation in four systematic stages.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="rounded-2xl border border-slate-800/80 bg-[#0c1427]/90 p-6 sm:p-7 space-y-3.5 relative overflow-hidden group hover:border-indigo-500/60 transition-all shadow-md">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600/90 text-white font-bold text-sm shadow-md shadow-indigo-900/50">
              1
            </div>
            <h3 className="font-bold text-white text-base">Setup & Calibrate</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Paste your resume or load a curated engineering profile. Select your track, focus area (system design, coding, or mixed), and time budget.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800/80 bg-[#0c1427]/90 p-6 sm:p-7 space-y-3.5 relative overflow-hidden group hover:border-indigo-500/60 transition-all shadow-md">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-600/90 text-white font-bold text-sm shadow-md shadow-violet-900/50">
              2
            </div>
            <h3 className="font-bold text-white text-base">Adaptive Dialogue</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Face realistic technical prompts. Receive structured progressive hints if you get stuck, and answer dynamic follow-up questions tailored to your logic.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800/80 bg-[#0c1427]/90 p-6 sm:p-7 space-y-3.5 relative overflow-hidden group hover:border-indigo-500/60 transition-all shadow-md">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600/90 text-white font-bold text-sm shadow-md shadow-indigo-900/50">
              3
            </div>
            <h3 className="font-bold text-white text-base">Evidence Extraction</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Our evaluation engine scans your responses, isolating sound trade-offs, missed edge cases, and architectural justifications without bias.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800/80 bg-[#0c1427]/90 p-6 sm:p-7 space-y-3.5 relative overflow-hidden group hover:border-indigo-500/60 transition-all shadow-md">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-600/90 text-white font-bold text-sm shadow-md shadow-violet-900/50">
              4
            </div>
            <h3 className="font-bold text-white text-base">Forensic Scorecard</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Access your detailed report with category scores, exact citations, overall readiness verdict, and personalized practice roadmap.
            </p>
          </div>
        </div>
      </section>

      {/* 6. CALL TO ACTION & ONBOARDING OPTIONS */}
      <section className="rounded-3xl border border-indigo-900/60 bg-gradient-to-br from-[#0e162f] via-[#0c1427] to-[#080d19] p-8 sm:p-14 text-center space-y-8 scroll-mt-20 shadow-2xl shadow-indigo-950/40">
        <div className="space-y-3 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 rounded-full bg-indigo-950/80 px-3.5 py-1 text-xs font-semibold text-indigo-300 border border-indigo-800/40">
            <Compass className="h-3.5 w-3.5" />
            <span>Ready for Your Next Technical Challenge?</span>
          </div>

          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Choose How You Want to Experience InterviewIQ
          </h2>

          <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
            Test with our 1-click demo accounts or create your candidate profile to track adaptive interviews and scorecard analytics.
          </p>
        </div>

        {/* Dual Onboarding Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto text-left">
          {/* Demo Login Flow */}
          <div className="rounded-2xl border border-slate-800/80 bg-[#080d19]/90 p-7 flex flex-col justify-between space-y-5 hover:border-indigo-500/50 transition-all shadow-md">
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <Badge variant="indigo" className="px-2.5 py-0.5">1-Click Demo</Badge>
                <span className="text-xs text-slate-400 font-mono">Instant Sign In</span>
              </div>
              <h3 className="text-lg font-bold text-white">Instant Demo Testing</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Test adaptive evaluation immediately using pre-configured Candidate or Recruiter demo credentials.
              </p>
            </div>
            <Link href="/login?redirect=/setup">
              <Button className="w-full h-11 rounded-xl gap-2 justify-center bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 font-bold shadow-md shadow-indigo-600/20">
                Sign In with Demo Account
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>

          {/* Registered Candidate Flow */}
          <div className="rounded-2xl border border-slate-800/80 bg-[#080d19]/90 p-7 flex flex-col justify-between space-y-5 hover:border-violet-500/50 transition-all shadow-md">
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <Badge variant="success" className="px-2.5 py-0.5">Saved Progress</Badge>
                <span className="text-xs text-slate-400 font-mono">Secure Session</span>
              </div>
              <h3 className="text-lg font-bold text-white">Candidate Account</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Create an account or sign in to persist your scorecards across devices, review past feedback, and monitor progress.
              </p>
            </div>
            <div className="flex gap-3">
              <Link href="/signup?redirect=/setup" className="flex-1">
                <Button className="w-full h-11 rounded-xl justify-center bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 text-white font-bold shadow-md shadow-violet-600/20">
                  Create Account
                </Button>
              </Link>
              <Link href="/login?redirect=/setup" className="flex-1">
                <Button variant="secondary" className="w-full h-11 rounded-xl justify-center border-slate-700/80 hover:bg-slate-800 font-semibold">
                  Sign In
                </Button>
              </Link>
            </div>
          </div>
        </div>

        <div className="pt-2 text-xs text-slate-400">
          InterviewIQ is an engineering evaluation simulation platform. Evaluations are advisory practice signals designed to accelerate candidate preparation.
        </div>
      </section>
    </div>
  );
}
