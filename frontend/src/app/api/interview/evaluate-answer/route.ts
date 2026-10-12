import { NextRequest, NextResponse } from "next/server";
import { callGemini, parseGeminiJson } from "@/lib/gemini";
import { Question, AnswerFeedback } from "@/lib/types";
import { resolveRequestUser } from "@/lib/resolve-user";
import { evaluateAnswer } from "@/lib/interview-engine";

export async function POST(req: NextRequest) {
  try {
    void resolveRequestUser(req);
    const body = await req.json();
    const question: Question = body.question;
    const answerText: string = body.answerText;
    const candidateName: string = body.candidateName || "Candidate";
    const targetRole: string = body.targetRole || "Software Engineer";
    const experienceLevel: string = body.experienceLevel || "intermediate";

    if (!question || !answerText) {
      return NextResponse.json({ error: "Missing question or answer" }, { status: 400 });
    }

    const prompt = `You are an expert technical interviewer evaluating a ${experienceLevel}-level ${targetRole} candidate named "${candidateName}".

Question: ${question.questionText}
Category: ${question.category}
Difficulty: ${question.difficulty}
Expected Concepts: ${question.expectedKeywords.join(", ")}

Candidate's Answer:
"${answerText}"

Evaluate holistically: technical accuracy, clarity, coverage of key concepts, practical reasoning.

Respond ONLY with valid JSON (no markdown, no code fences):
{
  "score": <integer 0-100>,
  "strengths": ["<strength 1>", "<strength 2>"],
  "gaps": ["<gap 1>", "<gap 2>"],
  "adaptiveNote": "<1-2 sentence note about how the next question will adapt>"
}`;

    try {
      console.log(`[🤖 Gemini AI] Evaluating answer for "${candidateName}" on "${question.category}"...`);
      const raw = await callGemini(prompt);
      const feedback = parseGeminiJson<AnswerFeedback>(raw);
      feedback.score = Math.min(100, Math.max(0, Math.round(feedback.score)));
      console.log(`[🤖 Gemini AI] Evaluation complete! Score: ${feedback.score}/100 | Strengths: [${feedback.strengths.join(", ")}]`);
      return NextResponse.json({ feedback });
    } catch (aiErr) {
      console.warn("[🤖 Gemini AI] Live answer evaluation failed (quota/rate-limit/network). Using calibrated rubric evaluation:", aiErr);
      const feedback = evaluateAnswer(question, answerText);
      return NextResponse.json({ feedback, fallbackUsed: true });
    }
  } catch (err) {
    console.error("[evaluate-answer] Internal Route Error:", err);
    return NextResponse.json(
      { error: "Failed to evaluate answer." },
      { status: 500 }
    );
  }
}
