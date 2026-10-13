/**
 * Client-side helpers to call the secure server-side AI API routes.
 * All Gemini API calls are made server-side — API key is never exposed to the browser.
 */

import { CandidateSetup, Question, AnswerFeedback, AnswerRecord, InterviewSession, EvaluationReport } from "./types";

async function apiPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || `Request failed: ${res.status}`);
  }

  return res.json() as Promise<T>;
}

/**
 * Generate the first question for a new interview session.
 */
export async function aiGenerateInitialQuestion(
  setup: CandidateSetup,
  resumeText?: string,
  sessionId?: string
): Promise<Question> {
  const data = await apiPost<{ question: Question }>(
    "/api/interview/generate-question",
    { sessionId, setup, previousQuestions: [], resumeText: resumeText || "" }
  );
  return data.question;
}

/**
 * Evaluate a candidate's answer to a question.
 */
export async function aiEvaluateAnswer(
  question: Question,
  answerText: string,
  setup: CandidateSetup,
  sessionId?: string
): Promise<AnswerFeedback> {
  const data = await apiPost<{ feedback: AnswerFeedback }>(
    "/api/interview/evaluate-answer",
    {
      sessionId,
      question,
      answerText,
      candidateName: setup.candidateName,
      targetRole: setup.targetRole,
      experienceLevel: setup.experienceLevel,
    }
  );
  return data.feedback;
}

/**
 * Get the adaptive next question based on last answer and performance history.
 */
export async function aiGetNextQuestion(
  setup: CandidateSetup,
  lastQuestion: Question,
  lastAnswer: string,
  lastScore: number,
  answerHistory: AnswerRecord[],
  sessionId?: string,
  lastFeedback?: Partial<AnswerFeedback>
): Promise<Question | null> {
  try {
    const questionsAsked = answerHistory.map((a) => a.questionText);
    const data = await apiPost<{ question: Question }>(
      "/api/interview/next-question",
      {
        sessionId,
        setup,
        lastQuestion,
        lastAnswer,
        lastScore,
        lastFeedback,
        answerHistory,
        questionsAsked,
      }
    );
    return data.question;
  } catch {
    return null;
  }
}

/**
 * Generate the comprehensive AI evaluation report after the interview.
 */
export async function aiGenerateReport(session: InterviewSession): Promise<EvaluationReport> {
  const data = await apiPost<{ report: EvaluationReport }>(
    "/api/interview/generate-report",
    { session }
  );
  return data.report;
}
