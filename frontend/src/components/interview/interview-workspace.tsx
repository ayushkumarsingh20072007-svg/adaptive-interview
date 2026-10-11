"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Clock,
  Sparkles,
  HelpCircle,
  AlertCircle,
  CheckCircle2,
  Send,
  Loader2,
  BrainCircuit,
  Cpu,
  Zap,
  FileText,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Modal } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/textarea";
import {
  Question,
  InterviewSession,
  AnswerRecord,
  AnswerFeedback,
  EvaluationReport,
} from "@/lib/types";
import { ROLE_LABELS, SAMPLE_CANDIDATE } from "@/lib/mock-data";
import {
  getStoredSession,
  saveStoredSession,
  saveStoredReport,
  getStoredSetup,
} from "@/lib/storage";
import {
  aiGenerateInitialQuestion,
  aiEvaluateAnswer,
  aiGetNextQuestion,
  aiGenerateReport,
} from "@/lib/ai-client";

import { evaluateAnswer as mockEvaluate, getNextAdaptiveQuestion as mockNextQ, getInitialQuestion as mockInitQ } from "@/lib/interview-engine";
import { useIsMounted } from "@/lib/use-mounted";
import { useAuth } from "@/lib/auth-context";

interface InterviewWorkspaceProps {
  sessionId: string;
}

type AiStatus = "loading" | "ready" | "evaluating" | "branching" | "finishing" | "error";

