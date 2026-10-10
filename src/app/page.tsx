import Link from "next/link";
import {
  ArrowRight,
  Sparkles,
  FileText,
  BrainCircuit,
  ShieldCheck,
  CheckCircle2,
  Terminal,
  LineChart,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function HomePage() {
  return (
    <div className="flex flex-col gap-20 py-4 sm:py-8">
      {/* 1. HERO SECTION */}
      <section className="flex flex-col items-center text-center gap-6 max-w-4xl mx-auto pt-6 pb-2">
        <div className="inline-flex items-center gap-2 rounded-full border border-indigo-800/60 bg-indigo-950/40 px-3 py-1 text-xs font-medium text-indigo-300">
          <Sparkles className="h-3.5 w-3.5" />
          <span>Next-Generation Technical Interview Simulation</span>
        </div>

        <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-white leading-tight">
          Your Skills. Your Interview. <br className="hidden sm:inline" />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-violet-400 to-indigo-300">
            Your Next Breakthrough.
          </span>
        </h1>

        <p className="text-base sm:text-lg text-slate-300 max-w-2xl leading-relaxed">
          Practice technical interviews that adapt to your answers, uncover knowledge gaps, and deliver actionable feedback.
        </p>

        {/* Hero CTAs */}
        <div className="flex flex-col sm:flex-row items-center gap-4 pt-2">
          <Link href="/setup">
            <Button size="lg" className="gap-2.5 h-12 px-6 shadow-lg shadow-indigo-950/70">
              Start Your Interview
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <a href="#how-it-works">
            <Button variant="secondary" size="lg" className="h-12 px-6">
              Explore How It Works
            </Button>
          </a>
        </div>

        {/* Polished Product Interface Preview Mockup */}
        <div className="w-full mt-8 rounded-2xl border border-[#1e2d4f] bg-[#0c1222] p-2 sm:p-4 shadow-2xl shadow-indigo-950/40 text-left">
          <div className="rounded-xl border border-[#1e2d4f]/80 bg-[#10182b] overflow-hidden">
            {/* Mock Header */}
            <div className="flex items-center justify-between border-b border-[#1a2642] px-4 py-3 bg-[#0c1222]/60">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-500/80" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500/80" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
                <span className="ml-2 text-xs font-mono text-slate-400">
                  live-session // Senior Full-Stack Engineer
                </span>
              </div>
              <Badge variant="indigo">Adaptive Calibration Active</Badge>
            </div>

            {/* Mock Body */}
            <div className="p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Question & Candidate Response Preview */}
              <div className="lg:col-span-2 space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="indigo">Question 2 of 4</Badge>
                    <span className="text-xs text-slate-400 font-mono">System Architecture</span>
                  </div>
                  <h4 className="text-sm sm:text-base font-semibold text-slate-100">
                    How do you handle lock expiration during network partitions in a distributed cache layer?
                  </h4>
                </div>

                <div className="rounded-lg border border-[#1e2d4f] bg-[#070b14] p-3 text-xs text-slate-300 font-mono leading-relaxed">
                  <p className="text-slate-500">{/* Candidate response analysis */}Candidate verified response:</p>
                  <p className="mt-1 text-slate-200">
                    &quot;To resolve split-brain execution when a lease expires during prolonged GC, I implement fencing tokens—monotonically incremented epoch numbers verified on every storage write.&quot;
                  </p>
                </div>

                <div className="flex items-center gap-2 text-xs text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Demonstrated mastery: Fencing tokens, optimistic concurrency, and partition boundaries.</span>
                </div>
              </div>

              {/* Live Signal Badges Preview */}
              <div className="rounded-lg border border-[#1e2d4f] bg-[#0c1222]/70 p-4 flex flex-col justify-between gap-3">
                <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Adaptive Skill Signals
                </span>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Distributed State</span>
                    <Badge variant="success">94% Mastery</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Concurrency Bounds</span>
                    <Badge variant="indigo">Proficient</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Core Web Vitals</span>
                    <Badge variant="default">Calibrating</Badge>
                  </div>
                </div>
                <div className="pt-2 border-t border-[#1a2642] text-[11px] text-slate-400">
                  Adaptive follow-up generated based on candidate terminology.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. TRUST / CAPABILITY INDICATORS */}
      <section className="border-y border-[#1a2642] py-8 bg-[#070b14]/40">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          <div className="space-y-1">
            <p className="text-base font-bold text-white">Resume-Aware</p>
            <p className="text-xs text-slate-400">Calibrates questions against your real background</p>
          </div>
          <div className="space-y-1">
            <p className="text-base font-bold text-white">Dynamic Branching</p>
            <p className="text-xs text-slate-400">Follow-up prompts adapt to your specific answers</p>
          </div>
          <div className="space-y-1">
            <p className="text-base font-bold text-white">Evidence-Backed</p>
            <p className="text-xs text-slate-400">Direct answer quotes support all scorecards</p>
          </div>
          <div className="space-y-1">
            <p className="text-base font-bold text-white">Privacy Focused</p>
            <p className="text-xs text-slate-400">No credential exposure or unnecessary file storage</p>
          </div>
        </div>
      </section>

      {/* 3. FEATURE SECTION */}
      <section id="features" className="space-y-8 scroll-mt-20">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <Badge variant="indigo">Core Platform Capabilities</Badge>
          <h2 className="text-2xl sm:text-3xl font-bold text-white">
            Engineered for Realistic Technical Evaluation
          </h2>
          <p className="text-sm text-slate-400">
            Everything you need to discover weak spots, practice articulate responses, and track tangible growth.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="hover:border-indigo-800/60 transition-all hover:-translate-y-0.5">
            <CardHeader>
              <div className="h-10 w-10 rounded-lg bg-indigo-950 text-indigo-400 flex items-center justify-center mb-2 border border-indigo-800/40">
                <FileText className="h-5 w-5" />
              </div>
              <CardTitle>Resume-Aware Preparation</CardTitle>
              <CardDescription>
                Tailored question paths that take your past projects, stack experience, and seniority level into account.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="hover:border-indigo-800/60 transition-all hover:-translate-y-0.5">
            <CardHeader>
              <div className="h-10 w-10 rounded-lg bg-indigo-950 text-indigo-400 flex items-center justify-center mb-2 border border-indigo-800/40">
                <Terminal className="h-5 w-5" />
              </div>
              <CardTitle>Role-Specific Questions</CardTitle>
              <CardDescription>
                Curated technical challenges for Frontend, Backend, Full Stack, Python, Java, and Data Analytics tracks.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="hover:border-indigo-800/60 transition-all hover:-translate-y-0.5">
            <CardHeader>
              <div className="h-10 w-10 rounded-lg bg-indigo-950 text-indigo-400 flex items-center justify-center mb-2 border border-indigo-800/40">
                <BrainCircuit className="h-5 w-5" />
              </div>
              <CardTitle>Adaptive Follow-Ups</CardTitle>
              <CardDescription>
                Just like a senior engineering manager, InterviewIQ listens to your trade-offs and drills into deeper questions.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="hover:border-indigo-800/60 transition-all hover:-translate-y-0.5">
            <CardHeader>
              <div className="h-10 w-10 rounded-lg bg-indigo-950 text-indigo-400 flex items-center justify-center mb-2 border border-indigo-800/40">
                <LineChart className="h-5 w-5" />
              </div>
              <CardTitle>Evidence-Based Feedback</CardTitle>
              <CardDescription>
                No arbitrary scores. Every strength and improvement area cites actual keywords and explanations from your answers.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="hover:border-indigo-800/60 transition-all hover:-translate-y-0.5">
            <CardHeader>
              <div className="h-10 w-10 rounded-lg bg-indigo-950 text-indigo-400 flex items-center justify-center mb-2 border border-indigo-800/40">
                <Layers className="h-5 w-5" />
              </div>
              <CardTitle>Personalized Improvement Plans</CardTitle>
              <CardDescription>
                Receive structured reading recommendations and actionable study roadmaps after each session.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="hover:border-indigo-800/60 transition-all hover:-translate-y-0.5">
            <CardHeader>
              <div className="h-10 w-10 rounded-lg bg-indigo-950 text-indigo-400 flex items-center justify-center mb-2 border border-indigo-800/40">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <CardTitle>Confidence Calibration</CardTitle>
              <CardDescription>
                Simulated real-time interview pressure with live timers, structured hints, and time-bounded problem solving.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </section>

      {/* 4. HOW IT WORKS SECTION */}
      <section id="how-it-works" className="space-y-8 scroll-mt-20">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <Badge variant="indigo">Streamlined Workflow</Badge>
          <h2 className="text-2xl sm:text-3xl font-bold text-white">
            How InterviewIQ Works
          </h2>
          <p className="text-sm text-slate-400">
            Four simple steps from resume upload to comprehensive evaluation.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="rounded-xl border border-[#1e2d4f] bg-[#10182b] p-6 space-y-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-white font-bold text-sm">
              1
            </div>
            <h3 className="font-semibold text-white text-base">Candidate Setup</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Upload your resume or use our quick sample profile, pick your engineering role, and calibrate interview duration.
            </p>
          </div>

          <div className="rounded-xl border border-[#1e2d4f] bg-[#10182b] p-6 space-y-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-white font-bold text-sm">
              2
            </div>
            <h3 className="font-semibold text-white text-base">Adaptive Dialogue</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Answer real-world architectural and coding prompts. The system branches dynamically depending on your answers.
            </p>
          </div>

          <div className="rounded-xl border border-[#1e2d4f] bg-[#10182b] p-6 space-y-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-white font-bold text-sm">
              3
            </div>
            <h3 className="font-semibold text-white text-base">Analytical Synthesis</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Review granular category metrics across architecture, performance, problem-solving, and communication.
            </p>
          </div>

          <div className="rounded-xl border border-[#1e2d4f] bg-[#10182b] p-6 space-y-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-white font-bold text-sm">
              4
            </div>
            <h3 className="font-semibold text-white text-base">Targeted Growth</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Follow tailored roadmap items to reinforce identified gaps before stepping into your real interview.
            </p>
          </div>
        </div>
      </section>

      {/* 5. ABOUT & CLOSING CTA */}
      <section id="about" className="rounded-2xl border border-indigo-900/50 bg-gradient-to-br from-[#10182b] to-[#0c1222] p-8 sm:p-12 text-center space-y-6 scroll-mt-20">
        <div className="inline-flex items-center gap-2 rounded-full bg-indigo-950/80 px-3 py-1 text-xs font-medium text-indigo-300 border border-indigo-800/40">
          <Terminal className="h-3.5 w-3.5" />
          <span>Hackathon Demonstration</span>
        </div>

        <h2 className="text-3xl sm:text-4xl font-extrabold text-white max-w-2xl mx-auto">
          Ready to experience the future of technical interview prep?
        </h2>

        <p className="text-sm sm:text-base text-slate-300 max-w-xl mx-auto">
          Start your personalized interview session now or inspect the candidate dashboard.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
          <Link href="/setup">
            <Button size="lg" className="gap-2.5 h-12 px-8 shadow-lg shadow-indigo-950/60">
              Start Candidate Setup
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/dashboard">
            <Button variant="secondary" size="lg" className="h-12 px-6">
              View Candidate Dashboard
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
