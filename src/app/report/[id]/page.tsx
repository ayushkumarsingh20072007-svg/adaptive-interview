import Link from "next/link";
import { ArrowLeft, Award, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Props {
  params: Promise<{ id: string }>;
}

export const instant = false;

export function generateStaticParams() {
  return [{ id: "demo-session" }];
}

export default async function CandidateReportPage({ params }: Props) {
  const { id } = await params;

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto w-full py-4">
      {/* Route Header */}
      <div className="flex items-center justify-between border-b border-[#1e2d4f] pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="success">Step 5 of 5</Badge>
            <span className="text-xs text-slate-400">Route: /report/{id}</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Candidate Evaluation & Intelligence Report</h1>
          <p className="text-sm text-slate-400">
            Evidence-backed technical capability score, verified competencies, and targeted gap synthesis.
          </p>
        </div>
        <Link href={`/interview/${id}`}>
          <Button variant="ghost" size="sm" className="gap-1.5">
            <ArrowLeft className="h-4 w-4" />
            Interview
          </Button>
        </Link>
      </div>

      {/* Summary Score Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <Badge variant="indigo">Evaluation Report</Badge>
            <span className="text-xs text-slate-400 font-mono">Reference: {id}</span>
          </div>
          <CardTitle>Overall Assessment: Strong Hire Recommendation</CardTitle>
          <CardDescription>
            Autonomous evaluation synthesized from 4 technical question turns.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-lg border border-[#1e2d4f] bg-[#0c1222] p-3 text-center">
              <span className="text-xs text-slate-400">Architecture Mastery</span>
              <p className="text-lg font-bold text-emerald-400 mt-1">92 / 100</p>
            </div>
            <div className="rounded-lg border border-[#1e2d4f] bg-[#0c1222] p-3 text-center">
              <span className="text-xs text-slate-400">Code Optimization</span>
              <p className="text-lg font-bold text-indigo-400 mt-1">86 / 100</p>
            </div>
            <div className="rounded-lg border border-[#1e2d4f] bg-[#0c1222] p-3 text-center">
              <span className="text-xs text-slate-400">Communication & Depth</span>
              <p className="text-lg font-bold text-amber-400 mt-1">88 / 100</p>
            </div>
          </div>

          <div className="rounded-lg border border-emerald-900/40 bg-emerald-950/20 p-4">
            <div className="flex items-center gap-2 text-emerald-300 text-sm font-semibold mb-1">
              <Award className="h-4 w-4" />
              <span>Core Strengths Highlighted</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Exhibited rigorous reasoning around eventual consistency and distributed consensus mechanisms. Clear, structured explanation of optimistic UI updates.
            </p>
          </div>
        </CardContent>
        <CardFooter className="flex justify-between items-center">
          <Link href="/">
            <Button variant="outline" size="sm">
              Return to Overview
            </Button>
          </Link>
          <Link href="/setup">
            <Button size="sm" className="gap-2">
              <RefreshCw className="h-3.5 w-3.5" />
              Start New Evaluation
            </Button>
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