export function InterviewWorkspace({ sessionId }: InterviewWorkspaceProps) {
  const router = useRouter();
  const { user } = useAuth();

  // Core session state
  const [session, setSession] = React.useState<InterviewSession>(() => {
    const stored = getStoredSession(sessionId);
    if (stored) return stored;
    const setup = getStoredSetup() || SAMPLE_CANDIDATE;
    const newSession: InterviewSession = {
      id: sessionId,
      setup,
      status: "in-progress",
      startedAt: new Date().toISOString(),
      durationSeconds: 0,
      answers: [],
      currentQuestionIndex: 0,
      userId: setup.userId,
    };
    saveStoredSession(newSession);
    return newSession;
  });

  const [currentQuestion, setCurrentQuestion] = React.useState<Question | null>(null);
  const [answerText, setAnswerText] = React.useState("");
  const [characterCount, setCharacterCount] = React.useState(0);
  const [wordCount, setWordCount] = React.useState(0);

  // UX & AI state
  const [aiStatus, setAiStatus] = React.useState<AiStatus>("loading");
  const [aiError, setAiError] = React.useState<string | null>(null);
  const [submissionFeedback, setSubmissionFeedback] = React.useState<AnswerFeedback | null>(null);
  const [inputError, setInputError] = React.useState<string | null>(null);
  const [evalError, setEvalError] = React.useState<string | null>(null);
  const [showHintModal, setShowHintModal] = React.useState(false);
  const [showEndConfirmModal, setShowEndConfirmModal] = React.useState(false);
  const [showResumeModal, setShowResumeModal] = React.useState(false);
  const [elapsedSeconds, setElapsedSeconds] = React.useState<number>(0);
  const [isAiPowered, setIsAiPowered] = React.useState(true);
  const isMounted = useIsMounted();

  // On mount: generate first AI question
  React.useEffect(() => {
    let cancelled = false;

    async function loadFirstQuestion() {
      const activeSession = getStoredSession(sessionId);
      const targetSetup = activeSession?.setup || getStoredSetup() || SAMPLE_CANDIDATE;

      // If session already has answers, resume with a fresh AI question
      if (activeSession && activeSession.answers.length > 0) {
        const lastAnswer = activeSession.answers[activeSession.answers.length - 1];
        setAiStatus("loading");
        try {
          const nextQ = await aiGetNextQuestion(
            targetSetup,
            { id: lastAnswer.questionId, questionText: lastAnswer.questionText, role: targetSetup.targetRole, category: lastAnswer.category, difficulty: lastAnswer.difficulty as Question["difficulty"], hint: "", expectedKeywords: [] },
            lastAnswer.answerText,
            lastAnswer.feedback.score,
            activeSession.answers
          );
          if (!cancelled) {
            if (nextQ) {
              setCurrentQuestion(nextQ);
            } else {
              handleCompleteInterview(activeSession);
              return;
            }
            setAiStatus("ready");
            setIsAiPowered(true);
          }
        } catch {
          if (!cancelled) {
            // Fallback to mock
            const mockQ = mockInitQ(targetSetup);
            setCurrentQuestion(mockQ);
            setAiStatus("ready");
            setIsAiPowered(false);
          }
        }
        return;
      }

      // Fresh session: generate first question
      try {
        const q = await aiGenerateInitialQuestion(targetSetup, targetSetup.resumeText);
        if (!cancelled) {
          setCurrentQuestion(q);
          setAiStatus("ready");
          setIsAiPowered(true);
        }
      } catch (err) {
        console.error("AI question generation failed, using mock fallback:", err);
        if (!cancelled) {
          // Fallback to mock question bank
          const mockQ = mockInitQ(targetSetup);
          setCurrentQuestion(mockQ);
          setAiStatus("ready");
          setIsAiPowered(false);
          setAiError("AI unavailable — using curated question bank.");
        }
      }
    }

    loadFirstQuestion();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // Elapsed timer
  React.useEffect(() => {
    const timer = setInterval(() => {
      setElapsedSeconds((prev) => {
        const next = prev + 1;
        setSession((current) => {
          if (!current) return current;
          const updated = { ...current, durationSeconds: next };
          saveStoredSession(updated);
          return updated;
        });
        return next;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  function handleAnswerChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const text = e.target.value;
    setAnswerText(text);
    setCharacterCount(text.length);
    setWordCount(text.trim() ? text.trim().split(/\s+/).length : 0);
    if (inputError) setInputError(null);
  }

  function formatTime(totalSeconds: number): string {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }

  async function handleSubmitAnswer(forceCurated = false) {
    if (!answerText.trim() || answerText.trim().length < 15) {
      setInputError("Please provide a substantive answer (at least 15 characters).");
      return;
    }
    if (!session || !currentQuestion) return;

    setAiStatus("evaluating");
    setInputError(null);
    setEvalError(null);

    const useAi = isAiPowered && !forceCurated;

    try {
      let feedback: AnswerFeedback;

      if (useAi) {
        feedback = await aiEvaluateAnswer(currentQuestion, answerText, session.setup);
      } else {
        await new Promise((r) => setTimeout(r, 600));
        feedback = mockEvaluate(currentQuestion, answerText);
      }

      setSubmissionFeedback(feedback);

      const record: AnswerRecord = {
        questionId: currentQuestion.id,
        questionText: currentQuestion.questionText,
        category: currentQuestion.category,
        difficulty: currentQuestion.difficulty,
        answerText: answerText.trim(),
        submittedAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        feedback,
      };

      const updatedAnswers = [...session.answers, record];
      const updatedSession: InterviewSession = {
        ...session,
        answers: updatedAnswers,
        currentQuestionIndex: session.currentQuestionIndex + 1,
      };
      setSession(updatedSession);
      saveStoredSession(updatedSession);

      // Question limit: automatically complete interview if target question count reached
      const targetQuestions = session.setup.interviewLength === 10 ? 3 : session.setup.interviewLength === 20 ? 5 : 7;
      if (updatedAnswers.length >= targetQuestions) {
        setTimeout(() => {
          handleCompleteInterview(updatedSession);
        }, 2200);
        return;
      }

      // After 2.2 seconds showing feedback, branch to next question
      setTimeout(async () => {
        setAiStatus("branching");

        try {
          let nextQ: Question | null = null;

          if (useAi) {
            nextQ = await aiGetNextQuestion(
              session.setup,
              currentQuestion,
              answerText,
              feedback.score,
              updatedAnswers
            );
          } else {
            nextQ = mockNextQ(currentQuestion, answerText, updatedSession);
          }

          if (nextQ) {
            setCurrentQuestion(nextQ);
            setAnswerText("");
            setCharacterCount(0);
            setWordCount(0);
            setSubmissionFeedback(null);
            setAiStatus("ready");
          } else {
            handleCompleteInterview(updatedSession);
          }
        } catch {
          // On next-question failure, fallback to mock
          const nextQ = mockNextQ(currentQuestion, answerText, updatedSession);
          if (nextQ) {
            setCurrentQuestion(nextQ);
            setAnswerText("");
            setCharacterCount(0);
            setWordCount(0);
            setSubmissionFeedback(null);
            setAiStatus("ready");
            setIsAiPowered(false);
          } else {
            handleCompleteInterview(updatedSession);
          }
        }
      }, 2200);
    } catch (err) {
      console.error("Answer evaluation error:", err);
      setAiStatus("ready");
      setEvalError("AI evaluation temporarily unavailable. Your typed answer is preserved below — you can retry with AI or proceed with curated evaluation.");
    }
  }

  async function handleCompleteInterview(currentSessionToFinalize?: InterviewSession) {
    const targetSession = currentSessionToFinalize || session;
    if (!targetSession) return;

    setAiStatus("finishing");

    targetSession.status = "completed";
    targetSession.endedAt = new Date().toISOString();
    targetSession.durationSeconds = elapsedSeconds;
    saveStoredSession(targetSession);

    try {
      let report: EvaluationReport;
      if (isAiPowered && targetSession.answers.length > 0) {
        report = await aiGenerateReport(targetSession);
      } else {
        // Import and use the mock report generator
        const { generateEvaluationReport } = await import("@/lib/interview-engine");
        report = generateEvaluationReport(targetSession);
      }
      if (user?.id && !report.userId) {
        report.userId = user.id;
      }
      saveStoredReport(report);
    } catch (err) {
      console.error("Report generation error:", err);
      const { generateEvaluationReport } = await import("@/lib/interview-engine");
      const report = generateEvaluationReport(targetSession);
      if (user?.id && !report.userId) {
        report.userId = user.id;
      }
      saveStoredReport(report);
    }

    router.push(`/report/${sessionId}`);
  }

  // ---- RENDER ----

  if (!isMounted || (aiStatus === "loading" && !currentQuestion)) {
    return (
      <div className="flex flex-col items-center justify-center p-16 text-center gap-4">
        <div className="relative">
          <div className="h-16 w-16 rounded-2xl bg-indigo-950 border border-indigo-800/60 flex items-center justify-center">
            <BrainCircuit className="h-8 w-8 text-indigo-400" />
          </div>
          <div className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-indigo-500 animate-pulse" />
        </div>
        <div>
          <p className="text-white font-semibold">Preparing your personalized interview...</p>
          <p className="text-sm text-slate-400 mt-1">AI is generating a question tailored to your profile.</p>
        </div>
        <Loader2 className="h-5 w-5 animate-spin text-indigo-400" />
      </div>
    );
  }

  if (aiStatus === "finishing") {
    return (
      <div className="flex flex-col items-center justify-center p-16 text-center gap-4">
        <div className="h-16 w-16 rounded-2xl bg-indigo-950 border border-indigo-800/60 flex items-center justify-center">
          <Sparkles className="h-8 w-8 text-indigo-400 animate-pulse" />
        </div>
        <div>
          <p className="text-white font-semibold">Synthesizing your evaluation report...</p>
          <p className="text-sm text-slate-400 mt-1">AI is analyzing all your answers and generating insights.</p>
        </div>
        <Loader2 className="h-5 w-5 animate-spin text-indigo-400" />
      </div>
    );
  }

  if (!currentQuestion) return null;

  const roleName = ROLE_LABELS[session.setup.targetRole] || "Software Engineer";
  const questionNumber = session.answers.length + 1;
  const estimatedTotal = Math.max(questionNumber, session.setup.interviewLength === 10 ? 4 : session.setup.interviewLength === 20 ? 7 : 10);
  const progressPercent = Math.min(95, Math.round((session.answers.length / estimatedTotal) * 100));
  const isProcessing = aiStatus === "evaluating" || aiStatus === "branching";

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto w-full py-2">
      {/* AI Error notice */}
      {aiError && (
        <div className="flex items-center gap-2 text-xs text-amber-300 bg-amber-950/30 border border-amber-800/40 rounded-lg px-3 py-2">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>{aiError}</span>
        </div>
      )}

      {/* 1. Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1e2d4f] pb-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-indigo-950 flex items-center justify-center border border-indigo-800/60 text-indigo-400">
            <BrainCircuit className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-white text-base">InterviewIQ Live Session</span>
              <Badge variant="indigo">{roleName}</Badge>
              {isAiPowered ? (
                <Badge variant="success" className="gap-1 text-[10px]">
                  <Zap className="h-2.5 w-2.5" />
                  AI Powered
                </Badge>
              ) : (
                <Badge variant="default" className="gap-1 text-[10px]">
                  <Cpu className="h-2.5 w-2.5" />
                  Curated
                </Badge>
              )}
            </div>
            <p className="text-xs text-slate-400">
              Focus: {session.setup.interviewFocus.replace("-", " ").toUpperCase()} • Seniority: {session.setup.experienceLevel}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {session.setup.resumeFileName && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowResumeModal(true)}
              className="gap-1.5 text-xs text-indigo-300 border-indigo-800/60 bg-indigo-950/40 hover:bg-indigo-900/50 hover:text-white"
              title="Inspect uploaded resume"
            >
              <FileText className="h-3.5 w-3.5" />
              <span className="hidden sm:inline truncate max-w-[140px]">{session.setup.resumeFileName}</span>
              <span className="sm:hidden">Resume</span>
            </Button>
          )}

          <div className="flex items-center gap-1.5 rounded-lg border border-[#1e2d4f] bg-[#0c1222] px-3 py-1.5 text-xs text-slate-300 font-mono">
            <Clock className="h-3.5 w-3.5 text-indigo-400" />
            <span>{formatTime(elapsedSeconds)}</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowEndConfirmModal(true)}
            disabled={isProcessing}
            className="text-xs text-rose-300 border-rose-900/60 hover:bg-rose-950/40 hover:text-white"
          >
            End Interview
          </Button>
        </div>
      </div>

      {/* 2. Progress Bar */}
      <div className="space-y-1.5">
        <div className="flex justify-between items-center text-xs text-slate-400">
          <span>Question {questionNumber} of ~{estimatedTotal}</span>
          <span className="font-mono text-indigo-400">{session.answers.length} answered</span>
        </div>
        <Progress value={progressPercent} indicatorColor="indigo" size="sm" />
      </div>

      {/* 3. Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Question + Answer */}
        <div className="lg:col-span-2 space-y-5">
          {/* Question Card */}
          <Card className="border-indigo-900/40 bg-[#10182b]">
            <CardHeader className="pb-3 border-b border-[#1a2642]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="indigo">
                    {isAiPowered ? "AI Question" : "Adaptive Question"} #{questionNumber}
                  </Badge>
                  <span className="text-xs font-semibold text-slate-300">{currentQuestion.category}</span>
                </div>
                <Badge variant="default" className="capitalize text-[11px]">
                  {currentQuestion.difficulty}
                </Badge>
              </div>
              <CardTitle className="text-base sm:text-lg text-white mt-2 leading-relaxed font-semibold">
                {currentQuestion.questionText}
              </CardTitle>
              {currentQuestion.context && (
                <p className="text-xs text-slate-400 mt-1 leading-relaxed italic border-l-2 border-indigo-800/60 pl-3">
                  {currentQuestion.context}
                </p>
              )}
            </CardHeader>
            <CardContent className="pt-3 pb-3 flex items-center justify-between text-xs text-slate-400">
              <span className="text-[11px] text-slate-400">
                Answer concisely with concrete technical terminology and trade-offs.
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowHintModal(true)}
                disabled={isProcessing}
                className="text-xs gap-1.5 text-indigo-300 hover:text-white h-7 px-2"
              >
                <HelpCircle className="h-3.5 w-3.5" />
                View Hint
              </Button>
            </CardContent>
          </Card>

          {/* Answer Workspace */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs text-slate-400">
              <label htmlFor="interview-answer" className="font-medium text-slate-300">
                Your Technical Response:
              </label>
              <div className="flex items-center gap-3 font-mono text-[11px]">
                <span>{wordCount} words</span>
                <span>•</span>
                <span>{characterCount} chars</span>
              </div>
            </div>

            <Textarea
              id="interview-answer"
              rows={8}
              value={answerText}
              onChange={handleAnswerChange}
              disabled={isProcessing}
              placeholder="Structure your answer clearly. Explain your decision, trade-offs, edge cases, and rationale..."
              className="font-mono text-sm leading-relaxed p-4 bg-[#070b14] border-[#1e2d4f] focus-visible:border-indigo-500"
            />

            {inputError && (
              <p className="text-xs text-rose-400 flex items-center gap-1.5 mt-1">
                <AlertCircle className="h-3.5 w-3.5" />
                {inputError}
              </p>
            )}

            {/* AI Evaluation Status */}
            {aiStatus === "evaluating" && (
              <div className="rounded-xl border border-indigo-800/50 bg-indigo-950/30 p-4 flex items-center gap-3 animate-in fade-in duration-200">
                <Loader2 className="h-4 w-4 animate-spin text-indigo-400 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-indigo-300">AI evaluating your answer...</p>
                  <p className="text-[11px] text-slate-400">Analyzing technical depth, accuracy, and trade-offs.</p>
                </div>
              </div>
            )}

            {aiStatus === "branching" && (
              <div className="rounded-xl border border-indigo-800/50 bg-indigo-950/30 p-4 flex items-center gap-3 animate-in fade-in duration-200">
                <Loader2 className="h-4 w-4 animate-spin text-indigo-400 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-indigo-300">AI adapting next question...</p>
                  <p className="text-[11px] text-slate-400">Calibrating difficulty and focus based on your response.</p>
                </div>
              </div>
            )}

            {/* Feedback Banner */}
            {submissionFeedback && (
              <div className="rounded-xl border border-indigo-800/70 bg-indigo-950/40 p-4 space-y-2 animate-in fade-in duration-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-indigo-300 text-xs font-semibold">
                    <Sparkles className="h-4 w-4 text-indigo-400" />
                    <span>{isAiPowered ? "AI Feedback" : "Adaptive Feedback"} Calibrated</span>
                  </div>
                  <Badge variant="success">Response Score: {submissionFeedback.score}%</Badge>
                </div>
                <p className="text-xs text-slate-200 leading-relaxed">{submissionFeedback.adaptiveNote}</p>
                <div className="flex items-center gap-2 text-[11px] text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>{submissionFeedback.strengths[0]}</span>
                </div>
                <p className="text-[11px] text-indigo-300 font-mono pt-1">
                  Branching to next adaptive inquiry...
                </p>
              </div>
            )}

            {/* Recoverable Evaluation Error with Retry */}
            {evalError && (
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-amber-800/60 bg-amber-950/40 text-xs text-amber-200">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-400 shrink-0" />
                  <span>{evalError}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleSubmitAnswer(false)}
                    className="border-amber-700/60 text-amber-200 hover:bg-amber-900/40"
                  >
                    Retry with AI
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleSubmitAnswer(true)}
                    className="text-slate-300 hover:text-white"
                  >
                    Use Curated Mode
                  </Button>
                </div>
              </div>
            )}

            {/* Submit Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
              <p className="text-[11px] text-slate-500">
                {isAiPowered
                  ? "Responses are evaluated by Gemini AI against role benchmarks."
                  : "Responses are evaluated against technical role benchmarks."}
              </p>
              <Button
                onClick={() => handleSubmitAnswer(false)}
                disabled={isProcessing || submissionFeedback !== null}
                isLoading={aiStatus === "evaluating"}
                className="w-full sm:w-auto gap-2 px-6 h-10 shadow-md shadow-indigo-950/60"
              >
                <Send className="h-4 w-4" />
                Submit Answer
              </Button>
            </div>
          </div>
        </div>

        {/* Right: Telemetry + History */}
        <div className="space-y-4">
          <Card className="bg-[#10182b]">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Session Telemetry</CardTitle>
              <CardDescription>
                {isAiPowered ? "Real-time Gemini AI interview orchestrator." : "Curated adaptive interview orchestrator."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div className="flex justify-between py-1 border-b border-[#1a2642]/60">
                <span className="text-slate-400">AI Engine:</span>
                {isAiPowered ? (
                  <Badge variant="success" className="gap-1">
                    <Zap className="h-2.5 w-2.5" />
                    Gemini 3.8
                  </Badge>
                ) : (
                  <Badge variant="default">Curated</Badge>
                )}
              </div>
              <div className="flex justify-between py-1 border-b border-[#1a2642]/60">
                <span className="text-slate-400">Adaptive Branching:</span>
                <Badge variant="indigo">Active</Badge>
              </div>
              <div className="flex justify-between py-1 border-b border-[#1a2642]/60">
                <span className="text-slate-400">Candidate:</span>
                <span className="font-semibold text-white truncate max-w-[140px]">
                  {session.setup.candidateName}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#1a2642]/60">
                <span className="text-slate-400">Evaluation Rubric:</span>
                <span className="text-slate-200 font-mono">
                  {isAiPowered ? "Gemini AI" : "STAR / Keyword"}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Questions Answered:</span>
                <span className="font-mono text-emerald-400 font-semibold">{session.answers.length}</span>
              </div>
            </CardContent>
          </Card>

          {/* History */}
          <Card className="bg-[#10182b]">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase tracking-wider text-slate-400">
                Answered in this session ({session.answers.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              {session.answers.length === 0 ? (
                <p className="text-[11px] text-slate-500 italic py-2">
                  No submitted answers yet. Answer the prompt above to begin.
                </p>
              ) : (
                session.answers.map((ans, idx) => (
                  <div
                    key={ans.questionId}
                    className="p-2.5 rounded-lg border border-[#1e2d4f] bg-[#0c1222] space-y-1"
                  >
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-medium text-slate-300 truncate max-w-[130px]">
                        Q{idx + 1}: {ans.category}
                      </span>
                      <Badge variant="success" className="text-[10px] py-0 px-1">
                        {ans.feedback.score}%
                      </Badge>
                    </div>
                    <p className="text-[11px] text-slate-400 line-clamp-1 italic">
                      &quot;{ans.answerText}&quot;
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* MODALS */}
      <Modal
        isOpen={showHintModal}
        onClose={() => setShowHintModal(false)}
        title="Conceptual Hint"
        description="Guidance to help structure your technical answer."
      >
        <div className="space-y-4 text-sm text-slate-200">
          <div className="p-4 rounded-lg border border-indigo-900/60 bg-indigo-950/30 text-indigo-200 leading-relaxed">
            <p className="font-medium mb-1">Key Considerations:</p>
            <p>{currentQuestion?.hint}</p>
          </div>
          {currentQuestion?.expectedKeywords && currentQuestion.expectedKeywords.length > 0 && (
            <div className="p-3 rounded-lg border border-[#1e2d4f] bg-[#0c1222]">
              <p className="text-xs text-slate-400 font-semibold mb-1">Relevant concepts to cover:</p>
              <div className="flex flex-wrap gap-1.5">
                {currentQuestion.expectedKeywords.map((kw) => (
                  <span
                    key={kw}
                    className="px-2 py-0.5 rounded-full text-[11px] border border-[#1e2d4f] bg-[#141e34] text-slate-300"
                  >
                    {kw}
                  </span>
                ))}
              </div>
            </div>
          )}
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setShowHintModal(false)}>
              Got it
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showEndConfirmModal}
        onClose={() => setShowEndConfirmModal(false)}
        title="Conclude Interview Session?"
        description="Ready to finalize your responses and generate your AI evaluation report?"
      >
        <div className="space-y-4 text-xs text-slate-300">
          <p className="leading-relaxed">
            You have answered{" "}
            <span className="font-semibold text-white">{session.answers.length} question(s)</span> in
            this session. All submitted responses and demonstrated competencies will be synthesized
            into an {isAiPowered ? "AI-powered evidence-backed" : "evidence-backed"} intelligence report.
          </p>
          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowEndConfirmModal(false)}
            >
              Continue Interview
            </Button>
            <Button
              size="sm"
              variant="danger"
              onClick={() => {
                setShowEndConfirmModal(false);
                handleCompleteInterview();
              }}
            >
              Conclude & Generate Report
            </Button>
          </div>
        </div>
      </Modal>

      {/* Resume In-Interview Modal */}
      {session.setup.resumeFileName && (
        <Modal
          isOpen={showResumeModal}
          onClose={() => setShowResumeModal(false)}
          title="Candidate Resume Reference"
          description={`Resume associated with this interview: ${session.setup.resumeFileName}`}
          className="max-w-2xl"
        >
          <div className="space-y-4 text-xs">
            <div className="rounded-lg border border-[#1e2d4f] bg-[#0c1222] p-3 flex items-center justify-between">
              <div>
                <p className="font-semibold text-white">{session.setup.candidateName}</p>
                <p className="text-slate-400 mt-0.5">
                  Target Role: <strong className="text-indigo-300">{ROLE_LABELS[session.setup.targetRole]}</strong> • {session.setup.experienceLevel}
                </p>
              </div>
              <Badge variant="indigo">{session.setup.resumeFileSize || "Uploaded"}</Badge>
            </div>

            {session.setup.resumeText ? (
              <pre className="p-3 bg-[#070b14] rounded border border-[#1e2d4f] text-slate-300 whitespace-pre-wrap font-mono max-h-[350px] overflow-y-auto">
                {session.setup.resumeText}
              </pre>
            ) : session.setup.isSampleResume ? (
              <div className="p-4 bg-[#070b14] rounded border border-[#1e2d4f] text-slate-300 space-y-2 max-h-[350px] overflow-y-auto">
                <p className="font-semibold text-white text-sm">Alex Rivera — Senior Full-Stack Engineer</p>
                <p className="text-slate-400">San Francisco, CA • alex.rivera@example.com</p>
                <p className="pt-2 text-slate-300">
                  5+ years building Next.js, Node.js, and PostgreSQL distributed systems. Lead engineer at FinTech Labs.
                </p>
                <div className="flex flex-wrap gap-1 pt-2">
                  {session.setup.skills.map((s) => (
                    <Badge key={s} variant="default" className="text-[10px]">
                      {s}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-6 bg-[#070b14] rounded border border-[#1e2d4f] text-center space-y-2">
                <FileText className="h-8 w-8 mx-auto text-indigo-400" />
                <p className="text-white font-medium">{session.setup.resumeFileName}</p>
                <p className="text-slate-400">
                  Calibrated profile active for this interview session.
                </p>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button size="sm" variant="outline" onClick={() => setShowResumeModal(false)}>
                Close Preview
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
