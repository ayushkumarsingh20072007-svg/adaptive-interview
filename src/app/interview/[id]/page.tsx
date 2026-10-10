import Link from "next/link";
import { ArrowRight, ArrowLeft, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Props {
  params: Promise<{ id: string }>;
}

export function generateStaticParams() {
  return [{ id: "demo-session" }];
}

export default async function LiveInterviewPage({ params }: Props) {
  const { id } = await params;

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto w-full py-4">
      {/* Route Header */}
      <div className="flex items-center justify-between border-b border-[#1e2d4f] pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="warning">Step 4 of 5</Badge>
            <span className="text-xs text-slate-400">Route: /interview/{id}</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Live Interview Workspace</h1>
          <p className="text-sm text-slate-400">
            Real-time adaptive technical evaluation environment with dynamic prompt orchestration.
          </p>
        </div>
        <Link href="/dashboard">
          <Button variant="ghost" size="sm" className="gap-1.5">
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </Button>
        </Link>
      </div>

      {/* Live Workspace Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: AI Question / Prompt placeholder */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <Badge variant="indigo">Adaptive Question #1</Badge>
                <span className="text-xs text-slate-400 font-mono">Session ID: {id}</span>
              </div>
              <CardTitle className="text-base text-slate-100">
                System Architecture & State Synchronization
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-300 leading-relaxed">
                Explain how you would design a scalable, low-latency state synchronization protocol for an interactive multi-agent workspace. How do you prevent split-brain conditions across distributed clients?
              </p>
            </CardContent>
          </Card>

          <Card className="border-dashed">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 text-slate-400 text-xs font-mono">
                <Terminal className="h-4 w-4 text-indigo-400" />
                <span>Candidate Response & Code Editor workspace placeholder (Stage 3)</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: Live Diagnostics sidebar placeholder */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Session Telemetry</CardTitle>
              <CardDescription>Mock monitor</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Audio Stream</span>
                <Badge variant="success">Active (Simulated)</Badge>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Adaptive Calibrator</span>
                <Badge variant="indigo">Standby</Badge>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Latency</span>
                <span className="text-slate-300 font-mono">24ms</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Bottom Navigation */}
      <div className="flex justify-between items-center pt-2">
        <Link href="/dashboard">
          <Button variant="outline" size="sm">
            Back to Dashboard
          </Button>
        </Link>
        <Link href={`/report/${id}`}>
          <Button size="sm" className="gap-2">
            Complete & View Results Report
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
