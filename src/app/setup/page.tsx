import Link from "next/link";
import { ArrowRight, ArrowLeft, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function CandidateSetupPage() {
  return (
    <div className="flex flex-col gap-6 max-w-3xl mx-auto w-full py-4">
      {/* Route Header */}
      <div className="flex items-center justify-between border-b border-[#1e2d4f] pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="indigo">Step 2 of 5</Badge>
            <span className="text-xs text-slate-400">Route: /setup</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Candidate Setup & Calibration</h1>
          <p className="text-sm text-slate-400">
            Configure candidate credentials, target role requirements, and resume ingest.
          </p>
        </div>
        <Link href="/">
          <Button variant="ghost" size="sm" className="gap-1.5">
            <ArrowLeft className="h-4 w-4" />
            Overview
          </Button>
        </Link>
      </div>

      {/* Placeholder Form Card */}
      <Card>
        <CardHeader>
          <CardTitle>Session Configuration Placeholder</CardTitle>
          <CardDescription>
            Minimal placeholder to verify form inputs and design tokens. Full ingestion logic will be wired in upcoming stages.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="candidateName" required>
              Candidate Full Name
            </Label>
            <Input id="candidateName" placeholder="e.g. Alex Chen" defaultValue="Alex Chen" />
          </div>

          <div>
            <Label htmlFor="targetRole" required>
              Target Engineering Role
            </Label>
            <Input
              id="targetRole"
              placeholder="e.g. Senior Full-Stack Engineer (Next.js / Node.js)"
              defaultValue="Senior Full-Stack Engineer"
            />
          </div>

          <div>
            <Label>Resume Upload Ingest</Label>
            <div className="flex flex-col items-center justify-center border border-dashed border-[#22304e] rounded-lg p-6 bg-[#0c1222]/50 text-center">
              <UploadCloud className="h-8 w-8 text-indigo-400 mb-2" />
              <p className="text-xs text-slate-300 font-medium">Drag and drop resume PDF, or click to browse</p>
              <p className="text-[11px] text-slate-500 mt-1">Simulated parser ready for Stage 2</p>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-between items-center">
          <Link href="/">
            <Button variant="outline" size="sm">
              Back to Overview
            </Button>
          </Link>
          <Link href="/dashboard">
            <Button size="sm" className="gap-2">
              Proceed to Dashboard
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
