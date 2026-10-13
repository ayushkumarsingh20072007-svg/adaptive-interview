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
  Eye,
  RefreshCw,
  CheckCircle2,
  ExternalLink,
  FileText,
  ShieldCheck,
  Check,
  LogOut,
  Lock,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import {
  CandidateSetup,
  TargetRole,
  ExperienceLevel,
  InterviewFocus,
} from "@/lib/types";
import { ROLE_LABELS, ROLE_SKILLS, SAMPLE_CANDIDATE } from "@/lib/mock-data";
import { saveStoredSetup, getStoredSetup } from "@/lib/storage";
import { useAuth } from "@/lib/auth-context";
import { useIsMounted } from "@/lib/use-mounted";

export default function CandidateSetupPage() {
  const router = useRouter();
  const { user, logout, isLoading } = useAuth();
  const isMounted = useIsMounted();

  React.useEffect(() => {
    if (isMounted && !isLoading && !user) {
      router.replace("/login?redirect=/setup");
    }
  }, [isMounted, isLoading, user, router]);

  // Initialize state with static defaults for SSR, hydrate in useEffect
  const [candidateName, setCandidateName] = React.useState<string>("");
  const [targetRole, setTargetRole] = React.useState<TargetRole>("fullstack");
  const [experienceLevel, setExperienceLevel] = React.useState<ExperienceLevel>("intermediate");
  const [interviewFocus, setInterviewFocus] = React.useState<InterviewFocus>("mixed");
  const [interviewLength, setInterviewLength] = React.useState<number>(20);
  const [resumeFile, setResumeFile] = React.useState<{
    name: string;
    size: string;
    isSample: boolean;
    previewUrl?: string;
    extractedSnippet?: string;
    detectedName?: string;
  } | null>(null);

  const [isPreviewOpen, setIsPreviewOpen] = React.useState<boolean>(false);
  const [isDragging, setIsDragging] = React.useState<boolean>(false);
  const [isResumeVerified, setIsResumeVerified] = React.useState<boolean>(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const existing = getStoredSetup(user?.id);
    if (!existing) return;
    requestAnimationFrame(() => {
      if (existing.candidateName) {
        setCandidateName(existing.candidateName);
      } else if (user?.name) {
        setCandidateName(user.name);
      }
      if (existing.targetRole) setTargetRole(existing.targetRole);
      if (existing.experienceLevel) setExperienceLevel(existing.experienceLevel);
      if (existing.interviewFocus) setInterviewFocus(existing.interviewFocus);
      if (existing.interviewLength) setInterviewLength(existing.interviewLength);
      if (existing.resumeFileName) {
        setResumeFile({
          name: existing.resumeFileName,
          size: existing.resumeFileSize || "2.4 MB",
          isSample: existing.isSampleResume ?? false,
          previewUrl: existing.resumePreviewUrl,
          extractedSnippet: existing.resumeText,
        });
        setIsResumeVerified(true);
      }
    });
  }, [user]);

  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Process dropped or selected file
  function processFile(file: File) {
    // Validate type
    const validExtensions = [".pdf", ".docx", ".txt"];
    const fileExt = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
    if (!validExtensions.includes(fileExt)) {
      setErrors((prev) => ({
        ...prev,
        resume: "Accepted formats are PDF (.pdf), Word (.docx), or Text (.txt).",
      }));
      return;
    }

    // Validate size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setErrors((prev) => ({
        ...prev,
        resume: "File size exceeds 10MB limit. Please select a smaller file.",
      }));
      return;
    }

    const formattedSize = (file.size / (1024 * 1024)).toFixed(1) + " MB";
    let previewUrl: string | undefined;
    try {
      previewUrl = URL.createObjectURL(file);
    } catch {
      // ignore
    }

    // Heuristically suggest candidate name from filename if not yet filled
    const cleanBaseName = file.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ");
    const potentialName = cleanBaseName
      .replace(/\b(resume|cv|curriculum|vitae|developer|engineer|fullstack|frontend|backend|swe)\b/gi, "")
      .trim();

    if (!candidateName && potentialName.length >= 3) {
      setCandidateName(potentialName);
    }

    // Call server-side /api/resume/parse route for genuine PDF/DOCX/TXT extraction
    const formData = new FormData();
    formData.append("file", file);

    fetch("/api/resume/parse", {
      method: "POST",
      body: formData,
    })
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          const profile = data.profile;
          setResumeFile({
            name: file.name,
            size: formattedSize,
            isSample: false,
            previewUrl,
            extractedSnippet: profile?.text || "",
            detectedName: profile?.detectedName || (potentialName.length >= 3 ? potentialName : undefined),
          });
          if (profile?.detectedName && !candidateName) {
            setCandidateName(profile.detectedName);
          }
          setIsResumeVerified(true);
        } else {
          const errData = await res.json().catch(() => ({}));
          // Fallback to client-side text if .txt
          if (file.type.includes("text") || fileExt === ".txt") {
            const reader = new FileReader();
            reader.onload = (ev) => {
              const text = (ev.target?.result as string) || "";
              setResumeFile({
                name: file.name,
                size: formattedSize,
                isSample: false,
                previewUrl,
                extractedSnippet: text.slice(0, 2000),
                detectedName: potentialName.length >= 3 ? potentialName : undefined,
              });
              setIsResumeVerified(true);
            };
            reader.readAsText(file);
          } else {
            setErrors((prev) => ({
              ...prev,
              resume: errData.error || "Failed to extract text from document. Please ensure it is not scanned or password-protected.",
            }));
            setResumeFile({
              name: file.name,
              size: formattedSize,
              isSample: false,
              previewUrl,
              detectedName: potentialName.length >= 3 ? potentialName : undefined,
            });
            setIsResumeVerified(false);
          }
        }
      })
      .catch(() => {
        setResumeFile({
          name: file.name,
          size: formattedSize,
          isSample: false,
          previewUrl,
          detectedName: potentialName.length >= 3 ? potentialName : undefined,
        });
        setIsResumeVerified(false);
      });

    setErrors((prev) => {
      const next = { ...prev };
      delete next.resume;
      return next;
    });
  }

  // Handle Real File Selection from input
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    processFile(file);
    e.target.value = "";
  }

  // Drag & drop handlers
  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
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
      detectedName: "Alex Rivera",
    });
    setIsResumeVerified(true);
    setErrors({});
  }

  // Remove Selected Resume
  function handleRemoveResume() {
    if (resumeFile?.previewUrl) {
      URL.revokeObjectURL(resumeFile.previewUrl);
    }
    setResumeFile(null);
    setIsResumeVerified(false);
  }

  function handleReplaceResume() {
    fileInputRef.current?.click();
  }

  // Handle Submit Form
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const newErrors: Record<string, string> = {};
    if (!user) {
      newErrors.auth = "Account required. Please sign in or register before launching an interview.";
    }
    if (!resumeFile) {
      newErrors.resume = "Resume is required. Please upload your resume (PDF, DOCX, TXT) or select a sample resume before proceeding.";
    }
    if (!targetRole) newErrors.targetRole = "Please select a target engineering role.";
    if (!experienceLevel) newErrors.experienceLevel = "Please specify your experience level.";
    if (!interviewFocus) newErrors.interviewFocus = "Please choose an interview focus.";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);

    const setupData: CandidateSetup = {
      candidateName: candidateName.trim() || (user ? user.name : "Candidate"),
      targetRole,
      experienceLevel,
      interviewFocus,
      interviewLength,
      resumeFileName: resumeFile?.name,
      resumeFileSize: resumeFile?.size,
      isSampleResume: resumeFile?.isSample ?? false,
      resumePreviewUrl: resumeFile?.previewUrl,
      resumeText: resumeFile?.extractedSnippet,
      skills: ROLE_SKILLS[targetRole] || [],
      createdAt: new Date().toISOString(),
      userId: user?.id,
    };

    saveStoredSetup(setupData);

    // Immediate instant navigation to dashboard
    window.location.assign("/dashboard");
  }

  const roleOptions: { role: TargetRole; desc: string }[] = [
    { role: "fullstack", desc: "Next.js, Node.js, Systems & Databases" },
    { role: "frontend", desc: "React, Web Performance, Modern CSS" },
    { role: "backend", desc: "APIs, PostgreSQL, Concurrency & Microservices" },
    { role: "python", desc: "FastAPI, AsyncIO, Internal Runtime" },
    { role: "java", desc: "Spring Boot, JVM Architecture, Concurrency" },
    { role: "data-analyst", desc: "SQL, Cohort Analytics, Data Modeling" },
  ];

  if (!isMounted || isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-slate-400">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
        <p className="text-xs">Checking authentication session...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-8 border-slate-800 bg-[#0e1628] text-center space-y-5 shadow-2xl">
          <div className="h-12 w-12 rounded-xl bg-indigo-950/60 border border-indigo-700/50 flex items-center justify-center text-indigo-400 mx-auto">
            <Lock className="h-6 w-6" />
          </div>
          <div className="space-y-1.5">
            <Badge variant="indigo" className="text-[10px]">Candidate Setup</Badge>
            <h2 className="text-xl font-bold text-white">Sign In Required</h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              You must sign in to configure your adaptive technical interview, upload your resume, and track your performance scorecards.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
            <Link href="/login?redirect=/setup" className="flex-1">
              <Button className="w-full bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold h-9">
                Sign In
              </Button>
            </Link>
            <Link href="/signup?redirect=/setup" className="flex-1">
              <Button variant="outline" className="w-full text-xs border-slate-700 hover:bg-slate-800/60 h-9">
                Create Account
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto w-full py-4">
      {/* Header */}
      <div className="p-6 sm:p-7 rounded-2xl border border-slate-800/80 bg-gradient-to-r from-[#0d162c]/90 via-[#0a1122]/90 to-[#0e172e]/90 shadow-md backdrop-blur-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Badge variant="indigo" className="text-xs py-0.5 px-2 font-medium">Step 1 of Setup</Badge>
            <span className="text-xs text-slate-400 font-mono">Candidate Calibration</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Configure Your Interview Profile
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-xl">
            Personalize the interview engine for your target role, seniority level, and upload your resume for adaptive questioning.
          </p>
        </div>
        <Link href="/">
          <Button variant="ghost" size="sm" className="gap-2 h-9 px-3.5 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800/60">
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Overview</span>
          </Button>
        </Link>
      </div>

      {/* Authenticated Mode Banner */}
      <div className="rounded-2xl border border-emerald-800/60 bg-emerald-950/25 px-5 py-3.5 text-xs text-emerald-300 flex items-center justify-between flex-wrap gap-3 shadow-sm">
        <div className="flex items-center gap-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>
            Signed in as <strong className="text-white">{user.name}</strong> ({user.email}). Your interview results will link to your account.
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="success" className="text-xs py-0.5 px-2">Authenticated</Badge>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={async () => {
              await logout();
              router.refresh();
            }}
            className="text-xs text-rose-300 hover:text-white hover:bg-rose-950/40 gap-1.5 h-7.5 px-2.5 rounded-lg"
            title="Log out of this account"
          >
            <LogOut className="h-3.5 w-3.5 text-rose-400" />
            <span>Log Out</span>
          </Button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left Column: Form Controls */}
        <div className="lg:col-span-2 space-y-6">
          {/* Card 1: Identity & Resume */}
          <Card className="rounded-2xl border border-slate-800/80 bg-[#0c1427]/90 shadow-md overflow-hidden">
            <CardHeader className="p-6 border-b border-slate-800/80 space-y-1.5">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base sm:text-lg">1. Candidate Information & Resume</CardTitle>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleUseSampleResume}
                  className="gap-1.5 text-xs h-8 px-3 rounded-xl text-indigo-300 border-indigo-800/60 hover:bg-indigo-950/50"
                >
                  <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
                  Use Sample Resume
                </Button>
              </div>
              <CardDescription className="text-xs">
                Provide an optional name and ingest your resume to calibrate question difficulty.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 sm:p-7 space-y-5">
              <div>
                <Label htmlFor="candidateName" className="font-semibold text-xs uppercase tracking-wider text-slate-300">Candidate Name (Optional)</Label>
                <Input
                  id="candidateName"
                  placeholder="e.g. Alex Rivera"
                  value={candidateName}
                  onChange={(e) => setCandidateName(e.target.value)}
                  className="mt-1.5 h-10 rounded-xl bg-[#070c18] border-slate-800 text-white placeholder-slate-500"
                />
              </div>

              {/* Resume Ingest Area */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="mb-0 font-semibold text-xs uppercase tracking-wider text-slate-300">Resume Ingestion (.pdf, .docx, .txt)</Label>
                  {resumeFile && (
                    <span className="text-xs text-slate-400">
                      {isResumeVerified ? (
                        <span className="text-emerald-400 flex items-center gap-1 font-medium">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Verified by you
                        </span>
                      ) : (
                        <span className="text-amber-400/90 flex items-center gap-1 font-medium">
                          <AlertCircle className="h-3.5 w-3.5" /> Needs verification
                        </span>
                      )}
                    </span>
                  )}
                </div>

                {/* Hidden File Input for click and replacement */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx,.txt"
                  onChange={handleFileChange}
                  className="hidden"
                />

                {resumeFile ? (
                  <div className="rounded-2xl border border-indigo-600/40 bg-gradient-to-br from-[#0c1326] via-[#0f172a] to-[#141d38] p-5 shadow-lg shadow-indigo-950/30">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-start gap-3.5 min-w-0">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-950 border border-indigo-700/60 text-indigo-300 shadow-inner">
                          <FileCheck className="h-6 w-6 text-indigo-400" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold text-white truncate max-w-[220px] sm:max-w-xs">
                              {resumeFile.name}
                            </p>
                            {resumeFile.isSample ? (
                              <Badge variant="indigo" className="text-[10px] py-0.5 px-2">
                                Sample Profile
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] py-0.5 px-2 text-slate-300 border-slate-700">
                                Uploaded File
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-indigo-300/80 font-mono mt-1">
                            {resumeFile.size} • {resumeFile.name.endsWith(".pdf") ? "PDF Document" : resumeFile.name.endsWith(".docx") ? "Word Document" : "Plain Text"}
                          </p>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setIsPreviewOpen(true)}
                          className="gap-1.5 text-xs h-8.5 px-3 rounded-xl text-indigo-300 border-indigo-700/60 bg-indigo-950/50 hover:bg-indigo-900/60 hover:text-white"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Verify & Preview
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={handleReplaceResume}
                          title="Upload different resume"
                          className="gap-1 text-xs h-8.5 px-2.5 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800/60"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">Change</span>
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={handleRemoveResume}
                          aria-label="Remove resume"
                          className="text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 h-8.5 w-8.5 rounded-xl"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Verification Prompt Bar */}
                    <div className="mt-3.5 pt-3.5 border-t border-[#1e2d4f]/60 flex items-center justify-between text-xs text-slate-400">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-indigo-400 animate-pulse" />
                        <span>
                          {isResumeVerified
                            ? "Document verified: Ready for candidate calibration."
                            : "Check your resume to confirm it is the right file."}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsPreviewOpen(true)}
                        className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2 text-xs font-medium"
                      >
                        Inspect content →
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 sm:p-10 text-center cursor-pointer transition-all duration-200 ${
                      isDragging
                        ? "border-indigo-400 bg-indigo-950/60 ring-4 ring-indigo-500/20 scale-[1.01]"
                        : "border-[#22304e] bg-[#070b14]/50 hover:border-indigo-500/60 hover:bg-[#0c1222]/60"
                    }`}
                  >
                    <div className={`flex h-14 w-14 items-center justify-center rounded-2xl transition-transform ${
                      isDragging ? "bg-indigo-600 text-white scale-110" : "bg-indigo-950/80 border border-indigo-800/50 text-indigo-400"
                    } mb-3.5`}>
                      <UploadCloud className="h-7 w-7" />
                    </div>
                    <p className="text-sm font-semibold text-slate-200">
                      {isDragging ? "Release to drop and inspect resume" : "Click to browse or drag and drop your resume"}
                    </p>
                    <p className="text-xs text-slate-400 mt-1.5 max-w-sm">
                      Supports PDF, DOCX, or TXT up to 10MB. You can preview and verify the document before starting.
                    </p>
                  </div>
                )}

                {errors.resume && (
                  <p className="text-xs text-rose-400 mt-2 flex items-center gap-1.5">
                    <AlertCircle className="h-3.5 w-3.5" />
                    {errors.resume}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Target Role */}
          <Card className="rounded-2xl border border-slate-800/80 bg-[#0c1427]/90 shadow-md overflow-hidden">
            <CardHeader className="p-6 border-b border-slate-800/80">
              <CardTitle className="text-base sm:text-lg">2. Target Engineering Role</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Select the domain role you want to practice for.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 sm:p-7">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {roleOptions.map((opt) => {
                  const isSelected = targetRole === opt.role;
                  return (
                    <button
                      key={opt.role}
                      type="button"
                      onClick={() => setTargetRole(opt.role)}
                      className={`text-left p-3.5 sm:p-4 rounded-xl border transition-all text-xs ${
                        isSelected
                          ? "border-indigo-500 bg-indigo-950/50 text-white ring-1 ring-indigo-500/60 shadow-sm"
                          : "border-[#1e2d4f] bg-[#0c1222] text-slate-300 hover:border-[#2b3e6b] hover:bg-[#141e34]"
                      }`}
                    >
                      <div className="font-semibold text-sm text-slate-100">
                        {ROLE_LABELS[opt.role]}
                      </div>
                      <div className="text-xs text-slate-400 mt-1">{opt.desc}</div>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Card 3: Calibration Parameters */}
          <Card className="rounded-2xl border border-slate-800/80 bg-[#0c1427]/90 shadow-md overflow-hidden">
            <CardHeader className="p-6 border-b border-slate-800/80">
              <CardTitle className="text-base sm:text-lg">3. Calibration Parameters</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Customize question depth, evaluation focus, and interview length.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 sm:p-7 space-y-5">
              {/* Experience level */}
              <div>
                <Label className="font-semibold text-xs uppercase tracking-wider text-slate-300">Experience Level</Label>
                <div className="grid grid-cols-3 gap-2.5 mt-1.5">
                  {(["beginner", "intermediate", "advanced"] as ExperienceLevel[]).map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setExperienceLevel(lvl)}
                      className={`py-2.5 px-3 rounded-xl border text-xs capitalize transition-colors ${
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
                <Label className="font-semibold text-xs uppercase tracking-wider text-slate-300">Interview Focus</Label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-1.5">
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
                      className={`py-2.5 px-3 rounded-xl border text-xs transition-colors text-center ${
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
                <Label className="font-semibold text-xs uppercase tracking-wider text-slate-300">Interview Length</Label>
                <div className="grid grid-cols-3 gap-2.5 mt-1.5">
                  {[10, 20, 30].map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => setInterviewLength(mins)}
                      className={`py-2.5 px-3 rounded-xl border text-xs flex items-center justify-center gap-1.5 transition-colors ${
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
          <Card className="sticky top-20 rounded-2xl border border-indigo-900/60 bg-gradient-to-br from-[#0f172e] to-[#0a1020] shadow-xl shadow-indigo-950/30 overflow-hidden">
            <CardHeader className="p-5 sm:p-6 border-b border-[#1a2642]">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold">Session Summary</CardTitle>
                <Badge variant="indigo" className="text-xs py-0.5 px-2">Live Preview</Badge>
              </div>
              <CardDescription className="text-xs mt-0.5">
                Verify your calibration before proceeding to the candidate dashboard.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 sm:p-6 space-y-3.5 text-xs">
              <div className="flex justify-between items-center py-1.5 border-b border-[#1a2642]/60">
                <span className="text-slate-400">Candidate:</span>
                <span className="font-semibold text-white">
                  {candidateName.trim() || "Alex Rivera (Demo)"}
                </span>
              </div>

              <div className="flex justify-between items-center py-1.5 border-b border-[#1a2642]/60">
                <span className="text-slate-400">Target Role:</span>
                <span className="font-semibold text-indigo-300">
                  {ROLE_LABELS[targetRole]}
                </span>
              </div>

              <div className="flex justify-between items-center py-1.5 border-b border-[#1a2642]/60">
                <span className="text-slate-400">Seniority Level:</span>
                <span className="capitalize text-slate-200">{experienceLevel}</span>
              </div>

              <div className="flex justify-between items-center py-1.5 border-b border-[#1a2642]/60">
                <span className="text-slate-400">Evaluation Focus:</span>
                <span className="capitalize text-slate-200">
                  {interviewFocus.replace("-", " ")}
                </span>
              </div>

              <div className="flex justify-between items-center py-1.5 border-b border-[#1a2642]/60">
                <span className="text-slate-400">Estimated Duration:</span>
                <span className="text-slate-200">{interviewLength} Minutes</span>
              </div>

              <div className="flex justify-between items-center py-1.5 border-b border-[#1a2642]/60">
                <span className="text-slate-400">Resume Status:</span>
                <span className={resumeFile ? "text-emerald-400 font-medium" : "text-amber-400 font-medium"}>
                  {resumeFile ? "Calibrated" : "Not Provided"}
                </span>
              </div>

              <div className="pt-2">
                <span className="text-xs text-slate-400 block mb-2 font-medium">
                  Associated Competencies:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {(ROLE_SKILLS[targetRole] || []).slice(0, 4).map((sk) => (
                    <Badge key={sk} variant="default" className="text-[10px] py-0.5 px-2">
                      {sk}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
            <CardFooter className="p-5 sm:p-6 pt-3 border-t border-[#1a2642] flex flex-col gap-3">
              {errors.auth && (
                <div className="w-full p-3 rounded-xl border border-amber-800/60 bg-amber-950/40 text-amber-200 text-xs flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5">
                    <AlertCircle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                    {errors.auth}
                  </span>
                  <Link href="/login" className="font-semibold underline shrink-0 hover:text-white">
                    Sign In
                  </Link>
                </div>
              )}
              {errors.resume && (
                <div className="w-full p-3 rounded-xl border border-rose-800/60 bg-rose-950/40 text-rose-200 text-xs flex items-center gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5 text-rose-400 shrink-0" />
                  {errors.resume}
                </div>
              )}
              <Button
                type="submit"
                isLoading={isSubmitting}
                className="w-full gap-2 justify-center h-11.5 rounded-xl font-bold text-sm bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white shadow-lg shadow-indigo-600/30 active:scale-[0.98] transition-all"
              >
                Proceed to Dashboard
                <ArrowRight className="h-4 w-4" />
              </Button>
              <p className="text-xs text-slate-500 text-center">
                Setup will be saved to your profile and can be re-calibrated at any time.
              </p>
            </CardFooter>
          </Card>
        </div>
      </form>

      {/* Resume Preview & Verification Modal */}
      {resumeFile && (
        <Modal
          isOpen={isPreviewOpen}
          onClose={() => setIsPreviewOpen(false)}
          title="Verify Uploaded Resume"
          description="Confirm that this resume belongs to you and matches your target role before interview simulation."
          className="max-w-3xl sm:max-w-4xl"
        >
          <div className="space-y-4">
            {/* Top Verification Header Card */}
            <div className="rounded-lg border border-[#1e2d4f] bg-[#0c1222] p-3 text-xs flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-950 text-indigo-300 font-mono">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white">{resumeFile.name}</span>
                    <Badge variant="indigo" className="text-[10px] py-0 px-1.5">
                      {resumeFile.size}
                    </Badge>
                  </div>
                  <p className="text-slate-400 mt-0.5">
                    Target Role: <strong className="text-slate-200">{ROLE_LABELS[targetRole]}</strong> • Seniority: <strong className="text-slate-200">{experienceLevel}</strong>
                  </p>
                </div>
              </div>

              {resumeFile.previewUrl && resumeFile.name.toLowerCase().endsWith(".pdf") && (
                <a
                  href={resumeFile.previewUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 font-medium underline underline-offset-2"
                >
                  Open in New Window
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>

            {/* Viewer Content Area */}
            <div className="rounded-lg border border-[#1e2d4f] bg-[#070b14] overflow-hidden">
              {resumeFile.previewUrl && resumeFile.name.toLowerCase().endsWith(".pdf") ? (
                <div className="relative">
                  <iframe
                    src={resumeFile.previewUrl}
                    title="Resume Document Preview"
                    className="w-full h-[500px] bg-slate-900"
                  />
                  <div className="p-2 border-t border-[#1e2d4f] bg-[#0c1222] text-[11px] text-slate-400 flex items-center justify-between">
                    <span>PDF Document Ingested & Rendered</span>
                    <a
                      href={resumeFile.previewUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-indigo-400 hover:underline flex items-center gap-1"
                    >
                      If PDF preview is blocked by browser, click here to view <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              ) : resumeFile.isSample ? (
                /* Sample Resume Full Formatted View */
                <div className="p-6 max-h-[500px] overflow-y-auto space-y-5 bg-[#090e1a] text-slate-200 text-xs">
                  <div className="border-b border-[#1e2d4f] pb-4">
                    <h2 className="text-xl font-bold text-white">Alex Rivera</h2>
                    <p className="text-indigo-400 font-medium mt-0.5">Senior Full-Stack Software Engineer</p>
                    <p className="text-slate-400 mt-1">
                      San Francisco, CA • alex.rivera@example.com • github.com/alexrivera • linkedin.com/in/alexrivera
                    </p>
                  </div>

                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-indigo-300 mb-1.5">
                      Professional Summary
                    </h3>
                    <p className="text-slate-300 leading-relaxed">
                      Accomplished Full-Stack Engineer with 5+ years of production experience architecting scalable Next.js and Node.js microservices. Proven track record reducing database query latency by 45% using Redis caching and PostgreSQL indexing. Passionate about resilient systems and distributed architectures.
                    </p>
                  </div>

                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-indigo-300 mb-2">
                      Work Experience
                    </h3>
                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between items-center text-slate-200 font-semibold">
                          <span>Senior Full-Stack Engineer — FinTech Labs</span>
                          <span className="text-slate-400 text-[11px] font-mono">2022 — Present</span>
                        </div>
                        <ul className="list-disc list-inside text-slate-400 mt-1 space-y-0.5 pl-1">
                          <li>Spearheaded transition of core transaction service to Next.js 14 & Node.js, handling 15,000+ RPM.</li>
                          <li>Implemented cache-aside strategy with Redis and distributed mutexes to eliminate cache stampedes.</li>
                          <li>Designed automated CI/CD deployment pipelines on Kubernetes with zero-downtime rolling deploys.</li>
                        </ul>
                      </div>

                      <div>
                        <div className="flex justify-between items-center text-slate-200 font-semibold">
                          <span>Full-Stack Developer — CloudScale Solutions</span>
                          <span className="text-slate-400 text-[11px] font-mono">2020 — 2022</span>
                        </div>
                        <ul className="list-disc list-inside text-slate-400 mt-1 space-y-0.5 pl-1">
                          <li>Developed interactive real-time telemetry dashboards using React, TypeScript, and WebSockets.</li>
                          <li>Engineered PostgreSQL schemas with partitioned tables, improving multi-tenant report query throughput.</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-indigo-300 mb-2">
                      Technical Skills & Competencies
                    </h3>
                    <div className="flex flex-wrap gap-1.5">
                      {["Next.js", "React", "TypeScript", "Node.js", "PostgreSQL", "Redis", "Docker", "System Design", "REST / GraphQL", "AWS / GCP"].map((sk) => (
                        <Badge key={sk} variant="default" className="text-[11px]">
                          {sk}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-indigo-300 mb-1">
                      Education
                    </h3>
                    <div className="flex justify-between items-center text-slate-300">
                      <span>B.S. in Computer Science — University of California, Berkeley</span>
                      <span className="text-slate-400 text-[11px] font-mono">2016 — 2020</span>
                    </div>
                  </div>
                </div>
              ) : resumeFile.extractedSnippet ? (
                /* Text Snippet Preview */
                <div className="p-4 max-h-[500px] overflow-y-auto">
                  <pre className="whitespace-pre-wrap font-mono text-xs text-slate-300 bg-[#070b14] p-3 rounded border border-[#1e2d4f]">
                    {resumeFile.extractedSnippet}
                  </pre>
                </div>
              ) : (
                /* DOCX or binary fallback inspection */
                <div className="p-8 text-center space-y-4">
                  <div className="flex h-16 w-16 mx-auto items-center justify-center rounded-2xl bg-indigo-950/70 border border-indigo-800/60 text-indigo-400">
                    <FileCheck className="h-8 w-8" />
                  </div>
                  <div>
                    <h4 className="text-base font-semibold text-white">{resumeFile.name}</h4>
                    <p className="text-xs text-slate-400 mt-1">
                      Word Document (.docx) • {resumeFile.size} • Ready for Calibration
                    </p>
                  </div>
                  <div className="max-w-md mx-auto text-left rounded-lg border border-[#1e2d4f] bg-[#0c1222] p-4 text-xs space-y-2 text-slate-300">
                    <div className="flex items-center gap-2 text-emerald-400">
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                      <span>Valid document format accepted</span>
                    </div>
                    <div className="flex items-center gap-2 text-emerald-400">
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                      <span>File size within 10MB limit</span>
                    </div>
                    <div className="flex items-center gap-2 text-indigo-400">
                      <ShieldCheck className="h-4 w-4 shrink-0" />
                      <span>Ready to be used for personalized questions & AI evaluation</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Decision Footer */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-[#1e2d4f]">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setIsPreviewOpen(false);
                  handleReplaceResume();
                }}
                className="gap-2 text-xs text-rose-300 hover:text-rose-200 hover:bg-rose-950/30 w-full sm:w-auto"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Wrong Resume? Pick Another File
              </Button>

              <Button
                type="button"
                variant="primary"
                onClick={() => {
                  setIsResumeVerified(true);
                  setIsPreviewOpen(false);
                }}
                className="gap-2 text-xs w-full sm:w-auto bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
              >
                <Check className="h-4 w-4" />
                Yes, this is my resume (Confirm)
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
