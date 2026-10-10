import Link from "next/link";
import { ArrowRight, ArrowLeft, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto w-full py-4">
      {/* Route Header */}
      <div className="flex items-center justify-between border-b border-[#1e2d4f] pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="indigo">Step 3 of 5</Badge>
            <span className="text-xs text-slate-400">Route: /dashboard</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Interview Intelligence Dashboard</h1>
          <p className="text-sm text-slate-400">
            Overview of scheduled evaluations, active assessments, and generated analytical scorecards.
          </p>
        </div>
        <Link href="/setup">
          <Button variant="ghost" size="sm" className="gap-1.5">
            <ArrowLeft className="h-4 w-4" />
            Setup
          </Button>
        </Link>
      </div>

      {/* Stats summary preview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400">Scheduled Interviews</p>
            <p className="text-xl font-bold text-white mt-1">3 Sessions</p>
          </div>
          <Badge variant="default">Queued</Badge>
        </Card>
        <Card className="p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400">Completed Audits</p>
            <p className="text-xl font-bold text-white mt-1">12 Candidates</p>
          </div>
          <Badge variant="success">Analyzed</Badge>
        </Card>
        <Card className="p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400">Average Adaptability Score</p>
            <p className="text-xl font-bold text-white mt-1">84%</p>
          </div>
          <Badge variant="indigo">High Match</Badge>
        </Card>
      </div>

      {/* Session list preview */}
      <Card>
        <CardHeader>
          <CardTitle>Session Queue Placeholder</CardTitle>
          <CardDescription>
            Simulated queue showing next candidate interview ready for launch.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-[#1e2d4f] bg-[#0c1222] p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-white">Alex Chen</span>
                <Badge variant="warning">Ready to Start</Badge>
              </div>
              <p className="text-xs text-slate-400">
                Senior Full-Stack Engineer • System Design & React 19 / Next.js
              </p>
            </div>
            <Link href="/interview/demo-session">
              <Button size="sm" className="gap-2">
                <Play className="h-3.5 w-3.5" />
                Launch Live Session
              </Button>
            </Link>
          </div>
        </CardContent>
        <CardFooter className="flex justify-between items-center">
          <Link href="/setup">
            <Button variant="outline" size="sm">
              Back to Setup
            </Button>
          </Link>
          <Link href="/interview/demo-session">
            <Button size="sm" className="gap-2">
              Go to Live Interview
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
