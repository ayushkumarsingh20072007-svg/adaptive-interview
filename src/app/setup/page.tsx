"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  UploadCloud,
  FileCheck,
  Trash2,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Clock,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CandidateSetup,
  TargetRole,
  ExperienceLevel,
  InterviewFocus,
} from "@/lib/types";
import { ROLE_LABELS, ROLE_SKILLS, SAMPLE_CANDIDATE } from "@/lib/mock-data";
import { saveStoredSetup, getStoredSetup } from "@/lib/storage";

export default function CandidateSetupPage() {
  const router = useRouter();

  // Initialize state directly from stored data without cascading renders
  const [candidateName, setCandidateName] = React.useState<string>(() => {
    return getStoredSetup()?.candidateName || "";
  });

  const [targetRole, setTargetRole] = React.useState<TargetRole>(() => {
    return getStoredSetup()?.targetRole || "fullstack";
  });

  const [experienceLevel, setExperienceLevel] = React.useState<ExperienceLevel>(() => {
    return getStoredSetup()?.experienceLevel || "intermediate";
  });

  const [interviewFocus, setInterviewFocus] = React.useState<InterviewFocus>(() => {
    return getStoredSetup()?.interviewFocus || "mixed";
  });

  const [interviewLength, setInterviewLength] = React.useState<number>(() => {
    return getStoredSetup()?.interviewLength || 20;
  });

  const [resumeFile, setResumeFile] = React.useState<{
    name: string;
    size: string;
    isSample: boolean;
  } | null>(() => {
    const existing = getStoredSetup();
    if (existing?.resumeFileName) {
      return {
        name: existing.resumeFileName,
        size: existing.resumeFileSize || "2.4 MB",
        isSample: existing.isSampleResume ?? false,
      };
    }
    return null;
  });

  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Handle Real File Selection
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate type
    const validExtensions = [".pdf", ".docx"];
    const fileExt = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
    if (!validExtensions.includes(fileExt)) {
      setErrors((prev) => ({
        ...prev,
        resume: "Accepted file formats are PDF (.pdf) or Word (.docx).",
      }));
      return;
    }

    // Validate size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setErrors((prev) => ({
        ...prev,
        resume: "File size exceeds 5MB limit. Please select a smaller file.",
      }));
      return;
    }

    const formattedSize = (file.size / (1024 * 1024)).toFixed(1) + " MB";
    setResumeFile({
      name: file.name,
      size: formattedSize,
      isSample: false,
    });
    setErrors((prev) => {
      const next = { ...prev };
      delete next.resume;
      return next;
    });
  }

  // Load Sample Resume Shortcut
  function handleUseSampleResume() {
    setCandidateName(SAMPLE_CANDIDATE.candidateName);
    setTargetRole(SAMPLE_CANDIDATE.targetRole);
    setExperienceLevel(SAMPLE_CANDIDATE.experienceLevel);
    setInterviewFocus(SAMPLE_CANDIDATE.interviewFocus);
    setInterviewLength(SAMPLE_CANDIDATE.interviewLength);
    setResumeFile({
      name: SAMPLE_CANDIDATE.resumeFileName || "Alex_Rivera_FullStack_Resume.pdf",
      size: SAMPLE_CANDIDATE.resumeFileSize || "2.4 MB",
      isSample: true,
    });
    setErrors({});
  }

  // Remove Selected Resume
  function handleRemoveResume() {
    setResumeFile(null);
  }

  // Handle Submit Form
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const newErrors: Record<string, string> = {};
    if (!targetRole) newErrors.targetRole = "Please select a target engineering role.";
    if (!experienceLevel) newErrors.experienceLevel = "Please specify your experience level.";
    if (!interviewFocus) newErrors.interviewFocus = "Please choose an interview focus.";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);

    const setupData: CandidateSetup = {
      candidateName: candidateName.trim() || "Candidate",
      targetRole,
      experienceLevel,
      interviewFocus,
      interviewLength,
      resumeFileName: resumeFile?.name,
      resumeFileSize: resumeFile?.size,
      isSampleResume: resumeFile?.isSample ?? false,
      skills: ROLE_SKILLS[targetRole] || [],
      createdAt: new Date().toISOString(),
    };

    saveStoredSetup(setupData);

    // Smooth navigation to dashboard
    setTimeout(() => {
      router.push("/dashboard");
    }, 250);
  }

  const roleOptions: { role: TargetRole; desc: string }[] = [
    { role: "fullstack", desc: "Next.js, Node.js, Systems & Databases" },
    { role: "frontend", desc: "React, Web Performance, Modern CSS" },
    { role: "backend", desc: "APIs, PostgreSQL, Concurrency & Microservices" },
    { role: "python", desc: "FastAPI, AsyncIO, Internal Runtime" },
    { role: "java", desc: "Spring Boot, JVM Architecture, Concurrency" },
    { role: "data-analyst", desc: "SQL, Cohort Analytics, Data Modeling" },
  ];

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto w-full py-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#1e2d4f] pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="indigo">Step 1 of Setup</Badge>
            <span className="text-xs text-slate-400">Candidate Calibration</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">
            Configure Your Interview Profile
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Personalize the interview engine for your target role, seniority level, and focus area.
          </p>
        </div>
        <Link href="/">
          <Button variant="ghost" size="sm" className="gap-1.5">
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Overview</span>
          </Button>
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Form Controls */}
        <div className="lg:col-span-2 space-y-6">
          {/* Card 1: Identity & Resume */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">1. Candidate Information & Resume</CardTitle>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleUseSampleResume}
                  className="gap-1.5 text-xs text-indigo-300 border-indigo-800/60 hover:bg-indigo-950/40"
                >
                  <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
                  Use Sample Resume
                </Button>
              </div>
              <CardDescription>
                Provide an optional name and ingest your resume to calibrate question difficulty.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="candidateName">Candidate Name (Optional)</Label>
                <Input
                  id="candidateName"
                  placeholder="e.g. Alex Rivera"
                  value={candidateName}
                  onChange={(e) => setCandidateName(e.target.value)}
                />
              </div>

              {/* Resume Ingest Area */}
              <div>
                <Label>Resume Upload (.pdf, .docx)</Label>

                {resumeFile ? (
                  <div className="flex items-center justify-between rounded-lg border border-indigo-800/60 bg-indigo-950/30 p-3.5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-900/60 text-indigo-300">
                        <FileCheck className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white truncate max-w-[220px] sm:max-w-xs">
                          {resumeFile.name}
                        </p>
                        <p className="text-xs text-indigo-300 font-mono">
                          {resumeFile.size} {resumeFile.isSample ? "• Sample Profile Loaded" : "• Ready for calibration"}
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={handleRemoveResume}
                      aria-label="Remove resume"
                      className="text-slate-400 hover:text-rose-400"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[#22304e] bg-[#070b14]/50 p-6 text-center cursor-pointer hover:border-indigo-500/60 transition-colors">
                    <UploadCloud className="h-8 w-8 text-indigo-400 mb-2" />
                    <p className="text-sm font-medium text-slate-200">
                      Click to browse or drag and drop your resume
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Supports PDF or DOCX up to 5MB (Metadata parsed locally)
                    </p>
                    <input
                      type="file"
                      accept=".pdf,.docx"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                )}

                {errors.resume && (
                  <p className="text-xs text-rose-400 mt-1 flex items-center gap-1">
                    <AlertCircle className="h-3.5 w-3.5" />
                    {errors.resume}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Target Role */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">2. Target Engineering Role</CardTitle>
              <CardDescription>
                Select the domain role you want to practice for.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {roleOptions.map((opt) => {
                  const isSelected = targetRole === opt.role;
                  return (
                    <button
                      key={opt.role}
                      type="button"
                      onClick={() => setTargetRole(opt.role)}
                      className={`text-left p-3 rounded-lg border transition-all text-xs ${
                        isSelected
                          ? "border-indigo-500 bg-indigo-950/40 text-white ring-1 ring-indigo-500"
                          : "border-[#1e2d4f] bg-[#0c1222] text-slate-300 hover:border-[#2b3e6b] hover:bg-[#141e34]"
                      }`}
                    >
                      <div className="font-semibold text-sm text-slate-100">
                        {ROLE_LABELS[opt.role]}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1">{opt.desc}</div>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Card 3: Calibration Parameters */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">3. Calibration Parameters</CardTitle>
              <CardDescription>
                Customize question depth, evaluation focus, and interview length.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Experience level */}
              <div>
                <Label>Experience Level</Label>
                <div className="grid grid-cols-3 gap-2">
                  {(["beginner", "intermediate", "advanced"] as ExperienceLevel[]).map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setExperienceLevel(lvl)}
                      className={`py-2 px-3 rounded-lg border text-xs capitalize transition-colors ${
                        experienceLevel === lvl
                          ? "border-indigo-500 bg-indigo-950/50 text-white font-semibold"
                          : "border-[#1e2d4f] bg-[#0c1222] text-slate-300 hover:bg-[#141e34]"
                      }`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>

              {/* Focus */}
              <div>
                <Label>Interview Focus</Label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: "dsa", label: "DSA" },
                    { id: "core-concepts", label: "Core Concepts" },
                    { id: "projects", label: "Projects" },
                    { id: "mixed", label: "Mixed Track" },
                  ].map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setInterviewFocus(f.id as InterviewFocus)}
                      className={`py-2 px-2.5 rounded-lg border text-xs transition-colors text-center ${
                        interviewFocus === f.id
                          ? "border-indigo-500 bg-indigo-950/50 text-white font-semibold"
                          : "border-[#1e2d4f] bg-[#0c1222] text-slate-300 hover:bg-[#141e34]"
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Duration */}
              <div>
                <Label>Interview Length</Label>
                <div className="grid grid-cols-3 gap-2">
                  {[10, 20, 30].map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => setInterviewLength(mins)}
                      className={`py-2 px-3 rounded-lg border text-xs flex items-center justify-center gap-1.5 transition-colors ${
                        interviewLength === mins
                          ? "border-indigo-500 bg-indigo-950/50 text-white font-semibold"
                          : "border-[#1e2d4f] bg-[#0c1222] text-slate-300 hover:bg-[#141e34]"
                      }`}
                    >
                      <Clock className="h-3.5 w-3.5" />
                      {mins} Minutes
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Live Configuration Summary Card */}
        <div className="space-y-4">
          <Card className="sticky top-20 border-indigo-900/60 bg-[#10182b]">
            <CardHeader className="pb-3 border-b border-[#1a2642]">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Session Summary</CardTitle>
                <Badge variant="indigo">Live Preview</Badge>
              </div>
              <CardDescription>
                Verify your calibration before proceeding to the candidate dashboard.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3.5 text-xs pt-4">
              <div className="flex justify-between items-center py-1 border-b border-[#1a2642]/60">
                <span className="text-slate-400">Candidate:</span>
                <span className="font-semibold text-white">
                  {candidateName.trim() || "Alex Rivera (Demo)"}
                </span>
              </div>

              <div className="flex justify-between items-center py-1 border-b border-[#1a2642]/60">
                <span className="text-slate-400">Target Role:</span>
                <span className="font-semibold text-indigo-300">
                  {ROLE_LABELS[targetRole]}
                </span>
              </div>

              <div className="flex justify-between items-center py-1 border-b border-[#1a2642]/60">
                <span className="text-slate-400">Seniority Level:</span>
                <span className="capitalize text-slate-200">{experienceLevel}</span>
              </div>

              <div className="flex justify-between items-center py-1 border-b border-[#1a2642]/60">
                <span className="text-slate-400">Evaluation Focus:</span>
                <span className="capitalize text-slate-200">
                  {interviewFocus.replace("-", " ")}
                </span>
              </div>

              <div className="flex justify-between items-center py-1 border-b border-[#1a2642]/60">
                <span className="text-slate-400">Estimated Duration:</span>
                <span className="text-slate-200">{interviewLength} Minutes</span>
              </div>

              <div className="flex justify-between items-center py-1 border-b border-[#1a2642]/60">
                <span className="text-slate-400">Resume Status:</span>
                <span className={resumeFile ? "text-emerald-400" : "text-amber-400"}>
                  {resumeFile ? "Calibrated" : "Not Provided"}
                </span>
              </div>

              <div className="pt-2">
                <span className="text-[11px] text-slate-400 block mb-1.5 font-medium">
                  Associated Competencies:
                </span>
                <div className="flex flex-wrap gap-1">
                  {(ROLE_SKILLS[targetRole] || []).slice(0, 4).map((sk) => (
                    <Badge key={sk} variant="default" className="text-[10px] py-0 px-1.5">
                      {sk}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
            <CardFooter className="pt-2 flex flex-col gap-2">
              <Button
                type="submit"
                isLoading={isSubmitting}
                className="w-full gap-2 justify-center h-10 shadow-md shadow-indigo-950/60"
              >
                Proceed to Dashboard
                <ArrowRight className="h-4 w-4" />
              </Button>
              <p className="text-[10px] text-slate-500 text-center">
                Setup will be saved locally and can be re-calibrated at any time.
              </p>
            </CardFooter>
          </Card>
        </div>
      </form>
    </div>
  );
}
