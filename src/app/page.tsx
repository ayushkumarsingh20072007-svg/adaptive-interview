import Link from "next/link";
import { ArrowRight, Shield, BrainCircuit, LineChart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function HomePage() {
  return (
    <div className="flex flex-col gap-10 py-6">
      {/* Hero placeholder */}
      <div className="flex flex-col items-start gap-4 max-w-3xl">
        <div className="flex items-center gap-2">
          <Badge variant="indigo">Stage 1: Foundation Established</Badge>
          <span className="text-xs text-slate-400">Step 1 of 5 in Architecture</span>
        </div>
        
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
          InterviewIQ — Adaptive Interview Intelligence
        </h1>
        
        <p className="text-base text-slate-300 leading-relaxed">
          Autonomous technical interviewing engine designed to analyze candidate resumes, detect latent skill gaps, and execute adaptive technical evaluation sessions.
        </p>

        <div className="flex flex-wrap gap-3 pt-2">
          <Link href="/setup">
            <Button size="lg" className="gap-2">
              Start Candidate Setup
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/dashboard">
            <Button variant="secondary" size="lg">
              View Interview Dashboard
            </Button>
          </Link>
        </div>
      </div>

      {/* Planned architecture overview cards */}
      <div className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
          Planned User Journey & Route Structure
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="hover:border-indigo-800/60 transition-colors">
            <CardHeader>
              <div className="flex items-center justify-between mb-1">
                <Badge variant="indigo">Route 1 & 2</Badge>
                <BrainCircuit className="h-4 w-4 text-indigo-400" />
              </div>
              <CardTitle>Setup & Ingestion</CardTitle>
              <CardDescription>/setup</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-slate-300 leading-relaxed">
                Resume parsing, role targeting, difficulty calibration, and personalized question plan generation.
              </p>
            </CardContent>
            <CardFooter>
              <Link href="/setup" className="w-full">
                <Button variant="outline" size="sm" className="w-full">
                  Test /setup Route
                </Button>
              </Link>
            </CardFooter>
          </Card>

          <Card className="hover:border-indigo-800/60 transition-colors">
            <CardHeader>
              <div className="flex items-center justify-between mb-1">
                <Badge variant="default">Route 3 & 4</Badge>
                <Shield className="h-4 w-4 text-indigo-400" />
              </div>
              <CardTitle>Live Interview Workspace</CardTitle>
              <CardDescription>/interview/[id]</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-slate-300 leading-relaxed">
                Interactive technical coding and architectural dialogue with real-time adaptive questioning.
              </p>
            </CardContent>
            <CardFooter>
              <Link href="/interview/demo-session" className="w-full">
                <Button variant="outline" size="sm" className="w-full">
                  Test /interview Route
                </Button>
              </Link>
            </CardFooter>
          </Card>

          <Card className="hover:border-indigo-800/60 transition-colors">
            <CardHeader>
              <div className="flex items-center justify-between mb-1">
                <Badge variant="success">Route 5</Badge>
                <LineChart className="h-4 w-4 text-emerald-400" />
              </div>
              <CardTitle>Results & Evaluation Report</CardTitle>
              <CardDescription>/report/[id]</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-slate-300 leading-relaxed">
                Evidence-backed scorecards, verified strengths, detected gaps, and audio/transcript synthesis.
              </p>
            </CardContent>
            <CardFooter>
              <Link href="/report/demo-session" className="w-full">
                <Button variant="outline" size="sm" className="w-full">
                  Test /report Route
                </Button>
              </Link>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}
