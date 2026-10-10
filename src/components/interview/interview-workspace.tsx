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
} from "@/lib/types";
import { ROLE_LABELS, QUESTION_BANK, SAMPLE_CANDIDATE } from "@/lib/mock-data";
import {
  getStoredSession,
  saveStoredSession,
  getStoredSetup,
} from "@/lib/storage";
import {
  evaluateAnswer,
  getNextAdaptiveQuestion,
  generateEvaluationReport,
} from "@/lib/interview-engine";

interface InterviewWorkspaceProps {
  sessionId: string;
}

export function InterviewWorkspace({ sessionId }: InterviewWorkspaceProps) {
  const router = useRouter();

  // Initialize state directly from storage without cascading effect renders
  const [session, setSession] = React.useState<InterviewSession>(() => {
    const activeSession = getStoredSession(sessionId);
    if (activeSession) return activeSession;

    const setup = getStoredSetup() || SAMPLE_CANDIDATE;
    const newSession: InterviewSession = {
      id: sessionId,
      setup,
      status: "in-progress",
      startedAt: new Date().toISOString(),
      durationSeconds: 0,
      answers: [],
      currentQuestionIndex: 0,
    };
    saveStoredSession(newSession);
    return newSession;
  });

  const [currentQuestion, setCurrentQuestion] = React.useState<Question>(() => {
    const activeSession = getStoredSession(sessionId);
    const targetSetup = activeSession?.setup || getStoredSetup() || SAMPLE_CANDIDATE;
    const roleBank = QUESTION_BANK[targetSetup.targetRole] || QUESTION_BANK.fullstack;
    const answeredCount = activeSession?.answers.length || 0;
    return roleBank[answeredCount] || roleBank[0];
  });

  const [answerText, setAnswerText] = React.useState("");
  const [characterCount, setCharacterCount] = React.useState(0);
  const [wordCount, setWordCount] = React.useState(0);

  // UX & Flow State
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [submissionFeedback, setSubmissionFeedback] = React.useState<AnswerFeedback | null>(null);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [showHintModal, setShowHintModal] = React.useState(false);
  const [showEndConfirmModal, setShowEndConfirmModal] = React.useState(false);
  const [elapsedSeconds, setElapsedSeconds] = React.useState<number>(() => {
    return getStoredSession(sessionId)?.durationSeconds || 0;
  });

  // Elapsed Timer ticker
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

  // Handle Textarea change
  function handleAnswerChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const text = e.target.value;
    setAnswerText(text);
    setCharacterCount(text.length);
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    setWordCount(words);
    if (errorMsg) setErrorMsg(null);
  }

  // Format Elapsed Time (MM:SS)
  function formatTime(totalSeconds: number): string {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }

  // Submit Candidate Answer
  function handleSubmitAnswer() {
    if (!answerText.trim() || answerText.trim().length < 15) {
      setErrorMsg("Please provide a substantive answer (at least 15 characters) before submitting.");
      return;
    }

    if (!session || !currentQuestion) return;

    setIsSubmitting(true);

    // 1. Deterministic evaluation
    const feedback = evaluateAnswer(currentQuestion, answerText);

    // 2. Simulated AI analysis animation
    setTimeout(() => {
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

      // 3. After displaying feedback for a moment, advance to next adaptive question
      setTimeout(() => {
        const nextQuestion = getNextAdaptiveQuestion(currentQuestion, answerText, updatedSession);

        if (nextQuestion) {
          setCurrentQuestion(nextQuestion);
          setAnswerText("");
          setCharacterCount(0);
          setWordCount(0);
          setSubmissionFeedback(null);
          setIsSubmitting(false);
        } else {
          // Questions exhausted -> Complete interview
          handleCompleteInterview(updatedSession);
        }
      }, 2500);
    }, 1200);
  }

  // Complete Interview & Route to Report
  function handleCompleteInterview(currentSessionToFinalize?: InterviewSession) {
    const targetSession = currentSessionToFinalize || session;
    if (!targetSession) return;

    targetSession.status = "completed";
    targetSession.endedAt = new Date().toISOString();
    targetSession.durationSeconds = elapsedSeconds;
    saveStoredSession(targetSession);

    // Generate comprehensive evaluation report
    generateEvaluationReport(targetSession);

    router.push(`/report/${sessionId}`);
  }

  if (!session || !currentQuestion) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center text-slate-400">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-400 mb-3" />
        <p className="text-sm">Initializing adaptive interview environment...</p>
      </div>
    );
  }

  const roleName = ROLE_LABELS[session.setup.targetRole] || "Software Engineer";
  const questionNumber = session.answers.length + 1;
  const estimatedTotal = Math.max(3, session.answers.length + 1);
  const progressPercent = Math.min(100, Math.round((session.answers.length / estimatedTotal) * 100));

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto w-full py-2">
      {/* 1. Header Bar with Meta & Exit Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1e2d4f] pb-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-indigo-950 flex items-center justify-center border border-indigo-800/60 text-indigo-400">
            <BrainCircuit className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-white text-base">
                InterviewIQ Live Session
              </span>
              <Badge variant="indigo">{roleName}</Badge>
            </div>
            <p className="text-xs text-slate-400">
              Focus: {session.setup.interviewFocus.replace("-", " ").toUpperCase()} • Seniority: {session.setup.experienceLevel}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Timer pill */}
          <div className="flex items-center gap-1.5 rounded-lg border border-[#1e2d4f] bg-[#0c1222] px-3 py-1.5 text-xs text-slate-300 font-mono">
            <Clock className="h-3.5 w-3.5 text-indigo-400" />
            <span>{formatTime(elapsedSeconds)}</span>
          </div>

          {/* End Interview Action */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowEndConfirmModal(true)}
            className="text-xs text-rose-300 border-rose-900/60 hover:bg-rose-950/40 hover:text-white"
          >
            End Interview
          </Button>
        </div>
      </div>

      {/* 2. Progress Tracker Bar */}
      <div className="space-y-1.5">
        <div className="flex justify-between items-center text-xs text-slate-400">
          <span>Question {questionNumber} of ~{estimatedTotal}</span>
          <span className="font-mono text-indigo-400">{session.answers.length} answered</span>
        </div>
        <Progress value={progressPercent} indicatorColor="indigo" size="sm" />
      </div>

      {/* 3. Main Question & Answer Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Question Prompt & Answer Editor */}
        <div className="lg:col-span-2 space-y-5">
          {/* Question Card */}
          <Card className="border-indigo-900/40 bg-[#10182b]">
            <CardHeader className="pb-3 border-b border-[#1a2642]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="indigo">Adaptive Question #{questionNumber}</Badge>
                  <span className="text-xs font-semibold text-slate-300">
                    {currentQuestion.category}
                  </span>
                </div>
                <Badge variant="default" className="capitalize text-[11px]">
                  {currentQuestion.difficulty}
                </Badge>
              </div>
              <CardTitle className="text-base sm:text-lg text-white mt-2 leading-relaxed font-semibold">
                {currentQuestion.questionText}
              </CardTitle>
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
                className="text-xs gap-1.5 text-indigo-300 hover:text-white h-7 px-2"
              >
                <HelpCircle className="h-3.5 w-3.5" />
                View Hint
              </Button>
            </CardContent>
          </Card>

          {/* Answer Workspace Area */}
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
              disabled={isSubmitting}
              placeholder="Structure your answer clearly. Explain your architectural decision, edge cases, and rationale..."
              className="font-mono text-sm leading-relaxed p-4 bg-[#070b14] border-[#1e2d4f] focus-visible:border-indigo-500"
            />

            {errorMsg && (
              <p className="text-xs text-rose-400 flex items-center gap-1.5 mt-1">
                <AlertCircle className="h-3.5 w-3.5" />
                {errorMsg}
              </p>
            )}

            {/* Simulated Feedback Banner */}
            {submissionFeedback && (
              <div className="rounded-xl border border-indigo-800/70 bg-indigo-950/40 p-4 space-y-2 animate-in fade-in duration-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-indigo-300 text-xs font-semibold">
                    <Sparkles className="h-4 w-4 text-indigo-400" />
                    <span>Adaptive Feedback Calibrated</span>
                  </div>
                  <Badge variant="success">
                    Response Score: {submissionFeedback.score}%
                  </Badge>
                </div>
                <p className="text-xs text-slate-200 leading-relaxed">
                  {submissionFeedback.adaptiveNote}
                </p>
                <div className="flex items-center gap-2 text-[11px] text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>{submissionFeedback.strengths[0]}</span>
                </div>
                <p className="text-[11px] text-indigo-300 font-mono pt-1">
                  Branching to next adaptive inquiry...
                </p>
              </div>
            )}

            {/* Action Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
              <p className="text-[11px] text-slate-500">
                Responses are evaluated deterministically against role benchmarks.
              </p>
              <Button
                onClick={handleSubmitAnswer}
                disabled={isSubmitting || submissionFeedback !== null}
                isLoading={isSubmitting && !submissionFeedback}
                className="w-full sm:w-auto gap-2 px-6 h-10 shadow-md shadow-indigo-950/60"
              >
                <Send className="h-4 w-4" />
                Submit Answer
              </Button>
            </div>
          </div>
        </div>

        {/* Right Col: Live Session Telemetry & Prior Answers */}
        <div className="space-y-4">
          {/* Telemetry Card */}
          <Card className="bg-[#10182b]">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Session Telemetry</CardTitle>
              <CardDescription>
                Simulated adaptive interview orchestrator.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
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
                <span className="text-slate-200 font-mono">STAR / Keyword</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Questions Answered:</span>
                <span className="font-mono text-emerald-400 font-semibold">
                  {session.answers.length}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Answered Questions History Snippets */}
          <Card className="bg-[#10182b]">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase tracking-wider text-slate-400">
                Answered in this session ({session.answers.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              {session.answers.length === 0 ? (
                <p className="text-[11px] text-slate-500 italic py-2">
                  No submitted answers yet. Answer the current prompt above to begin recording.
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

      {/* 4. MODALS */}
      {/* Hint Modal */}
      <Modal
        isOpen={showHintModal}
        onClose={() => setShowHintModal(false)}
        title="Conceptual Hint"
        description="Guidance to help structure your technical answer without giving away the complete solution."
      >
        <div className="space-y-4 text-sm text-slate-200">
          <div className="p-4 rounded-lg border border-indigo-900/60 bg-indigo-950/30 text-indigo-200 leading-relaxed">
            <p className="font-medium mb-1">Key Considerations:</p>
            <p>{currentQuestion.hint}</p>
          </div>
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setShowHintModal(false)}>
              Got it
            </Button>
          </div>
        </div>
      </Modal>

      {/* End Interview Confirmation Modal */}
      <Modal
        isOpen={showEndConfirmModal}
        onClose={() => setShowEndConfirmModal(false)}
        title="Conclude Interview Session?"
        description="Are you ready to finalize your responses and generate your comprehensive evaluation report?"
      >
        <div className="space-y-4 text-xs text-slate-300">
          <p className="leading-relaxed">
            You have answered <span className="font-semibold text-white">{session.answers.length} question(s)</span> in this session.
            All submitted responses and demonstrated competencies will be synthesized into an evidence-backed intelligence report.
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
    </div>
  );
}
