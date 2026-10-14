"use client";

import * as React from "react";
import Link from "next/link";
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
  ShieldAlert,
  ShieldCheck,
  ArrowRight,
  Camera,
  CameraOff,
  Users,
  UserX,
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
import { AiAssistantPanel } from "@/components/interview/ai-assistant-panel";
import { useAuth } from "@/lib/auth-context";
import { useCameraMonitor, CameraMonitorEvent } from "@/lib/use-camera-monitor";
import { CameraPreview } from "@/components/interview/camera-preview";
import { VoiceInputControl } from "@/components/interview/voice-input-control";
import { appendSpeechToAnswer } from "@/lib/speech-recognition";

interface InterviewWorkspaceProps {
  sessionId: string;
}

type AiStatus = "loading" | "ready" | "evaluating" | "branching" | "finishing" | "error";

function safeJson<T>(raw: unknown, fallback: T): T {
  if (Array.isArray(raw)) return raw as unknown as T;
  if (typeof raw !== "string") return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function InterviewWorkspace({ sessionId }: InterviewWorkspaceProps) {
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();

  const isDemo = sessionId === "demo-session" || sessionId.startsWith("demo-session-");

  // Core session state
  const [session, setSession] = React.useState<InterviewSession>(() => {
    const stored = getStoredSession(sessionId);
    if (stored) return stored;
    const setup = getStoredSetup(user?.id) || (isDemo ? SAMPLE_CANDIDATE : null);
    const newSession: InterviewSession = {
      id: sessionId,
      setup: setup || {
        candidateName: user?.name || "Candidate",
        targetRole: "fullstack",
        experienceLevel: "intermediate",
        interviewFocus: "mixed",
        interviewLength: 20,
        skills: [],
        createdAt: new Date().toISOString(),
        userId: user?.id,
      },
      status: "in-progress",
      startedAt: new Date().toISOString(),
      durationSeconds: 0,
      answers: [],
      currentQuestionIndex: 0,
      userId: user?.id,
    };
    if (setup) {
      saveStoredSession(newSession);
    }
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

  // Redirect unauthenticated candidates to login
  React.useEffect(() => {
    if (isMounted && !isAuthLoading && !user) {
      router.replace(`/login?redirect=/interview/${encodeURIComponent(sessionId)}`);
    }
  }, [isMounted, isAuthLoading, user, sessionId, router]);

  // Interview Integrity & Workspace Monitoring state
  const [integrityAcknowledged, setIntegrityAcknowledged] = React.useState<boolean>(() => {
    const stored = getStoredSession(sessionId);
    return Boolean(stored?.integrityPolicyAcknowledgedAt);
  });
  const [showPolicyModal, setShowPolicyModal] = React.useState<boolean>(false);
  const [violationCount, setViolationCount] = React.useState<number>(0);
  const [showWarningModal, setShowWarningModal] = React.useState<boolean>(false);
  const [isTerminatedByIntegrity, setIsTerminatedByIntegrity] = React.useState<boolean>(() => {
    const stored = getStoredSession(sessionId);
    return stored?.status === "terminated_integrity";
  });
  const [terminationReason, setTerminationReason] = React.useState<string | null>(null);
  const [isAcknowledgingPolicy, setIsAcknowledgingPolicy] = React.useState<boolean>(false);

  // Camera integrity warning modal state
  const [showCameraWarningModal, setShowCameraWarningModal] = React.useState<boolean>(false);
  const [cameraWarningType, setCameraWarningType] = React.useState<"multiple_faces" | "missing_face" | null>(null);

  // Focus-loss state machine refs (guards against duplicate triggers and race conditions)
  const isUnfocusedRef = React.useRef<boolean>(false);
  const lastViolationTimeRef = React.useRef<number>(0);

  // Camera integrity event handler — called by useCameraMonitor on confirmed violations
  const handleCameraIntegrityEvent = React.useCallback(
    async (event: CameraMonitorEvent) => {
      if (isTerminatedByIntegrity || session.status === "terminated_integrity" || session.status === "completed") {
        return;
      }

      if (event.type === "camera_detector_crashed") {
        console.warn("[CameraMonitor] Face detector became unavailable — monitoring paused, interview continues.");
        return;
      }
      if (event.type === "camera_detector_recovered") {
        console.info("[CameraMonitor] Face detector recovered.");
        return;
      }

      if (event.type === "camera_missing_face") {
        // Non-terminating warning: candidate left the frame
        setCameraWarningType("missing_face");
        setShowCameraWarningModal(true);

        // Record as a non-terminating integrity note on the server
        try {
          await fetch("/api/interview/integrity/event", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sessionId: session.id,
              eventType: "camera_missing_face",
              idempotencyKey: event.idempotencyKey,
              stageQuestionId: currentQuestion?.id,
              stageQuestionIndex: session.answers.length + 1,
              clientTimestamp: new Date().toISOString(),
              policyVersion: "v1.0",
              metadata: JSON.stringify({ gracePeriodSec: event.gracePeriodSec }),
            }),
          });
        } catch (err) {
          console.warn("[CameraMonitor] Failed to record missing-face event:", err);
        }
        return;
      }

      if (event.type === "camera_multiple_faces") {
        const isTerminatingEvent = Boolean(event.forceTerminate);

        if (isTerminatingEvent) {
          // Multiple faces persisted through the full verification window → terminate
          setCameraWarningType("multiple_faces");
          setShowCameraWarningModal(false);

          try {
            const res = await fetch("/api/interview/integrity/event", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                sessionId: session.id,
                eventType: "camera_multiple_faces",
                idempotencyKey: event.idempotencyKey,
                stageQuestionId: currentQuestion?.id,
                stageQuestionIndex: session.answers.length + 1,
                clientTimestamp: new Date().toISOString(),
                policyVersion: "v1.0",
                metadata: event.metadata,
                forceAction: "interview_terminated",
                terminationReason: "Multiple faces detected and persisted through the full verification window.",
              }),
            });
            if (res.ok) {
              const data = await res.json();
              if (data.status === "terminated_integrity" || data.action === "terminated") {
                setIsTerminatedByIntegrity(true);
                setTerminationReason("Multiple faces were detected in the camera view and persisted through the full verification window. The interview was automatically concluded per the integrity policy.");
                const terminatedSession = {
                  ...session,
                  status: "terminated_integrity" as const,
                  endedAt: new Date().toISOString(),
                  terminationReason: "Multiple faces detected — camera integrity policy triggered.",
                };
                setSession(terminatedSession);
                saveStoredSession(terminatedSession);
              }
            }
          } catch (err) {
            console.warn("[CameraMonitor] Failed to record multi-face termination event:", err);
          }
        } else {
          // First confirmed detection of multiple faces → show warning modal
          setCameraWarningType("multiple_faces");
          setShowCameraWarningModal(true);
        }
      }
    },
    [
      isTerminatedByIntegrity,
      session,
      currentQuestion?.id,
    ]
  );

  const cameraMonitor = useCameraMonitor({
    enabled: !isDemo && integrityAcknowledged && !isTerminatedByIntegrity,
    sessionId: session.id,
    integrityAcknowledged,
    isTerminated: isTerminatedByIntegrity || session.status === "terminated_integrity" || session.status === "completed",
    onIntegrityEvent: handleCameraIntegrityEvent,
  });

  const currentSetup = getStoredSession(sessionId)?.setup || session.setup || getStoredSetup(user?.id);
  const hasResume = Boolean(
    currentSetup?.resumeFileName ||
    currentSetup?.resumeText ||
    currentSetup?.isSampleResume ||
    session.setup?.resumeFileName ||
    session.setup?.resumeText ||
    session.setup?.isSampleResume
  );

  // Sync session state from storage and server
  React.useEffect(() => {
    const stored = getStoredSession(sessionId);
    if (stored) {
      setSession(stored);
      if (stored.status === "terminated_integrity") {
        setIsTerminatedByIntegrity(true);
      }
    }

    let cancelled = false;
    fetch(`/api/interview/session?id=${sessionId}`)
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          if (data.session && !cancelled) {
            if (data.session.status === "completed") {
              router.replace(`/report/${encodeURIComponent(sessionId)}`);
              return;
            }
            if (data.session.status === "terminated_integrity") {
              setIsTerminatedByIntegrity(true);
              setTerminationReason(
                data.session.terminationReason ||
                  "Exceeded allowable workspace focus-loss limit (2 of 2 incidents)"
              );
            }
            if (data.session.violationCount) {
              setViolationCount(data.session.violationCount);
            }
            if (data.session.integrityPolicyAcknowledgedAt) {
              setIntegrityAcknowledged(true);
              setShowPolicyModal(false);
            } else if (!isDemo && data.session.status !== "terminated_integrity") {
              setShowPolicyModal(true);
            }

            // Reconcile server-persisted answers so refresh restores answers from SQLite
            if (data.session.answers && data.session.answers.length > 0) {
              const dbAnswers: AnswerRecord[] = data.session.answers.map((a: any) => ({
                questionId: a.questionId,
                questionText: a.questionText,
                category: a.category,
                difficulty: a.difficulty,
                answerText: a.answerText,
                submittedAt: a.submittedAt,
                feedback: {
                  score: a.score || 0,
                  strengths: safeJson(a.strengths, []),
                  gaps: safeJson(a.gaps, []),
                  adaptiveNote: a.adaptiveNote || "",
                },
              }));

              setSession((prev) => {
                if (!prev) return prev;
                if (dbAnswers.length >= prev.answers.length) {
                  const updated = {
                    ...prev,
                    status: (data.session.status as any) || prev.status,
                    durationSeconds: data.session.durationSeconds || prev.durationSeconds,
                    answers: dbAnswers,
                    currentQuestionIndex: dbAnswers.length,
                  };
                  saveStoredSession(updated);
                  return updated;
                }
                return prev;
              });
            }
          }
        }
      })
      .catch((err) => console.warn("Could not sync server session status:", err));

    return () => {
      cancelled = true;
    };
  }, [sessionId, user, isDemo]);

  // Focus-Loss Monitoring & Transition State Machine
  React.useEffect(() => {
    if (
      !integrityAcknowledged ||
      isTerminatedByIntegrity ||
      session.status === "completed" ||
      session.status === "terminated_integrity"
    ) {
      return;
    }

    const reportFocusLossTransition = async (eventType: string) => {
      const now = Date.now();
      // Configurable cooldown: prevent duplicate signals within 1200ms
      if (now - lastViolationTimeRef.current < 1200) {
        return;
      }
      lastViolationTimeRef.current = now;

      const eventNonce = `evt_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

      try {
        const res = await fetch("/api/interview/integrity/event", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: session.id,
            eventType,
            idempotencyKey: eventNonce,
            stageQuestionId: currentQuestion?.id,
            stageQuestionIndex: session.answers.length + 1,
            clientTimestamp: new Date().toISOString(),
            policyVersion: "v1.0",
          }),
        });

        if (res.ok) {
          const data = await res.json();
          setViolationCount(data.violationCount);

          if (data.status === "terminated_integrity" || data.violationCount >= 2) {
            setIsTerminatedByIntegrity(true);
            setTerminationReason(
              "Exceeded allowable workspace focus-loss limit (2 of 2 incidents)"
            );
            setShowWarningModal(false);
            const terminatedSession = {
              ...session,
              status: "terminated_integrity" as const,
              endedAt: new Date().toISOString(),
              violationCount: data.violationCount,
              terminationReason: "Exceeded allowable workspace focus-loss limit (2 of 2 incidents)",
            };
            setSession(terminatedSession);
            saveStoredSession(terminatedSession);
          } else if (data.violationCount === 1) {
            setShowWarningModal(true);
          }
        }
      } catch (err) {
        console.warn("[InterviewIQ Integrity] Focus reporting error:", err);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        if (!isUnfocusedRef.current) {
          isUnfocusedRef.current = true;
          reportFocusLossTransition("visibility_hidden");
        }
      } else if (document.visibilityState === "visible") {
        isUnfocusedRef.current = false;
      }
    };

    const handleWindowBlur = () => {
      if (!isUnfocusedRef.current) {
        isUnfocusedRef.current = true;
        reportFocusLossTransition("window_blur");
      }
    };

    const handleWindowFocus = () => {
      isUnfocusedRef.current = false;
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleWindowBlur);
    window.addEventListener("focus", handleWindowFocus);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleWindowBlur);
      window.removeEventListener("focus", handleWindowFocus);
    };
  }, [
    integrityAcknowledged,
    isTerminatedByIntegrity,
    session.status,
    session.id,
    session.answers.length,
    currentQuestion?.id,
  ]);

  async function handleAcknowledgePolicy() {
    setIsAcknowledgingPolicy(true);
    try {
      const res = await fetch("/api/interview/integrity/ack-policy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: session.id, policyVersion: "v1.0" }),
      });
      if (res.ok) {
        setIntegrityAcknowledged(true);
        setShowPolicyModal(false);
        const updated = {
          ...session,
          integrityPolicyAcknowledgedAt: new Date().toISOString(),
          integrityPolicyVersion: "v1.0",
        };
        setSession(updated);
        saveStoredSession(updated);
      }
    } catch (err) {
      console.warn("Policy acknowledgement request failed:", err);
      setIntegrityAcknowledged(true);
      setShowPolicyModal(false);
    } finally {
      setIsAcknowledgingPolicy(false);
    }
  }

  // On mount: generate first AI question
  React.useEffect(() => {
    if (isAuthLoading) return;
    let cancelled = false;

    async function loadFirstQuestion() {
      const activeSession = getStoredSession(sessionId);
      const targetSetup = activeSession?.setup || getStoredSetup(user?.id) || session.setup || (isDemo ? SAMPLE_CANDIDATE : null);

      if (!targetSetup) {
        if (!cancelled) {
          setAiStatus("ready");
        }
        return;
      }

      const hasValidResume = Boolean(
        isDemo ||
        targetSetup.resumeFileName ||
        targetSetup.resumeText ||
        targetSetup.isSampleResume
      );

      // Do not generate questions if unauthenticated or missing resume
      if (!user || (!isDemo && !hasValidResume)) {
        if (!cancelled) {
          setAiStatus("ready");
        }
        return;
      }

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
        const q = await aiGenerateInitialQuestion(targetSetup, targetSetup.resumeText, sessionId);
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

    // Persist session to SQLite server-side while keeping localStorage fallback
    const currentActiveSession = getStoredSession(sessionId) || session;
    if (currentActiveSession) {
      fetch("/api/interview/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session: currentActiveSession }),
      }).catch((err) => console.warn("Failed to persist session to server:", err));
    }

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, isAuthLoading, user]);

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

  const handleVoiceTranscript = React.useCallback((transcript: string) => {
    setAnswerText((prev) => {
      const updated = appendSpeechToAnswer(prev, transcript);
      setCharacterCount(updated.length);
      setWordCount(updated.trim() ? updated.trim().split(/\s+/).length : 0);
      return updated;
    });
    setInputError(null);
  }, []);

  function formatTime(totalSeconds: number): string {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }

  async function handleSubmitAnswer(forceCurated = false) {
    if (isTerminatedByIntegrity || session?.status === "terminated_integrity") {
      setInputError("This interview session has been terminated. Further answer submissions are disabled.");
      return;
    }

    if (!answerText.trim() || answerText.trim().length < 15) {
      setInputError("Please provide a substantive answer (at least 15 characters).");
      return;
    }
    if (!session || !currentQuestion) return;

    setAiStatus("evaluating");
    setInputError(null);
    setEvalError(null);

    const useAi = isAiPowered && !forceCurated;
    const targetQuestions = session.setup.interviewLength === 10 ? 3 : session.setup.interviewLength === 20 ? 5 : 7;
    const isLastQuestion = session.answers.length + 1 >= targetQuestions;

    try {
      let feedback: AnswerFeedback;

      if (useAi) {
        feedback = await aiEvaluateAnswer(currentQuestion, answerText, session.setup, session.id);
      } else {
        await new Promise((r) => setTimeout(r, 400));
        feedback = mockEvaluate(currentQuestion, answerText);
      }

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

      // Persist answer turn to SQLite server-side
      fetch("/api/interview/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: session.id, answer: record }),
      })
        .then(async (res) => {
          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            if (errData.error?.includes("terminated")) {
              setIsTerminatedByIntegrity(true);
            }
          }
        })
        .catch((err) => console.warn("Failed to persist answer to server:", err));

      if (isLastQuestion) {
        handleCompleteInterview(updatedSession);
        return;
      }

      // Branch to next question seamlessly without showing premature feedback
      setAiStatus("branching");

      try {
        let nextQ: Question | null = null;

        if (useAi) {
          nextQ = await aiGetNextQuestion(
            session.setup,
            currentQuestion,
            answerText,
            feedback.score,
            updatedAnswers,
            session.id,
            feedback
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

    // Persist final session completion state to SQLite server-side
    try {
      await fetch("/api/interview/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session: targetSession }),
      });
    } catch (err) {
      console.warn("Failed to persist final session completion to server:", err);
    }

    try {
      let report: EvaluationReport;
      if (isAiPowered && targetSession.answers.length > 0) {
        report = await aiGenerateReport(targetSession);
      } else {
        // Use server route with forceDeterministic to guarantee persistence in SQLite
        const res = await fetch("/api/interview/generate-report", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session: targetSession, forceDeterministic: true }),
        });
        if (res.ok) {
          const data = await res.json();
          report = data.report;
        } else {
          const { generateEvaluationReport } = await import("@/lib/interview-engine");
          report = generateEvaluationReport(targetSession);
        }
      }
      if (user?.id) {
        report.userId = user.id;
      }
      if (user?.name) {
        report.candidateName = user.name;
      }
      if (!report.shortlistStatus) {
        report.shortlistStatus = "pending";
      }
      saveStoredReport(report);
    } catch (err) {
      console.error("Report generation error:", err);
      const { generateEvaluationReport } = await import("@/lib/interview-engine");
      const report = generateEvaluationReport(targetSession);
      if (user?.id) {
        report.userId = user.id;
      }
      if (user?.name) {
        report.candidateName = user.name;
      }
      if (!report.shortlistStatus) {
        report.shortlistStatus = "pending";
      }
      saveStoredReport(report);
    }

    router.push(`/report/${sessionId}`);
  }

  // ---- RENDER ----

  if (!isMounted || isAuthLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 text-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
        <p className="text-xs text-slate-400">Loading interview workspace...</p>
      </div>
    );
  }

  // Blocker 1: Must be authenticated
  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center max-w-md mx-auto py-20 text-center space-y-4">
        <div className="h-14 w-14 rounded-2xl bg-amber-950/40 border border-amber-800/60 flex items-center justify-center text-amber-400">
          <ShieldAlert className="h-7 w-7" />
        </div>
        <div className="space-y-1">
          <Badge variant="warning">Authentication Required</Badge>
          <h2 className="text-xl font-bold text-white mt-2">Sign In Required</h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            You must sign in or create an account to conduct a technical interview and generate adaptive questions.
          </p>
        </div>
        <div className="flex items-center gap-3 pt-2">
          <Link href={`/login?redirect=/interview/${encodeURIComponent(sessionId)}`}>
            <Button size="sm" className="bg-indigo-600 hover:bg-indigo-500">Sign In</Button>
          </Link>
          <Link href={`/signup?redirect=/interview/${encodeURIComponent(sessionId)}`}>
            <Button variant="outline" size="sm" className="border-slate-800">Create Account</Button>
          </Link>
        </div>
      </div>
    );
  }

  // Blocker 2: Must have an uploaded resume to generate tailored questions
  if (!isDemo && !hasResume) {
    return (
      <div className="flex flex-col items-center justify-center max-w-md mx-auto py-20 text-center space-y-4">
        <div className="h-14 w-14 rounded-2xl bg-indigo-950/40 border border-indigo-800/60 flex items-center justify-center text-indigo-400">
          <FileText className="h-7 w-7" />
        </div>
        <div className="space-y-1">
          <Badge variant="indigo">Resume Required</Badge>
          <h2 className="text-xl font-bold text-white mt-2">Resume Upload Required</h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            InterviewIQ questions are tailored directly to your engineering resume and background. Please configure your profile and upload your resume before beginning.
          </p>
        </div>
        <div className="flex items-center gap-3 pt-2">
          <Link href="/setup">
            <Button size="sm" className="bg-indigo-600 hover:bg-indigo-500">Upload Resume</Button>
          </Link>
          <Link href="/dashboard">
            <Button variant="outline" size="sm" className="border-slate-800">Return to Dashboard</Button>
          </Link>
        </div>
      </div>
    );
  }

  // Blocker 3: Session terminated due to focus-loss / integrity policy
  if (isTerminatedByIntegrity || session.status === "terminated_integrity") {
    return (
      <div className="flex flex-col items-center justify-center max-w-xl mx-auto py-16 px-4 text-center space-y-6">
        <div className="h-16 w-16 rounded-2xl bg-rose-950/40 border border-rose-800/60 flex items-center justify-center text-rose-400 shadow-lg">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <div className="space-y-2">
          <Badge variant="danger" className="text-xs px-3 py-1 font-semibold uppercase tracking-wider">
            Integrity Policy Triggered
          </Badge>
          <h2 className="text-2xl font-bold text-white tracking-tight mt-2">
            Interview Session Terminated
          </h2>
          <p className="text-sm text-slate-300 leading-relaxed max-w-lg mx-auto">
            This interview session was automatically concluded because the allowable workspace focus-loss limit was reached
            (2 of 2 incidents recorded).
          </p>
        </div>

        <div className="w-full text-left bg-[#0c1427]/80 border border-slate-800/80 rounded-2xl p-5 space-y-3.5 text-xs text-slate-300 shadow-md">
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              <strong className="text-white">Submitted Answers Preserved:</strong> All {session.answers.length} response(s) submitted prior to termination remain fully intact and saved in your evaluation record.
            </span>
          </div>
          <div className="flex items-start gap-2.5">
            <AlertCircle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            <span>
              <strong className="text-white">Objective Policy Signal:</strong> Focus loss represents a browser window or tab transition signal and is reviewed by recruiting teams in context. It is never labeled as proven cheating or misconduct.
            </span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full pt-2">
          <Button
            size="sm"
            onClick={() => handleCompleteInterview()}
            className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-500 font-semibold gap-2"
          >
            <span>View Evaluation Report</span>
            <ArrowRight className="h-4 w-4" />
          </Button>
          <Link href="/dashboard" className="w-full sm:w-auto">
            <Button variant="outline" size="sm" className="w-full border-slate-800 hover:bg-slate-800/60">
              Return to Dashboard
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  if (aiStatus === "loading" && !currentQuestion) {
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

  if (!currentQuestion) {
    return (
      <div className="flex flex-col items-center justify-center p-16 text-center gap-4">
        <div className="relative">
          <div className="h-16 w-16 rounded-2xl bg-indigo-950 border border-indigo-800/60 flex items-center justify-center">
            <BrainCircuit className="h-8 w-8 text-indigo-400" />
          </div>
          <div className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-indigo-500 animate-pulse" />
        </div>
        <div>
          <p className="text-white font-semibold">Generating your technical interview question...</p>
          <p className="text-sm text-slate-400 mt-1">Calibrating question against your resume with Gemini AI.</p>
        </div>
        <Loader2 className="h-5 w-5 animate-spin text-indigo-400" />
      </div>
    );
  }

  const roleName = ROLE_LABELS[session.setup.targetRole] || "Software Engineer";
  const questionNumber = session.answers.length + 1;
  const targetQuestions = session.setup.interviewLength === 10 ? 3 : session.setup.interviewLength === 20 ? 5 : 7;
  const estimatedTotal = targetQuestions;
  const isLastQuestion = session.answers.length + 1 >= targetQuestions;
  const progressPercent = Math.min(95, Math.round((session.answers.length / estimatedTotal) * 100));
  const isProcessing = aiStatus === "evaluating" || aiStatus === "branching";

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto w-full py-4">
      {/* AI Error notice */}
      {aiError && (
        <div className="flex items-center gap-2.5 text-xs text-amber-300 bg-amber-950/40 border border-amber-800/60 rounded-xl px-4 py-3 shadow-sm">
          <AlertCircle className="h-4 w-4 shrink-0 text-amber-400" />
          <span>{aiError}</span>
        </div>
      )}

      {/* 1. Header Bar */}
      <div className="p-4 sm:p-5 rounded-2xl border border-slate-800/80 bg-gradient-to-r from-[#0d162c]/90 via-[#0a1122]/90 to-[#0e172e]/90 shadow-md backdrop-blur-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-600/30 to-violet-600/30 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-sm">
            <BrainCircuit className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-white text-base tracking-tight">InterviewIQ Live Session</span>
              <Badge variant="indigo" className="text-xs py-0.5 px-2 font-medium">{roleName}</Badge>
              {isAiPowered ? (
                <Badge variant="success" className="gap-1 text-[10px] py-0.5 px-2">
                  <Zap className="h-2.5 w-2.5" />
                  AI Powered
                </Badge>
              ) : (
                <Badge variant="default" className="gap-1 text-[10px] py-0.5 px-2">
                  <Cpu className="h-2.5 w-2.5" />
                  Curated
                </Badge>
              )}
              {violationCount === 1 ? (
                <Badge variant="warning" className="gap-1 text-[10px] py-0.5 px-2">
                  <AlertCircle className="h-2.5 w-2.5 text-amber-400" />
                  Warning 1/2
                </Badge>
              ) : (
                <Badge variant="outline" className="gap-1 text-[10px] py-0.5 px-2 border-emerald-500/30 text-emerald-400 bg-emerald-950/20">
                  <ShieldCheck className="h-2.5 w-2.5 text-emerald-400" />
                  Focus Monitored
                </Badge>
              )}
              {/* Camera status badge */}
              {!isDemo && integrityAcknowledged && (
                cameraMonitor.cameraStatus === "active" ? (
                  cameraMonitor.detectionState === "multiple_faces" ? (
                    <Badge variant="danger" className="gap-1 text-[10px] py-0.5 px-2">
                      <Users className="h-2.5 w-2.5" />
                      Multiple Faces
                    </Badge>
                  ) : cameraMonitor.detectionState === "no_face" ? (
                    <Badge variant="warning" className="gap-1 text-[10px] py-0.5 px-2">
                      <UserX className="h-2.5 w-2.5" />
                      Face Missing
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="gap-1 text-[10px] py-0.5 px-2 border-emerald-500/30 text-emerald-400 bg-emerald-950/20">
                      <Camera className="h-2.5 w-2.5" />
                      Camera Active
                    </Badge>
                  )
                ) : cameraMonitor.cameraStatus === "denied" ? (
                  <Badge variant="warning" className="gap-1 text-[10px] py-0.5 px-2">
                    <CameraOff className="h-2.5 w-2.5" />
                    Camera Denied
                  </Badge>
                ) : null
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Focus: {session.setup.interviewFocus.replace("-", " ").toUpperCase()} • Seniority: {session.setup.experienceLevel}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {session.setup.resumeFileName && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowResumeModal(true)}
              className="gap-1.5 text-xs h-9 px-3 rounded-xl text-indigo-300 border-indigo-800/60 bg-indigo-950/40 hover:bg-indigo-900/50 hover:text-white"
              title="Inspect uploaded resume"
            >
              <FileText className="h-3.5 w-3.5" />
              <span className="hidden sm:inline truncate max-w-[140px]">{session.setup.resumeFileName}</span>
              <span className="sm:hidden">Resume</span>
            </Button>
          )}

          <div className="flex items-center gap-2 rounded-xl border border-slate-700/80 bg-slate-900/90 px-3.5 py-1.5 text-xs text-indigo-300 font-mono shadow-inner font-semibold">
            <Clock className="h-3.5 w-3.5 text-indigo-400" />
            <span>{formatTime(elapsedSeconds)}</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowEndConfirmModal(true)}
            disabled={isProcessing}
            className="text-xs h-9 px-3.5 rounded-xl text-rose-300 border-rose-900/60 hover:bg-rose-950/40 hover:text-white"
          >
            End Interview
          </Button>
        </div>
      </div>

      {/* 2. Progress Bar */}
      <div className="p-3.5 sm:px-4.5 rounded-xl border border-slate-800/80 bg-[#0c1427]/60 shadow-sm space-y-2">
        <div className="flex justify-between items-center text-xs text-slate-400">
          <span className="font-medium text-slate-300">Question {questionNumber} of ~{estimatedTotal}</span>
          <span className="font-mono text-indigo-400 font-semibold">{session.answers.length} answered</span>
        </div>
        <Progress value={progressPercent} indicatorColor="indigo" size="sm" />
      </div>

      {/* 3. Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Question + Answer */}
        <div className="lg:col-span-2 space-y-5">
          {/* Question Card */}
          <Card className="rounded-2xl border border-indigo-500/25 bg-gradient-to-br from-[#0e172f] via-[#0b1224] to-[#070c18] shadow-lg shadow-indigo-950/20 overflow-hidden">
            <CardHeader className="p-6 sm:p-7 border-b border-slate-800/80 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Badge variant="indigo" className="text-xs py-0.5 px-2">
                    {isAiPowered ? "AI Question" : "Adaptive Question"} #{questionNumber}
                  </Badge>
                  <span className="text-xs font-semibold text-slate-300">{currentQuestion.category}</span>
                </div>
                <Badge variant="default" className="capitalize text-xs py-0.5 px-2">
                  {currentQuestion.difficulty}
                </Badge>
              </div>
              <CardTitle className="text-lg sm:text-xl text-white mt-2 leading-relaxed font-semibold tracking-tight">
                {currentQuestion.questionText}
              </CardTitle>
              {currentQuestion.context && (
                <p className="text-xs sm:text-sm text-slate-300 mt-2 leading-relaxed italic border-l-2 border-indigo-500 pl-4 py-1.5 bg-indigo-950/25 rounded-r-xl">
                  {currentQuestion.context}
                </p>
              )}
            </CardHeader>
            <CardContent className="px-6 py-3.5 bg-slate-900/40 flex items-center justify-between text-xs text-slate-400">
              <span className="text-xs text-slate-400">
                Answer concisely with concrete technical terminology, trade-offs, and architecture decisions.
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowHintModal(true)}
                disabled={isProcessing}
                className="text-xs gap-1.5 text-indigo-300 hover:text-white h-7.5 px-2.5 rounded-lg"
              >
                <HelpCircle className="h-3.5 w-3.5" />
                View Hint
              </Button>
            </CardContent>
          </Card>

          {/* Answer Workspace */}
          <div className="space-y-3">
            <div className="flex justify-between items-center text-xs text-slate-400">
              <label htmlFor="interview-answer" className="font-semibold text-slate-300 text-xs uppercase tracking-wider">
                Your Technical Response:
              </label>
              <div className="flex items-center gap-3 font-mono text-xs">
                <span className="text-slate-300">{wordCount} words</span>
                <span className="text-slate-600">•</span>
                <span className="text-slate-400">{characterCount} chars</span>
              </div>
            </div>

            <Textarea
              id="interview-answer"
              rows={9}
              value={answerText}
              onChange={handleAnswerChange}
              disabled={isProcessing}
              placeholder="Structure your answer clearly. Explain your decision, trade-offs, edge cases, and rationale..."
              className="font-mono text-sm leading-relaxed p-4 sm:p-5 rounded-xl bg-[#070c18] border-slate-800 text-slate-100 placeholder:text-slate-500 focus-visible:border-indigo-500/80 focus-visible:ring-2 focus-visible:ring-indigo-500/20 shadow-inner min-h-[200px]"
            />

            {/* Voice Input Toolbar */}
            <VoiceInputControl
              onTranscriptReceived={handleVoiceTranscript}
              disabled={isProcessing || isTerminatedByIntegrity}
            />

            {inputError && (
              <p className="text-xs text-rose-400 flex items-center gap-1.5 mt-1">
                <AlertCircle className="h-3.5 w-3.5" />
                {inputError}
              </p>
            )}

            {/* AI Status Transition */}
            {(aiStatus === "evaluating" || aiStatus === "branching") && (
              <div className="rounded-2xl border border-indigo-800/40 bg-indigo-950/20 p-4.5 flex items-center gap-3.5 shadow-md animate-in fade-in duration-200">
                <Loader2 className="h-5 w-5 animate-spin text-indigo-400 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-indigo-300">
                    {aiStatus === "evaluating" ? "Recording your response..." : "Calibrating next adaptive question..."}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Questions adapt dynamically. Your complete performance scorecard and gaps analysis will be synthesized at the end.
                  </p>
                </div>
              </div>
            )}

            {/* Recoverable Evaluation Error with Retry */}
            {evalError && (
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-xl border border-amber-800/60 bg-amber-950/40 text-xs text-amber-200">
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
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-3">
              <p className="text-xs text-slate-500">
                {isAiPowered
                  ? "Answers are recorded and evaluated by Gemini AI for the final comprehensive scorecard."
                  : "Answers are recorded and evaluated against technical benchmarks for the final scorecard."}
              </p>
              <Button
                onClick={() => handleSubmitAnswer(false)}
                disabled={isProcessing}
                isLoading={isProcessing}
                className="w-full sm:w-auto gap-2.5 px-7 h-11 shadow-lg shadow-indigo-600/30 hover:shadow-indigo-500/40 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-semibold text-xs sm:text-sm rounded-xl transition-all"
              >
                {isLastQuestion ? (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Complete Interview & View Report
                  </>
                ) : (
                  <>
                    <ArrowRight className="h-4 w-4" />
                    Submit & Next Question
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Right: Camera Preview + Telemetry + History */}
        <div className="space-y-4">
          {/* Camera Preview Widget */}
          {!isDemo && integrityAcknowledged && (
            <CameraPreview
              stream={cameraMonitor.stream}
              cameraStatus={cameraMonitor.cameraStatus}
              detectionState={cameraMonitor.detectionState}
              isVerifyingMultiple={cameraMonitor.isVerifyingMultiple}
              multipleVerificationRemainingSec={cameraMonitor.multipleVerificationRemainingSec}
              isMissingFaceGraceActive={cameraMonitor.isMissingFaceGraceActive}
              missingFaceGraceRemainingSec={cameraMonitor.missingFaceGraceRemainingSec}
              detectorCrashed={cameraMonitor.detectorCrashed}
              errorMessage={cameraMonitor.errorMessage}
              onRetry={cameraMonitor.retryCamera}
            />
          )}
          <Card className="rounded-2xl border border-slate-800/80 bg-[#0c1427]/90 shadow-md overflow-hidden">
            <CardHeader className="p-5 border-b border-slate-800/80">
              <CardTitle className="text-sm font-bold">Session Telemetry</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                {isAiPowered ? "Real-time Gemini AI interview orchestrator." : "Curated adaptive interview orchestrator."}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 space-y-3.5 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-slate-800/80">
                <span className="text-slate-400">AI Engine:</span>
                {isAiPowered ? (
                  <Badge variant="success" className="gap-1 text-[11px] py-0.5 px-2">
                    <Zap className="h-2.5 w-2.5" />
                    Gemini 3.8
                  </Badge>
                ) : (
                  <Badge variant="default" className="text-[11px] py-0.5 px-2">Curated</Badge>
                )}
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-800/80">
                <span className="text-slate-400">Adaptive Branching:</span>
                <Badge variant="indigo" className="text-[11px] py-0.5 px-2">Active</Badge>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-800/80">
                <span className="text-slate-400">Candidate:</span>
                <span className="font-semibold text-white truncate max-w-[140px]">
                  {session.setup.candidateName}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-800/80">
                <span className="text-slate-400">Evaluation Rubric:</span>
                <span className="text-slate-200 font-mono">
                  {isAiPowered ? "Gemini AI" : "STAR / Keyword"}
                </span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-400">Questions Answered:</span>
                <span className="font-mono text-emerald-400 font-semibold">{session.answers.length}</span>
              </div>
            </CardContent>
          </Card>

          {/* History */}
          <Card className="rounded-2xl border border-slate-800/80 bg-[#0c1427]/90 shadow-md overflow-hidden">
            <CardHeader className="p-5 border-b border-slate-800/80">
              <CardTitle className="text-xs uppercase tracking-wider text-slate-400 font-bold">
                Answered in this session ({session.answers.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-2.5 text-xs">
              {session.answers.length === 0 ? (
                <p className="text-xs text-slate-500 italic py-3 text-center">
                  No submitted answers yet. Answer the prompt to begin.
                </p>
              ) : (
                session.answers.map((ans, idx) => (
                  <div
                    key={ans.questionId}
                    className="p-3 rounded-xl border border-slate-800/80 bg-[#090e1a]/80 space-y-1 hover:border-slate-700/80 transition-all"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-300 truncate max-w-[130px]">
                        Q{idx + 1}: {ans.category}
                      </span>
                      <Badge variant="outline" className="text-[10px] py-0.5 px-2 text-emerald-400 border-emerald-800/60 bg-emerald-950/30">
                        Answered
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-400 line-clamp-1 italic mt-1">
                      &quot;{ans.answerText}&quot;
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* AI Assistant — Interview Mode (locked) */}
          <AiAssistantPanel
            mode="interview"
            sessionId={sessionId}
            questionTopic={currentQuestion?.questionText}
            questionCategory={currentQuestion?.category}
            targetRole={session.setup.targetRole}
            experienceLevel={session.setup.experienceLevel}
            defaultCollapsed={false}
          />
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

      {/* Pre-Interview Integrity Policy Modal */}
      <Modal
        isOpen={showPolicyModal && !integrityAcknowledged}
        onClose={() => {}}
        title="Interview Workspace Integrity Policy"
        description="Please review and acknowledge the active workspace focus policy before beginning."
        className="max-w-xl"
      >
        <div className="space-y-4 text-xs text-slate-300">
          <div className="p-4 rounded-xl bg-indigo-950/40 border border-indigo-800/60 text-slate-300 space-y-2.5">
            <p className="font-semibold text-white text-sm flex items-center gap-2">
              <ShieldCheck className="h-4.5 w-4.5 text-indigo-400 shrink-0" />
              Focus & Integrity Guidelines (Policy v1.0)
            </p>
            <ul className="space-y-2 list-disc list-inside text-slate-300 leading-relaxed text-xs">
              <li>
                <strong className="text-white">Active page required:</strong> The interview page must remain visible and active during your technical session.
              </li>
              <li>
                <strong className="text-white">Warning policy:</strong> A first confirmed focus-loss transition issues <span className="text-amber-300 font-semibold">Warning 1 of 2</span>.
              </li>
              <li>
                <strong className="text-white">Session termination:</strong> A second confirmed focus-loss incident automatically concludes the interview.
              </li>
              <li>
                <strong className="text-white">Objective monitoring signal:</strong> Focus changes represent window/tab transition signals, not conclusive proof of cheating. Accidental focus changes can happen and are reviewed in context.
              </li>
              <li>
                <strong className="text-white">Camera monitoring:</strong> Your camera will activate to verify that only one candidate is present. Only face count (0 / 1 / multiple) is assessed — no biometric data, identity, or emotions are inferred and no video is recorded or transmitted.
              </li>
              <li>
                <strong className="text-white">Multiple faces:</strong> If multiple faces persist for 10 seconds, the interview will be automatically concluded per the integrity policy.
              </li>
              <li>
                <strong className="text-white">Missing face grace period:</strong> A 15-second grace period applies if no face is detected. Returning to the camera view clears the countdown.
              </li>
            </ul>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              size="sm"
              disabled={isAcknowledgingPolicy}
              onClick={handleAcknowledgePolicy}
              className="bg-indigo-600 hover:bg-indigo-500 font-semibold gap-2"
            >
              {isAcknowledgingPolicy ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Recording Consent...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Acknowledge & Begin Monitored Interview
                </>
              )}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Warning 1 of 2 Focus-Loss Modal */}
      <Modal
        isOpen={showWarningModal}
        onClose={() => setShowWarningModal(false)}
        title="Warning 1 of 2 — Workspace Focus Loss"
        description="Your interview page lost focus or visibility."
        className="max-w-md"
      >
        <div className="space-y-4 text-xs text-slate-300">
          <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-800/60 text-amber-200 space-y-2">
            <div className="flex items-center gap-2 font-bold text-amber-300 text-sm">
              <AlertCircle className="h-4.5 w-4.5 text-amber-400 shrink-0" />
              <span>Warning 1 of 2</span>
            </div>
            <p className="leading-relaxed">
              Your interview page lost focus. Please remain on the interview page.
              A second confirmed incident will end this interview.
            </p>
          </div>

          <p className="text-slate-400 text-[11px] leading-relaxed">
            Your current question, entered response text, and previous answers remain fully preserved.
          </p>

          <div className="flex justify-end pt-2">
            <Button
              size="sm"
              onClick={() => setShowWarningModal(false)}
              className="bg-amber-600 hover:bg-amber-500 text-white font-semibold"
            >
              I Understand & Resume Interview
            </Button>
          </div>
        </div>
      </Modal>

      {/* Camera Integrity Warning Modal (multiple faces / missing face) */}
      <Modal
        isOpen={showCameraWarningModal}
        onClose={() => setShowCameraWarningModal(false)}
        title={
          cameraWarningType === "multiple_faces"
            ? "Camera Alert — Multiple Faces Detected"
            : "Camera Alert — Face Not Detected"
        }
        description={
          cameraWarningType === "multiple_faces"
            ? "More than one person appears to be in view of your camera."
            : "Your face is no longer visible in the camera view."
        }
        className="max-w-md"
      >
        <div className="space-y-4 text-xs text-slate-300">
          {cameraWarningType === "multiple_faces" ? (
            <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-200 space-y-2">
              <div className="flex items-center gap-2 font-bold text-rose-300 text-sm">
                <Users className="h-4.5 w-4.5 text-rose-400 shrink-0" />
                <span>Multiple Faces Detected</span>
              </div>
              <p className="leading-relaxed">
                More than one face is visible in the camera feed. Only the candidate being
                interviewed may be present in frame. If this is not resolved, the interview
                will be automatically concluded when the verification window expires.
              </p>
              {cameraMonitor.isVerifyingMultiple && cameraMonitor.multipleVerificationRemainingSec > 0 && (
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-rose-300 font-semibold">Auto-terminate in:</span>
                  <span className="font-mono text-white text-lg font-bold">
                    {cameraMonitor.multipleVerificationRemainingSec}s
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-800/60 text-amber-200 space-y-2">
              <div className="flex items-center gap-2 font-bold text-amber-300 text-sm">
                <UserX className="h-4.5 w-4.5 text-amber-400 shrink-0" />
                <span>Face Not Visible</span>
              </div>
              <p className="leading-relaxed">
                Your face is no longer detectable in the camera view. Please ensure you are
                centered in front of your camera and the area is adequately lit.
              </p>
              {cameraMonitor.isMissingFaceGraceActive && cameraMonitor.missingFaceGraceRemainingSec > 0 && (
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-amber-300 font-semibold">Grace period remaining:</span>
                  <span className="font-mono text-white text-lg font-bold">
                    {cameraMonitor.missingFaceGraceRemainingSec}s
                  </span>
                </div>
              )}
            </div>
          )}

          <p className="text-slate-400 text-[11px] leading-relaxed">
            Your current question, entered response text, and all submitted answers remain fully preserved.
          </p>

          <div className="flex justify-end pt-2">
            <Button
              size="sm"
              onClick={() => setShowCameraWarningModal(false)}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold"
            >
              I Understand — I&apos;ll Correct This
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
